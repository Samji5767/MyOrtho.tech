# TGN vs MeshSegNet — Side-by-Side Comparison

**Last updated:** 2026-07-11  
**Sprint:** Multi-Engine AI Segmentation Integration

---

## Summary

| Property | ToothGroupNetwork (TGN) | MeshSegNet |
|----------|------------------------|------------|
| Reference | Kwon et al., 2022 | Lian et al., IEEE TMI 2021 |
| License | No LICENSE file (all-rights-reserved) | MIT |
| Training data license | CC BY-NC-ND 4.0 | Not publicly documented |
| Commercial use | **Blocked** (P0 risk) | Permitted (MIT code) |
| Checkpoint availability | Available (CC BY-NC-ND 4.0) | Available from authors |
| Checkpoint redistribution | Not permitted (NC-ND) | Unverified — confirm before redistribution |
| Input representation | Point cloud (vertices) | Per-face feature matrix [N × 15] |
| Architecture | PointCloud + GCN | Multi-scale STLocalGCN |
| Classes | 17 (0=gingiva, 1–16=teeth) | 17 (0=gingiva, 1–16=teeth) |
| FDI output | Direct (jaw-specific table) | Via jaw-specific mapping table |
| GPU requirement | Recommended | Recommended; CPU-only is slower |
| Service port | 8001 | 8002 |
| Feature flag | `TGN_ENABLED` | `MESHSEGNET_ENABLED` |
| Default enabled | false | false |

---

## Architecture

### ToothGroupNetwork

```
Input: point cloud [N_points × 3]
  │
  ▼
PointNet++ feature extraction
  │
  ▼
Graph Convolutional Network (point-level)
  │
  ▼
17-class softmax per point → majority vote per tooth
```

- Works at **vertex** (point) level
- Outputs per-vertex class labels
- Tooth instances derived by connected-component clustering on same-label vertices

### MeshSegNet

```
Input: per-face feature matrix [N_faces × 15]
         + adjacency indices [N_faces × K]
  │
  ▼
4 × STLocalGCN layers (64 → 128 → 256 → 512 channels)
  │                    + global max-pool → 256-dim descriptor
  ▼
Concatenate local(512) + global(256) + original(15) → 1216
  │
  ▼
3-layer MLP classifier → 17 classes → log_softmax
```

- Works at **face** level
- 15 face features: centroid(3) + normal(3) + area(1) + rel_pos(3) + neighbour_disp(3) + normal_consistency(1) + mean_edge(1)
- STLocalGCN gathers K=6 face neighbours, computes edge features via 2×in → out MLP + BN + ReLU + max-pool

---

## Input/Output Formats

| Aspect | TGN | MeshSegNet |
|--------|-----|------------|
| Accepted file format | STL, OBJ | STL, OBJ (via trimesh) |
| Input features | XYZ vertex coords | 15 per-face features |
| Model input tensor | `[N, 3]` float32 | `[1, N_faces, 15]` float32 |
| Adjacency tensor | None (PointNet++) | `[1, N_faces, K]` int64 |
| Output tensor | `[N, 17]` logits per vertex | `[N_faces, 17]` log-softmax |
| FDI derivation | per-vertex label → FDI table | per-face label → FDI table |
| Confidence source | per-vertex softmax max | per-face softmax max, averaged per tooth |

---

## FDI Mapping Tables

Both engines use the same FDI conventions, implemented independently in each service.

### Upper Jaw (class → FDI)

| Class | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|-------|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|
| FDI   | 18 | 17 | 16 | 15 | 14 | 13 | 12 | 11 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 |

### Lower Jaw (class → FDI)

| Class | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|-------|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|
| FDI   | 48 | 47 | 46 | 45 | 44 | 43 | 42 | 41 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 |

Class 0 → gingiva (excluded from FDI output)

---

## Validation Logic (both engines)

Both FDI validators implement the same clinical gate:

| Check | Threshold | Action |
|-------|-----------|--------|
| Gingiva-only result | 0 teeth | requires_manual_review |
| Deciduous teeth detected | Any deciduous FDI | flag + warning |
| Cross-jaw contamination | Upper label in lower scan (or vice versa) | flag + warning |
| Per-tooth confidence gate | < 0.70 | flag low-confidence teeth |
| Quadrant continuity | Gap in quadrant sequence | flag warning |
| Partial segmentation | < 4 viable teeth | requires_manual_review |

---

## Clinical Output Fields

Both engines produce the same SegmentationResult structure:

```json
{
  "engine": "TGN | MESHSEGNET",
  "engine_version": "...",
  "tooth_count": 28,
  "fdi_labels": [11, 12, 13, ...],
  "confidence_scores": {"11": 0.93, "12": 0.91, ...},
  "requires_manual_review": false,
  "research_use": true,
  "disclaimer": "Research-use segmentation. Manual clinical review required. ...",
  "warnings": [],
  "timing_ms": 1234
}
```

`research_use: true` and `disclaimer` are present on **every** response from both engines.

---

## Performance Characteristics (Reference)

These are approximate values from the MeshSegNet authors and community benchmarks.
**Not validated on MyOrtho.tech internal data — run internal validation before production use.**

| Metric | TGN (reported) | MeshSegNet (reported) |
|--------|---------------|----------------------|
| Mean DSC | ~0.94 (typical IOS scans) | ~0.92 (IEEE TMI 2021 dataset) |
| Inference time (GPU) | ~2–4 s | ~3–6 s |
| Inference time (CPU) | ~30–90 s | ~60–180 s |
| Memory (GPU) | ~2–4 GB | ~3–6 GB |
| Sensitivity to mesh quality | Moderate | Higher (face-level features) |

Internal validation against 50+ de-identified scans is required before enabling either engine in clinical workflows.

---

## License Risk Summary

| Risk | TGN | MeshSegNet |
|------|-----|------------|
| Code license | All-rights-reserved (P0) | MIT (clear) |
| Checkpoint license | CC BY-NC-ND 4.0 (non-commercial) | Unverified |
| Commercial deployment | **Blocked until resolved** | Permitted once checkpoint terms confirmed |
| Recommended path | Obtain commercial license from authors | Confirm checkpoint redistribution terms with Lian et al. |

See `docs/ADR/006-multi-engine-segmentation.md` for the full decision record.

---

## Required Citations

### TGN
Contact authors for citation requirements (no public LICENSE).

### MeshSegNet (required when used)
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
