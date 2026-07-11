# TGN Production Activation & Validation Sprint — Engineering Report

**Report date:** 2026-07-11  
**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Commit:** `a2f8c68`  
**Author:** AI-assisted engineering (samjith.ambadi@outlook.com)

---

## 1. Executive Summary

This report covers the 14-phase TGN Production Activation & Validation Sprint for the MyOrtho.tech platform. The sprint hardened the ToothGroupNetwork (TGN) microservice for production readiness, enforced a research-use-only posture for unvalidated AI outputs, and established the governance framework required before clinical activation.

**Key outcomes:**

| Area | Before Sprint | After Sprint |
|------|--------------|-------------|
| Auth on inference endpoints | Fail-open (token bypass when unset) | Fail-closed (HTTP 503 when unset) |
| TGN default activation | On when `TGN_API_URL` set | Off by default; requires `TGN_ENABLED=true` |
| Port 8001 exposure | Published to host (`ports:`) | Internal-only (`expose:`) |
| Research-use notices | Absent | Mandatory on all job outputs and frontend |
| Checkpoint integrity | Unchecked | SHA-256 governance with fail-closed option |
| Path traversal protection | None | Allowlist whitelist (`_assert_safe_path`) |
| FDI validation | Missing edge cases | Gingiva-only + partial-segmentation detection |
| Preprocessing tests | 16/17 pass (1 crash) | 16/17 pass (1 correctly skipped) |
| TypeScript (backend) | 0 errors | 0 errors |
| TypeScript (frontend) | 2 type errors | 0 errors |

**Soft-launch readiness score: 6/10** (unchanged — clinical validation data still required)  
**Commercial-launch readiness score: 3/10** (unchanged — regulatory clearance still required)

**GO/NO-GO: NO-GO for production clinical use. CONDITIONAL GO for soft-launch research deployment pending checklist in Section 19.**

---

## 2. PR #3 Status

**PR:** https://github.com/Samji5767/MyOrtho.tech/pull/3  
**Title:** feat: RC1 production hardening + ToothGroupNetwork AI segmentation integration  
**State:** Open (Draft)  
**Head SHA:** `a2f8c68` — confirmed pushed and reflected in PR  
**Base:** `main` (`2be6951`)  

The PR must remain **Draft** until the clinical validation report (Section 15) is complete and the final validation gate (Section 19) is passed. Do not merge to `main` without sign-off from a licensed orthodontist and completion of ≥ 100 annotated scan comparisons.

---

## 3. Files Changed This Sprint

| File | Type | Change Summary |
|------|------|---------------|
| `tgn-service/api/main.py` | Modified | Full security rewrite — auth, feature flag, checksum governance, path safety, request IDs, research-use notices, ModelState enum |
| `tgn-service/api/fdi_validator.py` | Modified | Gingiva-only and partial-segmentation detection added |
| `tgn-service/scripts/download_checkpoints.sh` | Modified | SHA-256 computation after download; sidecar file + env var output |
| `tgn-service/preprocessing/test_stl_to_obj.py` | Modified | `test_watertight_flag` marked `skipif(scipy absent)` |
| `docker-compose.tgn.yml` | Modified | `expose:` replaces `ports:`; `INTERNAL_API_SECRET` required; log rotation |
| `ai-engine/src/main.py` | Modified | TGN init gated on `TGN_ENABLED`; job payload extended with research fields |
| `frontend/src/lib/api/segmentation.ts` | Modified | `JobStatus` extended with `preprocessing`, `validating`, `manual_review_required`, `unavailable` |
| `frontend/src/components/SegmentationJobMonitor.tsx` | Modified | `ResearchUseBanner` + `ManualReviewBanner` components; full status label/tone maps |
| `.gitignore` | Modified | `ckpts/`, `*.h5`, `tgn_uploads/`, `checksums.sha256` excluded from VCS |

**Cumulative diff:** 647 insertions, 176 deletions across 9 files.

---

## 4. Checkpoint Governance Result

### Implementation

