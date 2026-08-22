"""
Shared helpers for the MeshSegNet training pipeline.

The training code imports the *service's own* model and feature extraction
(meshsegnet-service/api/) so that exported checkpoints are guaranteed to be
loadable by the inference service without any conversion step.
"""
from __future__ import annotations

import os
import sys

# Make ../api importable as plain modules (model, feature_extraction).
_API_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api"))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

from model import (  # noqa: E402  (path setup must run first)
    MeshSegNet,
    _LOWER_FDI_MAP,
    _UPPER_FDI_MAP,
)
from feature_extraction import extract_features  # noqa: E402

NUM_CLASSES = MeshSegNet.NUM_CLASSES  # 17: 0 = gingiva, 1-16 per-jaw FDI
NUM_FEATURES = 15
K_NEIGHBOURS = 6

# Inverse maps: FDI tooth number -> raw class index (1-16). Gingiva (0) -> 0.
UPPER_FDI_TO_CLASS: dict[int, int] = {fdi: cls for cls, fdi in _UPPER_FDI_MAP.items()}
LOWER_FDI_TO_CLASS: dict[int, int] = {fdi: cls for cls, fdi in _LOWER_FDI_MAP.items()}


def fdi_to_class(fdi_labels, jaw: str):
    """
    Map an iterable of FDI tooth numbers (0 = gingiva) to raw class
    indices 0-16 for the given jaw ("upper" | "lower").

    FDI codes that do not belong to the jaw's permanent-dentition map
    (e.g. primary teeth 51-85, or wrong-jaw codes in a mislabeled file)
    are mapped to 0 (gingiva/background) — they cannot be represented in
    the 17-class scheme.
    """
    mapping = UPPER_FDI_TO_CLASS if jaw == "upper" else LOWER_FDI_TO_CLASS
    return [mapping.get(int(f), 0) for f in fdi_labels]


__all__ = [
    "MeshSegNet",
    "extract_features",
    "NUM_CLASSES",
    "NUM_FEATURES",
    "K_NEIGHBOURS",
    "UPPER_FDI_TO_CLASS",
    "LOWER_FDI_TO_CLASS",
    "fdi_to_class",
]
