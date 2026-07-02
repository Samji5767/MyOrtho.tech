"""
Dental mesh processing: validation and hollowing.

validate_mesh() performs 5 checks:
  1. Watertight / boundary edges (original)
  2. Non-manifold edge ratio (new)
  3. Connected component count (new)
  4. Bounding box sanity — dental arch expected 30-200 × 20-150 × 5-100 mm (new)
  5. Self-intersection heuristic — degenerate faces + winding consistency (new)
"""

import logging

import numpy as np
import trimesh

logger = logging.getLogger("ai-engine.mesh_processing")

# Bounding box expectations for a dental arch scan (mm).
# These are intentionally wide to accommodate partial scans.
_BBOX_WIDTH_MIN = 30.0
_BBOX_WIDTH_MAX = 200.0
_BBOX_DEPTH_MIN = 20.0
_BBOX_DEPTH_MAX = 150.0
_BBOX_HEIGHT_MIN = 5.0
_BBOX_HEIGHT_MAX = 100.0

# Non-manifold edge ratio above which the mesh is flagged.
_MAX_NON_MANIFOLD_RATIO = 0.05   # 5 %

# More than this many disconnected bodies is suspicious for a dental arch.
_MAX_COMPONENTS = 50


class MeshProcessor:
    def validate_mesh(self, mesh_path: str) -> dict:
        """
        Comprehensive mesh validation for dental arch scan files.

        Returns a dict with per-check results, an ``issues`` list (human-readable
        descriptions of every failed check), and a boolean ``valid`` that is True
        only when the hard-fail checks all pass.

        Hard-fail checks (set ``valid=False``):
          - Mesh is not watertight
          - Non-manifold edge ratio > 5 %
          - Bounding box outside expected dental range

        Advisory checks (recorded in ``issues`` but do NOT set ``valid=False``):
          - > 50 disconnected components
          - Self-intersection suspected (degenerate faces or inconsistent winding)
        """
        logger.info(f"Validating mesh: {mesh_path}")

        # ── Load ──────────────────────────────────────────────────────────────
        try:
            loaded = trimesh.load(mesh_path, force="mesh")
        except Exception as exc:
            logger.error(f"Mesh load failed: {exc}")
            return {"valid": False, "error": str(exc)}

        if isinstance(loaded, trimesh.Scene):
            meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
            if not meshes:
                return {"valid": False, "error": "No mesh geometry found in scene"}
            loaded = trimesh.util.concatenate(meshes)

        if not isinstance(loaded, trimesh.Trimesh) or len(loaded.faces) == 0:
            return {"valid": False, "error": "Loaded geometry contains no faces"}

        mesh: trimesh.Trimesh = loaded
        issues: list[str] = []
        hard_fail = False

        # ── Check 1: Watertight / boundary edges ─────────────────────────────
        is_watertight = bool(mesh.is_watertight)
        try:
            hole_count = int(len(mesh.boundary_edges))
        except Exception:
            hole_count = 0
        triangle_count = int(len(mesh.faces))

        if not is_watertight:
            hard_fail = True
            issues.append(f"Mesh is not watertight ({hole_count} boundary edge(s))")

        # ── Check 2: Non-manifold edge ratio ─────────────────────────────────
        non_manifold_count = 0
        non_manifold_ratio = 0.0
        try:
            edges_sorted = np.sort(mesh.edges_sorted, axis=1)
            _, counts = np.unique(edges_sorted, axis=0, return_counts=True)
            total_edges = len(counts)
            non_manifold_count = int(np.sum(counts != 2))
            non_manifold_ratio = non_manifold_count / total_edges if total_edges > 0 else 0.0
        except Exception as exc:
            logger.warning(f"Non-manifold check failed: {exc}")
            issues.append("Non-manifold edge check could not be completed")

        if non_manifold_ratio > _MAX_NON_MANIFOLD_RATIO:
            hard_fail = True
            issues.append(
                f"Non-manifold edge ratio {non_manifold_ratio:.1%} exceeds "
                f"{_MAX_NON_MANIFOLD_RATIO:.0%} threshold "
                f"({non_manifold_count}/{len(counts) if 'counts' in dir() else '?'} edges)"
            )

        # ── Check 3: Connected component count ───────────────────────────────
        component_count = 1
        try:
            components = mesh.split(only_watertight=False)
            component_count = len(components)
        except Exception as exc:
            logger.warning(f"Component split failed: {exc}")

        if component_count > _MAX_COMPONENTS:
            # Advisory only — some valid dental scans have many small detached fragments
            issues.append(
                f"Mesh has {component_count} disconnected components "
                f"(expected ≤ {_MAX_COMPONENTS} for a dental arch)"
            )

        # ── Check 4: Bounding box sanity ─────────────────────────────────────
        extents = mesh.extents  # [dx, dy, dz]
        bbox_valid = (
            _BBOX_WIDTH_MIN <= extents[0] <= _BBOX_WIDTH_MAX
            and _BBOX_DEPTH_MIN <= extents[1] <= _BBOX_DEPTH_MAX
            and _BBOX_HEIGHT_MIN <= extents[2] <= _BBOX_HEIGHT_MAX
        )
        if not bbox_valid:
            hard_fail = True
            issues.append(
                f"Bounding box {extents[0]:.1f} × {extents[1]:.1f} × {extents[2]:.1f} mm "
                f"is outside expected dental arch range "
                f"({_BBOX_WIDTH_MIN}–{_BBOX_WIDTH_MAX} × "
                f"{_BBOX_DEPTH_MIN}–{_BBOX_DEPTH_MAX} × "
                f"{_BBOX_HEIGHT_MIN}–{_BBOX_HEIGHT_MAX} mm)"
            )

        # ── Check 5: Self-intersection heuristic ─────────────────────────────
        degenerate_face_count = 0
        is_winding_consistent = True
        self_intersection_suspected = False
        try:
            degenerate_face_count = int(np.sum(mesh.area_faces < 1e-8))
            is_winding_consistent = bool(mesh.is_winding_consistent)
            self_intersection_suspected = (
                degenerate_face_count > 0 or not is_winding_consistent
            )
        except Exception as exc:
            logger.warning(f"Self-intersection check failed: {exc}")

        if self_intersection_suspected:
            detail_parts = []
            if degenerate_face_count > 0:
                detail_parts.append(f"{degenerate_face_count} degenerate face(s)")
            if not is_winding_consistent:
                detail_parts.append("inconsistent winding")
            issues.append(
                f"Self-intersection suspected: {', '.join(detail_parts)}. "
                "Advisory only — repair recommended but does not block processing."
            )

        return {
            "valid": not hard_fail,
            "watertight": is_watertight,
            "hole_count": hole_count,
            "triangle_count": triangle_count,
            "non_manifold_edge_count": non_manifold_count,
            "non_manifold_edge_ratio": round(non_manifold_ratio, 4),
            "connected_component_count": component_count,
            "bounding_box_mm": {
                "width":  round(float(extents[0]), 2),
                "depth":  round(float(extents[1]), 2),
                "height": round(float(extents[2]), 2),
            },
            "bounding_box_valid": bbox_valid,
            "degenerate_face_count": degenerate_face_count,
            "winding_consistent": is_winding_consistent,
            "self_intersection_suspected": self_intersection_suspected,
            "issues": issues,
        }

    def hollow_and_label(
        self,
        input_path: str,
        output_path: str,
        wall_thickness_mm: float = 2.0,
        label: str = "",
    ) -> bool:
        """
        Hollow dental model by offsetting an inner shell, then export.

        Falls back to a straight copy if hollowing fails, so the pipeline
        always produces an output file.
        """
        logger.info(f"Loading mesh: {input_path}")
        logger.info(f"Hollowing mesh with wall thickness = {wall_thickness_mm} mm")

        try:
            mesh = trimesh.load(input_path)
            inner_mesh = mesh.copy()

            try:
                if len(inner_mesh.vertices) < 50_000:
                    inner_mesh = inner_mesh.subdivide()
            except Exception:
                pass

            inner_mesh.vertices -= inner_mesh.vertex_normals * wall_thickness_mm
            inner_mesh.invert()
            hollowed_mesh = trimesh.util.concatenate([mesh, inner_mesh])

            if label:
                logger.info(
                    f"Identification label '{label}' requested — "
                    "Boolean text engraving requires OpenSCAD; logged for post-process step."
                )

            hollowed_mesh.export(output_path)
            logger.info(f"Exported hollow model to: {output_path}")
            return True
        except Exception as exc:
            logger.error(f"Mesh hollowing failed: {exc} — falling back to direct copy")
            try:
                import shutil
                shutil.copy(input_path, output_path)
                return True
            except Exception:
                return False
