# AI License Activation Status

**Sprint:** Final AI Segmentation Activation & Production Verification  
**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Date:** 2026-07-12  
**Reviewed by:** Engineering / Legal Risk Assessment  

---

## Summary

| Engine | Source License | Checkpoint License | Training Data License | Activation Status |
|--------|---------------|--------------------|-----------------------|-------------------|
| TGN | Unknown (no LICENSE file) | Not obtained | CC BY-NC-ND 4.0 | **BLOCKED (P0)** |
| MeshSegNet | MIT | Not obtained / rights TBD | Unknown | **BLOCKED (P1)** |
| ManualReviewProvider | N/A (original code) | N/A | N/A | **ACTIVE** |

---

## ToothGroupNetwork (TGN) — BLOCKED (P0)

### Finding

The TGN repository (`tgn-service/`) does not contain a `LICENSE` file. The model was trained on a dataset that is published under **CC BY-NC-ND 4.0** (Creative Commons Attribution-NonCommercial-NoDerivatives). This license explicitly prohibits:

- Commercial use (NC — NonCommercial)
- Distribution of adapted material (ND — NoDerivatives)
- Use in a software-as-a-service product without written permission from the licensor

### Impact

- TGN **cannot** be used in MyOrtho.tech in any commercial capacity until license terms are renegotiated with the authors
- The pretrained checkpoint — even if obtained — would be a derivative of CC BY-NC-ND 4.0 data and cannot be redistributed or used commercially
- This is a **P0 blocker**: no workaround exists without explicit written permission from the TGN dataset authors

### Full analysis

See `TOOTHGROUPNETWORK_LICENSE_REVIEW.md` for the complete license review, risk assessment, and recommended remediation path.

### Status: BLOCKED

```
TGN_ENABLED=false   # must remain false until CC BY-NC-ND is resolved
```

Actions required to unblock:
1. Contact TGN authors to request a commercial license
2. Contact dataset authors to request CC BY-NC-ND commercial use waiver
3. Obtain written confirmation covering: source code, checkpoint, training data, derivative outputs, SaaS deployment, redistribution
4. Have the written permission reviewed by qualified legal counsel
5. Record the license grant in this document and in `TOOTHGROUPNETWORK_LICENSE_REVIEW.md`
6. Only then may `TGN_ENABLED=true` be set in production

---

## MeshSegNet — BLOCKED (P1)

### Finding

MeshSegNet source code is published under the **MIT License** (permissive; commercial use allowed). However:

1. The pretrained checkpoint has **not been obtained** from the MeshSegNet authors (Tian et al.)
2. The commercial-use and redistribution rights of the pretrained checkpoint have **not been confirmed** in writing
3. Without a checkpoint, the engine cannot be activated regardless of the source code license

### License analysis

MIT License (source code): permits commercial use, modification, and redistribution. This covers the Python model code copied or adapted from the MeshSegNet repository.

Pretrained checkpoint (unpublished): Not covered by any confirmed license. The checkpoint is a trained artifact that encodes the authors' dataset and training methodology. While it may be freely available for academic use, commercial-use rights for a trained checkpoint are separate from source code rights and require explicit author permission or a clearly published license statement.

### Status: BLOCKED (P1 — lower severity than TGN but still a blocker)

```
MESHSEGNET_ENABLED=false   # must remain false until checkpoint is obtained and rights confirmed
```

Actions required to unblock:
1. Contact Tian et al. to request the pretrained MeshSegNet checkpoint
2. Obtain written confirmation that the checkpoint may be used commercially within a SaaS product
3. Obtain written confirmation that redistributing inference results derived from the checkpoint is permitted
4. Run `scripts/download_checkpoints.sh` to download and verify the checkpoint SHA-256
5. Record the confirmed SHA-256 in `AI_CHECKPOINT_REGISTRY.md`
6. Set `MESHSEGNET_SHA256` in `.env`
7. Start `meshsegnet-service` and confirm `/health` returns `state=READY`
8. Run a real-STL inference test; verify output and clinical disclaimer
9. Obtain clinical lead sign-off
10. Only then may `MESHSEGNET_ENABLED=true` be set in production

### Required citation

Any deployment, publication, or commercial use of the MeshSegNet model or checkpoint must credit:

> Tian, Z., Liu, L., Zhang, Z., & Fei, B. (2021). Automatic Tooth Segmentation of Dental Mesh Based on Sparse Point Supervision. *IEEE Transactions on Medical Imaging*, 40(11), 3256–3268. DOI: 10.1109/TMI.2021.3096361

---

## ManualReviewProvider — ACTIVE (no license concerns)

The `ManualReviewProvider` (`ai-engine/src/providers/manual_provider.py`) is original code written for MyOrtho.tech. It makes no external AI inference calls and does not depend on any third-party model or dataset.

- No license review required
- Always operational
- Always the terminal fallback in the router chain
- Status: **ACTIVE — no restrictions**

---

## License Status History

| Date | Engine | Event | By |
|------|--------|-------|----|
| 2026-07-11 | TGN | P0 license blocker documented in `TOOTHGROUPNETWORK_LICENSE_REVIEW.md` | Engineering |
| 2026-07-11 | MeshSegNet | P1 blocker identified: checkpoint not obtained; rights unconfirmed | Engineering |
| 2026-07-12 | Both | Activation sprint confirms BLOCKED status; SCENARIO D adopted | Engineering |

---

## Maintenance

Update this document whenever:
- A license is obtained or confirmed
- Legal review is completed
- A license is revoked or expired
- A new engine is added to the platform

This document is the single source of truth for license-level activation status.
