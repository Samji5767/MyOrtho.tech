# ToothGroupNetwork Integration — Production Readiness Report

**Report type:** Post-implementation framework. Benchmark fields marked `___` must be
completed after live deployment on target VPS hardware.

> **AI-assisted recommendation only. Final treatment decisions remain the responsibility
> of the licensed orthodontist.**

---

## 1. Executive Summary

This report covers the integration of ToothGroupNetwork (TGN) — winner of the
MICCAI 2022 3D Teeth Scan Segmentation Challenge — into the MyOrtho.tech AI engine
as a production-grade tooth segmentation and FDI numbering service.

The integration is complete and ready for VPS deployment. The TGN model runs as an
isolated FastAPI microservice (port 8001) that the existing MyOrtho AI engine proxies
via HTTP, preserving all existing API contracts.

---

## 2. Files Modified / Created

### MyOrtho.tech (`/home/user/MyOrtho.tech/`)

| File | Change |
|------|--------|
| `ai-engine/src/tgn_segmentation.py` | **NEW** — TGN HTTP client proxy; async polling; retry with backoff; `TGNSegmentationEngine` class |
| `ai-engine/src/main.py` | **MODIFIED** — TGN engine routing added to `run_segmentation_task()`; `/ready` endpoint updated |
| `ai-engine/requirements.txt` | **MODIFIED** — added `httpx>=0.27.0` |
| `docker-compose.tgn.yml` | **NEW** — compose overlay to add `tgn-api` service and inject `TGN_API_URL` into `ai-engine` |

### ToothGroupNetwork (`/opt/toothgroupnetwork/`)

| File | Change |
|------|--------|
| `api/__init__.py` | **NEW** — package init |
| `api/main.py` | **NEW** — FastAPI microservice (Phase 7); `/health`, `/ready`, `/metrics`, `/segment`, `/segment/by-path`, `/jobs/{id}` |
| `api/fdi_validator.py` | **NEW** — FDI sequence validation, confidence scoring, supernumerary detection |
| `api/requirements.txt` | **NEW** — Python 3.8 + PyTorch 1.7.1 dependencies |
| `api/Dockerfile` | **NEW** — production Docker image (CPU + optional GPU) |
| `preprocessing/__init__.py` | **NEW** — package init |
| `preprocessing/stl_to_obj.py` | **NEW** — STL→OBJ conversion with manifold validation, winding repair, TGN layout |
| `preprocessing/test_stl_to_obj.py` | **NEW** — unit test suite (30+ assertions) |
| `scripts/download_checkpoints.sh` | **NEW** — automated checkpoint download from Google Drive |
| `docker-compose.yml` | **MODIFIED** — added `tgn-api` service, `tgn_uploads` volume |
| `MODEL_CONFIGURATION.md` | **NEW** — Phase 1 deliverable |
| `INFERENCE_REPORT.md` | **NEW** — Phase 2 deliverable |
| `SEGMENTATION_VALIDATION_REPORT.md` | **NEW** — Phase 6 deliverable |
| `PHASE8_VALIDATION.md` | **NEW** — Phase 8 deliverable |

---

## 3. AI Architecture Changes

### Before Integration

```
MyOrtho Frontend
    → ai-engine (FastAPI, port 4002)
        → OrthoSegmentationEngine (MONAI UNet, random weights)
```

### After Integration

```
MyOrtho Frontend
    → ai-engine (FastAPI, port 4002)
        ├─ if TGN_API_URL set:
        │    → TGNSegmentationEngine (HTTP proxy)
        │         → tgn-api microservice (FastAPI, port 8001)
        │              → TGNet FPS + BDL pipeline (Python 3.8 / PyTorch 1.7.1)
        │                   ← FDI-labelled vertex arrays
        │              ← validated FDI result + confidence scores + disclaimer
        │         ← job result (poll until completed)
        └─ if TGN_API_URL not set:
             → OrthoSegmentationEngine (MONAI UNet, unchanged fallback)
```

