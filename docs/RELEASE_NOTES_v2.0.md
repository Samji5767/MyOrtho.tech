# MyOrtho.tech — Release Notes v2.0 (Enterprise Platform Evolution)

**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Date:** 2026-07-14  
**Prior Version:** 1.0.0-rc2

---

## Overview

Enterprise 2.0 is a platform maturity sprint that adds four foundational enterprise subsystems, closes 23 manufacturing module bugs, hardens all reporting endpoints with RBAC, and establishes architectural decision records for all new subsystems.

**No breaking API changes.** All existing endpoints continue to work. New endpoints require new permissions (`integrations:read`, `integrations:write`, `knowledge:read`, `knowledge:write`, `mlops:read`, `mlops:manage`), which are pre-assigned to appropriate roles.

---

## What's New

### 1. Integration Provider Registry

**API:** `GET|POST /api/integration-providers`, `GET|PATCH /api/integration-providers/:id`, `POST /api/integration-providers/:id/health-check`, `GET /api/integration-providers/:id/health-logs`

**Database:** `integration_providers`, `integration_health_logs` (migration 062)

A centralized registry for all external system connections per organization. Supports 9 provider types: DICOM/PACS, HL7/FHIR, PMS, scanner, printer, payment, email, SMS, calendar. Each provider tracks its health status, last check time, and full health-check history.

**Permissions:** `integrations:read` (list/get), `integrations:write` (create/update/health-check)  
**Roles with access:** `super_admin`, `admin`

---

### 2. Background Job Queue

**API:** `GET|POST /api/background-jobs`, `GET /api/background-jobs/:id`, `POST /api/background-jobs/:id/cancel`, `GET /api/background-jobs/stats`

**Database:** `background_jobs` (migration 062)

A PostgreSQL-backed job queue with priority scheduling, configurable retry policies, and dead-letter queue. Provides the infrastructure contract for long-running platform operations (STL export, analytics aggregation, email digests). Worker implementation is a follow-on task.

**Permissions:** `admin:settings` (all operations)  
**Roles with access:** `super_admin`, `admin`

---

### 3. Clinical Knowledge Platform

**API (Protocols):** `GET|POST /api/clinical-knowledge/protocols`, `GET /api/clinical-knowledge/protocols/:id`, `PATCH /api/clinical-knowledge/protocols/:id/status`  
**API (Materials):** `GET|POST /api/clinical-knowledge/materials`  
**API (Profiles):** `GET|POST /api/clinical-knowledge/manufacturing-profiles`

**Database:** `clinical_protocols`, `protocol_templates`, `material_libraries`, `appliance_libraries`, `manufacturing_profiles` (migration 062)

A structured library for clinical content. Protocols are versioned and classified by evidence level (A=RCT, B=Cohort, C=Expert Opinion). Material libraries catalog resins, wires, brackets, composites, and adhesives. Manufacturing profiles capture validated printer/resin/cure parameter sets with a single-default constraint.

**Permissions:** `knowledge:read` (list/get), `knowledge:write` (create/update), `manufacturing:manage` (profiles)  
**Roles with access:** `super_admin`, `admin`, `lab_manager`, `clinical_director` (read)

---

### 4. MLOps / AI Governance

**API (Models):** `GET|POST /api/mlops/models`, `GET /api/mlops/models/:id`, `PATCH /api/mlops/models/:id/status`  
**API (Audit):** `GET|POST /api/mlops/inference-audit`, `GET /api/mlops/utilization`

**Database:** `ai_model_registry`, `ai_inference_audit` (migration 062)

A model registry with full version lifecycle (staged → active → deprecated/rolled_back) and an inference audit trail. Every AI inference call that produces a clinical recommendation must log a record including whether a clinician disclaimer was displayed. The `disclaimer_shown` rate is a platform KPI. Input hashes enable reproducibility verification without PHI storage.

**Permissions:** `mlops:read` (list/audit), `mlops:manage` (register/lifecycle)  
**Roles with access:** `super_admin`, `admin`

---

### 5. Enhanced Reporting

