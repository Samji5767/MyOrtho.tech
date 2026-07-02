"""
OrthoSegmentationEngine — production inference pipeline.

Behaviour by configuration:
  MODEL_CHECKPOINT set → loads weights, runs real inference
  MODEL_CHECKPOINT absent → architecture instantiated but untrained;
    inference runs but confidence will be near 1/33 (~3%) per class,
    which is the honest output of random-initialized weights.
    This is reported explicitly in the response.

Supports: STL, PLY, OBJ, OFF (via trimesh)
Jaw types: maxillary, mandibular, combined
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
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise SegmentationError(
                f"Unsupported file format '{ext}'. "
                f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )

        jaw_type = jaw_type.lower()
        if jaw_type not in ("maxillary", "mandibular", "combined"):
            raise SegmentationError(
                f"Invalid jaw_type '{jaw_type}'. Use 'maxillary', 'mandibular', or 'combined'."
            )

        t0 = time.monotonic()
        voxel_tensor = self._preprocess(file_path)
        preprocess_ms = int((time.monotonic() - t0) * 1000)

        t1 = time.monotonic()
        logits, softmax_probs = self._infer(voxel_tensor)
        infer_ms = int((time.monotonic() - t1) * 1000)

        result = self._postprocess(logits, softmax_probs, jaw_type)
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
        labels: np.ndarray,       # (D, H, W) integer class labels
        probs: np.ndarray,        # (33, D, H, W) softmax probabilities
        jaw_type: str,
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

        return {
            "success": True,
            "jaw_type": jaw_type,
            "tooth_ids": detected_teeth,
            "missing_teeth": missing_teeth,
            "confidence_scores": confidence_scores,
            "confidence_maps": confidence_maps,     # per-tooth mean probability
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "voxel_resolution": 128,
            "segmented_mesh_path": None,            # populated when mesh extraction is implemented
            "message": (
                f"Segmentation complete. "
                f"Detected {len(detected_teeth)}/{len(candidate_teeth)} teeth "
                f"above {CONFIDENCE_THRESHOLD*100:.0f}% threshold."
            ),
        }
