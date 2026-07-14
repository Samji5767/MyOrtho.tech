# Changelog

All notable changes to MyOrtho.tech are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — Enterprise 2.0 Platform Evolution

**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Sprint:** Enterprise 2.0 Platform Evolution  
**Date:** 2026-07-14

### Added

- **Integration Provider Registry** — new `integration_providers` and `integration_health_logs` tables (migration 062); `IntegrationProvidersModule` with full CRUD + health-check logging; RBAC via `integrations:read` / `integrations:write` permissions; supports 9 provider types: DICOM/PACS, HL7/FHIR, PMS, scanner, printer, payment, email, SMS, calendar.
- **Background Job Queue** — new `background_jobs` table (migration 062); `BackgroundJobsModule` with enqueue, cancel, and stats endpoints; priority-based scheduling; DLQ via `dead_letter` status; accessible via `admin:settings` permission.
- **Clinical Knowledge Platform** — new `clinical_protocols`, `protocol_templates`, `material_libraries`, `appliance_libraries`, `manufacturing_profiles` tables (migration 062); `ClinicalKnowledgeModule` with protocol lifecycle (draft → active → archived), evidence-level classification (A/B/C), material library management, and manufacturing profile management; RBAC via `knowledge:read` / `knowledge:write` permissions.
- **MLOps / AI Governance** — new `ai_model_registry` and `ai_inference_audit` tables (migration 062); `MlopsModule` with model registration, status lifecycle (staged → active → deprecated/rolled_back), inference audit trail, and utilization stats; `disclaimer_shown` field enforces policy on every inference record; RBAC via `mlops:read` / `mlops:manage` permissions.
- **Enhanced Reports** — four new reporting endpoints: `GET /api/reports/clinical-kpis`, `GET /api/reports/manufacturing-kpis`, `GET /api/reports/ai-utilization`, `GET /api/reports/dashboard/html`; all existing report endpoints now enforce `analytics:read` / `manufacturing:read` / `mlops:read` RBAC.
- **New RBAC permissions**: `integrations:read`, `integrations:write`, `knowledge:read`, `knowledge:write`, `mlops:read`, `mlops:manage` — assigned to `super_admin`, `admin`, `lab_manager`, `clinical_director` as appropriate.
- **ADR-007**: Integration Provider Framework architectural decision record.
- **ADR-008**: Background Job Queue architectural decision record.
- **ADR-009**: Clinical Knowledge Platform architectural decision record.
- **ADR-010**: MLOps Governance architectural decision record.

### Fixed

- All 23 manufacturing module bugs (shipments, inventory, QA inspection, batch manufacturing, printer registration, mobile tab bar).
- `recipientAddress` type narrowed from `unknown` to `string | null` in shipments page.
- Lab inventory now rejects transactions that would produce negative stock.
- QA `reject()` now blocks simulated inspections consistently with `approve()`.
- Shipment `in_transit` transition now stamps `shipped_at` via `COALESCE`.
- `AddTrackingModal` validates non-empty courier + tracking number before submitting.
- Batch manufacturing `create` endpoint now gated by `manufacturing:write` permission.
- Batch `resinType` and `priority` fields propagated through service, controller, and interface.
- Mobile `TabBar` navigation now points to `/manufacturing` instead of `/patients`.
- Register Printer buttons disabled with admin-guidance tooltip.

---

## [Unreleased] — Final AI Segmentation Activation & Production Verification

**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Sprint:** Final AI Segmentation Activation & Production Verification  
**Date:** 2026-07-12

### Outcome: SCENARIO D

Neither AI engine cleared all activation gates. The correct production configuration is:
- `TGN_ENABLED=false` — P0 blocker: CC BY-NC-ND 4.0 training data prohibits commercial use
- `MESHSEGNET_ENABLED=false` — P1 blocker: checkpoint not obtained; redistribution rights unconfirmed
- `SEGMENTATION_PROVIDER=MANUAL` — all segmentation routes to `ManualReviewProvider`

### Added

- `AI_SEGMENTATION_ACTIVATION_REPORT.md`: Master activation report — 7 gate evaluations for both engines, SCENARIO D determination, path-to-activation requirements.
- `AI_RUNTIME_VERIFICATION.md`: Full runtime verification record — TypeScript (0 errors), Python (35 files OK), tests (25 pass), Docker Compose validation, port audit, security controls.
- `AI_CHECKPOINT_REGISTRY.md`: Authoritative checkpoint registry — no checkpoints registered; acquisition procedures; SHA-256 verification protocol; rotation and emergency procedures.
- `AI_LICENSE_ACTIVATION_STATUS.md`: License clearance status for TGN (P0 BLOCKED) and MeshSegNet (P1 BLOCKED); activation requirements; history log.
- `AI_SECURITY_VERIFICATION.md`: Security audit of all AI services — port exposure, hmac.compare_digest, path traversal, checkpoint integrity, SQL injection, frontend security, backend headers.
- `AI_PERFORMANCE_RESULTS.md`: Baseline performance data from literature; benchmarking infrastructure description; accuracy gate thresholds; measurement plan for when engines are activated.
- `AI_ROLLBACK_PLAN.md`: Rollback procedures for AI activation, code revert, checkpoint integrity failure, and service crash loop.

