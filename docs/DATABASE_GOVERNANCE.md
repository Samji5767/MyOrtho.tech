# Database Governance — MyOrtho.tech

_Grounded in source code as of v1.0.0-beta.1 (migrations 000–054). Last reviewed: 2026-07-08._

---

## 1. Migration Strategy

### Idempotency Contract

Every migration file in `database/migrations/` is written to be safe to re-apply. The patterns in use:

- `CREATE TABLE IF NOT EXISTS` — tables are only created when absent.
- `CREATE INDEX IF NOT EXISTS` — indexes are added without error if they already exist.
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — columns are added safely on re-run.
- `DO $$ BEGIN … IF NOT EXISTS … END $$` — anonymous PL/pgSQL blocks guard existence checks for extensions (`uuid-ossp`, `vector`), functions (`auth.uid()`), and conditional DDL for tables that may or may not exist on a given deployment target (e.g., `pgvector`-dependent tables in `033_copilot_rag.sql`).
- `INSERT … ON CONFLICT DO UPDATE / DO NOTHING` — seed data inserts are idempotent.

Migration `034_add_org_id_to_cases.sql` illustrates the backfill pattern: add the column nullable, run an `UPDATE` to backfill from the join chain, then conditionally add `NOT NULL` only if every row was backfilled — protecting against orphaned rows breaking the constraint enforcement.

### Sequential Numbering

Migrations are numbered `000` through `054` (55 files as of v1.0.0-beta.1). The naming convention is:

```
<NNN>_<descriptive_slug>.sql
```

Phase-based slugs (e.g., `003_phases_15d_15e_15f.sql`) were used in early development. Later migrations use semantic slugs (e.g., `034_add_org_id_to_cases.sql`, `054_copilot_confidence_explainability.sql`). New migrations must continue the numeric sequence without gaps.

### One Concern Per File

Each migration file addresses a single logical change. Examples:

- `037_sso_configurations.sql` — SSO provider table only
- `042_billing_saas.sql` — billing schema only
- `053_billing_unit_price.sql` — adds a single column to billing

The early phase migrations (`003_phases_15d_15e_15f.sql`, `015_phase_28_29_30.sql`) bundle multiple phases but this was an early-project exception; new migrations must not bundle unrelated schema changes.

### Column Addition vs. Removal Policy

**Never drop columns.** Column removal would break any running application version that still references the column. The safe sequence is:

1. Add a new column in one migration.
2. Migrate application code to use the new column.
3. Mark the old column as deprecated in a comment if it must remain.
4. Only drop the column in a future migration after confirming no application code references it, and only after a full deployment cycle with zero old-version instances running.

Renaming follows the same discipline: add the new column, backfill it, migrate code, then drop the old column in a later migration.

---

## 2. Schema Ownership

Each NestJS module owns the tables it creates and queries. The table below maps modules to their primary tables. "Primary" means the module holds the `CREATE TABLE` origin and all write paths. Read-access from other modules is permitted.

| Module (NestJS) | Primary Tables | Notes |
|---|---|---|
| `AuthModule` | `auth_users` | VPS auth, separate from Supabase `auth.users`. Profiles extend `profiles` table. |
| `ProfilesModule` / tenant layer | `profiles`, `organizations` | `organizations` is referenced broadly for multi-tenancy |
| `PatientsModule` | `patients` | Encrypted PII (first/last name, gender, clinical notes via `CryptoService`) |
| `CasesModule` | `cases`, `workflow_events` | `cases.organization_id` added in migration 034 |
| `ScansModule` | `scans`, `scan_processing_jobs`, `tooth_id_results` | File paths stored; binary on local volume |
| `SegmentationModule` | `segmentation_results` | Populated by AI engine callbacks |
| `TreatmentPlansModule` | `treatment_plans`, `aligner_stages`, `movement_prescriptions` | `ipr_details` stored as JSONB on `treatment_plans` |
| `IprPlannerModule` | `ipr_plan_items`, `ipr_enamel_estimates` | References `treatment_plans.id` |
| `AttachmentPlannerModule` | `treatment_attachments` | References `treatment_plans.id` |
| `TreatmentSimulationModule` | `treatment_simulations` | References `treatment_plans.id` |
| `StagesModule` / `AlignerGenerationModule` | `aligner_generation_plans`, `aligner_stages` | Stage data for printing |
| `ManufacturingModule` / `PrintFarmModule` | `printers`, `print_jobs` | 3D printing workflow |
| `CopilotModule` | `copilot_conversations`, `copilot_messages`, `copilot_suggestions`, `copilot_knowledge_chunks` | RAG knowledge base requires `pgvector` |
| `AuditModule` | `audit_events` | Append-only; never updated or deleted |
| `NotificationsModule` | `notifications` | `read_at` nullable; no hard delete |
| `BillingModule` | `billing_subscriptions`, `export_transactions`, `billing_unit_prices` | SaaS billing added in migration 042 |
| `SsoModule` | `sso_configurations` | SAML/OIDC provider config per org |
| `FeatureFlagsModule` | `feature_flags` | Per-flag rollout percentage and org allowlist |
| `ClinicalReportsModule` | `generated_reports` | Stores generated Markdown and JSON |
| `ClinicalAnalysisModule` | `clinical_analyses`, `treatment_goals` | Deep analysis results |

