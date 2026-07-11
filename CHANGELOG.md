# Changelog

All notable changes to MyOrtho.tech are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