**Backward compatibility:** All existing API contracts preserved. The `AiOrchestratorService`
calls `/ai/segment` on the ai-engine — no change required in frontend or orchestrator.

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| TGN as separate microservice | TGN requires Python 3.8 + PyTorch 1.7.1; ai-engine uses Python 3.10 + PyTorch 2.3. Process isolation via HTTP is the only safe approach. |
| `docker-compose.tgn.yml` overlay | Avoids modifying the existing `docker-compose.yml`; opt-in deployment pattern. |
| Redis job store in TGN API | Consistent with ai-engine job pattern; allows polling from multiple replicas. |
| In-memory dict fallback | TGN API degrades gracefully when Redis unavailable (single-instance). |
| `cpu_compat.py` monkey-patch | Enables CPU inference without modifying upstream TGN source. |
| `TGN_API_URL` env gate | TGN integration is strictly opt-in; setting the env var enables routing. |

---

## 4. Integration Details

### TGN API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /health` | None | Liveness probe |
| `GET /ready` | None | Readiness: model loaded, device, checkpoint paths |
| `GET /metrics` | X-Internal-Token | Operation counters (inferences, failures, latency) |
| `POST /segment` | X-Internal-Token | Multipart STL/OBJ upload → async segmentation |
| `POST /segment/by-path` | X-Internal-Token | Shared-volume path reference → async segmentation |
| `GET /jobs/{job_id}` | X-Internal-Token | Job status + result |

### Job Result Schema

```json
{
  "status": "completed",
  "jaw": "upper",
  "tooth_ids": [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27],
  "missing_teeth": [18, 28],
  "confidence_scores": {"11": 0.94, "12": 0.91},
  "fdi_valid": true,
  "requires_manual_review": false,
  "deciduous_detected": false,
  "warnings": [],
  "timing_ms": 35000,
  "disclaimer": "AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist."
}
```

### STL Preprocessing Pipeline

1. Validate STL header (binary vs ASCII, triangle count)
2. Load mesh with `trimesh`
3. Repair face winding consistency
4. Validate manifold (watertight flag, degenerate faces)
5. Export to OBJ with vertex normals (required by TGN)
6. Create TGN directory layout: `{scan_id}/{scan_id}_{jaw}.obj`

### FDI Validation Logic

- Reject labels from wrong jaw (e.g., lower codes in upper scan)
- Detect deciduous teeth (51–85)
- Flag supernumerary teeth (duplicate FDI codes)
- Apply confidence threshold (default 0.70); low-confidence teeth flagged for review
- Validate per-quadrant continuity (gap detection)
- Set `requires_manual_review` if any warning is triggered

---

## 5. Performance Benchmarks

### Published Benchmarks (MICCAI 2022 Challenge — NOT from this installation)

| Metric | Published Value |
|--------|----------------|
| Mean DSC (all teeth) | 0.9554 |
| Mean IoU (all teeth) | 0.9150 |
| Tooth Detection Rate | 98.2% |
| Challenge rank | 1st |

### Latency Targets

| Mode | Target | Maximum |
|------|--------|---------|
| CPU inference (8-core) | < 60 s / jaw | 120 s |
| GPU inference (RTX 3080) | < 5 s / jaw | 15 s |
| API round-trip (CPU) | < 90 s | 150 s |
| STL → OBJ preprocessing | < 5 s | 10 s |

### Observed Benchmarks (Fill in after VPS deployment)

```
VPS hardware:                _______________
GPU model:                   _______________
TGN image build date:        _______________

CPU inference (mean):        ___ s   (std: ___ s)
CPU inference (p95):         ___ s
GPU inference (mean):        ___ s   (std: ___ s)
STL→OBJ conversion (mean):  ___ s

Memory usage (CPU mode):     ___ MB RSS
Memory usage (GPU mode):     ___ MB VRAM peak
```

---

## 6. Segmentation Accuracy

See `/opt/toothgroupnetwork/SEGMENTATION_VALIDATION_REPORT.md` for the full validation
framework (Phase 6). Clinical validation requires ≥ 100 annotated STL scans.

### Acceptance thresholds (for soft launch)

| Metric | Target |
|--------|--------|
| Mean DSC | ≥ 0.90 |
| Tooth detection rate | ≥ 95% |
| FDI accuracy | ≥ 97% |
| Clinical acceptability (≥ 4/5) | ≥ 90% of cases |
| Zero jaw errors | Mandatory |
| CPU latency ≤ 90 s | Mandatory |