`tgn-service/scripts/download_checkpoints.sh` now:
1. Downloads `tgnet_fps.h5` and `tgnet_bdl.h5` from Google Drive
2. Computes SHA-256 of each file using `sha256sum` (Linux) or `shasum -a 256` (macOS)
3. Writes `$CKPTS_DIR/checksums.sha256` sidecar file
4. Prints the values that must be set in `.env`:
   ```
   CHECKPOINT_SHA256_FPS=<hash>
   CHECKPOINT_SHA256_BDL=<hash>
   REQUIRE_CHECKSUM=true
   TGN_ENABLED=true
   ```

`tgn-service/api/main.py` — `_verify_checkpoint()`:
- When `REQUIRE_CHECKSUM=true`, reads `CHECKPOINT_SHA256_FPS` / `CHECKPOINT_SHA256_BDL` from env
- Computes live SHA-256 of the checkpoint file
- Compares with `hmac.compare_digest()` (timing-safe)
- On mismatch: raises `RuntimeError`; service enters `ModelState.failed` and refuses inference
- When `REQUIRE_CHECKSUM=false` (default): logs a warning but does not block startup

### Status

| Checkpoint | Sidecar | Service enforcement |
|-----------|---------|-------------------|
| `tgnet_fps.h5` | Written by download script | Checked on startup when `REQUIRE_CHECKSUM=true` |
| `tgnet_bdl.h5` | Written by download script | Checked on startup when `REQUIRE_CHECKSUM=true` |

**Result: IMPLEMENTED.** Operator must run `download_checkpoints.sh`, set the hash env vars, and set `REQUIRE_CHECKSUM=true` before production activation. Without this, the service starts in degraded mode (logged warning).

**Blocker:** Actual checkpoint files (`*.h5`) are not available in this environment — binary model files are excluded from the repository (`.gitignore`). The VPS operator must download them separately. See Section 20.

---

## 5. Service Startup Result

### ModelState Lifecycle

```
UNAVAILABLE → LOADING → READY
                    ↘ FAILED
```

- `UNAVAILABLE`: initial state before startup probe
- `LOADING`: entered when `_load_models()` is invoked in the startup event
- `READY`: both checkpoints loaded, model initialized
- `FAILED`: checkpoint verification failed, load error, or `TGN_ENABLED=false`

### Startup Gate

`/segment` and `/segment/by-path` return HTTP 503 in these conditions:

| Condition | HTTP | Body |
|-----------|------|------|
| `TGN_ENABLED=false` | 503 | `{"detail": "TGN is disabled..."}` |
| `INTERNAL_API_SECRET` unset | 503 | `{"detail": "Service not configured..."}` |
| `ModelState != READY` | 503 | `{"detail": "Model not ready (state=...)"}` |

### Health / Ready Endpoints

```
GET /health   → {"status": "ok", "tgn_enabled": bool, "model_state": str}
GET /ready    → {"ready": bool, "model_state": str, "model_name": str, "version": str}
GET /metrics  → {"jobs_queued": int, "jobs_completed": int, "jobs_failed": int, ...}
```

**Result: IMPLEMENTED.** Service startup is fully observable. All inference is blocked until explicit operator action (`TGN_ENABLED=true` + checkpoints verified).

---

## 6. STL Preprocessing Result

### Pipeline

```
STL/PLY/OBJ/OFF input
  → validate_stl_header()
  → trimesh.load(process=False)
  → is_watertight / is_winding_consistent checks
  → winding repair if inconsistent
  → vertex_normals precomputed
  → export OBJ with normals
  → {output_dir}/{scan_id}/{scan_id}_{jaw}.obj
```

### Test Results

```
17 collected, 16 passed, 1 skipped
```

| Test | Result |
|------|--------|
| `test_valid_cube_stl` | PASS |
| `test_missing_file` | PASS |
| `test_too_small_file` | PASS |
| `test_cube_stl_to_obj` | PASS |
| `test_obj_roundtrip_preserves_scale` | PASS |
| `test_missing_input` | PASS |
| `test_unsupported_format` | PASS |
| `test_corrupted_file` | PASS |
| `test_output_dir_created` | PASS |
| `test_single_triangle` | PASS |
| `test_watertight_flag` | SKIPPED (scipy absent in env) |
| `test_output_is_valid_obj` | PASS |
| `test_tgn_directory_layout` | PASS |
| `test_upper_jaw_naming` | PASS |
| `test_invalid_jaw` | PASS |
| `test_missing_input (preprocess)` | PASS |
| `test_idempotent_reprocess` | PASS |

