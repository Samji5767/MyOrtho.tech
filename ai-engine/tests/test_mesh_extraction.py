"""Per-tooth mesh extraction from vertex labels."""

import importlib
import os
import sys

# conftest stubs trimesh for the torch-dependent modules; these are real
# geometry tests, so swap the genuine library in and rebind the module
# under test to it.
for _m in [k for k in list(sys.modules) if k == "trimesh" or k.startswith("trimesh.")]:
    del sys.modules[_m]
import trimesh  # noqa: E402 — real trimesh from site-packages

import src.mesh_extraction as _me  # noqa: E402

importlib.reload(_me)
extract_labeled_meshes = _me.extract_labeled_meshes


def test_extracts_tooth_and_gingiva_submeshes(tmp_path):
    tooth_a = trimesh.creation.box(extents=(8, 8, 10)).subdivide()
    tooth_b = trimesh.creation.box(extents=(8, 8, 10)).subdivide()
    tooth_b.apply_translation((15, 0, 0))
    gingiva = trimesh.creation.box(extents=(40, 12, 4)).subdivide()
    gingiva.apply_translation((7, 0, -8))
    combined = trimesh.util.concatenate([tooth_a, tooth_b, gingiva])

    scan = tmp_path / "scan.stl"
    combined.export(str(scan))
    loaded = trimesh.load(str(scan), force="mesh", process=False)

    # Label loaded vertices by geometric region (x < 10 → 11, x > 10 → 21, z < -5 → 0)
    labels = []
    for v in loaded.vertices:
        if v[2] < -5:
            labels.append(0)
        elif v[0] < 10:
            labels.append(11)
        else:
            labels.append(21)

    result = extract_labeled_meshes(str(scan), labels, str(tmp_path / "out"))
    assert result is not None
    assert sorted(result["teeth_written"]) == [11, 21]
    assert result["gingiva_written"] is True

    # Exported submeshes are real, non-empty, and preserve the source frame
    t11 = trimesh.load(os.path.join(result["output_dir"], "tooth_fdi_11.stl"), force="mesh")
    assert len(t11.faces) > 0
    assert t11.bounds[1][0] <= 10.5  # tooth 11 region stays in-place

    g = trimesh.load(os.path.join(result["output_dir"], "gingiva.stl"), force="mesh")
    assert len(g.faces) > 0


def test_label_count_mismatch_returns_none(tmp_path):
    box = trimesh.creation.box(extents=(5, 5, 5))
    scan = tmp_path / "s.stl"
    box.export(str(scan))
    assert extract_labeled_meshes(str(scan), [11, 21, 0]) is None


def test_no_tooth_labels_returns_none(tmp_path):
    box = trimesh.creation.box(extents=(5, 5, 5))
    scan = tmp_path / "s.stl"
    box.export(str(scan))
    loaded = trimesh.load(str(scan), force="mesh", process=False)
    labels = [0] * len(loaded.vertices)
    assert extract_labeled_meshes(str(scan), labels) is None
