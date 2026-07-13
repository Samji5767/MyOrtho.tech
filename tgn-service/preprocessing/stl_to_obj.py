"""
STL → OBJ preprocessing pipeline for ToothGroupNetwork.

Converts binary or ASCII STL to Wavefront OBJ while validating mesh integrity.
Rejects corrupted meshes and logs conversion failures.

TGN expects OBJ files named:  {scan_id}_{jaw}.obj
where jaw is 'upper' or 'lower'.  The jaw is read from the filename by
predict_utils.ScanSegmentation.get_jaw().
"""

import logging
import os
import struct
import time
from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np
import trimesh

logger = logging.getLogger("tgn.preprocessing")

_STL_HEADER_SIZE = 84  # 80-byte header + 4-byte triangle count


@dataclass
class PreprocessResult:
    success: bool
    output_path: Optional[str] = None
    input_path: Optional[str] = None
    vertex_count: int = 0
    face_count: int = 0
    is_watertight: bool = False
    is_winding_consistent: bool = False
    warnings: List[str] = field(default_factory=list)
    error: Optional[str] = None
    conversion_ms: int = 0


def validate_stl_header(path: str) -> dict:
    """Return basic structural validity info for a binary STL file."""
    try:
        size = os.path.getsize(path)
        if size < _STL_HEADER_SIZE:
            return {"valid": False, "error": f"File too small: {size} bytes"}

        with open(path, "rb") as fh:
            header = fh.read(80)
            tri_bytes = fh.read(4)

        tri_count = struct.unpack("<I", tri_bytes)[0]
        expected = _STL_HEADER_SIZE + tri_count * 50
        is_binary = abs(size - expected) < 200

        return {
            "valid": True,
            "is_binary": is_binary,
            "triangle_count": tri_count if is_binary else None,
            "starts_with_solid": header[:5].lower() == b"solid",
        }
    except Exception as exc:
        return {"valid": False, "error": str(exc)}


def convert_stl_to_obj(input_path: str, output_path: str) -> PreprocessResult:
    """
    Convert a mesh file (STL/PLY/OBJ/OFF) to Wavefront OBJ.

    Scale, orientation, and units are preserved exactly (no normalization —
    TGN normalizes internally).  Vertex normals are included so open3d can
    read them without recomputing.

    Returns a PreprocessResult; never raises.
    """
    t0 = time.monotonic()

    if not os.path.isfile(input_path):
        return PreprocessResult(
            success=False,
            input_path=input_path,
            error=f"Input file not found: {input_path}",
        )

    ext = os.path.splitext(input_path)[1].lower()
    if ext not in {".stl", ".obj", ".ply", ".off"}:
        return PreprocessResult(
            success=False,
            input_path=input_path,
            error=f"Unsupported format '{ext}'. Accepted: .stl .obj .ply .off",
        )

    warnings: List[str] = []

    # ── Load ─────────────────────────────────────────────────────────────────
    try:
        loaded = trimesh.load(input_path, process=False, force="mesh")
    except Exception as exc:
        return PreprocessResult(
            success=False,
            input_path=input_path,
            error=f"Mesh load failed: {exc}",
        )

    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not meshes:
            return PreprocessResult(
                success=False,
                input_path=input_path,
                error="Scene contains no triangle meshes",
            )
        loaded = trimesh.util.concatenate(meshes)
        warnings.append("Multiple mesh objects merged into one")

    mesh: trimesh.Trimesh = loaded

    if len(mesh.faces) == 0:
        return PreprocessResult(
            success=False, input_path=input_path, error="Mesh has no faces"
        )
    if len(mesh.vertices) == 0:
        return PreprocessResult(
            success=False, input_path=input_path, error="Mesh has no vertices"
        )

    # ── Validate geometry ─────────────────────────────────────────────────────
    watertight = bool(mesh.is_watertight)
    if not watertight:
        warnings.append(
            "Mesh is not watertight (open boundary edges present). "
            "TGN can still process it but results may be degraded."
        )

    winding_ok = bool(mesh.is_winding_consistent)
    if not winding_ok:
        warnings.append("Inconsistent face winding; attempting repair.")
        try:
            trimesh.repair.fix_winding(mesh)
            winding_ok = True
            warnings.append("Winding repaired successfully.")
        except Exception as exc:
            warnings.append(f"Winding repair failed: {exc}")

    degen = int((mesh.area_faces < 1e-10).sum())
    if degen:
        warnings.append(f"{degen} degenerate faces (area ≈ 0) detected.")

    # Trigger vertex-normal computation before export
    _ = mesh.vertex_normals

    # ── Export ────────────────────────────────────────────────────────────────
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    try:
        mesh.export(output_path, file_type="obj", include_normals=True)
    except Exception as exc:
        return PreprocessResult(
            success=False,
            input_path=input_path,
            error=f"OBJ export failed: {exc}",
        )

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        "Converted %s → %s  vertices=%d  faces=%d  %dms",
        os.path.basename(input_path),
        os.path.basename(output_path),
        len(mesh.vertices),
        len(mesh.faces),
        elapsed_ms,
    )

    return PreprocessResult(
        success=True,
        output_path=output_path,
        input_path=input_path,
        vertex_count=len(mesh.vertices),
        face_count=len(mesh.faces),
        is_watertight=watertight,
        is_winding_consistent=winding_ok,
        warnings=warnings,
        conversion_ms=elapsed_ms,
    )


def preprocess_scan(
    input_path: str,
    output_dir: str,
    scan_id: str,
    jaw: str,
) -> PreprocessResult:
    """
    Preprocess a single scan for TGN inference.

    Creates:  {output_dir}/{scan_id}/{scan_id}_{jaw}.obj
    TGN walks subdirs of input_dir_path, so the output must be one level deep.

    Args:
        input_path:  Source STL/OBJ/PLY/OFF file.
        output_dir:  TGN input_dir_path (parent of scan subdirectory).
        scan_id:     Patient/scan identifier used for directory and filename.
        jaw:         "upper" or "lower".
    """
    if jaw not in ("upper", "lower"):
        return PreprocessResult(
            success=False,
            input_path=input_path,
            error=f"jaw must be 'upper' or 'lower', got '{jaw}'",
        )

    # TGN directory layout: input_dir / scan_id / scan_id_jaw.obj
    scan_subdir = os.path.join(output_dir, scan_id)
    os.makedirs(scan_subdir, exist_ok=True)
    output_path = os.path.join(scan_subdir, f"{scan_id}_{jaw}.obj")

    result = convert_stl_to_obj(input_path, output_path)

    if result.success:
        for w in result.warnings:
            logger.warning("[%s] %s", scan_id, w)
    else:
        logger.error("Preprocessing failed [%s]: %s", scan_id, result.error)

    return result