### Changed

- `docs/DEPLOYMENT_GUIDE.md`: Added SCENARIO D production status section; corrected `SEGMENTATION_PROVIDER` default from `AUTO` to `MANUAL` in env variable table; added TGN and MANUAL items to security checklist.
- `docs/CHECKPOINT_MANAGEMENT.md`: Updated checkpoint inventory table to reflect NOT OBTAINED / BLOCKED status; added reference to `AI_CHECKPOINT_REGISTRY.md`.
- `docs/SEGMENTATION_PROVIDER_GUIDE.md`: Added SCENARIO D note to quick reference; warning against enabling AI engines before blockers are resolved.
- `docs/KNOWN_LIMITATIONS.md`: Added TGN P0 and MeshSegNet P1 limitations; updated roadmap table.
- `docs/RELEASE_NOTES.md`: Added activation sprint entry.
- `.env.example`: Added full multi-engine segmentation section with TGN, MeshSegNet, and routing variables; included BLOCKED status warnings for both engines.

### Security / Compliance

- All 5 sign-off audit defects confirmed fixed (commit `b4151cf`): port exposure, SEGMENTATION_PROVIDER default, token comparison, path traversal, assert bypass.
- SCENARIO D minimizes AI attack surface: no AI inference engine ports are active.
- `SEGMENTATION_PROVIDER=MANUAL` default hard-coded in both `docker-compose.yml` and `ai-engine/src/routing.py`.

---

## [Unreleased] — Multi-Engine AI Segmentation Integration

**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Sprint:** Multi-Engine AI Segmentation Integration (Advanced Enterprise Edition)  
**Date:** 2026-07-11

### Added

#### MeshSegNet Microservice (`meshsegnet-service/`)
- `api/model.py`: STLocalGCN (local graph conv with edge features) and MeshSegNet (4 GCN layers + global FC branch + MLP classifier, 17-class output). Full FDI mapping tables for upper and lower jaw.
- `api/feature_extraction.py`: Computes 15 per-face features (centroid, normal, area, relative position, neighbour displacement, normal consistency, mean edge length) and K=6 face adjacency indices.
- `api/fdi_validator.py`: Clinical gate for FDI label validation — gingiva-only check, deciduous detection, cross-jaw check, confidence gate (0.70 threshold), quadrant continuity, partial segmentation minimum (4 teeth).
- `api/main.py`: FastAPI service on port 8002 with state machine (DISABLED/LOADING/READY/ERROR), SHA-256 checkpoint verification, background inference threads, and endpoints: `/health`, `/ready`, `/version`, `/metrics`, `/segment/by-path`, `/segment` (multipart upload), `/jobs/{job_id}`.
- `api/requirements.txt`: Service dependencies (FastAPI, PyTorch, trimesh, scipy, httpx).
- `api/Dockerfile`: Non-root build (uid 1001), healthcheck, checkpoint volume at `/ckpts`.
- `scripts/download_checkpoints.sh`: Checkpoint download with SHA-256 verification and size sanity check.

#### AI Engine Provider Layer (`ai-engine/src/`)
- `providers/base.py`: `SegmentationProvider` abstract base class, `SegmentationResult` and `ProviderHealth` dataclasses, clinical disclaimer constant.
- `providers/tgn_provider.py`: `TGNProvider` wrapping the existing TGN engine.
- `providers/meshsegnet_provider.py`: `MeshSegNetProvider` wrapping the new MeshSegNet engine.
- `providers/manual_provider.py`: `ManualReviewProvider` — always-healthy terminal fallback that never fabricates AI output.
- `providers/registry.py`: `ProviderRegistry` keyed by engine name.
- `meshsegnet_segmentation.py`: HTTP client for meshsegnet-service with submit-by-path, multipart upload, and long-poll job completion.
- `routing.py`: `SegmentationRouter` — env-var-driven route plan (AUTO/TGN/MESHSEGNET/MANUAL), ordered provider fallback chain, health-aware selection.
- `benchmarking.py`: `BenchmarkEngine` — parallel cross-engine comparison via `ThreadPoolExecutor`, Redis-backed result storage with in-memory fallback.
- `metrics.py`: `SegmentationMetrics` — thread-safe per-engine Prometheus counters and JSON metrics.