`test_watertight_flag` is correctly skipped when `scipy` is not installed; the test is not removed because it should pass in the Docker environment where scipy is available.

**Result: PASS (conditional on scipy available in target environment).**

---

## 7. Inference Validation Result

### TGN Inference Flow (`/segment` endpoint)

```
POST /segment  (multipart: file, arch, scan_id, job_id)
  → _require_token()         auth gate
  → TGN_ENABLED gate
  → _validate_upload()       extension + size check
  → ModelState.READY gate
  → background: _run_inference_sync()
      queued → preprocessing → running → validating → completed
  → 202 Accepted + {job_id}

GET /jobs/{job_id}
  → returns job dict with status, results, research_use
```

### Status Lifecycle Timings (expected; not measured in this environment)

| Status | Trigger |
|--------|---------|
| `queued` | Job created |
| `preprocessing` | STL→OBJ conversion started |
| `running` | TGN model invoked |
| `validating` | `FDIValidator.validate()` called |
| `completed` | All steps success |
| `failed` | Any exception |

### Research-Use Fields (mandatory in every completed job)

```python
{
  "research_use": True,
  "research_use_notice": "Research-use segmentation. Manual clinical review required. Not cleared as a Software as a Medical Device.",
  "model_name": "tgnet_fps",
  "model_version": "1.0.0",
  "gingiva_only": False,
  "partial_segmentation": False,
  "requires_manual_review": False,  # True if gingiva_only or partial_segmentation
}
```

**Result: IMPLEMENTED (code path). Live inference not exercisable without checkpoint files and GPU/CPU environment. Must be validated on VPS with actual checkpoints before soft-launch.**

---

## 8. FDI Validation Result

### Validator Capabilities

`fdi_validator.py` — `FDIValidator.validate(labels, arch)`:

| Check | Description |
|-------|-------------|
| Range check | Labels outside FDI ranges flagged as unexpected |
| Arch check | Lower jaw teeth (31–48) in upper prediction flagged as cross-arch |
| Confidence check | Per-tooth confidence < 0.5 flagged as low-confidence |
| Deciduous detection | Labels 51–85 flagged |
| **Gingiva-only** | Empty label set after filtering → `gingiva_only=True`, early return |
| **Partial segmentation** | < 4 permanent teeth in expected arch → `partial_segmentation=True` |
| Duplicate detection | Same tooth label appearing more than once |

### Gingiva-Only Path

If TGN returns only label 0 (gingiva), the validator short-circuits:
```python
FDIValidationResult(
    is_valid=False,
    gingiva_only=True,
    partial_segmentation=False,
    requires_manual_review=True,
    warnings=["No tooth labels detected — output is gingiva-only..."]
)
```

This prevents a corrupted or failed inference from being passed to the frontend as a valid segmentation.

**Result: IMPLEMENTED.** Both edge cases (gingiva-only, partial segmentation) are handled and surface in job output.

---

## 9. Backend Integration Result

### ai-engine → tgn-api Routing

`ai-engine/src/main.py` — `run_segmentation_task()`:

```python
_TGN_ENABLED = os.getenv("TGN_ENABLED", "false").lower() in ("1", "true", "yes")
_tgn_engine: Optional[TGNSegmentationEngine] = None

if _TGN_ENABLED:
    try:
        _tgn_engine = TGNSegmentationEngine()
    except TGNUnavailableError:
        logger.info("TGN unavailable; using built-in engine")
else:
    logger.info("TGN_ENABLED not true; using built-in MONAI engine")
```

When TGN is unavailable, the ai-engine falls back to its built-in MONAI/CPU segmentation engine. The fallback is transparent to the MyOrtho backend — the same job status lifecycle is used.

### Extended Job Completion Payload

All segmentation job completions now include:
```python
{
    "fdi_valid": bool,
    "requires_manual_review": bool,
    "deciduous_detected": bool,
    "research_use": True,
    "disclaimer": "Research-use segmentation. Manual clinical review required. AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist."
}
```

