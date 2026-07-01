# AI Model Readiness — Phase 28 Audit
> Audit date: 2026-07-01  
> Constraint: No fabricated results. Limitations reported explicitly.

---

## 1. OrthoSegmentationEngine

**File:** `ai-engine/src/segmentation.py`

| Property | Value |
|----------|-------|
| Architecture | MONAI UNet — `spatial_dims=3, in_channels=1, out_channels=33, channels=(16,32,64,128,256)` |
| Framework | PyTorch + MONAI |
| Trained weights | **NONE** — model instantiated with random initialization |
| Inference output | 33 logit channels mapped to FDI labels via `LABEL_TO_FDI` dict |
| Current production status | **NOT PRODUCTION READY** |

**Limitation (explicit):** `segmentation.py` instantiates the MONAI UNet but loads no checkpoint:
```python
self.model = UNet(spatial_dims=3, in_channels=1, out_channels=33, ...)
# No: self.model.load_state_dict(torch.load(...))
```
The fallback `_demo_segmentation()` returns anatomically plausible FDI assignments by
quadrant heuristic — not by neural network inference. Any confidence score returned is
`"demo_only"`, not a real posterior probability.

**Required before production:**
- [ ] Train on ≥500 annotated CBCT volumes with validated tooth labels
- [ ] Checkpoint saved to `ai-engine/weights/segmentation_v1.pt`
- [ ] Loader added: `self.model.load_state_dict(torch.load("weights/segmentation_v1.pt"))`
- [ ] Validation DSC (Dice Similarity Coefficient) ≥ 0.85 per tooth class
- [ ] DICOM de-identification verified before training data ingest

---

## 2. DentalLandmarkDetector

**File:** `ai-engine/src/landmark_detector.py`

| Property | Value |
|----------|-------|
| Algorithm | Discrete mean curvature via `trimesh.curvature.discrete_mean_curvature_measure` |
| Fallback | ICP-based crown-to-atlas registration |
| Requires trained weights | **No** — pure geometry |
| Input | Trimesh `Trimesh` object (from parsed STL/OBJ) |
| Output | Landmark dict: `{cusp_tip, mesial_contact, distal_contact, cementoenamel_junction}` |
| Production status | **PRODUCTION READY** for meshes with clean topology |

**Known limitation:** Accuracy degrades on meshes with:
- > 5% non-manifold edges
- Fewer than 500 faces per tooth
- Heavy occlusal wear (flat curvature signal)

---

## 3. RootPredictorEngine

**File:** `ai-engine/src/root_predictor.py`

| Property | Value |
|----------|-------|
| Crown alignment | ICP registration (`trimesh.registration.icp`) against crown mesh |
| Centerline | 5-point Bezier approximation from crown to estimated apex |
| Apex estimation | Statistical offset from crown centroid using `ROOT_APEX_OFFSETS` table |
| Requires trained weights | **No** — geometry + statistical table |
| Production status | **PRODUCTION READY** for planning (not for surgical guides) |

**Known limitation:** Apex offset table (`ROOT_APEX_OFFSETS`) is derived from population
averages, not patient-specific CBCT. Root length error can be ±2–3 mm for teeth with
morphological variants (dilaceration, extra canals). A CBCT integration layer is required
before using root predictions for surgical guide manufacturing.

---

## 4. MeshProcessor

**File:** `ai-engine/src/mesh_processing.py`

| Property | Value |
|----------|-------|
| Parser | `trimesh.load_mesh()` — supports STL, OBJ, PLY, OFF |
| Validation | watertight check, face count, degenerate faces |
| Hollowing | `trimesh.boolean.difference()` via OpenSCAD backend |
| Production status | **PRODUCTION READY** for typical clinical STL files |

**Known limitation:** Boolean hollowing requires OpenSCAD to be installed in the runtime
container. The `Dockerfile` for `ai-engine` must include `apt-get install -y openscad`.
Without it, hollowing silently returns the original solid mesh.

---

## Summary

| Engine | Algorithm Type | Weights Required | Production Ready |
|--------|---------------|-----------------|-----------------|
| OrthoSegmentation | Deep learning (MONAI UNet) | **Yes — MISSING** | No |
| LandmarkDetector | Geometric (trimesh curvature) | No | Yes |
| RootPredictor | Geometric + statistical table | No | Yes (planning only) |
| MeshProcessor | Algorithmic (trimesh boolean) | No | Yes (needs OpenSCAD) |