---

## 3. Index Recommendations

### Existing Coverage (from migrations 021, 030, 034, 052)

The following composite indexes are already in place and cover the most common access patterns:

- `idx_cases_org_status ON cases(organization_id, status)` — case list filtered by org and status
- `idx_cases_org_created ON cases(organization_id, created_at DESC)` — case list ordered by recency
- `idx_patients_org_name ON patients(organization_id, last_name, first_name)` — patient search
- `idx_audit_events_org_created ON audit_events(organization_id, created_at DESC)` — compliance log queries
- `idx_audit_events_resource ON audit_events(resource_type, resource_id)` — resource-specific audit trail
- `idx_notifications_user ON notifications(user_id, created_at DESC)`
- `idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL` — partial index for unread only
- `idx_copilot_messages_conv ON copilot_messages(conversation_id)` — message list per conversation
- `idx_treatment_plans_case_id ON treatment_plans(case_id)` — plan lookup per case

### Recommended Additional Indexes

The following indexes are not yet present and should be added in a new migration (`055_additional_governance_indexes.sql`).

#### notifications — org-scoped unread query

Admin dashboards and org-level notification pages filter by both `user_id` and `organization_id`. The current `idx_notifications_org` covers `(organization_id, created_at DESC)` but does not filter on read status.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_org_unread
  ON notifications (organization_id, user_id, created_at DESC)
  WHERE read_at IS NULL;
```

#### cases — dentist/assignee lookup

Case lists are often filtered by the assigned dentist (`assigned_to`). No index exists on this column.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_assigned_to
  ON cases (assigned_to, organization_id, status);
```

#### audit_events — actor-based queries

Compliance queries that look up actions by a specific actor (`actor_id`) already have `idx_audit_events_actor` from migration 030. Confirm it exists; if not:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_actor
  ON audit_events (actor_id, created_at DESC);
```

#### copilot_messages — ordered by recency within a conversation

`idx_copilot_messages_conv` covers `(conversation_id)` but conversation message views are always ordered by `created_at`. A covering index avoids a sort step:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_copilot_messages_conv_created
  ON copilot_messages (conversation_id, created_at ASC);
```

#### treatment_plans — latest plan per case

`generateTreatmentSummary` runs `ORDER BY created_at DESC LIMIT 1` on `treatment_plans WHERE case_id`. The existing `idx_treatment_plans_case_id` covers the filter; verify it is used for the sort. If the planner cannot use the index for the sort, add:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_treatment_plans_case_created
  ON treatment_plans (case_id, created_at DESC);
```

#### treatment_simulations — plan FK

`treatment_simulations` is queried by `plan_id` in report generation. No index was found in the reviewed migrations.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_treatment_simulations_plan_id
  ON treatment_simulations (plan_id);
```

#### treatment_attachments — plan FK

Same pattern as simulations:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_treatment_attachments_plan_id
  ON treatment_attachments (treatment_plan_id);