**Result: IMPLEMENTED.** Fallback to MONAI engine preserved. No existing API contracts changed.

---

## 10. Frontend Workflow Result

### JobStatus Type Extension

`frontend/src/lib/api/segmentation.ts`:

```typescript
export type JobStatus =
  | 'pending' | 'queued' | 'preprocessing' | 'running' | 'validating'
  | 'processing' | 'completed' | 'failed' | 'manual_review_required' | 'unavailable';
```

All TGN pipeline states now have TypeScript types. Frontend TypeScript: **0 errors.**

### UI Components Added

`frontend/src/components/SegmentationJobMonitor.tsx`:

**ResearchUseBanner** — shown on every completed segmentation job:
> "Research-use segmentation. Manual clinical review required. AI outputs must be verified by a licensed orthodontist before use in treatment planning."

**ManualReviewBanner** — shown when `requires_manual_review: true`:
> "Manual review required before proceeding" + per-tooth warning list

**Status label and tone maps** cover all pipeline states including `preprocessing`, `validating`, `manual_review_required`, and `unavailable`.

**Result: IMPLEMENTED.** Every segmentation result displays the mandatory research-use notice. TypeScript clean.

---

## 11. Docker Staging Result

### docker-compose.tgn.yml Changes

| Setting | Before | After |
|---------|--------|-------|
| Port exposure | `ports: ["${TGN_API_PORT:-8001}:8001"]` | `expose: ["8001"]` (internal only) |
| `INTERNAL_API_SECRET` | Optional | Required (`:?` syntax; compose fails if unset) |
| `TGN_ENABLED` default | `false` | `false` (explicit) |
| `CHECKPOINT_SHA256_FPS/BDL` | Not present | Present (defaults empty) |
| `REQUIRE_CHECKSUM` | Not present | Present (defaults `false`) |
| Log rotation | Not configured | `json-file`, 50 MB, 5 files |

### Network Security

Port 8001 is now reachable only within the Docker bridge network (`myortho_default`). The ai-engine reaches it via `http://tgn-api:8001`. No external access possible without explicitly adding a `ports:` stanza.

### Resource Limits

```yaml
deploy:
  resources:
    limits:
      memory: "4g"
      cpus: "2.0"
```

**Result: IMPLEMENTED.** Staging Docker configuration is production-safe. VPS operator must set `INTERNAL_API_SECRET` in `.env` or compose will refuse to start.

---

## 12. E2E Smoke-Test Result

**Status: NOT RUN IN THIS ENVIRONMENT.**

An E2E smoke test requires:
1. Running Docker daemon (not available in this container)
2. Downloaded TGN checkpoints (binary files excluded from repo)
3. A live MyOrtho backend with a valid admin user seeded

The smoke-test framework exists at `tgn-service/PHASE8_VALIDATION.md` — a 12-step workflow from login through case archival.

**Required before soft-launch:** Operator must execute all 12 steps on the VPS staging environment and record pass/fail against the acceptance criteria in that document. See Section 20 for exact commands.

---

## 13. Security Review

### Issues Found and Resolved

| Issue | Severity | Status |
|-------|----------|--------|
| Auth bypass when `INTERNAL_API_SECRET` unset | Critical | Fixed — HTTP 503, not 200 |
| Timing-unsafe token comparison (`==`) | High | Fixed — `hmac.compare_digest()` |
| Port 8001 reachable from host network | High | Fixed — `expose:` not `ports:` |
| Path traversal in `/segment/by-path` | High | Fixed — `_assert_safe_path()` allowlist |
| TGN active by default when `TGN_API_URL` set | Medium | Fixed — `TGN_ENABLED=false` default |
| Checkpoint files committable to VCS | Medium | Fixed — `.gitignore` patterns added |
| No request correlation IDs | Low | Fixed — `X-Request-ID` middleware |

### Remaining Considerations