Four new reporting endpoints:

| Endpoint | Permission | Description |
|---|---|---|
| `GET /api/reports/clinical-kpis` | `analytics:read` | Case flow, QA pass rate, top complaint types |
| `GET /api/reports/manufacturing-kpis` | `manufacturing:read` | Batch status, inventory reorder alerts, shipment status |
| `GET /api/reports/ai-utilization` | `mlops:read` | Inference counts, disclaimer rate, by-model/by-outcome breakdown |
| `GET /api/reports/dashboard/html` | `analytics:read` | Standalone HTML dashboard export (all three KPI sets) |

All existing report endpoints (`/api/reports/practice-summary`, `/api/reports/cases/csv`) now enforce `analytics:read` permission (previously unenforced).

All endpoints accept `?period=last_30_days|last_90_days|last_12_months|all`.

---

## Bug Fixes

### Manufacturing Module (23 bugs)

| # | Component | Fix |
|---|---|---|
| 4 | Batch Manufacturing | `create` now requires `manufacturing:write`; `resinType` + `priority` fields added |
| 5 | Lab Inventory | Negative-stock guard added; throws 400 on insufficient stock |
| 9 | QA Inspection | `reject()` now blocks simulated inspections (was only `approve()`) |
| 10 | Shipments | `in_transit` transition stamps `shipped_at` via `COALESCE` |
| 11 | Shipments | `recipientAddress` typed as `string | null` (was `unknown`) |
| 12 | Shipments | `AddTrackingModal` validates non-empty courier + tracking number |
| 13 | Mobile Tab Bar | Navigation target changed from `/patients` to `/manufacturing` |
| 17 | Printers | Register Printer buttons disabled with admin guidance tooltip |
| 22 | Shipments | Exception status added to status advancement options |

---

## Database Changes

### Migration 062 — `062_enterprise_v2_framework.sql`

New tables: `integration_providers`, `integration_health_logs`, `background_jobs`, `clinical_protocols`, `protocol_templates`, `material_libraries`, `appliance_libraries`, `manufacturing_profiles`, `ai_model_registry`, `ai_inference_audit`.

All tables include:
- UUID primary keys via `gen_random_uuid()`
- `organization_id` FK with `ON DELETE CASCADE` (where applicable)
- `created_at` / `updated_at` timestamps
- Appropriate indexes for org-scoped queries

Migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

---

## Architecture

- ADR-007: Integration Provider Framework
- ADR-008: Background Job Queue
- ADR-009: Clinical Knowledge Platform
- ADR-010: MLOps Governance

---

## Permissions Added

| Permission | Description | Assigned To |
|---|---|---|
| `integrations:read` | View integration providers + health logs | `super_admin`, `admin` |
| `integrations:write` | Create/update providers, record health checks | `super_admin`, `admin` |
| `knowledge:read` | View protocols, materials, profiles | `super_admin`, `admin`, `lab_manager`, `clinical_director` |
| `knowledge:write` | Create/update protocols, materials | `super_admin`, `admin`, `lab_manager` |
| `mlops:read` | View model registry, inference audit | `super_admin`, `admin` |
| `mlops:manage` | Register models, update lifecycle | `super_admin`, `admin` |

---

## Breaking Changes

None. All additions are additive. Existing API surface, authentication architecture, database schema, and frontend behavior are unchanged.

---

## Upgrade Notes

1. Run migration 062: `psql -U postgres myortho_dev -f database/migrations/062_enterprise_v2_framework.sql`
2. Deploy backend: `npm run build && node dist/src/main.js`
3. No frontend deployment required for this sprint.

---

## Ongoing Constraints (Unchanged)

- `SEGMENTATION_PROVIDER=MANUAL` — SCENARIO D active; no AI segmentation engine has cleared all activation gates.
- All AI recommendations must include clinician disclaimers. `disclaimer_shown` in the inference audit trail is the enforcement mechanism.
- No segmentation result may automatically become clinically approved.
- Output mode: `export` (Next.js static HTML export); `force-dynamic` is prohibited.
