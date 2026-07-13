# AI Segmentation Activation Report

**Sprint:** Final AI Segmentation Activation & Production Verification  
**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Date:** 2026-07-12  
**Author:** Engineering / Safety Review  
**Outcome:** SCENARIO D — Both AI engines BLOCKED; production mode is MANUAL  

---

## Executive Summary

This report documents the outcome of the Final AI Segmentation Activation & Production Verification sprint. The sprint evaluated two AI segmentation engines — ToothGroupNetwork (TGN) and MeshSegNet — for production activation against seven mandatory gates: commercial license clearance, checkpoint availability, checksum validation, model load, warm-up, health/readiness, and real-STL inference with validated output.

**Neither engine passed all gates.**

The correct and only permissible production configuration at this time is:

```
TGN_ENABLED=false
MESHSEGNET_ENABLED=false
SEGMENTATION_PROVIDER=MANUAL
```

All segmentation requests are routed to `ManualReviewProvider`, which returns a structured referral for clinical review without fabricating AI output.

---

## Activation Gate Results

### Gate 1 — Commercial License Clearance

| Engine | Status | Blocker |
|--------|--------|---------|
| TGN | **BLOCKED (P0)** | No LICENSE file present in `tgn-service/`. Training data uses CC BY-NC-ND 4.0, which prohibits commercial use and redistribution. Documented in `TOOTHGROUPNETWORK_LICENSE_REVIEW.md`. |
| MeshSegNet | **BLOCKED (P1)** | MIT license applies to source code. However, the pretrained checkpoint has not been obtained. Commercial-use and redistribution rights of the checkpoint have not been confirmed with the model authors. |

**Gate 1 result: BOTH ENGINES FAILED.**

### Gate 2 — Checkpoint Availability

| Engine | Status | Detail |
|--------|--------|--------|
| TGN | **MISSING** | `/opt/toothgroupnetwork/ckpts/` does not exist. No `.h5` or `.pth` checkpoint found anywhere on the filesystem. |
| MeshSegNet | **MISSING** | `meshsegnet-ckpts` Docker volume not populated. No `.pth` checkpoint found. `scripts/download_checkpoints.sh` has not been executed. |

Filesystem search: `find / -name "*.pth" -o -name "*.h5" 2>/dev/null` — zero results.

**Gate 2 result: BOTH ENGINES FAILED.**

### Gate 3 — Checksum Validation

| Engine | Status | Detail |
|--------|--------|--------|
| TGN | **N/A** | No checkpoint to verify. |
| MeshSegNet | **N/A** | `MESHSEGNET_SHA256` not set in `.env`. SHA-256 verification at startup would fail closed as designed. |

**Gate 3 result: BOTH ENGINES FAILED (no checkpoint to verify).**

### Gate 4 — Model Load

| Engine | Status | Detail |
|--------|--------|--------|
| TGN | **CANNOT RUN** | `TGN_ENABLED=false`; service not started; checkpoint missing. |
| MeshSegNet | **CANNOT RUN** | `MESHSEGNET_ENABLED=false`; service not started; checkpoint missing. `_state` would remain `DISABLED`. |

**Gate 4 result: BOTH ENGINES FAILED.**

### Gate 5 — Warm-Up

| Engine | Status | Detail |
|--------|--------|--------|
| TGN | **N/A** | Cannot warm up without a loaded model. |
| MeshSegNet | **N/A** | Cannot warm up without a loaded model. |

**Gate 5 result: BOTH ENGINES FAILED.**

### Gate 6 — Health and Readiness

| Engine | Status | Detail |
|--------|--------|--------|
| TGN | **NOT READY** | `TGNProvider.health()` returns `healthy=False, ready=False` when `TGN_ENABLED=false`. |
| MeshSegNet | **NOT READY** | `MeshSegNetProvider.health()` returns `healthy=False, ready=False` when engine is `None` (disabled). |
| MANUAL | **READY** | `ManualReviewProvider.health()` always returns `healthy=True, ready=True`. |

**Gate 6 result: MANUAL only — correct for SCENARIO D.**

### Gate 7 — Real STL Inference with Validated Output

| Engine | Status | Detail |
|--------|--------|--------|
| TGN | **NOT RUN** | P0 license blocker and missing checkpoint prevent execution. |
| MeshSegNet | **NOT RUN** | Missing checkpoint prevents execution. |
| MANUAL | **PASS** | Returns structured manual-review referral with `requires_manual_review=True` and clinical disclaimer. No AI inference attempted. |

