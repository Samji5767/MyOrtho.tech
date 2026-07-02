# STL Validation Checklist
> Phase 28 — Part 2  
> Status: **Checklist only** — no patient STL files are present in this repository.
> Validation against real files must be performed in a HIPAA-compliant environment
> after proper de-identification.

---

## Why this checklist exists

Clinical aligner manufacturing depends on geometrically valid STL meshes. An invalid
mesh passed to the slicer produces defective aligners. This checklist defines the
acceptance criteria that `MeshProcessor` and the manufacturing pipeline must enforce
before any STL is accepted as input to treatment planning.

---

## 1. File-level checks

| Check | Pass criterion | Implemented in |
|-------|---------------|----------------|
| File parses without error | `trimesh.load_mesh()` returns a non-empty `Trimesh` | `mesh_processing.py:validate_mesh` |
| File is not empty | `len(mesh.faces) > 0` | `mesh_processing.py:validate_mesh` |
| File size | 50 KB ≤ size ≤ 500 MB | Manual pre-check (not yet in code) |
| Format | `.stl`, `.obj`, `.ply` | trimesh supports all three |

---

## 2. Topology checks

| Check | Pass criterion | Implemented |
|-------|---------------|-------------|
| Watertight mesh | `mesh.is_watertight == True` | Yes — `validate_mesh` |
| No degenerate faces | Zero-area faces < 0.01% of total | Yes — `validate_mesh` |
| Non-manifold edge ratio | < 2% of all edges | Not yet implemented |
| Connected components | 1 component per arch scan | Not yet implemented |
| Face count floor | ≥ 10,000 faces (clinical resolution) | Not yet implemented |
| Face count ceiling | ≤ 5,000,000 faces (performance limit) | Not yet implemented |

---

## 3. Dimensional sanity checks

| Check | Pass criterion | Rationale |
|-------|---------------|-----------|
| Bounding box X | 40–100 mm | Adult dental arch width range |
| Bounding box Y | 30–80 mm | Arch depth range |
| Bounding box Z | 5–40 mm | Clinical crown height range |
| Mesh centroid near origin | < 200 mm from [0,0,0] | Prevents misaligned scans |

These checks are not yet implemented in `mesh_processing.py` and must be added before
full clinical validation.

---

## 4. Surface quality checks

| Check | Pass criterion | Notes |
|-------|---------------|-------|
| Average edge length | 0.1–2.0 mm | Coarser = less accurate |
| Curvature signal present | `discrete_mean_curvature_measure` returns non-zero values on ≥ 80% of faces | Required for LandmarkDetector |
| No self-intersections | `mesh.is_valid == True` | trimesh can detect |

---

## 5. Clinical content checks (manual / radiographic correlation required)

These cannot be automated without a reference annotation:

- [ ] All 28 (or 32) teeth are represented in the scan
- [ ] Gingival margin is visible for attachment placement simulation
- [ ] No significant STL artifacts from scanner motion (manual review)
- [ ] Scan date recorded and within 6 months of treatment start

---

## Gap summary

The following checks are **not yet implemented** in `ai-engine/src/mesh_processing.py`
and must be added before production deployment:

1. Non-manifold edge ratio check
2. Connected-component count check
3. Face count floor and ceiling
4. Bounding box dimensional sanity
5. Mesh centroid proximity check
6. Self-intersection detection
