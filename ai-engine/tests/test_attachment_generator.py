"""Tests for attachment body generation (src/attachment_generator.py).

Uses the real trimesh/numpy geometry stack (swapped past the conftest stubs
the same way tests/test_mesh_extraction.py does).
"""
import importlib
import math
import os
import sys
import zipfile

import pytest

# The shared conftest stubs trimesh and scipy for API-level tests; these are
# geometry tests, so restore the real libraries before importing the module
# under test (same pattern as test_mesh_extraction.py).
for name in [
    m for m in list(sys.modules)
    if m == "trimesh" or m.startswith("trimesh.")
    or m == "scipy" or m.startswith("scipy.")
]:
    del sys.modules[name]
trimesh = pytest.importorskip("trimesh")
pytest.importorskip("scipy.spatial")

import src.attachment_generator as _ag
importlib.reload(_ag)
from src.tooth_frames import compute_tooth_frames


def _arch(tmp_path):
    import numpy as np

    meshes = {}
    fdis = [14, 13, 12, 11, 21, 22, 23, 24]
    for fdi, ang in zip(fdis, np.linspace(-1.2, 1.2, len(fdis))):
        box = trimesh.creation.box(extents=(7, 7, 9))
        box.apply_translation((27 * math.sin(ang), 27 * math.cos(ang), 4.5))
        meshes[fdi] = box
    centroids = {f: tuple(map(float, m.centroid)) for f, m in meshes.items()}
    frames = compute_tooth_frames(centroids, up_hint=(0.0, 0.0, 1.0))
    return meshes, frames


def test_bodies_watertight_and_on_surface(tmp_path):
    import numpy as np

    meshes, frames = _arch(tmp_path)
    atts = [
        {"fdi_number": 11, "attachment_type": "vertical_rectangular",
         "width_mm": 1.5, "height_mm": 2.5, "depth_mm": 0.5, "surface": "buccal"},
        {"fdi_number": 13, "attachment_type": "beveled",
         "width_mm": 3.0, "height_mm": 1.2, "depth_mm": 0.7, "surface": "buccal"},
        {"fdi_number": 22, "attachment_type": "optimized",
         "width_mm": 2.5, "height_mm": 2.0, "depth_mm": 0.6, "surface": "lingual"},
    ]
    res = _ag.generate_attachment_models(str(tmp_path), "p1", atts, frames, meshes)
    assert res["success"] and res["bodies_generated"] == 3 and not res["errors"]
    assert all(b["watertight"] and b["placed_via"] == "raycast" for b in res["bodies"])

    with zipfile.ZipFile(res["zip_path"]) as zf:
        assert len(zf.namelist()) == 3

    # Each body must sit against its tooth surface: closest distance between
    # body and tooth ≈ 0 (the body is seated EMBED_MM into the surface).
    for b in res["bodies"]:
        body = trimesh.load(os.path.join(str(tmp_path), "attachments_p1", b["file"]))
        tooth = meshes[b["fdi"]]
        # signed distance of body centre to the tooth surface must be small
        centre_dist = np.min(np.linalg.norm(
            tooth.vertices - body.centroid, axis=1))
        assert centre_dist < 6.0  # within one tooth of the surface region
        assert body.is_watertight


def test_missing_tooth_becomes_error(tmp_path):
    meshes, frames = _arch(tmp_path)
    atts = [
        {"fdi_number": 11, "attachment_type": "beveled"},
        {"fdi_number": 47, "attachment_type": "beveled"},  # not in the arch
    ]
    res = _ag.generate_attachment_models(str(tmp_path), "p2", atts, frames, meshes)
    assert res["bodies_generated"] == 1
    assert len(res["errors"]) == 1 and res["errors"][0]["fdi"] == 47


def test_all_missing_raises(tmp_path):
    meshes, frames = _arch(tmp_path)
    with pytest.raises(ValueError):
        _ag.generate_attachment_models(
            str(tmp_path), "p3",
            [{"fdi_number": 47, "attachment_type": "beveled"}],
            frames, meshes,
        )
