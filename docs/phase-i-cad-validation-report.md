# Phase I — CAD Validation Report

**Date**: 2026-07-02  
**Branch**: `claude/myortho-production-validation-dlmvsi`  
**Method**: Source code review of `frontend/src/components/CADEngine.tsx` (1,965 lines) and `frontend/src/components/Viewer3D.tsx` (760 lines). No running browser or GPU available.

---

## Architecture Overview

There are **two completely separate 3D systems** in the frontend that are never connected:

| System | File | Purpose | Geometry |
|--------|------|---------|---------|
| CADEngine | `frontend/src/components/CADEngine.tsx` | Treatment planning, tooth movement, IPR | **SphereGeometry placeholders only** |
| Viewer3D | `frontend/src/components/Viewer3D.tsx` | Scan viewing, measurements | **Real STL/OBJ/PLY files** |

The planning system (CADEngine) never receives real scan geometry. The scan viewer (Viewer3D) has no connection to the planning system.

---

## I1 — File Format Import (Viewer3D.tsx)

| Format | Loader | Status |
|--------|--------|--------|
| STL (binary) | three.js `STLLoader` | IMPLEMENTED |
| STL (ASCII) | three.js `STLLoader` | IMPLEMENTED |
| OBJ | three.js `OBJLoader` | IMPLEMENTED |
| PLY (binary) | three.js `PLYLoader` | IMPLEMENTED |
| PLY (ASCII) | three.js `PLYLoader` | IMPLEMENTED |

**Threading**: All parsing is synchronous on the main thread via `FileReader.readAsArrayBuffer`. For large files (>50MB), this will block the UI until parsing completes.

**Memory management**: Geometry objects are stored in component state. No explicit `geometry.dispose()` call exists on component unmount — this is a memory leak vector on scene reload.

**CADEngine**: Receives NO file input. All tooth models are `SphereGeometry(0.8, 16, 16)` (a small sphere). Real scan data is never rendered in the planning view.

---

## I2 — Mesh Operations

| Operation | Viewer3D | CADEngine |
|-----------|---------|----------|
| Mesh cleanup | Not present | Not present |
| Mesh repair (hole filling) | Not present | Not present |
| Normal recalculation | `geometry.computeVertexNormals()` on load | Not applicable (spheres) |
| Smoothing | Not present | Not present |
| Remeshing | Not present | Not present |

**Finding**: No mesh repair or cleanup is available in either system. Imported scans with holes, non-manifold edges, or flipped normals are rendered as-is.

---

## I3 — Planning and Transform Tools (CADEngine.tsx)

| Feature | Implementation | Notes |
|---------|---------------|-------|
| Tooth selection | Click on sphere mesh via raycasting | Functional |
| Translation (drag) | Mouse delta → position offset | Functional (on spheres) |
| Rotation | Mouse delta → Euler angle | Functional (on spheres) |
| Precision movement | Input fields for X/Y/Z/Rx/Ry/Rz | Implemented |
| Transform gizmo | Custom arrow mesh (not TransformControls) | Basic — no scale gizmo |
| Undo | 50-snapshot position/rotation stack | Implemented; persists only transform overrides |
| Redo | Stack pop | Implemented |
| History | Array of action labels | Implemented (labels only, no diff) |
| Snapshots | Named save points in undo stack | Implemented |
| Collision detection | Euclidean distance between sphere centers | **Inaccurate** — sphere centers do not represent actual tooth geometry |
| Occlusion visualization | Sphere proximity colouring | **Inaccurate** — same limitation as collision |
| Cross-sections | THREE.Plane clipping | Implemented |
| Clipping planes | Up to 6 renderer clipping planes | Implemented |

**Critical gap**: Because all teeth are spheres, collision detection reports collisions between sphere centers at a fixed threshold. A real tooth whose crown extends 5mm from its geometric center would be classified as colliding when it is still 3mm away, or as non-colliding when roots actually overlap. This is clinically meaningless.

---

## I4 — Attachment and IPR Visualization (CADEngine.tsx)

