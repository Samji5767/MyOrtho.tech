# AI Checkpoint Registry

**Sprint:** Final AI Segmentation Activation & Production Verification  
**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Date:** 2026-07-12  
**Status:** NO CHECKPOINTS REGISTERED — both engines BLOCKED  

---

## Overview

This registry tracks the status of all AI model checkpoints used by MyOrtho.tech segmentation engines. A checkpoint must appear in this registry, with a confirmed SHA-256 hash, before it may be used in production.

**Current state:** No checkpoints are registered. Both engines are feature-flagged off.

---

## Registered Checkpoints

*None. The table below shows the expected schema for when checkpoints are obtained.*

| Engine | Filename | SHA-256 | Size | Source | License | Date Obtained | Obtained By | Production Approved |
|--------|----------|---------|------|--------|---------|---------------|-------------|---------------------|
| MeshSegNet | *(pending)* | *(pending)* | ~500 MB | MeshSegNet authors | MIT (source); checkpoint rights TBD | — | — | No |
| TGN | *(pending)* | *(pending)* | ~500 MB | TGN authors | BLOCKED (CC BY-NC-ND) | — | — | No |

---

## Checkpoint Search Results (2026-07-12)

Filesystem scan performed:
```bash
find / -name "*.pth" -o -name "*.h5" -o -name "*.pt" -o -name "*.ckpt" 2>/dev/null
```

**Result:** Zero checkpoint files found.

Path-specific checks:
- `/ckpts/meshsegnet.pth` — NOT FOUND
- `/opt/toothgroupnetwork/ckpts/` — directory does not exist
- `meshsegnet-ckpts` Docker volume — not populated
- `tgn-ckpts` Docker volume — not populated (if it exists)

---

## Checkpoint Acquisition Procedures

### MeshSegNet Checkpoint

**Blocker status:** P1 — checkpoint not obtained; redistribution rights unconfirmed.

Steps to obtain:
1. Contact MeshSegNet authors (Tian et al., IEEE TMI 2021) to request pretrained checkpoint
2. Obtain written confirmation that the checkpoint may be used commercially and redistributed within a SaaS product
3. If granted, download the checkpoint to the VPS:
   ```bash
   ./scripts/download_checkpoints.sh
   ```
4. The script will compute SHA-256 automatically and print it
5. Add the SHA-256 to `.env`:
   ```
   MESHSEGNET_SHA256=<sha256_value>
   ```
6. Update this registry with all fields above
7. Start `meshsegnet-service` and verify `/health` returns `state=READY`
8. Run test inference on a real STL file
9. Obtain clinical lead sign-off
10. Set `MESHSEGNET_ENABLED=true` only after steps 1–9 are complete

**Citation required:**
> Tian, Z., Liu, L., Zhang, Z., & Fei, B. (2021). Automatic Tooth Segmentation of Dental Mesh Based on Sparse Point Supervision. *IEEE Transactions on Medical Imaging*, 40(11), 3256–3268.

### TGN Checkpoint

**Blocker status:** P0 — BLOCKED by CC BY-NC-ND 4.0 training data license.

Steps required before a checkpoint may be obtained:
1. Obtain a commercial-use license for the TGN source code from the authors
2. Obtain written permission for commercial use of the CC BY-NC-ND 4.0 training dataset
3. Only after steps 1–2 are legally complete, contact authors for a commercially cleared checkpoint
4. Follow the same SHA-256 verification and registry update process as MeshSegNet above
5. Update `TOOTHGROUPNETWORK_LICENSE_REVIEW.md` with the license grant details and date

**Do NOT obtain or use a TGN checkpoint until the CC BY-NC-ND license blocker is formally resolved.**

---

## Verification Protocol

All checkpoints must be verified at two points:

### 1. Download time
`scripts/download_checkpoints.sh` computes SHA-256 of the downloaded file and compares it to `MESHSEGNET_SHA256` (or equivalent TGN variable). The script exits non-zero if the checksum does not match.

### 2. Service startup
`meshsegnet-service/api/main.py` (and the equivalent TGN service) reads the checkpoint path, computes its SHA-256, and compares it to the env variable. If the checksum is absent or mismatched, the service sets `_state=ERROR` and all health checks return `ready=False`. **No inference is run with an unverified checkpoint.**

---

## Emergency Procedures

### Checkpoint compromised or corrupted
1. Set `MESHSEGNET_ENABLED=false` (or `TGN_ENABLED=false`) immediately
2. The router falls back to the next healthy provider (and ultimately to MANUAL)
3. Delete the corrupted checkpoint
4. Re-download and re-verify before re-enabling
5. Document the incident in this registry under a new "Incident Log" section

### Checkpoint rotation
1. Download the new checkpoint to a temporary path
2. Verify SHA-256 against the new expected value
3. Update `MESHSEGNET_SHA256` in `.env`
4. Replace the checkpoint file at the live path
5. Restart `meshsegnet-service` — the state machine verifies on startup
6. Update this registry entry with the new hash and date

---

## Registry Maintenance

This file must be updated whenever:
- A new checkpoint is obtained
- A checkpoint SHA-256 is changed (rotation)
- A checkpoint is revoked or removed
- A new engine is added to the platform

The registry is the authoritative source of truth for checkpoint provenance and verification status.
