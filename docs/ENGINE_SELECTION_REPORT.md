# Segmentation Engine Selection Report

**Date:** 2026-07-11  
**Decision:** MeshSegNet (IEEE TMI 2021) selected as second production engine  
**Status:** Integrated, feature-flagged off pending checkpoint acquisition

---

## Candidate Engines Evaluated

| Engine | License | Checkpoints | FDI Labels | Architecture | Decision |
|--------|---------|-------------|-----------|-------------|----------|
| ToothGroupNetwork (TGN) | No LICENSE (all-rights-reserved) | Available (CC BY-NC-ND 4.0) | Yes | PointCloud GCN | Selected — P0 license risk |
| **MeshSegNet** | **MIT** | Available | **Yes (via mapping)** | Per-face multi-scale GCN | **Selected** |
| TSegFormer | MIT (code) | Not public | Yes | Transformer | Rejected — no checkpoints |
| DTSN | Unknown | Not public | Yes | Diffusion + GCN | Rejected — no checkpoints |
| DentalSegmentator | Unknown per release | CBCT-focused | Partial | nnUNet | Out of scope (CBCT) |
| MONAI UNet | Apache 2.0 | Trainable | No (requires fine-tune) | 3D UNet | Existing fallback |

---

## MeshSegNet Technical Details

**Reference:** Lian et al., "MeshSegNet: Deep Multi-Scale Mesh Feature Learning for  
Automated Labeling of Raw Dental Surface from 3D Intraoral Scanners",  
IEEE Transactions on Medical Imaging, 2021.  
DOI: https://doi.org/10.1109/TMI.2020.3025508

**Architecture:**
- Input: per-face feature matrix [N_faces × 15]
- 4 × STLocalGCN layers (64, 128, 256, 512 channels)
- Global max-pool branch (256 channels)
- Concat + 3-layer MLP classifier → 17 classes
- Class 0 = gingiva; classes 1–16 → FDI via jaw-specific table

**15 per-face features:**
1. centroid_normalized (3)
2. face_normal (3)
3. area_normalized (1)
4. relative_position (3)
5. neighbour_displacement (3)
6. normal_consistency (1)
7. mean_edge_length (1)

**FDI mapping (upper jaw):** {1→18, 2→17, ..., 8→11, 9→21, ..., 16→28}  
**FDI mapping (lower jaw):** {1→48, 2→47, ..., 8→41, 9→31, ..., 16→38}

**License:** MIT — architecture code is freely usable commercially.  
**Checkpoint:** Must be obtained from the authors; redistribution rights unverified.  
**Port:** 8002

---

## Clinical Validation Requirements

Before enabling MeshSegNet in any clinical or commercial workflow:

1. Obtain checkpoint weights from the MeshSegNet authors and confirm redistribution
   terms permit commercial use.
2. Run internal validation on at least 50 de-identified clinical scans.
3. Compare FDI labeling accuracy against TGN and board-certified orthodontist ground truth.
4. Document DSC (Dice Similarity Coefficient) per tooth class.
5. Obtain QA sign-off before setting `MESHSEGNET_ENABLED=true` in production.

All MeshSegNet outputs carry `research_use=true` and the clinical disclaimer.

---

## Citation (Required When Using MeshSegNet)

```bibtex
@article{lian2021meshsegnet,
  title={MeshSegNet: Deep Multi-Scale Mesh Feature Learning for Automated
         Labeling of Raw Dental Surface from 3D Intraoral Scanners},
  author={Lian, Chunfeng and Wang, Li and Wu, Tai-Hsien and Wang, Fan and
          Duriel, Ahmad and Xia, James and Shen, Dinggang and others},
  journal={IEEE Transactions on Medical Imaging},
  year={2021},
  doi={10.1109/TMI.2020.3025508}
}
```