| Feature | Implementation |
|---------|---------------|
| Attachment markers | 3D box geometry placed on sphere surface | Present |
| Attachment type selector | Dropdown UI bound to attachment state | Present |
| IPR visualization | Red line segment between adjacent teeth | Present (between sphere positions) |
| IPR amount display | Tooltip on hover | Present |
| Root visualization | Cone geometry below sphere centroid | Present (not derived from scan) |

All visualization is relative to sphere positions, not actual tooth anatomy.

---

## I5 — Export (CADEngine.tsx)

| Export type | Format | Actual content |
|------------|--------|---------------|
| "STL export" | JSON | Tooth positions and rotations as JSON object |
| "Treatment plan export" | JSON | Stage data, tooth overrides, attachments as JSON |

**Finding**: The export function generates JSON metadata, not STL binary. The filename is labeled `.stl` but the content is JSON. A downstream system (printer, lab software) expecting a valid STL file will fail to parse this export.

---

## I6 — Measurement Tools (Viewer3D.tsx)

| Tool | Implementation | Status |
|------|---------------|--------|
| Point-to-point distance | Raycasted hit → Euclidean distance | Implemented |
| Angle measurement | Three raycasted points → vector angle | Implemented |
| Overjet measurement | Manual two-point horizontal distance | Implemented |
| Overbite measurement | Manual two-point vertical distance | Implemented |
| Annotation overlay | Three.js `Sprite` with canvas texture | Implemented |

Measurement tools operate on real mesh geometry via raycasting in Viewer3D. These are correct for scan viewing.

---

## I7 — Stress Testing

**Cannot be performed** — no running browser, no GPU, no file system with test STLs available. Source code analysis only.

**Predicted bottlenecks based on code review**:

| File size | Likely behavior |
|-----------|----------------|
| 10 MB | Synchronous parse (~200–400ms); UI freeze noticeable |
| 50 MB | Synchronous parse (~1–2s); UI unresponsive during load |
| 100 MB | Synchronous parse (~3–5s); browser may show "page unresponsive" warning |
| 250 MB | Very likely to exhaust V8 heap on 32-bit systems; on 64-bit with 4GB RAM should complete but will freeze UI for 10–20s |
| 500 MB | Expected OOM crash on most consumer machines. No streaming or chunked loading exists. |

`Viewer3D.tsx` loads the entire file into `ArrayBuffer` before parsing. No Web Worker offloading, no streaming parser, no LOD (level-of-detail) system.

---

## I8 — Performance Architecture

| Feature | Status |
|---------|--------|
| Web Worker for parsing | Not implemented |
| LOD (Level of Detail) | Not implemented |
| Geometry instancing | Not implemented |
| Frustum culling | Three.js default only |
| Progressive loading | Not implemented |
| Texture streaming | Not applicable (no textures) |
| Memory dispose on unmount | Not implemented (leak risk) |

---

## Summary

| Area | Status | Critical issues |
|------|--------|----------------|
| STL/OBJ/PLY import | IMPLEMENTED (Viewer3D) | Synchronous main-thread parse |
| Planning geometry | **PLACEHOLDER** | SphereGeometry only — no real scan data |
| Collision detection | **INACCURATE** | Sphere-center Euclidean distance only |
| Occlusion | **INACCURATE** | Same limitation |
| Export | **BROKEN** | Exports JSON labeled as STL |
| Measurement tools | IMPLEMENTED | Functional on real scans |
| Undo/Redo | IMPLEMENTED | Transform overrides only |
| Memory management | GAP | No geometry.dispose() on unmount |
| Large file (>100MB) | UNTESTED | Expected freeze/OOM |
| Planning ↔ Scan connection | **MISSING** | Two disconnected systems |

**CAD Readiness Score**: 35/100  
Rationale: Viewer3D has working file loading and measurements. CADEngine planning system uses geometric placeholders — no real anatomy, inaccurate collision, broken STL export. The gap between scan geometry and planning is the most significant architectural issue in the entire frontend.
