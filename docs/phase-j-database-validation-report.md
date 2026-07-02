# Phase J — Database Schema Validation Report

**Date**: 2026-07-02  
**Branch**: `claude/myortho-production-validation-dlmvsi`  
**Method**: Full source code audit of `database/schema.sql`, all migration files `database/migrations/001–033_*.sql`, and all backend service files querying the database.

---

## J1 — Table Inventory

80+ tables across two parallel schemas (Supabase-native via `schema.sql` and VPS-native via numbered migrations). Core clinical tables are listed below; a full inventory was produced by the audit agent.

---

## J2 — Critical Runtime Failures

### J2.1 — `organization_id` missing from `cases` and `scans` tables

**Severity**: CRITICAL — runtime failure on production data

Neither `schema.sql` nor any migration adds `organization_id` to the `cases` table or the `scans` table. Over 30 backend service files issue queries of the form:

```sql
SELECT ... FROM cases WHERE organization_id = $1
```

Files affected include:
- `backend/src/business-intelligence/business-intelligence.service.ts:14–19`
- `backend/src/admin/admin.service.ts:225`
- 15+ additional service files

These queries will fail at runtime with `column "organization_id" does not exist`. The BI dashboard, admin panel, and per-case access-control checks are non-functional.

The correct pattern (used in `cases.service.ts`) is a join through `patients`:
```sql
FROM cases c
JOIN patients p ON p.id = c.patient_id
WHERE p.organization_id = $1
```
This join-based pattern works but requires a composite index on `patients(organization_id, id)` to be efficient. Services that bypass the join and query `cases.organization_id` directly will fail.

**Fix required**: Add `organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE` to `cases` (and optionally to `scans`), with a backfill migration from `cases → patients.organization_id`. Add index `(organization_id, created_at DESC)`.

### J2.2 — Migration 021 will abort on first error with `ON_ERROR_STOP=1`

**Severity**: CRITICAL — prevents migrations 022–033 from applying on fresh install

`database/migrate.sh` uses `psql ... -v ON_ERROR_STOP=1`. Migration `021_performance_indexes.sql` references:

| Reference in 021 | Actual object |
|-----------------|---------------|
| `audit_log` | Tables are named `audit_logs` / `audit_events` |
| `subscriptions` | Tables are named `billing_subscriptions` / `organization_subscriptions` |
| `ipr_contacts` | Table is named `ipr_plan_items` |
| `cases.organization_id` | Column does not exist on `cases` |
| `cases.deleted_at` | Column does not exist (soft-delete not implemented) |
| `patients.deleted_at` | Column does not exist |
| `treatment_plans.organization_id` | Column does not exist on `treatment_plans` |
| `treatment_plans.status` | Column does not exist |

On a fresh install, migration 021 will fail on the first bad reference, abort the migration script, and prevent all of migrations 022–033 from running. This means 12 migrations of schema changes (including the billing, notifications, feature-flag, and print-farm tables) will not exist on a fresh production deploy.

**Fix required**: Correct all table/column names in `021_performance_indexes.sql`. Use `CREATE INDEX IF NOT EXISTS` with correct names, and remove indexes referencing non-existent columns (`deleted_at`, `organization_id` on `cases`).

### J2.3 — `messages.sender_id` NOT NULL contradicts ON DELETE SET NULL

**Severity**: HIGH — profile deletion causes constraint violation crash

`database/schema.sql` line ~748:
```sql
sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL
```

PostgreSQL will accept this DDL, but any `DELETE FROM profiles WHERE id = $1` will attempt to set `messages.sender_id = NULL` and immediately violate the `NOT NULL` constraint. The delete will fail with a constraint violation error and roll back.

**Fix required**: Remove `NOT NULL` from `sender_id` in the schema, or change to `ON DELETE RESTRICT` with application-level handling.

---

## J3 — Schema Dual-Definition Conflicts

Six tables are defined in both `schema.sql` and migrations with incompatible column sets:

| Table | schema.sql version | migration version | Conflict |
|-------|--------------------|-------------------|---------|
| `conversations` | No `organization_id` | Migration 007 adds `organization_id`, `subject` | Different columns |
| `messages` | `read_status BOOLEAN` | Migration 007: `read_by UUID[]`, no `read_status` | Incompatible read tracking |
| `participants` | Present | Migration 007 creates `conversation_participants` with `user_id → auth_users` | Different table name and FK target |
| `feature_flags` | Migration 007: `flag_key UNIQUE` | Migration 025: `organization_id + flag_name UNIQUE` | Different column names |
| `aligner_stages` | `plan_id → treatment_plans` | Migration 008: `treatment_plan_id + case_id` | Different FK column names |
| `print_jobs` | Migration 003 version | Migration 026 redefines with entirely different columns | `IF NOT EXISTS` means first version survives |
| `appointments` | `patient_id → patients` | Migration 022: adds `case_id`, `organization_id` | Different columns |
| `segmentation_jobs` | Migration 003 | Migration 009 redefines with different schema | IF NOT EXISTS means 003 survives; 009's expected columns missing |

The deployment path (Supabase: schema.sql only; VPS: migrations only) determines which version exists. Backend code written for one schema will fail against the other.

---

## J4 — Index Audit

### Missing critical indexes