- **PHI in job store:** Job records contain `scan_id` (caller-provided). If the caller passes a PHI-containing string as `scan_id`, it will be stored in Redis. The MyOrtho ai-engine uses an opaque UUID — this is safe. Third-party integrators should be warned.
- **Upload file cleanup:** Uploaded STL files are deleted after inference in `_run_inference_sync()`. If the process is killed mid-job, the temp file may remain in `TGN_UPLOAD_DIR`. The Docker volume `tgn_uploads:` is ephemeral across container restarts.
- **No mTLS between ai-engine and tgn-api:** The `X-Internal-Token` header provides authentication but not encryption. Both services are on the same Docker bridge; traffic does not traverse the public network. If ever moved to separate hosts, add TLS.
- **Redis job store TTL:** 7 days. Jobs older than 7 days are evicted. If Redis is unavailable, the in-memory fallback dict has no TTL and no eviction — potential memory leak under sustained load.

---

## 14. Licensing and Regulatory Review

### TGN Model License

The ToothGroupNetwork model was published with the MICCAI 2022 challenge. The original codebase is available on GitHub under an MIT-adjacent research license. Before commercial deployment:

1. **Confirm the exact license** of the TGN checkpoint weights (not just the code). Model weights may carry separate restrictions from the code license.
2. **Obtain written confirmation** from the original authors that commercial inference is permitted under the applicable license.
3. **Document the license** in `tgn-service/MODEL_CONFIGURATION.md`.

### Medical Device Regulatory Status

| Region | Pathway | Status |
|--------|---------|--------|
| United States | FDA 510(k) or De Novo (Class II SaMD) | Not initiated |
| European Union | MDR 2017/745, Class IIa SaMD | Not initiated |
| United Kingdom | UKCA Medical Devices Regulations | Not initiated |

TGN outputs are **not cleared as a Software as a Medical Device** in any jurisdiction. All outputs must carry the notice:

> "Research-use segmentation. Manual clinical review required. Not cleared as a Software as a Medical Device. AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist."

This notice is implemented at three layers:
1. Every TGN job response (`research_use_notice` field)
2. Every ai-engine job completion (`disclaimer` field)
3. Frontend `ResearchUseBanner` component (visible to every clinician)

### HIPAA

The TGN microservice receives STL scan files (3D geometry). STL files are de-identified geometric data; they do not contain PHI by design. However:

- The MyOrtho backend must not include PHI in the `scan_id` field passed to TGN.
- Redis job store must not be exposed externally.
- The VPS operator is responsible for encrypting the volume containing `tgn_uploads/`.

---

## 15. Clinical Validation Readiness

### Current Status

**Validated scans: 0 / ≥100 required.**

The clinical validation framework is defined in `tgn-service/SEGMENTATION_VALIDATION_REPORT.md`. It requires:

1. ≥ 100 de-identified CBCT/IOS scans with expert-annotated FDI ground truth
2. Dice similarity coefficient ≥ 0.85 per tooth across the test set
3. FDI label accuracy ≥ 95% on permanent dentition
4. False-positive supernumerary rate < 2%
5. Gingiva misclassification rate < 5%
6. Mean inference time < 120 seconds per arch

None of these metrics have been measured because:
- No annotated scan dataset is available in this environment
- TGN checkpoints are not downloaded (binary files excluded from VCS)
- Inference cannot run without a GPU/CPU environment with PyTorch 1.7.1

### Required Before Soft-Launch

- [ ] Download checkpoints and set `CHECKPOINT_SHA256_FPS/BDL` in `.env`
- [ ] Run `REQUIRE_CHECKSUM=true` and confirm service starts without error
- [ ] Process ≥ 100 scans through TGN in the VPS staging environment
- [ ] Record Dice and label accuracy metrics in `SEGMENTATION_VALIDATION_REPORT.md`
- [ ] Have a licensed orthodontist review ≥ 20 randomly selected outputs
- [ ] Document any systematic errors observed (e.g., specific tooth types mislabeled)
- [ ] Obtain written sign-off from the supervising orthodontist

---

## 16. Remaining Blockers

### Hard Blockers (prevent any clinical use)

| # | Blocker | Owner | Est. Effort |
|---|---------|-------|-------------|
| B1 | TGN checkpoints not downloaded — cannot run inference | VPS operator | 1 hour |
| B2 | Clinical validation dataset absent — Dice/accuracy metrics unmeasured | Clinical team | 2–8 weeks |
| B3 | Licensed orthodontist sign-off on AI outputs not obtained | Clinical director | After B2 |

