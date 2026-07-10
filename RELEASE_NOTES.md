# MyOrtho 2.0 — Release Notes (RC1)

**Release:** 1.0.0-rc1  
**Date:** 2026-07-10  
**Status:** Release Candidate — Pilot Clinic Deployment

---

## Summary

RC1 is the first release candidate targeting pilot-clinic deployment. It delivers end-to-end orthodontic case management: patient registration, CBCT scan upload, AI-assisted tooth segmentation, treatment planning, movement editing, clinical approval, and STL export for manufacturing.

---

## What's New in RC1

### Clinical

- Full RBAC across 10 roles (super_admin → lab_technician) with 16 scoped permissions
- AI tooth segmentation using 33-class MONAI UNet; runs on CPU or GPU
- Treatment plan staging with up to 60 aligner stages
- IPR and attachment scheduling per stage
- Clinical review and approval workflow with audit trail
- FHIR R4 export for Patient and CBCT Observation resources

### Security

- AES-256-GCM field-level encryption for all PHI (name, DOB, gender, clinical notes)
- JWT with JTI blacklist; HttpOnly cookies; HS256 algorithm-pinned
- Multi-tenant organization isolation enforced at every query
- Rate limiting: 100 req/min global; 5 req/min on auth endpoints
- Helmet CSP, HSTS (1-year, preload), CORS allowlist

### Manufacturing

- Export package workflow: Create → Validate (14-point QA) → Approve → Mark Exported
- Stage STL generation via AI engine (`stage_001.stl` … `stage_NNN.stl`)
- Aligner shell hollowing with configurable wall thickness
- Print job routing and production telemetry

### Infrastructure

- Docker Compose single-file deployment (backend + frontend + AI engine + PostgreSQL + Redis)
- Environment-variable-driven configuration; startup validation rejects missing secrets
- Structured NestJS Logger throughout; no stack traces in API responses

---

## Bugs Fixed in This Build

| Area | Fix |
|---|---|
| Scanner service | Removed sandbox credential bypass; now throws `NotFoundException` when no integration is configured |
| Auth service | `is_active` column added to `ensureSchema()` DDL; account-disable feature now works correctly |
| Auth service | `bootstrapAdmin()` refuses to create account if password is absent or shorter than 12 characters |
| Auth service | Hardcoded `'adminadmin'` fallback password eliminated |
| Startup validation | `MYORTHO_ADMIN_PASSWORD` minimum length raised from 1 to 12 characters |
| Export manifest | Stage file names corrected from `stage_NNN_upper/lower.stl` to `stage_NNN.stl` to match AI engine output |
| Onboarding | Fixed silent navigation on POST failure; user now sees error and can retry |
| CAD worker | `DecimationWorker` no longer returns fake 300 000-vertex data for PLY/OBJ; returns clear unsupported-format error |
| AI engine | `/ai/landmarks`, `/mesh/hollow`, `/ai/collision` offloaded to thread executor; no longer block the event loop |
| AI engine | `asyncio.get_event_loop()` replaced with `asyncio.get_running_loop()` (Python 3.10+ correctness) |
| AI engine | `_CHANNEL_TO_FDI.index(fdi)` O(n) list scan replaced with precomputed `_FDI_TO_CHANNEL` dict |

---

## Known Limitations

| Area | Limitation |
|---|---|
| STL unit detection | Assumes millimetres; no inches→mm conversion or rejection |
| STL orientation | No ICP or landmark-based arch registration; identity matrix stored |
| Mesh viewer | No watertightness or non-manifold warning in the 3D viewer |
| Export checksums | `checksum_sha256` stored as NULL; chain-of-custody integrity not verifiable |
| STL provenance | No patient/case metadata written into the 80-byte binary STL header |
| FHIR completeness | Patient + CBCT Observation only; Procedure, CarePlan, DocumentReference not yet implemented |
| CSRF | Cookie-based auth is CSRF-susceptible; CSRF middleware not yet deployed |
| Label engraving | OpenSCAD not installed; aligner label engraving step is skipped |
| PLY/OBJ decimation | CAD Studio's decimation worker supports STL only; PLY/OBJ returns an error |
| Multi-view WebGL | Four simultaneous WebGL contexts may cause context loss on low-end hardware |

---

## Upgrade Notes

- Set `MYORTHO_ADMIN_PASSWORD` to at least 12 characters before first boot.
- Run `ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;` if upgrading an existing database (the `ensureSchema()` DDL runs on startup but only creates the table if it does not yet exist).
- Export packages created before this build reference `stage_NNN_upper.stl` / `stage_NNN_lower.stl` filenames; newly generated manifests use `stage_NNN.stl`.
