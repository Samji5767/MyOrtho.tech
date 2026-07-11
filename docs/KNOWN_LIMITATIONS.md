# Known Limitations — MyOrtho.tech v2.0.0-rc1

This document lists confirmed limitations as of the RC1 release. Each item includes its severity, impact on operations, and the recommended mitigation or path to resolution.

---

## Security

### No Refresh Token Rotation
**Severity:** High  
**File:** `backend/src/auth/auth.service.ts`

Access tokens have a 24-hour TTL with no rotation mechanism. A stolen token remains valid for its full window. Mitigated in RC1 by an `is_active` database check on every request (disabled accounts are rejected immediately) and a per-token blocklist for explicit logout. Token rotation is a pre-commercial-launch requirement.

### No PHI Re-Encryption Utility
**Severity:** High  
**File:** `backend/src/crypto/crypto.service.ts`

`ENCRYPTION_KEY` is used for AES-256-GCM encryption of all PHI fields. No utility ships to decrypt and re-encrypt data when the key is rotated. The key must be stored in a secrets manager and must not be rotated until a re-encryption migration script is built. Loss of the key means permanent, irrecoverable loss of all encrypted patient data.

### No CSRF Token Layer
**Severity:** Medium  

State-changing endpoints are not protected by CSRF tokens. The `mo_session` cookie is `SameSite=Strict; HttpOnly`, which prevents cross-site request forgery from third-party domains on modern browsers. Explicit CSRF tokens are recommended before commercial launch, particularly if embedding the application in an iframe or adding webhook callbacks.

---

## Integrations

### Scanner Vendor Connectors Are Stubs
**Severity:** Medium  
**Files:** `backend/src/scans/` vendor connector services

All five scanner integrations (iTero, Medit, 3Shape, Carestream, Planmeca) throw `NotImplementedException`. The `ScanProcessingCenter` UI correctly shows them as "Available / Connect" rather than active. Manual STL file upload (binary format) is the supported scan input path for RC1.

### Binary STL Only
**Severity:** Medium  
**File:** `frontend/src/lib/cad/DecimationWorker.ts`

The 3D viewer and mesh pipeline accept binary STL files only. PLY and OBJ formats fail with a descriptive error. ASCII STL is untested. All exports from major intraoral scanners default to binary STL, so this is not a workflow blocker in practice.

---

## AI / Clinical Engine

### AI Segmentation Requires a Trained Model Checkpoint
**Severity:** Medium  
**Env var:** `MODEL_CHECKPOINT`

Without a trained model file mounted at the path specified by `MODEL_CHECKPOINT`, segmentation jobs fail or fall back to a deterministic rule-based scaffold when `SEGMENTATION_FALLBACK_ENABLED=true`. Scaffold output is always flagged `clinician_review_required=true` and `ai_version=0.0.0-rule-based-scaffold`. Never enable the scaffold fallback in production — it does not produce clinically valid segmentations.

### Treatment Plan AI Not Integrated
**Severity:** Medium  
**Env var:** `TREATMENT_PLAN_AI_URL`

Automated stage generation returns HTTP 503 without a configured external AI endpoint. A deterministic scaffold is available via `TREATMENT_PLAN_STAGE_FALLBACK_ENABLED=true`, but all generated stages carry `_is_simulated=true` and are blocked from doctor approval and export. Manual stage entry via the treatment plan editor is fully functional.

---

## Operations

### No Built-in Key Rotation for ENCRYPTION_KEY
See the security section above. Treat `ENCRYPTION_KEY` as a long-lived, never-rotated secret until a migration utility is available.

### Single-Origin CORS
**Env var:** `CORS_ORIGIN`

Only one allowed origin may be configured via the environment variable. Multi-origin support requires editing `main.ts`. This is not a limitation for standard single-domain deployments.

### Billing in Mock Mode by Default
**Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

All billing endpoints respond with mock data when Stripe keys are absent. Acceptable for pilot deployments. Set Stripe keys before any paid subscriptions are processed.

### Export Manifests Produce `.html` Clinical Reports, Not PDF
**File:** `backend/src/manufacture-prep/manufacture-prep.service.ts`

The clinical reports controller renders HTML. No PDF generation library (Puppeteer, WeasyPrint, etc.) is installed. Export manifests reference `.html` files accordingly. Pilot clinics should be informed that clinical reports open in the browser rather than downloading as PDFs.

---

## Roadmap Items (Not Blocking Pilot)

| Item | Target |
|---|---|
| Refresh token rotation | Pre-GA |
| PHI key re-encryption utility | Pre-GA |
| CSRF token middleware | Pre-GA |
| Scanner integrations (iTero first) | Post-pilot |
| Real AI segmentation model | Post-pilot |
| Biomechanical treatment plan AI | Post-pilot |
| PDF report generation | Post-pilot |
| Multi-origin CORS support | Post-pilot |
| Stripe production billing | At commercial launch |