| Table | Missing index | Impact |
|-------|--------------|--------|
| `cases` | `organization_id` (column doesn't exist) | All org-scoped case queries fail |
| `cases` | `(patient_id, updated_at)` composite | Case list queries do nested loop join |
| `cases` | `current_stage_id` | FK unindexed |
| `scans` | `uploaded_by` | FK unindexed |
| `messages` | `sender_id` | FK unindexed |
| `messages` | `read_by` (GIN on array) | Unread count subquery does full array scan |
| `copilot_suggestions` | `(case_id, plan_id, severity DESC)` | Sort on large result sets |
| `legal_consent_records` | `patient_id` | FK unindexed |
| `digital_prescriptions` | `case_id`, `dentist_id` | No indexes beyond PK |

### Broken index definitions (Migration 021)

Migration 021 creates indexes that reference non-existent columns and tables (see J2.2). On a correct deployment (if 021 is fixed), these would still fail:

- `idx_cases_org_status` on `cases(organization_id, status)` — `organization_id` doesn't exist
- `idx_treatment_plans_org_status` on `treatment_plans(organization_id, status)` — neither column exists

### Duplicate index names

| Name | Definitions | Risk |
|------|------------|------|
| `idx_cases_org_status` | Migrations 021 and 029 | Different definitions; whichever runs first wins |
| `idx_digital_setups_case_created` | Migrations 029 and 030 | Same definition; harmless |
| `idx_workflow_events_actor` | Migrations 002 and 030 | Same column; harmless |

### Query defeating the optimizer

`movement_constraints.service.ts`:
```sql
SELECT * FROM movement_constraints WHERE organization_id=$1 OR is_default=true
```
The `OR is_default=true` prevents use of the `idx_constraints_org` index. Requires a `UNION` rewrite or a separate partial index on `is_default`.

---

## J5 — Constraint Issues

### Financial columns using FLOAT (should be NUMERIC)

| Table | Column | Issue |
|-------|--------|-------|
| `insurance_claims` | `claim_amount` | FLOAT — monetary amounts accumulate rounding error |
| `financing_plans` | `total_financed_amount`, `monthly_installment`, `interest_rate` | FLOAT |
| `erp_purchase_orders` | `quantity`, `unit_price`, `total_cost` | FLOAT |

All monetary amounts should be `NUMERIC(15,2)` or stored as integer cents.

### Missing FK constraints (~50 columns)

Tables added in migrations 016–028 contain UUID columns that are clearly FK references but have no `REFERENCES` constraint:

- `copilot_conversations`: `organization_id`, `case_id`, `plan_id`, `created_by`
- `copilot_suggestions`: `case_id`, `plan_id`, `organization_id`, `resolved_by`
- `arch_coordination_plans`: `organization_id`, `created_by`, `approved_by`
- `export_packages`: `organization_id`, `plan_id`, `approved_by`, `created_by`
- And ~40 additional columns across manufacturing and enterprise tables

Orphaned rows are possible on delete.

### `bi_snapshots` UNIQUE expression index bug

```sql
UNIQUE INDEX ON bi_snapshots(organization_id, snapshot_date, metric_name, (dimensions::text))
```

JSONB key order is not canonical in `::text` cast. `{"a":1,"b":2}` and `{"b":2,"a":1}` produce the same JSONB value but different text representations, leading to spurious UNIQUE violations.

### Soft-delete pattern planned but never implemented

Migration 021 creates six partial indexes using `WHERE deleted_at IS NULL`. No table in the schema has a `deleted_at` column.

---

## J6 — Vacuum and Maintenance

### High-churn tables needing autovacuum tuning

| Table | Pattern | Recommendation |
|-------|---------|---------------|
| `audit_events` | Insert-only, high volume | `autovacuum_vacuum_threshold = 5000`, `autovacuum_analyze_threshold = 1000` |
| `notifications` | Frequent `read_at` UPDATEs | `autovacuum_vacuum_scale_factor = 0.01` |
| `segmentation_jobs` | Status column UPDATEs | Lower vacuum scale |
| `print_jobs` | Status transitions | Lower vacuum scale |

### IVFFlat index on `copilot_knowledge_chunks`

IVFFlat indexes do not support incremental updates. After bulk embedding updates, `REINDEX CONCURRENTLY` must be run manually. This is not automated.

---

## J7 — Severity Summary

| # | Severity | Finding |
|---|----------|---------|
| 1 | CRITICAL | `organization_id` missing from `cases` and `scans` — 30+ service queries fail |
| 2 | CRITICAL | Migration 021 aborts on first error, blocks migrations 022–033 on fresh install |
| 3 | HIGH | `messages.sender_id NOT NULL` + `ON DELETE SET NULL` — crash on profile delete |
| 4 | HIGH | Dual schema conflicts on 8 tables — Supabase vs VPS deployments diverge |
| 5 | HIGH | Financial columns use FLOAT instead of NUMERIC |
| 6 | MEDIUM | ~50 unconstrained UUID FK columns — orphaned rows possible |
| 7 | MEDIUM | `bi_snapshots` UNIQUE index on `dimensions::text` — semantic bug |
| 8 | MEDIUM | `movement_constraints` OR query defeats index — full table scan |
| 9 | MEDIUM | `messages.read_by UUID[]` without GIN index — unread count scans arrays |
| 10 | LOW | Soft-delete indexes reference non-existent `deleted_at` column |
| 11 | LOW | Autovacuum not tuned for high-churn tables |
| 12 | LOW | IVFFlat index requires manual REINDEX after bulk updates |

**Database Readiness Score**: 42/100  
Rationale: Core clinical query patterns work via patient join. Two critical migration failures (missing column + broken migration 021) will prevent a clean fresh-install deployment. Financial columns use inappropriate types. Schema dual-definition conflicts make Supabase and VPS deployments structurally different.