#### AI Engine New Endpoints (`ai-engine/src/main.py`)
- `GET /ai/engines` (JWT-authenticated): Provider list, route plan, and active provider.
- `POST /ai/engines/benchmark` (JWT-authenticated): Trigger parallel cross-engine benchmark.
- `GET /metrics` (unauthenticated): Prometheus text metrics.
- `GET /metrics/json` (JWT-authenticated): JSON metrics with average durations.
- Wired provider registry, router, and benchmark engine into startup and segmentation task flow.

#### Backend
- `segmentation.service.ts`: `CreateJobDto` extended with optional `provider` field (`TGN | MESHSEGNET | AUTO | MANUAL`). Provider stored in `result_summary` and forwarded to ai-engine on job processing.

#### Frontend
- `lib/api/segmentation.ts`: Added `SegmentationProvider` type, `EngineInfo` interface, `PROVIDER_LABELS`, extended `SegmentationJob` with `engine`, `engineVersion`, `requiresManualReview`, `disclaimer`. Extended `MODEL_LABELS` for TGN and MeshSegNet. Extended `submitSegmentationJob` DTO with `provider`.
- `components/SegmentationJobMonitor.tsx`: Provider selector in submit form; `EngineBadge` component (color-coded per engine); provider displayed on job cards. **Fixed polling bug**: was only re-polling on `pending | processing`, now covers all 6 in-progress states (`pending | queued | preprocessing | running | validating | processing`).

#### Infrastructure
- `docker-compose.meshsegnet.yml`: Docker Compose overlay for meshsegnet-service.
- `docker-compose.yml`: Added `TGN_ENABLED`, `MESHSEGNET_ENABLED`, `MESHSEGNET_API_URL`, `SEGMENTATION_PROVIDER`, `SEGMENTATION_PRIMARY` env vars to ai-engine service.

#### Documentation
- `docs/ADR/006-multi-engine-segmentation.md`: Architecture decision record for the provider abstraction layer and MeshSegNet selection.
- `docs/AI_PROVIDER_ARCHITECTURE.md`: Class reference, environment variables, API endpoints, clinical disclaimer.
- `docs/ENGINE_SELECTION_REPORT.md`: Candidate engine evaluation matrix, MeshSegNet technical details, FDI mapping, clinical validation requirements, required citation.
- `docs/ENGINE_COMPARISON.md`: TGN vs MeshSegNet side-by-side — architecture, input/output, FDI tables, validation logic, performance, license risks.
- `docs/DEPLOYMENT_GUIDE.md`: VPS deployment instructions for all three services (ai-engine, tgn-service, meshsegnet-service), environment variables, health checks, security checklist.
- `docs/CHECKPOINT_MANAGEMENT.md`: Checkpoint acquisition, verification (SHA-256), storage, rotation, emergency rollback, secrets management.
- `docs/MODEL_VERSIONING.md`: Version scheme, lifecycle states, promotion criteria, upgrade path.
- `docs/SEGMENTATION_PROVIDER_GUIDE.md`: Operations guide for provider switching, fallback behavior, benchmarking, metrics, alerting, and troubleshooting.

### Changed

- `ai-engine/src/main.py`: Segmentation task now routes through `SegmentationRouter` instead of calling TGN engine directly. `/ready` endpoint updated to show per-provider health.
- `frontend/src/components/SegmentationJobMonitor.tsx`: STATUS_LABEL for "running" changed from "Running TGN…" to "Running inference…" to be engine-agnostic.

### Security / Compliance

- All AI outputs carry `research_use: true` and the clinical disclaimer — enforced in code, not configurable.
- `ManualReviewProvider` never fabricates segmentation output.
- MeshSegNet feature-flagged off (`MESHSEGNET_ENABLED=false`) pending checkpoint acquisition and internal clinical validation.
- TGN feature-flagged off (`TGN_ENABLED=false`) pending commercial license resolution (CC BY-NC-ND P0 blocker).
- Internal API secret (`X-Internal-Token`) required for all ai-engine ↔ engine-service calls.
- MeshSegNet checkpoint SHA-256 verified at both download time and service startup.

### Not Changed

- Docker networking, nginx configuration, VPS deployment scripts — untouched per sprint constraints.
- Authentication architecture — untouched.
- TGN engine implementation — untouched (tgn_provider wraps without modification).
- Existing MONAI / CPU fallback behavior — untouched.
- All existing database migrations — no changes; backward-compatible.
