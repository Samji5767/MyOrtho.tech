"""Attachment body generation on segmented tooth surfaces.

Builds real attachment solids (the small composite shapes bonded to teeth
during aligner treatment) from the plan's attachment prescriptions:

  - the tooth surface point is found by ray-casting from the tooth centroid
    along the prescribed surface direction (buccal / lingual / occlusal),
    using the tooth's own anatomical frame (src/tooth_frames.py)
  - the body is a watertight primitive sized by the prescription
    (width × height × depth mm), oriented width-along-mesial,
    height-along-occlusal, depth-along-outward, seated 0.1 mm into the
    surface so bonding templates make contact

Shape mapping (documented approximation — manufacturers' proprietary
"optimized" geometries are not reproduced):
  beveled                 -> beveled prism (outer face half height)
  optimized               -> ellipsoid
  everything else         -> rectangular box

Bodies are exported as SEPARATE solids — they are not boolean-unioned into
the tooth meshes (no boolean backend in this service). That is the correct
deliverable for bonding templates and visualization; it is stated in the
response so downstream consumers never assume fused geometry.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import numpy as np

from src.tooth_frames import ToothFrame

logger = logging.getLogger("ai-engine.attachment_generator")

EMBED_MM = 0.1  # seat depth into the tooth surface


def _orientation_matrix(frame: ToothFrame, outward: np.ndarray) -> np.ndarray:
    """Columns: local x = mesial, z = outward, y = z × x (right-handed)."""
    x = np.asarray(frame.mesial, dtype=float)
    z = np.asarray(outward, dtype=float)
    # Orthogonalize x against z (outward may not be exactly perpendicular
    # to mesial for the occlusal surface).
    x = x - z * float(np.dot(x, z))
    n = np.linalg.norm(x)
    if n < 1e-9:
        x = np.asarray(frame.buccal, dtype=float)
        x = x - z * float(np.dot(x, z))
        n = np.linalg.norm(x)
    x = x / n
    y = np.cross(z, x)
    return np.column_stack([x, y, z])


def _primitive(attachment_type: str, w: float, h: float, d: float):
    """Watertight primitive centred at the origin, local z ∈ [-d/2, d/2]."""
    import trimesh

    if attachment_type == "optimized":
        body = trimesh.creation.icosphere(subdivisions=2, radius=1.0)
        body.apply_scale((w / 2.0, h / 2.0, d / 2.0))
        return body

    if attachment_type == "beveled":
        # Inner face (z=-d/2) full height; outer face (z=+d/2) half height,
        # bevelled toward the gingival edge. Convex hull of the 8 corners
        # guarantees a watertight solid.
        inner = [(-w / 2, -h / 2, -d / 2), (w / 2, -h / 2, -d / 2),
                 (w / 2, h / 2, -d / 2), (-w / 2, h / 2, -d / 2)]
        outer = [(-w / 2, -h / 2, d / 2), (w / 2, -h / 2, d / 2),
                 (w / 2, 0.0, d / 2), (-w / 2, 0.0, d / 2)]
        return trimesh.convex.convex_hull(np.array(inner + outer))

    return trimesh.creation.box(extents=(w, h, d))


def _ray_hits(mesh, origin: np.ndarray, direction: np.ndarray) -> np.ndarray:
    """Möller–Trumbore ray/triangle intersection over every face (vectorized).

    Self-contained on purpose: trimesh's ray engines require rtree/embree,
    which this service does not ship. One ray against a few thousand
    triangles is trivial work. Returns the positive hit distances, sorted.
    """
    tri = mesh.triangles  # (F, 3, 3)
    v0, v1, v2 = tri[:, 0], tri[:, 1], tri[:, 2]
    e1 = v1 - v0
    e2 = v2 - v0
    h = np.cross(direction[None, :], e2)
    a = np.einsum("ij,ij->i", e1, h)
    ok = np.abs(a) > 1e-12
    f = np.zeros_like(a)
    f[ok] = 1.0 / a[ok]
    s = origin[None, :] - v0
    u = f * np.einsum("ij,ij->i", s, h)
    q = np.cross(s, e1)
    v = f * np.einsum("j,ij->i", direction, q)
    t = f * np.einsum("ij,ij->i", e2, q)
    mask = ok & (u >= -1e-9) & (v >= -1e-9) & (u + v <= 1 + 1e-9) & (t > 1e-9)
    return np.sort(t[mask])


def _surface_point(mesh, origin: np.ndarray, direction: np.ndarray) -> tuple[np.ndarray, str]:
    """Farthest ray hit from the centroid along `direction`; extent fallback."""
    try:
        hits = _ray_hits(mesh, np.asarray(origin, dtype=float), np.asarray(direction, dtype=float))
        if hits.size:
            return origin + direction * float(hits[-1]), "raycast"
    except BaseException as exc:  # geometry oddities must not abort the build
        logger.warning("Ray cast failed (%s); using extent fallback", exc)
    half_extent = float(np.max(mesh.extents)) / 2.0
    return origin + direction * half_extent, "extent_fallback"


def build_attachment_body(
    tooth_mesh,
    frame: ToothFrame,
    attachment_type: str,
    width_mm: float,
    height_mm: float,
    depth_mm: float,
    surface: str,
) -> Optional[dict]:
    """Place one attachment body on the tooth. Returns metadata + mesh."""
    import trimesh

    occlusal = np.asarray(frame.occlusal, dtype=float)
    buccal = np.asarray(frame.buccal, dtype=float)
    if surface == "lingual":
        outward = -buccal
    elif surface == "occlusal":
        outward = occlusal
    else:  # buccal (default)
        outward = buccal

    centroid = np.asarray(tooth_mesh.centroid, dtype=float)
    hit, placed_via = _surface_point(tooth_mesh, centroid, outward)

    body = _primitive(attachment_type, float(width_mm), float(height_mm), float(depth_mm))
    rot = np.eye(4)
    rot[:3, :3] = _orientation_matrix(frame, outward)
    body.apply_transform(rot)
    center = hit + outward * (float(depth_mm) / 2.0 - EMBED_MM)
    body.apply_translation(center)

    return {
        "mesh": body,
        "watertight": bool(body.is_watertight),
        "placed_via": placed_via,
        "surface_point": [float(v) for v in hit],
    }


def generate_attachment_models(
    seg_dir: str,
    plan_id: str,
    attachments: list[dict],
    frames: dict[int, ToothFrame],
    tooth_meshes: dict,
) -> dict:
    """Build every prescribed attachment body; export STLs + a zip.

    ``attachments``: [{fdi_number, attachment_type, width_mm, height_mm,
    depth_mm, surface}]. Returns per-body reports; bodies that cannot be
    built (missing tooth mesh, non-watertight output) become errors, never
    silent omissions.
    """
    import zipfile

    output_dir = os.path.join(seg_dir, f"attachments_{plan_id}")
    os.makedirs(output_dir, exist_ok=True)

    built = []
    errors = []
    for att in attachments:
        fdi = int(att["fdi_number"])
        a_type = str(att["attachment_type"])
        mesh = tooth_meshes.get(fdi)
        frame = frames.get(fdi)
        if mesh is None or frame is None:
            errors.append({
                "fdi": fdi, "type": a_type,
                "error": "no segmented mesh for this tooth — attachment cannot be placed",
            })
            continue
        try:
            result = build_attachment_body(
                mesh, frame, a_type,
                float(att.get("width_mm", 3.0)),
                float(att.get("height_mm", 2.0)),
                float(att.get("depth_mm", 0.5)),
                str(att.get("surface", "buccal")),
            )
        except Exception as exc:
            errors.append({"fdi": fdi, "type": a_type, "error": str(exc)})
            continue
        if not result["watertight"]:
            errors.append({"fdi": fdi, "type": a_type, "error": "generated body is not watertight"})
            continue

        fname = f"attachment_fdi{fdi}_{a_type}.stl"
        result["mesh"].export(os.path.join(output_dir, fname))
        built.append({
            "file": fname,
            "fdi": fdi,
            "type": a_type,
            "surface": att.get("surface", "buccal"),
            "watertight": True,
            "placed_via": result["placed_via"],
        })

    if not built:
        raise ValueError(
            "No attachment bodies could be generated: "
            + "; ".join(e["error"] for e in errors[:3])
        )

    zip_path = os.path.join(seg_dir, f"attachment_models_{plan_id}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for b in built:
            zf.write(os.path.join(output_dir, b["file"]), b["file"])

    return {
        "success": True,
        "plan_id": plan_id,
        "bodies_generated": len(built),
        "bodies": built,
        "errors": errors,
        "zip_path": zip_path,
        "note": (
            "Attachment bodies are separate watertight solids positioned on the "
            "segmented tooth surfaces — not boolean-unioned into the teeth. "
            "Shape mapping: beveled->beveled prism, optimized->ellipsoid, "
            "others->rectangular box. Requires review by a licensed clinician."
        ),
    }
