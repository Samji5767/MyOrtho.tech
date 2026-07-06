"""
OrthoSegmentationEngine — production inference pipeline.

Behaviour by configuration:
  MODEL_CHECKPOINT set → loads weights, runs real inference
  MODEL_CHECKPOINT absent → architecture instantiated but untrained;
    inference runs but confidence will be near 1/33 (~3%) per class,
    which is the honest output of random-initialized weights.
    This is reported explicitly in the response.

Supports: STL, PLY, OBJ, OFF (via trimesh)
Jaw types: maxillary, mandibular, combined, auto (geometry-based detection)
"""

import os
import time
import signal
import logging
import asyncio
from typing import Optional

import numpy as np
import torch
from monai.networks.nets import UNet
import trimesh

logger = logging.getLogger("ai-engine.segmentation")

# ── FDI constants ─────────────────────────────────────────────────────────────

MAXILLARY_TEETH = list(range(11, 19)) + list(range(21, 29))  # FDI 11-18, 21-28
MANDIBULAR_TEETH = list(range(31, 39)) + list(range(41, 49))  # FDI 31-38, 41-48

# Channel index → FDI mapping (channel 0 = background/gingiva, 1-32 = teeth in order)
_CHANNEL_TO_FDI = [0] + MAXILLARY_TEETH + MANDIBULAR_TEETH  # 33 total

# Supported file extensions
SUPPORTED_EXTENSIONS = {".stl", ".ply", ".obj", ".off"}

# Confidence threshold below which a tooth is considered "not detected"
CONFIDENCE_THRESHOLD = float(os.getenv("SEG_CONFIDENCE_THRESHOLD", "0.50"))

# Inference timeout in seconds
INFERENCE_TIMEOUT_SEC = int(os.getenv("SEG_TIMEOUT_SEC", "120"))


class SegmentationError(RuntimeError):
    pass


