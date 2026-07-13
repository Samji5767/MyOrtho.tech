# ToothGroupNetwork — License & Commercial Compliance Review

**Prepared by:** Independent Acceptance Audit (automated)  
**Date:** 2026-07-11  
**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Reviewer role:** Production acceptance gate  

---

## Executive Summary

| Component | License | Commercial Use | Status |
|-----------|---------|---------------|--------|
| TGN repository code | **No LICENSE file** (all rights reserved) | **Unknown / Presumed forbidden** | 🔴 P0 Blocker |
| Pretrained checkpoint weights | **No explicit license** | **Presumed forbidden** (trained on NC dataset) | 🔴 P0 Blocker |
| Training dataset (3DTeethSeg'22) | **CC BY-NC-ND 4.0** | **Forbidden** | 🔴 P0 Blocker |
| Challenge code scaffold | **MIT** | Permitted | ✅ Clear |

**Verdict: NO-GO for commercial deployment without explicit written permission from the ToothGroupNetwork authors and the 3DTeethSeg'22 dataset maintainers.**

---

## 1. Repository Code License

**Source:** https://github.com/limhoyeon/ToothGroupNetwork  
**Authors:** Ho Yeon Lim, Min Chang Kim (MICCAI 2022)

**Finding:** No `LICENSE` file is present in the ToothGroupNetwork repository. Under the Berne Convention (which governs all countries where MyOrtho.tech may operate), absence of a license means the code is **all rights reserved** by default. The authors retain exclusive copyright. Copying, modifying, or distributing the code — including integrating it into a commercial product — requires explicit written permission.

**Verification method:** HTTP GET to `https://raw.githubusercontent.com/limhoyeon/ToothGroupNetwork/main/LICENSE` returns 404. GitHub repository page shows no license badge.

**Risk:** Any production deployment of TGN source code without a license agreement constitutes copyright infringement.

---

## 2. Pretrained Checkpoint Weights License

**Source:** Google Drive, linked from TGN README  
**Archive:** `ckpts(new).zip`  
**Files:** `tgnet_fps.h5`, `tgnet_bdl.h5`, `tsegnet_centroid.h5`, `tsegnet_seg.h5`, `pointnet.h5`, `pointnetpp.h5`, `dgcnn.h5`, `pointtransformer.h5`

**Finding:** No license terms are attached to the Google Drive distribution. The checkpoint files are trained model weights derived from training on the 3DTeethSeg'22 challenge dataset (see Section 3). Under copyright law, trained model weights are derivative works of both the training code and the training data. Because the training dataset carries a CC BY-NC-ND 4.0 license (non-commercial, no derivatives), the checkpoint weights inherit those restrictions.

**Risk classification:** Using these weights in a commercial clinical product is very likely a violation of CC BY-NC-ND 4.0, which prohibits:
- Commercial use (NC clause)
- Creation of derivative works without permission (ND clause)

---

## 3. Training Dataset License

**Source:** 3DTeethSeg'22 Challenge  
**Repository:** https://github.com/abenhamadou/3DTeethSeg22_challenge

**License confirmed:** CC BY-NC-ND 4.0 (Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International)

**Full restrictions:**
- **BY** — Attribution required (cite the challenge paper)
- **NC** — **Non-commercial use only.** The dataset and any derivatives may not be used for commercial purposes.
- **ND** — **No derivatives.** You may not distribute modified versions or products derived from this dataset.

**Citation required:**
> Aous Naman, et al. "3DTeethSeg'22: 3D Teeth Scan Segmentation and Labeling Challenge." arXiv:2305.18277 (2023).

**Implication for MyOrtho.tech:** MyOrtho.tech is a commercial clinical platform. Deploying TGN — whose weights derive from this dataset — for commercial orthodontic analysis violates the NC clause.

---

## 4. Challenge Code Scaffold License

The evaluation and baseline code in the 3DTeethSeg'22 challenge repository is separately licensed under **MIT**. This permits commercial use with attribution.

The `cpu_compat.py` patch written by MyOrtho.tech and the FastAPI wrapper in `tgn-service/api/` are original works and not encumbered by the upstream license. However, they are useless without the TGN source code and weights.

---

## 5. Attribution Requirements

Regardless of commercial use status, the following citations are required whenever TGN outputs are used or published:

```bibtex
@inproceedings{lim2023toothgroupnetwork,
  title={ToothGroupNetwork: Multi-scale Tooth Segmentation by Using Point Cloud Group Features},
  author={Lim, Ho Yeon and Kim, Min Chang},
  booktitle={Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition},
  year={2023}
}

@article{ben2023teeth3ds,
  title={Teeth3DS: a benchmark for teeth segmentation and labeling from intra-oral 3D scans},
  author={Ben Hamadou, Achraf and others},
  journal={arXiv preprint arXiv:2305.18277},
  year={2023}
}
```

These citations are not present anywhere in the MyOrtho.tech codebase, documentation, or user-facing interfaces.

---

## 6. Redistribution Permissions

**TGN source code:** Redistribution without a license agreement is copyright infringement. The TGN code is vendored into `tgn-service/` and is included in the Docker image — this constitutes redistribution.

**Checkpoint weights:** Redistribution of the `.h5` files without license terms is legally uncertain at best, prohibited at worst given the NC/ND dataset provenance.

**Recommendation:** The TGN source code and checkpoint weights must NOT be bundled into a publicly distributed Docker image or pushed to any public or customer-facing registry until a license agreement is in place.

---

## 7. MyOrtho.tech Repository State

| Check | Result |
|-------|--------|
| `LICENSE` file at repo root | **Missing** — repo has no license |
| TGN source vendored under `tgn-service/` | Yes — `ToothGroupNetwork/` subdir referenced in Dockerfile |
| Checkpoint weights in repo | No (downloaded at deploy time via `scripts/download_checkpoints.sh`) |
| Attribution / citation in codebase | **Missing** |
| Third-party license inventory | **Missing** |

The absence of a top-level `LICENSE` file for the MyOrtho.tech repository itself is a separate issue: without one, MyOrtho.tech's own code is all-rights-reserved, which complicates contractor contributions, open-sourcing, and investor due diligence.

---

## 8. Required Actions Before Commercial Deployment

| Action | Priority | Owner |
|--------|----------|-------|
| Obtain written commercial license from TGN authors (Ho Yeon Lim, Min Chang Kim) | **P0** | Legal / Founders |
| Obtain written commercial license or dataset exemption from 3DTeethSeg'22 organizers | **P0** | Legal / Founders |
| Add citation block for TGN and 3DTeethSeg'22 to all interfaces/docs that show TGN output | **P0** | Engineering |
| Add `LICENSE` file to the MyOrtho.tech repository | **P1** | Founders |
| Add `THIRD_PARTY_LICENSES.md` listing all vendored open-source dependencies | **P1** | Engineering |
| Evaluate MIT-licensed alternative segmentation models for interim use | **P1** | ML Engineering |
| Obtain legal opinion on whether checkpoint weights are CC BY-NC-ND 4.0 derivatives | **P0** | Legal |

---

## 9. Interim Mitigation (Until License Resolved)

The existing implementation already gates TGN behind `TGN_ENABLED=false` by default. This is the correct interim state:

1. **Keep `TGN_ENABLED=false`** in all production deployments until a commercial license is confirmed.
2. **Do not expose TGN outputs to paying customers** even in beta or "research mode" without explicit consent.
3. **Do not include TGN checkpoint weights** in Docker images pushed to public registries.
4. **Keep all TGN outputs labeled** `research_use: true` and `"Research-use segmentation"` as the system currently does.
5. **Document the license risk** in investor disclosures and customer agreements if TGN is mentioned as a roadmap feature.

---

## 10. Alternative Models to Evaluate

If a commercial license for TGN cannot be obtained in a reasonable timeframe, the following alternatives should be evaluated:

| Model | License | Commercial Use | Notes |
|-------|---------|---------------|-------|
| PointNet (original) | MIT | Yes | Lower accuracy; no FDI labels |
| DGCNN | MIT | Yes | Better than PointNet; still weaker than TGN |
| DentalSegmentator | Check per release | Verify | ITK-Snap-based; CBCT focus |
| Custom fine-tuned MONAI model | Apache 2.0 | Yes | Already integrated as fallback in `ai-engine/` |

---

## Classification

**Overall finding: P0 — Release Blocker**

Deployment of ToothGroupNetwork-powered features to commercial customers is legally prohibited until:
1. A commercial license is obtained from the TGN authors, AND
2. A commercial exemption or license is obtained from the 3DTeethSeg'22 dataset maintainers, OR the legal team confirms that trained weights are sufficiently transformed to escape the CC BY-NC-ND 4.0 restriction.

This is a hard stop for clinical or commercial use. Research-internal use (e.g., benchmarking, internal validation) may be permissible under fair use / research exemptions depending on jurisdiction, but requires legal review.

---

*Review generated as part of the ToothGroupNetwork Production Acceptance Audit.*  
*This document is not legal advice. Engage qualified IP counsel before proceeding.*