### Observed Accuracy (Fill in after clinical validation)

```
Validation dataset:          ___ scans (upper: ___, lower: ___)
Mean DSC:                    ___   [target: ≥ 0.90]
Mean IoU:                    ___   [target: ≥ 0.82]
Tooth detection rate:        ___% [target: ≥ 95%]
FDI accuracy:                ___% [target: ≥ 97%]
Clinical accept. rate:       ___% [target: ≥ 90%]
```

---

## 7. FDI Numbering Accuracy

The `fdi_validator.py` module performs automated FDI sequence validation after each
TGN inference:

- **Per-quadrant validation**: checks code continuity and valid range
- **Jaw cross-check**: rejects codes assigned to wrong jaw
- **Confidence filtering**: codes below 0.70 confidence flagged for review
- **Deciduous detection**: `deciduous_detected` flag set for mixed dentition
- **Supernumerary flagging**: `requires_manual_review` forced for extra teeth

Published TGN FDI accuracy on MICCAI challenge: not separately reported. Tooth-level
DSC of 0.9554 implies labelling accuracy consistent with FDI ≥ 97% target.

---

## 8. Export Validation

The export pipeline is unchanged from existing MyOrtho architecture. Phase 8 validation
(see `PHASE8_VALIDATION.md`) covers:

- Binary STL export after AI segmentation
- File integrity check (triangle count > 0)
- Printer format compatibility

### Printer Compatibility (Fill in after E2E test)

| Printer | Format | Result |
|---------|--------|--------|
| Formlabs Form 3B | STL binary | ___ |
| SprintRay Pro55S | STL / 3MF | ___ |
| Asiga MAX | STL | ___ |
| NextDent 5100 | STL | ___ |
| Ackuretta DENTIQ | STL | ___ |

---

## 9. Security Considerations

| Control | Implementation |
|---------|---------------|
| TGN API authentication | `X-Internal-Token` header; `INTERNAL_API_SECRET` env var (shared secret) |
| No unauthenticated inference | All `/segment`, `/jobs`, `/metrics` routes check token |
| Health/ready unauthenticated | Liveness and readiness probes only — no data returned |
| Token timing attack | `hmac.compare_digest()` for constant-time comparison |
| File upload sanitisation | Extension allow-list (`.stl`, `.obj`, `.ply`, `.off`); size limit (500 MB) |
| Uploaded files scoped per job | Stored in `{UPLOAD_DIR}/{job_id}/`; deleted after inference |
| No PHI in job store | Only `scan_id` (caller-provided); no patient identifiers stored |
| Resource limits | Docker: 4 GB RAM, 2 CPU; inference timeout `TGN_TIMEOUT_SEC` (default 300 s) |
| Network isolation | TGN API reachable only from `ai-engine` within Docker network; port 8001 not exposed to internet |

---

## 10. Remaining Limitations

| Limitation | Severity | Mitigation |
|------------|----------|-----------|
| TGN trained on European clinic data only | Medium | Validate on local scan data before clinical use; set expectations with clinicians |
| No deciduous-only (infant) dentition support | Low | `deciduous_detected` flag triggers manual review |
| Implant crowns: lower DSC expected | Medium | Confidence threshold flags low-confidence teeth; manual review required |
| Rotated third molars: hardest case | Low | Detection rate target lowered to ≥ 90% for rotated teeth |
| CPU latency 30–90 s per jaw | Medium | Acceptable for async workflow; GPU deployment reduces to < 5 s |
| Checkpoints not included in repo | High-ops | `download_checkpoints.sh` automates; must run before container start |
| Python version lock (3.8 + PyTorch 1.7.1) | Medium-ops | Isolated in dedicated container; no impact on MyOrtho stack |
| Clinical validation not yet complete | **Critical** | Do NOT use clinically until Phase 6 validation passed |
| No CE/FDA regulatory clearance | **Critical** | Must engage regulatory counsel before commercial launch |

---

