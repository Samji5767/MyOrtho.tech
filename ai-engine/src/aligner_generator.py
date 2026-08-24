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
        voxel_pitch_mm: float = 0.4,
        gap_bridge_mm: float = 1.0,
    ) -> dict:
        """
        Create a watertight aligner shell from a staged dental model mesh.

        Algorithm (voxel signed-region offset — produces a closed solid, unlike
        a per-vertex normal push, which yields two open sheets):
          1. Load the staged arch mesh and voxelize its surface at
             ``voxel_pitch_mm``.
          2. Build the "solid positive model": in every voxel column that
             contains surface, everything from the topmost surface voxel down
             to the grid floor is solid.  This is the printed-model-with-base
             abstraction used for thermoforming; deep undercut cavities are
             filled by construction (documented approximation).
          3. Euclidean distance transform of the outside region gives the
             distance from every outside voxel to the model; the shell is the
             set of outside voxels within ``thickness_mm`` of the model —
             i.e. a uniform-thickness drape over the model, the geometric
             idealization of a thermoformed foil.
          4. Gingival trim: shell voxels below ``z_min + trim_line_height_mm``
             are removed from the voxel grid BEFORE meshing, so the cut edge
             is closed by the surfacing step rather than leaving an open rim.
          5. Marching cubes over the zero-padded shell grid yields a closed,
             watertight triangle mesh; light Taubin smoothing reduces voxel
             staircase artifacts without changing topology.
          6. Export as binary STL adjacent to the source file.

        Coordinate convention: Z+ = occlusal (teeth protrude upward).

        Accuracy bounds: surfaces are quantized at ``voxel_pitch_mm``, so wall
        thickness is ``thickness_mm`` ± one pitch; the trim line is planar,
        not scalloped to the gingival contour.

        Clinical disclaimer: geometric approximation only — uniform-thickness
        drape, filled undercuts, linear trim.  Not clinically validated.  Do
        not use outputs for clinical or manufacturing purposes without a
        licensed clinician's review.
        """
        try:
            import trimesh  # type: ignore
            from scipy import ndimage  # type: ignore
            from skimage import measure  # type: ignore

            mesh = trimesh.load(staged_mesh_path, force="mesh")

            if not isinstance(mesh, trimesh.Trimesh) or len(mesh.faces) == 0:
                return {
                    "success": False,
                    "error": "empty_mesh",
                    "detail": f"Could not load a valid mesh from {staged_mesh_path}",
                }

            pitch = float(voxel_pitch_mm)
            if pitch <= 0.05:
                return {
                    "success": False,
                    "error": "invalid_pitch",
                    "detail": "voxel_pitch_mm must be > 0.05",
                }

            # ── Step 1: surface voxel occupancy ───────────────────────────────
            vox = mesh.voxelized(pitch)
            surf = np.asarray(vox.matrix, dtype=bool)
            if not surf.any():
                return {
                    "success": False,
                    "error": "voxelization_empty",
                    "detail": "Voxelization produced no occupied cells",
                }

            # Pad so the shell can never touch the grid border — marching cubes
            # over a zero-padded grid is guaranteed to close the surface.
            pad = int(np.ceil(thickness_mm / pitch)) + 4
            surf = np.pad(surf, pad, mode="constant", constant_values=False)

            # World position of grid index (0,0,0): the voxel transform maps
            # indices to world; account for the padding shift.
            origin = np.asarray(vox.transform[:3, 3], dtype=float) - pad * pitch

            # ── Step 2: solid positive model (column fill downward) ───────────
            # A voxel is solid when any surface voxel exists at or above it in
            # the same column (Z+ = occlusal).
            solid = np.flip(np.maximum.accumulate(np.flip(surf, axis=2), axis=2), axis=2)

            # Morphological closing bridges narrow interdental gaps the way a
            # thermoformed foil tents across them instead of plunging in —
            # without it, well-separated teeth would yield a disconnected
            # shell. Radius = gap_bridge_mm (0 disables).
            close_r = int(round(float(gap_bridge_mm) / pitch))
            if close_r > 0:
                og = np.ogrid[-close_r:close_r + 1, -close_r:close_r + 1, -close_r:close_r + 1]
                ball = (og[0] ** 2 + og[1] ** 2 + og[2] ** 2) <= close_r ** 2
                solid = ndimage.binary_closing(solid, structure=ball)

            # ── Step 3: uniform-thickness drape ──────────────────────────────
            outside = ~solid
            dist = ndimage.distance_transform_edt(outside, sampling=(pitch, pitch, pitch))
            shell = outside & (dist <= (thickness_mm + pitch * 0.5))

            # ── Step 4: gingival trim in voxel space ─────────────────────────
            z_min_world = float(mesh.vertices[:, 2].min())
            z_max_world = float(mesh.vertices[:, 2].max())
            if (z_max_world - z_min_world) > 1.0:
                trim_z_world = z_min_world + float(trim_line_height_mm)
                trim_k = int(np.floor((trim_z_world - origin[2]) / pitch))
                if 0 < trim_k < shell.shape[2] - 1:
                    trimmed = shell.copy()
                    trimmed[:, :, :trim_k] = False
                    if trimmed.sum() > 100:  # sanity: shell must survive the cut
                        shell = trimmed
                    else:
                        logger.warning(
                            "Gingival trim would remove almost the whole shell "
                            f"(trim_line_height_mm={trim_line_height_mm}); skipping trim"
                        )

            if not shell.any():
                return {
                    "success": False,
                    "error": "empty_shell",
                    "detail": "Offset produced no shell voxels (thickness too small for pitch?)",
                }

            # ── Step 5: closed surface via marching cubes + smoothing ────────
            verts, faces, _normals, _values = measure.marching_cubes(
                shell.astype(np.uint8), level=0.5, spacing=(pitch, pitch, pitch)
            )
            verts = verts + origin
            out = trimesh.Trimesh(vertices=verts, faces=faces, process=True)
            try:
                trimesh.smoothing.filter_taubin(out, lamb=0.5, nu=-0.53, iterations=8)
            except BaseException as exc:  # smoothing is cosmetic — never fatal
                logger.warning("Taubin smoothing skipped: %s", exc)

            # ── Step 6: export ───────────────────────────────────────────────
            base, _ext = os.path.splitext(staged_mesh_path)
            output_path = base + "_aligner.stl"
            out.export(output_path)

            watertight = bool(out.is_watertight)
            logger.info(
                f"Aligner shell generated: {output_path} "
                f"({len(out.vertices)} verts, {len(out.faces)} faces, "
                f"watertight={watertight}, pitch={pitch}mm)"
            )
            return {
                "success": True,
                "output_path": output_path,
                "vertex_count": len(out.vertices),
                "face_count": len(out.faces),
                "watertight": watertight,
                "thickness_mm": thickness_mm,
                "trim_line_height_mm": trim_line_height_mm,
                "voxel_pitch_mm": pitch,
                "method": "voxel_sdf_offset_marching_cubes",
                "disclaimer": (
                    "Aligner shell is a geometric approximation: uniform-thickness "
                    f"drape quantized at {pitch} mm voxels, undercuts filled by the "
                    "solid-model abstraction, linear (not scalloped) gingival trim. "
                    "Not clinically validated. Requires review by a licensed clinician."
                ),
            }

        except ImportError as exc:
            logger.error("Missing geometry dependency for aligner shells: %s", exc)
            return {
                "success": False,
                "error": "dependency_unavailable",
                "detail": f"Install trimesh, scipy and scikit-image to enable aligner shell generation ({exc}).",
            }
        except Exception as exc:
            logger.error("generate_aligner_shell failed: %s", exc)
            return {
                "success": False,
                "error": "aligner_shell_generation_failed",
                "detail": str(exc),
            }
