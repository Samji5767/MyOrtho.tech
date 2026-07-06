import logging
import os

import numpy as np

logger = logging.getLogger("ai-engine.aligner_generator")


class AlignerGenerationEngine:
    def generate_aligner_shell(
        self,
        staged_mesh_path: str,
        thickness_mm: float = 0.75,
        trim_line_height_mm: float = 1.2,
    ) -> dict:
        """
        Creates an offset aligner shell from a staged dental model mesh.

        Algorithm:
          1. Load the staged arch mesh (tooth positions at one treatment stage).
          2. Compute per-vertex outward normals via trimesh.
          3. Offset all vertices outward by thickness_mm — this is the outer surface.
          4. Combine the outer surface (original winding) with a copy of the inner
             surface (reversed winding) so the shell has visible faces on both sides.
          5. Trim the gingival margin: discard faces whose vertices all sit below
             trim_line_height_mm above the mesh's lowest Z extent.  This approximates
             the gingival scallop cut line.
          6. Export as binary STL adjacent to the source file.

        Coordinate convention: Z+ = occlusal (teeth protrude upward).  The trim cut
        is applied in the Z direction using the mesh's own bounding box as the
        reference — no external calibration needed.

        Clinical disclaimer: This is a geometric approximation only.  The gingival
        trim line is linear; a production aligner requires a scalloped trim derived
        from the patient's gingival contour.  Do not use outputs for clinical or
        manufacturing purposes without a licensed clinician's review.
        """
        try:
            import trimesh  # type: ignore

            mesh = trimesh.load(staged_mesh_path, force="mesh")

            if not isinstance(mesh, trimesh.Trimesh) or len(mesh.faces) == 0:
                return {
                    "success": False,
                    "error": "empty_mesh",
                    "detail": f"Could not load a valid mesh from {staged_mesh_path}",
                }

            # ── Step 1: outer surface = vertices offset along vertex normals ──
            outer = mesh.copy()
            # vertex_normals triggers computation; clone before mutation
            normals = np.array(outer.vertex_normals)
            outer.vertices = outer.vertices + normals * thickness_mm

            # ── Step 2: inner surface = original mesh with reversed winding ──
            inner = mesh.copy()
            inner.faces = inner.faces[:, ::-1]  # flip every triangle's winding order

            # ── Step 3: combine into a single shell mesh ──
            shell = trimesh.util.concatenate([outer, inner])

            # ── Step 4: gingival trim ─────────────────────────────────────────
            z_min = float(shell.vertices[:, 2].min())
            z_max = float(shell.vertices[:, 2].max())
            span = z_max - z_min

            # Only trim if the mesh has meaningful Z extent (> 1 mm)
            if span > 1.0:
                trim_z = z_min + trim_line_height_mm
                # Keep faces where ALL three vertices are at or above trim_z
                face_z_min = shell.vertices[shell.faces, 2].min(axis=1)  # (N_faces,)
                keep = face_z_min >= trim_z

                if keep.sum() > 50:  # sanity check: at least 50 faces survive
                    kept_faces = shell.faces[keep]
                    used_verts, inv = np.unique(kept_faces, return_inverse=True)
                    shell = trimesh.Trimesh(
                        vertices=shell.vertices[used_verts],
                        faces=inv.reshape(-1, 3),
                        process=False,
                    )
                else:
                    logger.warning(
                        "Gingival trim would remove too many faces "
                        f"(trim_line_height_mm={trim_line_height_mm}); skipping trim"
                    )

            # ── Step 5: export ────────────────────────────────────────────────
            base, ext = os.path.splitext(staged_mesh_path)
            output_path = base + "_aligner.stl"
            shell.export(output_path)

            logger.info(
                f"Aligner shell generated: {output_path} "
                f"({len(shell.vertices)} verts, {len(shell.faces)} faces)"
            )
            return {
                "success": True,
                "output_path": output_path,
                "vertex_count": len(shell.vertices),
                "face_count": len(shell.faces),
                "thickness_mm": thickness_mm,
                "trim_line_height_mm": trim_line_height_mm,
                "disclaimer": (
                    "Aligner shell is a geometric approximation. "
                    "The gingival trim line is linear — not scalloped. "
                    "Not clinically validated. Requires review by a licensed clinician."
                ),
            }

        except ImportError:
            logger.error("trimesh is not installed; cannot generate aligner shells")
            return {
                "success": False,
                "error": "trimesh_unavailable",
                "detail": "Install trimesh to enable aligner shell generation.",
            }
        except Exception as exc:
            logger.error("generate_aligner_shell failed: %s", exc)
            return {
                "success": False,
                "error": "aligner_shell_generation_failed",
                "detail": str(exc),
            }
