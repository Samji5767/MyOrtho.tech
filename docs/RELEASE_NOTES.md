# MyOrtho.tech v2.0.0-rc1 Release Notes

**Release date:** 2026-07-10
**Status:** Release Candidate 1 — not for production until GA sign-off

---

## Overview

v2.0.0-rc1 is the first release candidate of the MyOrtho.tech 2.0 platform. It delivers a complete rewrite of the clinical case lifecycle, a redesigned 3D CAD Studio, expanded AI capabilities, and a hardened security posture targeting HIPAA-prepared production readiness. This RC is intended for qualified internal testers and staging environments only.

---

## What's New

### Clinical Case Lifecycle
- Full case state machine: `draft → scan_review → clinical_review → planning → manufacturing → completed`
- Role-gated transitions enforce that only authorized roles (e.g. `orthodontist`, `clinical_director`) can advance or revert a case
- Case creation with attached patient in a single atomic operation (`POST /api/cases/with-new-patient`)

### PHI Encryption
- All patient PHI fields (name, date of birth, gender, clinical notes) encrypted at rest with AES-256-GCM
- ENCRYPTION_KEY required at startup; process exits with code 1 if absent to prevent unencrypted boots

### 3D CAD Studio
- In-browser STL viewer with real-time mesh decimation controls
- Tooth segmentation workflow for both scan-level and AI-center paths
- Binary STL upload only; PLY and OBJ are not supported in this release

### AI Segmentation
- AI segmentation enabled when MODEL_CHECKPOINT is set and the AI engine is reachable
- SEGMENTATION_FALLBACK_ENABLED=true activates a non-AI path for environments without a model checkpoint

### Treatment Plan Stage Generation
- Automated stage generation via TREATMENT_PLAN_AI_URL when configured
- Falls back to manual stage entry when TREATMENT_PLAN_STAGE_FALLBACK_ENABLED=true

### Clinical Reports
- Treatment summary, aligner progress report, and insurance pre-authorization report generation
- Download endpoint returns PDF-ready content per report type

### FHIR R4 Export
- Patient and case data exportable in FHIR R4 Bundle format

### Manufacturing & Print Job Management
- Export packages created from approved treatment plans
- Print job queue with status tracking for lab technicians and lab managers

### Feature Flags
- Runtime feature flag system with per-organization rollout control
- SHA-256 hash bucketing for deterministic rollout percentages

### SSO / MFA
- MFA and SAML 2.0 SSO configurable via admin portal (enterprise tier)

### AI Copilot
- RAG-powered assistant activated when COPILOT_LLM_PROVIDER and COPILOT_LLM_API_KEY are set
- Falls back to rule-based responses when LLM credentials are absent

### Observability
- Correlation ID middleware (x-correlation-id on every request)
- Typed error codes (ErrorCode enum, 30+ codes across 9 domains)
- Slow query logger warns when any database call exceeds 500 ms
- OpenTelemetry export via OTEL_EXPORTER_OTLP_ENDPOINT

---

## Bug Fixes & Improvements

- Config startup validation now exits early (code 1) when DATABASE_URL or JWT_SECRET is missing
- Migration 021 CREATE INDEX statements wrapped in existence guards — fresh installs no longer abort mid-migration
- In-memory token blacklist replaced with Redis-backed blocklist (in-memory fallback still present but logged as a warning)
- Feature flag rollout replaced with deterministic SHA-256 hash bucketing (was `Math.random`)
- PhotosController: RBAC added via PermissionsGuard; PHI photo access gated behind `cases:read` / `cases:write`
- Audit logging added for `photo.created` and `photo.deleted` events
- Event and comment IDs migrated to UUID (was narrow Math.random range with collision risk)
- Empty catch blocks in platform health service replaced with structured debug logging

---

## Known Limitations

- **Scanner integrations (iTero, Medit):** API surface exists but throws `NotImplementedException` — no live vendor API connected
- **STL streaming from export packages:** Not supported; no AI-generated geometry output yet
- **Segmentation code paths:** Two distinct systems (scan-level vs. AI center) share a job type but run different code paths — may produce inconsistent results
- **Upload progress:** Simulated; `fetch()` does not expose byte-level progress
- **Refresh token rotation:** Not implemented; sessions are 24 h JWTs revocable via Redis blocklist only
- **In-memory token blacklist:** Lost on restart — Redis is required in production
- **Mesh formats:** Binary STL only; PLY and OBJ are not supported

---

## Upgrade Notes

- Set ENCRYPTION_KEY before starting. Existing plaintext PHI records from pre-2.0 installs require a one-time re-encryption migration (see ADMIN_GUIDE.md — Rotating ENCRYPTION_KEY).
- JWT_SECRET rotation invalidates all active sessions. Plan a maintenance window.
- Run `docker compose pull && docker compose up -d --build` to update all service images.
- Migrations run automatically via the `migrate` service on startup and are idempotent.

---

## Next Steps — GA Readiness

- [ ] Scanner vendor API integration (iTero, Medit)
- [ ] Refresh token rotation
- [ ] Real byte-level upload progress via WebSocket or chunked upload
- [ ] Unified segmentation code path (consolidate scan-level and AI-center)
- [ ] PLY / OBJ mesh format support
- [ ] Password reset flow (email token, one-time use)
- [ ] Load and penetration testing sign-off
- [ ] Third-party HIPAA technical safeguards audit