**Gate 7 result: ONLY MANUAL PROVIDER OPERATIONAL.**

---

## Activation Outcome: SCENARIO D

All seven gates were evaluated. Both TGN and MeshSegNet fail at Gate 1 (license) and Gate 2 (checkpoint). No further gates can be evaluated until these P0/P1 blockers are resolved.

**Production configuration:**
```
TGN_ENABLED=false
MESHSEGNET_ENABLED=false
SEGMENTATION_PROVIDER=MANUAL
SEGMENTATION_PRIMARY=TGN   # retained as default for when TGN is eventually cleared
```

The router (`ai-engine/src/routing.py`) uses `SEGMENTATION_PROVIDER=MANUAL` as its default (hard-coded fallback in `os.getenv("SEGMENTATION_PROVIDER", "MANUAL")`). With no AI provider registered as ready, `SegmentationRouter.get_active_provider()` selects `ManualReviewProvider` as the only healthy candidate.

---

## Active Provider Behavior (MANUAL)

- Routes all segmentation jobs to `ManualReviewProvider`
- Returns: `requires_manual_review=True`, `ai_assisted=False`, `disclaimer="AI-assisted segmentation. Manual clinical review required."`
- Never fabricates tooth labels, confidence values, or mesh geometry
- Always healthy; never raises on `segment()`
- Logged at `INFO` level as: `"SegmentationRouter selected provider: MANUAL"`

---

## Path to Enabling AI Engines

### TGN activation requirements (all must be satisfied before enabling)
1. Obtain a commercial-use license for the TGN source code repository
2. Obtain written permission to use the training dataset commercially (CC BY-NC-ND 4.0 is a P0 blocker)
3. Obtain a legally cleared pretrained checkpoint
4. Place checkpoint at the path expected by `tgn-service/`
5. Set `TOOTHGROUPNETWORK_SHA256` and verify at startup
6. Complete warm-up and real-STL inference test
7. Obtain sign-off from clinical lead before setting `TGN_ENABLED=true`
8. Update `TOOTHGROUPNETWORK_LICENSE_REVIEW.md` with license confirmation and date

### MeshSegNet activation requirements (all must be satisfied before enabling)
1. Download pretrained checkpoint from MeshSegNet authors
2. Confirm checkpoint commercial-use and redistribution rights in writing
3. Run `scripts/download_checkpoints.sh` and verify `MESHSEGNET_SHA256`
4. Confirm SHA-256 recorded in `AI_CHECKPOINT_REGISTRY.md`
5. Start `meshsegnet-service` and verify `/health` returns `state=READY`
6. Run real-STL inference; confirm FDI mapping and clinical disclaimer present
7. Obtain sign-off from clinical lead before setting `MESHSEGNET_ENABLED=true`

---

## Hard Safety Rules Compliance

| Rule | Status |
|------|--------|
| Never run random-initialized weights | COMPLIANT — neither engine is started |
| Never mark engine ready without validated checkpoint | COMPLIANT — both engines return `ready=False` |
| No commercial use of TGN without written permission | COMPLIANT — TGN disabled |
| No commercial use of MeshSegNet checkpoint without verification | COMPLIANT — MeshSegNet disabled |
| All AI results include clinical disclaimer | COMPLIANT — enforced in `SegmentationProvider.segment()` base method |
| No AI result auto-approved clinically | COMPLIANT — `requires_manual_review=True` on all outputs |
| If any engine fails, route to MANUAL | COMPLIANT — MANUAL is always the terminal fallback |
| Never fabricate synthetic outputs | COMPLIANT — `ManualReviewProvider` makes no inference calls |
| Never expose engine ports publicly | COMPLIANT — both engines use `expose:` not `ports:` |
| Do not mark complete unless runtime tests pass | COMPLIANT — both engines BLOCKED; MANUAL passes; status is SCENARIO D |

---

## Sign-Off

| Role | Decision |
|------|----------|
| Engineering Lead | SCENARIO D confirmed — both engines BLOCKED |
| Clinical Safety | MANUAL-only routing approved for production |
| Security | No security gates blocked by MANUAL-only mode |
| Compliance | TGN CC BY-NC-ND P0 documented; MeshSegNet checkpoint rights P1 documented |
| PR Status | Draft — must remain Draft until at least one AI engine clears all 7 gates |