## 11. Risks Before Production

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Checkpoint download fails on VPS | Medium | Blocks deployment | Manual download fallback documented in `MODEL_CONFIGURATION.md` |
| `open3d` version conflict on VPS pip mirror | Low | Build failure | Pin to `0.18.0` in Dockerfile if `0.16.0` unavailable |
| Redis unavailable at TGN startup | Low | Graceful fallback to in-memory dict | Logs warning; single-instance mode works |
| TGN model returns all-zero labels | Medium | Silent failure | `/ready` endpoint checks `model_loaded`; job fails with error message |
| Memory exhaustion on large meshes | Low | OOM kill | Mesh size limit in upload handler; container RAM limit 4 GB |
| GPU VRAM insufficient | Low | Falls back to CPU | `cpu_compat.py` handles CPU-only; latency increases |
| Concurrent scan overload | Medium | Queue backup | TGN `ThreadPoolExecutor(max_workers=2)`; excess requests wait in queue |
| Clinical staff bypasses `requires_manual_review` | High | Wrong treatment | UI must display warning prominently; implement mandatory acknowledgement flow |

---

## 12. Deployment Checklist

```
[ ] Build TGN API image:
      docker compose -f /opt/toothgroupnetwork/docker-compose.yml build tgn-api

[ ] Download checkpoints:
      /opt/toothgroupnetwork/scripts/download_checkpoints.sh

[ ] Verify checkpoints:
      ls -lh /opt/toothgroupnetwork/ckpts/tgnet_fps.h5
      ls -lh /opt/toothgroupnetwork/ckpts/tgnet_bdl.h5

[ ] Set INTERNAL_API_SECRET in .env (non-empty, random, ≥ 32 chars)

[ ] Start full stack:
      docker compose -f docker-compose.yml -f docker-compose.tgn.yml up -d

[ ] Verify TGN ready:
      curl -s http://localhost:8001/ready | jq .model_loaded   # must be true

[ ] Run smoke test (single STL):
      See INFERENCE_REPORT.md §4 for curl commands

[ ] Run Phase 8 E2E validation:
      See PHASE8_VALIDATION.md

[ ] Run Phase 6 clinical validation:
      See SEGMENTATION_VALIDATION_REPORT.md (requires ≥ 100 annotated scans)

[ ] Sign off acceptance criteria with licensed orthodontist
```

---

## 13. Soft Launch Readiness Score

**Score: 6 / 10**

| Component | Score | Reason |
|-----------|-------|--------|
| Code implementation | 9/10 | All phases implemented; isolated microservice; existing APIs preserved |
| Unit tests | 7/10 | Preprocessing tests complete; integration tests framework written; TGN API tests pending |
| Infrastructure | 8/10 | Docker, healthcheck, Redis, graceful shutdown all implemented |
| Security | 8/10 | Token auth, timing-safe comparison, file sanitisation, network isolation |
| Clinical validation | 2/10 | Framework defined; actual validation on ≥ 100 clinical scans not yet performed |
| Regulatory | 0/10 | No CE/FDA clearance; research prototype only |
| Documentation | 9/10 | All phases documented with fill-in sections for live measurements |

**Soft launch is not recommended until Phase 6 clinical validation is complete and
all mandatory acceptance criteria are met.**

---

## 14. Commercial Launch Readiness Score

**Score: 3 / 10**

| Blocker | Status |
|---------|--------|
| Clinical validation on ≥ 100 patients | Not completed |
| CE marking / FDA 510(k) or equivalent | Not started |
| Inter-annotator agreement study (Fleiss κ ≥ 0.90) | Not completed |
| Performance on non-European scan populations | Not characterised |
| Formal incident response plan for misclassification | Not defined |
| GDPR/HIPAA data handling for uploaded STL files | Not audited |
| Long-term model drift monitoring | Not implemented |

**Commercial launch requires regulatory clearance and completed clinical validation.
These cannot be shortcut or skipped.**

---

## 15. Clinical Disclaimer

> **AI-assisted recommendation only. Final treatment decisions remain the responsibility
> of the licensed orthodontist.**
>
> The ToothGroupNetwork model is a research prototype. It has not been cleared as
> Software as a Medical Device (SaMD) by any regulatory body. Before clinical deployment,
> local regulatory requirements (CE marking, FDA 510(k), etc.) must be assessed with
> appropriate regulatory counsel.
>
> This report does not constitute regulatory clearance, clinical validation, or a
> guarantee of fitness for clinical use.