### Soft Blockers (should resolve before broad user access)

| # | Blocker | Owner | Est. Effort |
|---|---------|-------|-------------|
| S1 | `test_watertight_flag` skipped (scipy absent in test environment) | Engineering | 15 min (`pip install scipy` in Docker test stage) |
| S2 | mTLS between ai-engine and tgn-api not implemented | Engineering | 1–2 days |
| S3 | Redis in-memory fallback has no TTL / eviction | Engineering | 4 hours |
| S4 | TGN model license (weights) not confirmed in writing | Legal | Days–weeks |
| S5 | E2E smoke test (`PHASE8_VALIDATION.md`) not executed on VPS | Engineering | 2–4 hours |

---

## 17. Soft-Launch Readiness Score

**Score: 6 / 10**

| Criterion | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Security controls implemented | 20% | 9/10 | Auth, path safety, port isolation, checksum governance all in place |
| Feature flag gating | 10% | 10/10 | `TGN_ENABLED=false` default; no accidental activation |
| Research-use notices | 10% | 10/10 | Banner, disclaimer, job fields all present |
| Fallback behavior | 10% | 10/10 | Falls back to MONAI when TGN unavailable |
| TypeScript / Python syntax clean | 10% | 10/10 | Zero errors in both |
| Preprocessing tests passing | 10% | 9/10 | 16/17 pass; 1 skipped (scipy) |
| Checkpoint governance | 10% | 7/10 | Code implemented; actual checksums not set (requires download) |
| Clinical validation data | 20% | 0/10 | No annotated scans; metrics unmeasured |

**What would bring it to 8/10:** Complete the 100-scan validation and get orthodontist sign-off.  
**What would bring it to 10/10:** Regulatory submission and cleared status.

---

## 18. Commercial-Launch Readiness Score

**Score: 3 / 10**

Additional requirements beyond soft-launch:

| Criterion | Status |
|-----------|--------|
| FDA clearance (510(k) or De Novo) | Not initiated |
| CE marking (MDR 2017/745) | Not initiated |
| Clinical performance study (≥ 1000 subjects) | Not initiated |
| Post-market surveillance plan | Not documented |
| Adverse event reporting process | Not documented |
| Model license (weights) confirmed commercial | Pending |
| Indemnification / liability framework | Not documented |
| Customer-facing regulatory disclosures | Not written |

Commercial launch requires a multi-year regulatory program. This is not an engineering blocker — it is a business and legal program.

---

## 19. GO / NO-GO Recommendation

### For Production Clinical Use (any paying customer)

**NO-GO.**

Reason: Clinical validation data is absent. No Dice scores, no FDI accuracy metrics, no orthodontist sign-off. TGN outputs cannot be presented to clinicians as reliable without this data, regardless of technical quality.

### For Internal Research / Staging Deployment

**CONDITIONAL GO** when all of the following are completed:

- [ ] Checkpoints downloaded; `CHECKPOINT_SHA256_FPS/BDL` set in `.env`; `REQUIRE_CHECKSUM=true` confirmed
- [ ] `TGN_ENABLED=true` set **only on staging**; production `.env` keeps it `false`
- [ ] E2E smoke test (`tgn-service/PHASE8_VALIDATION.md`) completed on VPS
- [ ] At least 1 TGN inference job completed end-to-end; output reviewed by supervising orthodontist
- [ ] All outputs in the UI carry the `ResearchUseBanner` (visual confirmation)
- [ ] Redis and tgn_uploads volume are not accessible from the public network

### For Merging PR #3 to `main`

**CONDITIONAL GO** (lower bar than clinical use — this is code merge, not clinical activation):

- [ ] E2E smoke test passes on staging
- [ ] Supervising orthodontist has reviewed at least one live output
- [ ] `TGN_ENABLED` remains `false` in production `.env`

---

## 20. Exact VPS Staging Commands

Run these on the VPS after SSH access is established:

```bash
# 1. Pull latest code
cd /opt/myortho
git fetch origin claude/myortho-production-validation-dlmvsi
git checkout claude/myortho-production-validation-dlmvsi

# 2. Deploy TGN service files to /opt/toothgroupnetwork
bash tgn-service/deploy.sh

# 3. Download TGN checkpoints (requires Google Drive access)
bash tgn-service/scripts/download_checkpoints.sh
# Note the printed CHECKPOINT_SHA256_FPS and CHECKPOINT_SHA256_BDL values

# 4. Set required environment variables in .env
cat >> .env <<'ENV'
INTERNAL_API_SECRET=<generate with: openssl rand -hex 32>
CHECKPOINT_SHA256_FPS=<value from step 3>
CHECKPOINT_SHA256_BDL=<value from step 3>
REQUIRE_CHECKSUM=true
TGN_ENABLED=false        # keep false until clinical validation complete
ENV

# 5. Build TGN Docker image
cd /opt/toothgroupnetwork
docker compose build tgn-api

# 6. Start full stack with TGN overlay
cd /opt/myortho
docker compose -f docker-compose.yml -f docker-compose.tgn.yml up -d

# 7. Confirm TGN is healthy
docker compose -f docker-compose.yml -f docker-compose.tgn.yml ps tgn-api
curl -s http://localhost:8001/health        # from inside Docker network only
docker exec myortho-ai-engine curl -s http://tgn-api:8001/health | jq .

# 8. Enable TGN for staging inference (STAGING ONLY)
# Edit .env: TGN_ENABLED=true
# Restart tgn-api and ai-engine:
docker compose -f docker-compose.yml -f docker-compose.tgn.yml restart tgn-api ai-engine

# 9. Submit a test segmentation via MyOrtho frontend
# Upload an STL → watch status: queued → preprocessing → running → validating → completed
# Confirm ResearchUseBanner is visible on the result

# 10. Run E2E validation framework
# Follow tgn-service/PHASE8_VALIDATION.md steps 1–12
```

---

## 21. Suggested Next Version Tag

After PR #3 merges to `main`, tag:

```bash
git tag -a v0.9.0-tgn-research -m "TGN research integration — feature-flagged, research-use only"
git push origin v0.9.0-tgn-research
```

Version rationale:
- `v0.9.x` — pre-1.0; suitable for production-capable but not yet clinically validated
- `-tgn-research` — suffix indicates TGN is present but in research mode
- After clinical validation (≥ 100 scans, orthodontist sign-off): tag `v1.0.0-tgn-soft-launch`
- After regulatory clearance: remove suffix, tag `v1.1.0`

---

## 22. Commit Summary

### This Sprint

| Commit | Message |
|--------|---------|
| `a2f8c68` | feat(tgn): production validation sprint — security hardening, feature flag, research-use notices |

### Branch History (validation sprint context)

| Commit | Message |
|--------|---------|
| `3ba2ac0` | feat(tgn): add TGN microservice source, validation docs, and deploy script |
| `1a6ea4d` | feat(tgn): integrate ToothGroupNetwork AI segmentation pipeline (Phases 1–8) |
| `86dd0d4` | docs: add KNOWN_LIMITATIONS.md for RC1 |
| `6214da8` | fix(test): update auth.service.spec to mock pool for is_active check |
| `0d4336b` | feat(rc1): production security hardening, performance, and UX cleanup |

### Quality Gate Summary

| Gate | Status |
|------|--------|
| Backend TypeScript (`npx tsc --noEmit`) | ✅ PASS — 0 errors |
| Frontend TypeScript (`npx tsc --noEmit`) | ✅ PASS — 0 errors |
| Python syntax (tgn-service, 6 files) | ✅ PASS |
| Python syntax (ai-engine/src, 17 files) | ✅ PASS |
| Docker Compose YAML validation | ✅ PASS |
| Preprocessing unit tests (17 tests) | ✅ 16 PASS, 1 SKIP (scipy absent — expected) |
| E2E smoke test | ⏳ NOT RUN — requires VPS + checkpoints |
| Live TGN inference | ⏳ NOT RUN — requires checkpoints |
| Clinical validation (100 scans) | ❌ NOT DONE — see Section 15 |

---

*This report was generated as part of the TGN Production Activation & Validation Sprint on 2026-07-11.*  
*AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist.*
