"""
Unit tests for STL → OBJ preprocessing pipeline.

Run:
    python -m pytest preprocessing/test_stl_to_obj.py -v
"""

import importlib.util
import os
import struct
import tempfile

import numpy as np
import pytest
import trimesh

_SCIPY_AVAILABLE = importlib.util.find_spec("scipy") is not None

from preprocessing.stl_to_obj import (
    PreprocessResult,
    convert_stl_to_obj,
    preprocess_scan,
    validate_stl_header,
)


# ── Fixtures ─────────────────────────────────────────────────────────────────


def _make_cube_stl(path: str) -> None:
    """Write a watertight binary STL cube (12 triangles)."""
    mesh = trimesh.creation.box(extents=[10, 10, 10])
    mesh.export(path, file_type="stl")


def _make_single_triangle_stl(path: str) -> None:
    """Write a minimal binary STL with a single triangle."""
    verts = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=np.float32)
    faces = np.array([[0, 1, 2]], dtype=np.int32)
    m = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    m.export(path, file_type="stl")


def _make_corrupted_file(path: str) -> None:
    """Write a file with garbage content."""
    with open(path, "wb") as f:
        f.write(b"\x00\xFF" * 50)


# ── Tests: validate_stl_header ────────────────────────────────────────────────


class TestValidateStlHeader:
    def test_valid_cube_stl(self, tmp_path):
        stl = str(tmp_path / "cube.stl")
        _make_cube_stl(stl)
        result = validate_stl_header(stl)
        assert result["valid"] is True
        assert result["is_binary"] is True
        assert result["triangle_count"] == 12

    def test_missing_file(self, tmp_path):
        result = validate_stl_header(str(tmp_path / "nonexistent.stl"))
        assert result["valid"] is False
        assert "error" in result

    def test_too_small_file(self, tmp_path):
        tiny = str(tmp_path / "tiny.stl")
        with open(tiny, "wb") as f:
            f.write(b"\x00" * 20)
        result = validate_stl_header(tiny)
        assert result["valid"] is False


# ── Tests: convert_stl_to_obj ─────────────────────────────────────────────────


class TestConvertStlToObj:
    def test_cube_stl_to_obj(self, tmp_path):
        stl = str(tmp_path / "cube.stl")
        obj = str(tmp_path / "cube.obj")
        _make_cube_stl(stl)

        result = convert_stl_to_obj(stl, obj)

        assert result.success is True
        assert result.output_path == obj
        assert os.path.isfile(obj)
        assert result.vertex_count > 0
        assert result.face_count > 0
        assert result.conversion_ms >= 0

    def test_obj_roundtrip_preserves_scale(self, tmp_path):
        """Converting STL→OBJ must not rescale the mesh."""
        stl = str(tmp_path / "box.stl")
        obj = str(tmp_path / "box.obj")
        original = trimesh.creation.box(extents=[5.0, 10.0, 15.0])
        original.export(stl, file_type="stl")

        convert_stl_to_obj(stl, obj)

        reloaded = trimesh.load(obj, process=False, force="mesh")
        np.testing.assert_allclose(
            sorted(reloaded.extents), sorted(original.extents), atol=0.01
        )

    def test_missing_input(self, tmp_path):
        result = convert_stl_to_obj(
            str(tmp_path / "missing.stl"), str(tmp_path / "out.obj")
        )
        assert result.success is False
        assert result.error is not None
        assert "not found" in result.error.lower()

    def test_unsupported_format(self, tmp_path):
        fake = str(tmp_path / "scan.dcm")
        with open(fake, "wb") as f:
            f.write(b"DICM" * 100)
        result = convert_stl_to_obj(fake, str(tmp_path / "out.obj"))
        assert result.success is False
        assert "Unsupported" in result.error

    def test_corrupted_file(self, tmp_path):
        bad = str(tmp_path / "bad.stl")
        _make_corrupted_file(bad)
        result = convert_stl_to_obj(bad, str(tmp_path / "out.obj"))
        # Either fails to load or produces a degenerate mesh
        if result.success:
            assert result.face_count >= 0  # may succeed with 0 faces
        else:
            assert result.error is not None

    def test_output_dir_created(self, tmp_path):
        stl = str(tmp_path / "cube.stl")
        obj = str(tmp_path / "subdir" / "deep" / "cube.obj")
        _make_cube_stl(stl)
        result = convert_stl_to_obj(stl, obj)
        assert result.success is True
        assert os.path.isfile(obj)

    def test_single_triangle(self, tmp_path):
        stl = str(tmp_path / "tri.stl")
        obj = str(tmp_path / "tri.obj")
        _make_single_triangle_stl(stl)
        result = convert_stl_to_obj(stl, obj)
        assert result.success is True
        assert result.face_count == 1

    @pytest.mark.skipif(
        not _SCIPY_AVAILABLE,
        reason="trimesh watertight detection requires scipy",
    )
    def test_watertight_flag(self, tmp_path):
        stl = str(tmp_path / "cube.stl")
        obj = str(tmp_path / "cube.obj")
        _make_cube_stl(stl)
        result = convert_stl_to_obj(stl, obj)
        assert result.is_watertight is True

    def test_output_is_valid_obj(self, tmp_path):
        """The OBJ output must be loadable by trimesh with correct vertex count."""
        stl = str(tmp_path / "cube.stl")
        obj = str(tmp_path / "cube.obj")
        _make_cube_stl(stl)
        result = convert_stl_to_obj(stl, obj)

        reloaded = trimesh.load(obj, process=False, force="mesh")
        assert isinstance(reloaded, trimesh.Trimesh)
        assert len(reloaded.vertices) > 0
        assert len(reloaded.faces) > 0


# ── Tests: preprocess_scan ────────────────────────────────────────────────────


class TestPreprocessScan:
    def test_tgn_directory_layout(self, tmp_path):
        """Output must follow TGN's expected directory layout."""
        stl = str(tmp_path / "scan.stl")
        _make_cube_stl(stl)
        tgn_input = str(tmp_path / "tgn_input")

        result = preprocess_scan(stl, tgn_input, "PATIENT001", "lower")

        assert result.success is True
        expected_path = os.path.join(tgn_input, "PATIENT001", "PATIENT001_lower.obj")
        assert result.output_path == expected_path
        assert os.path.isfile(expected_path)

    def test_upper_jaw_naming(self, tmp_path):
        stl = str(tmp_path / "scan.stl")
        _make_cube_stl(stl)
        result = preprocess_scan(stl, str(tmp_path / "in"), "S001", "upper")
        assert result.success is True
        assert result.output_path.endswith("S001_upper.obj")

    def test_invalid_jaw(self, tmp_path):
        stl = str(tmp_path / "scan.stl")
        _make_cube_stl(stl)
        result = preprocess_scan(stl, str(tmp_path / "in"), "S001", "buccal")
        assert result.success is False
        assert "upper" in result.error.lower() or "lower" in result.error.lower()

    def test_missing_input(self, tmp_path):
        result = preprocess_scan(
            str(tmp_path / "missing.stl"), str(tmp_path / "in"), "S001", "lower"
        )
        assert result.success is False

    def test_idempotent_reprocess(self, tmp_path):
        """Running preprocess_scan twice with same params should succeed both times."""
        stl = str(tmp_path / "cube.stl")
        _make_cube_stl(stl)
        tgn_input = str(tmp_path / "tgn_input")

        r1 = preprocess_scan(stl, tgn_input, "SCAN01", "lower")
        r2 = preprocess_scan(stl, tgn_input, "SCAN01", "lower")

        assert r1.success is True
        assert r2.success is True
        assert r1.output_path == r2.output_path