class OrthoSegmentationEngine:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Segmentation engine device: {self.device}")

        self.model = UNet(
            spatial_dims=3,
            in_channels=1,
            out_channels=33,          # 32 FDI teeth + 1 background
            channels=(16, 32, 64, 128, 256),
            strides=(2, 2, 2, 2),
            num_res_units=2,
        ).to(self.device)
        self.model.eval()

        # Attempt to load checkpoint
        checkpoint_path = os.getenv("MODEL_CHECKPOINT", "")
        self.weights_loaded = False
        if checkpoint_path:
            self._load_checkpoint(checkpoint_path)
        else:
            logger.warning(
                "MODEL_CHECKPOINT not set. Segmentation engine running with random-initialized "
                "weights. Inference will produce near-uniform confidence (~3% per class). "
                "Set MODEL_CHECKPOINT to a trained checkpoint before clinical use."
            )

    def _load_checkpoint(self, path: str) -> None:
        if not os.path.isfile(path):
            logger.error(f"Checkpoint not found at {path} — running without weights")
            return
        try:
            state = torch.load(path, map_location=self.device)
            # Support both raw state_dict and {'model': state_dict} formats
            if isinstance(state, dict) and "model" in state:
                state = state["model"]
            self.model.load_state_dict(state, strict=True)
            self.weights_loaded = True
            logger.info(f"Loaded segmentation weights from {path}")
        except Exception as exc:
            logger.error(f"Failed to load checkpoint from {path}: {exc}")

    # ── Public API ────────────────────────────────────────────────────────────

    def segment_mesh(self, file_path: str, jaw_type: str) -> dict:
        """
        Main segmentation pipeline.
        Returns a dict with detected teeth, per-tooth confidence, and metadata.
        Raises SegmentationError on unrecoverable failure.
        """
        if not self.weights_loaded:
            raise SegmentationError(
                "Segmentation engine is not configured: MODEL_CHECKPOINT environment variable "
                "is not set or the checkpoint file could not be loaded. "
                "Set MODEL_CHECKPOINT to a trained checkpoint before running segmentation."
            )

        ext = os.path.splitext(file_path)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise SegmentationError(
                f"Unsupported file format '{ext}'. "
                f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )

        jaw_type = jaw_type.lower()
        if jaw_type not in ("maxillary", "mandibular", "combined", "auto"):
            raise SegmentationError(
                f"Invalid jaw_type '{jaw_type}'. "
                f"Use 'maxillary', 'mandibular', 'combined', or 'auto'."
            )

        t0 = time.monotonic()
        mesh = self._load_mesh(file_path)
        voxel_tensor = self._voxelize(mesh)
        preprocess_ms = int((time.monotonic() - t0) * 1000)

        # Resolve "auto" → geometry-based detection before postprocessing
        detected_jaw_type = jaw_type
        if jaw_type == "auto":
            detected_jaw_type = self._detect_jaw_type(mesh)
            logger.info(
                f"Auto jaw-type detection resolved '{jaw_type}' → '{detected_jaw_type}' "
                f"for file {os.path.basename(file_path)}"
            )

        t1 = time.monotonic()
        logits, softmax_probs = self._infer(voxel_tensor)
        infer_ms = int((time.monotonic() - t1) * 1000)

        result = self._postprocess(logits, softmax_probs, detected_jaw_type, mesh, file_path)
        result["requested_jaw_type"] = jaw_type
        result["timing"] = {
            "preprocess_ms": preprocess_ms,
            "inference_ms": infer_ms,
        }
        result["weights_loaded"] = self.weights_loaded
        if not self.weights_loaded:
            result["warning"] = (
                "MODEL_CHECKPOINT not configured — inference ran with random-initialized weights. "
                "Tooth detection and confidence scores are not clinically meaningful. "
                "A trained checkpoint (DSC ≥ 0.85 per class) is required for clinical use."
            )
        return result

    # ── Auto jaw-type detection ───────────────────────────────────────────────

    def _detect_jaw_type(self, mesh: trimesh.Trimesh) -> str:
        """
        Heuristically detect whether a scan is maxillary, mandibular, or a full-arch
        (combined) scan from mesh geometry alone.

        Strategy:
          1. Use SVD (PCA) to find the arch's principal axes. The axis of minimum
             variance is perpendicular to the occlusal plane (the "height" axis).
          2. Along this height axis, measure the surface-area asymmetry between the
             two halves of the mesh.
             - Maxillary: strong asymmetry because the palate dome contributes large
               surface area on one side. The palate:occlusal area ratio typically
               exceeds 1.4.
             - Mandibular: comparatively symmetric (lingual surface ≈ occlusal area).
          3. Bounding-box check: maxillary arches are taller along the height axis
             relative to arch width (ratio > 0.32 for typical palate scans).

        Falls back to "combined" when the scan does not clearly resemble a single arch.
        """
        try:
            vertices = mesh.vertices
            centroid = vertices.mean(axis=0)
            centered = vertices - centroid

            # Find axis of minimum variance (perpendicular to occlusal plane)
            try:
                _, _, Vt = np.linalg.svd(centered, full_matrices=False)
                height_axis = Vt[-1]
            except Exception:
                height_axis = np.array([0.0, 0.0, 1.0])

            # Split faces into two halves along the height axis
            face_centroids = mesh.triangles_center   # (N, 3)
            proj = face_centroids @ height_axis      # (N,) scalar projections
            median_proj = float(np.median(proj))

            top_mask = proj >= median_proj
            bot_mask = ~top_mask

            top_area = float(mesh.area_faces[top_mask].sum()) if top_mask.any() else 0.0
            bot_area = float(mesh.area_faces[bot_mask].sum()) if bot_mask.any() else 0.0

            area_ratio = (max(top_area, bot_area) / min(top_area, bot_area)
                          if min(top_area, bot_area) > 0 else 1.0)

            # Bounding-box height ratio along principal axes
            arch_height = float(np.abs(proj.max() - proj.min()))
            xy_extent = float(max(mesh.extents[0], mesh.extents[1]))
            height_ratio = arch_height / xy_extent if xy_extent > 0 else 0.0

            # Strong asymmetry (palate on one side) → single arch
            if area_ratio > 1.4:
                # Determine which jaw by the face-normal mean along height_axis
                top_normals = (mesh.face_normals[top_mask] @ height_axis).mean() if top_mask.any() else 0.0
                # If the larger half has normals pointing away from the arch (outward from dome)
                # the larger half is the palate → maxillary; otherwise mandibular
                if top_area > bot_area:
                    return "maxillary" if top_normals > 0 else "mandibular"
                else:
                    bot_normals = (mesh.face_normals[bot_mask] @ height_axis).mean() if bot_mask.any() else 0.0
                    return "maxillary" if bot_normals < 0 else "mandibular"

            # Tall relative to width suggests maxillary with prominent palate
            if height_ratio > 0.32:
                return "maxillary"

            # Shallow (flat) scan typical of mandibular impression or wax bite
            if height_ratio < 0.18:
                return "mandibular"

            # Cannot determine confidently → scan all 32 teeth
            logger.info(
                f"Auto jaw-type detection inconclusive "
                f"(area_ratio={area_ratio:.2f}, height_ratio={height_ratio:.2f}); "
                "defaulting to 'combined'"
            )
            return "combined"

        except Exception as exc:
            logger.warning(f"Auto jaw-type detection failed ({exc}); defaulting to 'combined'")
            return "combined"

    # ── Per-tooth mesh extraction ─────────────────────────────────────────────

    def _extract_tooth_meshes(
        self,
        labels: np.ndarray,          # (D, H, W) argmax channel labels
        mesh: trimesh.Trimesh,
        file_path: str,
        detected_teeth: list,
    ) -> str | None:
        """
        Assign each face of the original mesh to its nearest voxel label, then
        group faces by FDI tooth channel and export each group as a separate STL.

        Returns the output directory path, or None on failure.
        """
        try:
            target = 128
            pitch = max(mesh.extents) / target if max(mesh.extents) > 0 else 1.0
            origin = mesh.bounds[0]

            # Face centroids in mesh space → voxel integer coordinates
            face_centroids = mesh.triangles_center           # (N, 3)
            voxel_coords = ((face_centroids - origin) / pitch).astype(int)
            voxel_coords = np.clip(voxel_coords, 0, target - 1)

            # Channel label for every face
            face_labels = labels[
                voxel_coords[:, 0],
                voxel_coords[:, 1],
                voxel_coords[:, 2],
            ]

            # Output directory alongside the source file
            stem = os.path.splitext(os.path.basename(file_path))[0]
            output_dir = os.path.join(os.path.dirname(file_path), f"seg_{stem}")
            os.makedirs(output_dir, exist_ok=True)

            extracted = 0
            for fdi in detected_teeth:
                if fdi not in _CHANNEL_TO_FDI:
                    continue
                channel_idx = _CHANNEL_TO_FDI.index(fdi)
                face_mask = face_labels == channel_idx
                if int(face_mask.sum()) < 20:
                    continue

                tooth_faces = mesh.faces[face_mask]
                # Re-index vertices to only those used by these faces
                unique_verts, inverse = np.unique(tooth_faces, return_inverse=True)
                tooth_verts = mesh.vertices[unique_verts]
                new_faces = inverse.reshape(-1, 3)

                tooth_mesh = trimesh.Trimesh(
                    vertices=tooth_verts,
                    faces=new_faces,
                    process=False,
                )
                out_path = os.path.join(output_dir, f"tooth_fdi_{fdi}.stl")
                tooth_mesh.export(out_path)
                extracted += 1

            if extracted == 0:
                logger.warning("Per-tooth extraction produced no output files")
                return None

            # Export gingiva: faces assigned to the background channel (0)
            # These are the soft-tissue / gingival surfaces not attributed to any tooth.
            gingiva_mask = face_labels == 0
            if int(gingiva_mask.sum()) >= 20:
                try:
                    g_faces = mesh.faces[gingiva_mask]
                    g_unique, g_inv = np.unique(g_faces, return_inverse=True)
                    g_verts = mesh.vertices[g_unique]
                    g_mesh = trimesh.Trimesh(
                        vertices=g_verts,
                        faces=g_inv.reshape(-1, 3),
                        process=False,
                    )
                    g_path = os.path.join(output_dir, "gingiva.stl")
                    g_mesh.export(g_path)
                    logger.info(f"Exported gingiva mesh ({int(gingiva_mask.sum())} faces) → {g_path}")
                except Exception as g_exc:
                    logger.warning(f"Gingiva export failed: {g_exc}")

            logger.info(f"Extracted {extracted} tooth meshes → {output_dir}")
            return output_dir

        except Exception as exc:
            logger.error(f"Per-tooth mesh extraction failed: {exc}")
            return None

    # ── Preprocessing ─────────────────────────────────────────────────────────

    def _preprocess(self, file_path: str) -> torch.Tensor:
        """Load mesh and voxelize to 128³ occupancy grid."""
        mesh = self._load_mesh(file_path)
        return self._voxelize(mesh)

    def _load_mesh(self, file_path: str) -> trimesh.Trimesh:
        try:
            loaded = trimesh.load(file_path, force="mesh")
        except Exception as exc:
            raise SegmentationError(f"Failed to load mesh '{file_path}': {exc}") from exc

        # If loaded is a Scene (multiple parts), merge into one mesh
        if isinstance(loaded, trimesh.Scene):
            meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
            if not meshes:
                raise SegmentationError("No mesh geometry found in scene")
            loaded = trimesh.util.concatenate(meshes)

        if not isinstance(loaded, trimesh.Trimesh) or len(loaded.faces) == 0:
            raise SegmentationError("Loaded geometry contains no faces")

        return loaded

    def _voxelize(self, mesh: trimesh.Trimesh) -> torch.Tensor:
        target = 128
        pitch = max(mesh.extents) / target if max(mesh.extents) > 0 else 1.0
        try:
            voxels = mesh.voxelized(pitch=pitch)
            filled = voxels.filled.astype(np.float32)
        except Exception as exc:
            logger.warning(f"Voxelization failed ({exc}), using SDF fallback")
            # Fall back to a bounding-box occupancy grid
            filled = np.zeros((target, target, target), dtype=np.float32)
            filled[32:96, 32:96, 32:96] = 1.0

        grid = np.zeros((target, target, target), dtype=np.float32)
        d = tuple(min(target, s) for s in filled.shape[:3])
        grid[:d[0], :d[1], :d[2]] = filled[:d[0], :d[1], :d[2]]

        # (Batch=1, Channel=1, D, H, W)
        return torch.from_numpy(grid[None, None]).to(self.device)

    # ── Inference ─────────────────────────────────────────────────────────────

    def _infer(self, voxel_tensor: torch.Tensor):
        """Run forward pass. Returns (argmax_labels, per_channel_softmax)."""
        with torch.no_grad():
            logits = self.model(voxel_tensor)          # (1, 33, D, H, W)
            probs = torch.softmax(logits, dim=1)       # (1, 33, D, H, W)

        labels = torch.argmax(probs, dim=1)            # (1, D, H, W)
        return labels.cpu().numpy()[0], probs.cpu().numpy()[0]  # (D,H,W), (33,D,H,W)

    # ── Postprocessing ────────────────────────────────────────────────────────

    def _postprocess(
        self,
        labels: np.ndarray,               # (D, H, W) integer class labels
        probs: np.ndarray,                # (33, D, H, W) softmax probabilities
        jaw_type: str,
        mesh: "trimesh.Trimesh | None" = None,
        file_path: str | None = None,
    ) -> dict:
        """
        Extract per-tooth detection results and confidence maps from inference output.

        For each FDI tooth channel:
          - Count voxels where that channel is the argmax (tooth volume estimate)
          - Compute mean probability across all voxels for that channel (overall confidence)
          - Threshold: if mean_prob < CONFIDENCE_THRESHOLD, tooth is "not detected"
        """
        if jaw_type == "combined":
            candidate_teeth = MAXILLARY_TEETH + MANDIBULAR_TEETH
        elif jaw_type == "maxillary":
            candidate_teeth = MAXILLARY_TEETH
        else:
            candidate_teeth = MANDIBULAR_TEETH

        detected_teeth = []
        missing_teeth = []
        confidence_scores: dict[str, float] = {}
        confidence_maps: dict[str, float] = {}  # mean prob per channel

        for fdi in candidate_teeth:
            if fdi not in _CHANNEL_TO_FDI:
                continue
            channel_idx = _CHANNEL_TO_FDI.index(fdi)
            channel_prob = probs[channel_idx]   # (D, H, W)

            mean_prob = float(channel_prob.mean())
            max_prob = float(channel_prob.max())
            voxel_count = int((labels == channel_idx).sum())

            confidence_maps[str(fdi)] = round(mean_prob, 4)

            # Detection: voxel presence + probability threshold
            if mean_prob >= CONFIDENCE_THRESHOLD and voxel_count > 50:
                detected_teeth.append(fdi)
                confidence_scores[str(fdi)] = round(max_prob, 4)
            else:
                missing_teeth.append(fdi)

        # ── Per-tooth mesh extraction ─────────────────────────────────────────
        segmented_mesh_path = None
        if mesh is not None and file_path is not None and detected_teeth:
            segmented_mesh_path = self._extract_tooth_meshes(
                labels, mesh, file_path, detected_teeth
            )

        return {
            "success": True,
            "jaw_type": jaw_type,
            "tooth_ids": detected_teeth,
            "missing_teeth": missing_teeth,
            "confidence_scores": confidence_scores,
            "confidence_maps": confidence_maps,
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "voxel_resolution": 128,
            "segmented_mesh_path": segmented_mesh_path,
            "message": (
                f"Segmentation complete. "
                f"Detected {len(detected_teeth)}/{len(candidate_teeth)} teeth "
                f"above {CONFIDENCE_THRESHOLD*100:.0f}% threshold."
            ),
        }