```

### Index Hygiene

Migration `052_fix_rls_and_indexes.sql` removed the following redundant single-column indexes that were superseded by composite ones:

- `idx_cases_patient` (replaced by `idx_cases_patient_id`)
- `idx_cases_status` (replaced by `idx_cases_org_status`)
- `idx_patients_org` and `idx_patients_org_id` (replaced by `idx_patients_organization_id`)

New migrations must not re-add single-column indexes that are already covered by the leading column of a composite index.

---

## 4. Data Retention Policy

### Audit Events (`audit_events`)

**Retain indefinitely.** Audit events are an append-only compliance record (who did what, when, from which IP). Clinical and enterprise regulations require full audit trails for the lifetime of patient records. No `DELETE` or `UPDATE` is permitted on this table. Row-level security enforces org-scoping but does not allow deletion.

Implementation: the `AuditService.log()` method performs `INSERT` only. No code path deletes from `audit_events`.

### Notifications (`notifications`)

**Soft-delete via `read_at`.** When a user reads a notification, `read_at` is set to the current timestamp. Notifications are never hard-deleted. The partial index `idx_notifications_unread WHERE read_at IS NULL` keeps unread queries fast as the table grows. Stale read notifications (e.g., older than 90 days) may be archived to a cold-storage table in a future migration if the table grows large. Until then, no purge policy exists.

### Session Tokens (JWT)

**Expire per JWT TTL.** JWTs are issued with a 24-hour expiry (`COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000`). Revoked JWTs are stored in Redis under a key with the same TTL — they are automatically evicted when they would have expired anyway. There is no persistent database table for sessions. If Redis is unavailable, the in-memory blacklist in `AuthService` does not survive process restarts; this is the primary reason Redis must be treated as a required dependency in production.

### Scan Files and Segmentation Meshes

**Long-term retention required.** Scan files (`file_path` in `scans`), segmented mesh files (`segmented_mesh_path` in `segmentation_results`), and aligner stage STL files (`maxillary_mesh_path`, `mandibular_mesh_path` in `aligner_stages`) are clinical records that must be retained for the duration of patient record retention requirements (typically 7–10 years depending on jurisdiction, or until the patient reaches adulthood plus the applicable minimum, whichever is longer).

Files must not be deleted when a case is soft-deleted or archived. The database `ON DELETE CASCADE` constraint on `scans(case_id)` would delete scan rows if a case is hard-deleted; **cases must never be hard-deleted in production**. The `case_status` enum includes `'canceled'` as the terminal non-active state; use status transitions, never `DELETE FROM cases`.

### Generated Reports (`generated_reports`)

**Retain for patient record lifetime.** Once generated, a clinical report (`treatment_summary`, `aligner_progress`, etc.) is a clinical document. `content_markdown` and `content_json` both must be preserved. No deletion path exists in the reviewed code.

### Copilot Conversation History (`copilot_conversations`, `copilot_messages`)

**Retain per organizational policy.** Copilot messages are clinical decision support records. Default: retain indefinitely. A future policy may allow archival of conversations older than 2 years, but this requires legal review before implementation.

---

## 5. Backup Requirements

### Daily Backup

A full logical backup (`pg_dump` or equivalent) must run daily and be stored in a separate geographic region from the primary database. Retention: keep 30 daily backups rolling.

For Supabase-hosted deployments, the project dashboard provides automated daily backups on Pro and Enterprise plans. Verify that the backup window does not coincide with peak clinical usage hours (typically 08:00–18:00 local clinic time).

For VPS deployments using the Docker Compose stack, add a scheduled job (cron or systemd timer) running:

```bash
pg_dump "$DATABASE_URL" | gzip > "/backups/myortho-$(date +%Y%m%d).sql.gz"
```

### Point-in-Time Recovery (PITR)

Clinical data requires point-in-time recovery capability. This means:

- PostgreSQL WAL archiving must be enabled (`wal_level = replica`, `archive_mode = on`).
- WAL segments must be shipped to a durable store (e.g., S3-compatible bucket) continuously.
- The recovery point objective (RPO) target is **≤ 5 minutes** of data loss.

For Supabase: PITR is available on Pro and Enterprise plans. Enable it for the production project and confirm the WAL retention window is at least 7 days.

For VPS: configure `pgBackRest` or `Barman` for WAL archiving. Verify that the WAL archive is accessible from a separate host (not the database container).

### Restoration Testing

**Test restoration quarterly.** The test procedure:

1. Spin up an isolated PostgreSQL instance.
2. Restore from the most recent nightly backup.
3. Run `SELECT COUNT(*) FROM cases`, `SELECT COUNT(*) FROM audit_events`, and `SELECT COUNT(*) FROM generated_reports` on both the restored instance and production. The counts must match within the backup lag window.
4. Verify that at least one case with its linked treatment plan, scan, and clinical report can be retrieved and rendered correctly.
5. Document the restoration duration. If restoration takes more than 4 hours, the backup format or host sizing must be reviewed.

### Schema Migration on Restore

After restoring from a backup, check which migration was the latest at backup time and run only the migrations that followed. The `schema_migrations` table (if present) or the sequential file numbering provides the reference point. Migrations 000–054 are all idempotent, so replaying already-applied migrations is safe but unnecessary.

---

## 6. Row-Level Security (RLS) Policy

All clinical tables have RLS enabled (set in `schema.sql` and enforced by migrations). The access function `app_current_org_id()` is the authoritative org-scoping mechanism as of migration `052` (which corrected earlier policies on `patients` and `cases` that incorrectly used `auth.uid()` via the `profiles` join — unsafe on VPS deployments where `profiles` may be unpopulated).

Any new table that holds PHI or org-scoped data must:

1. `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
2. `CREATE POLICY <name>_org_policy ON <name> USING (organization_id = app_current_org_id());`
3. Be added to the list in `migration 036` style helper or in its own migration file.

Never add a new table with PHI without a corresponding RLS policy. Security review (`docs/security-review.md`) should include RLS coverage checks for every new table.
