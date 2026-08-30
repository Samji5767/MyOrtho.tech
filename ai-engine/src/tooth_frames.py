"""Per-tooth anatomical coordinate frames derived from arch geometry.

Replaces the global arch-frame approximation (one fixed mesial/buccal
direction for every tooth) with a frame computed per tooth from the actual
positions of the segmented teeth:

  - occlusal axis: the Newell normal of the tooth-centroid polygon (the
    arch lies roughly in the occlusal plane), sign-aligned to a caller
    "up hint" so the convention matches the consumer's coordinate system
  - mesial axis: the arch-curve tangent at the tooth, projected into the
    arch plane and signed toward the dental midline
  - buccal axis: the outward direction from the arch centroid, projected
    into the arch plane and orthogonalized against the mesial axis

The same algorithm is implemented in TypeScript for the viewer
(frontend/src/lib/toothFrames.ts); a cross-implementation fixture test
keeps the two byte-compatible.  Any change here MUST be mirrored there.

Remaining approximation (documented): the occlusal axis is shared by the
whole arch (the arch-plane normal), not tilted per tooth — deriving true
per-tooth long axes needs root geometry that crown-only scans lack.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

UPPER_ORDER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
LOWER_ORDER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

Vec3 = tuple[float, float, float]


def _sub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _add(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _scale(a: Vec3, s: float) -> Vec3:
    return (a[0] * s, a[1] * s, a[2] * s)


def _dot(a: Vec3, b: Vec3) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a: Vec3, b: Vec3) -> Vec3:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _norm(a: Vec3) -> float:
    return math.sqrt(_dot(a, a))


def _normalize(a: Vec3) -> Vec3 | None:
    n = _norm(a)
    if n < 1e-9:
        return None
    return _scale(a, 1.0 / n)


@dataclass(frozen=True)
class ToothFrame:
    fdi: int
    origin: Vec3
    mesial: Vec3    # unit, + = toward the dental midline along the arch
    buccal: Vec3    # unit, + = outward from the arch centre, in the arch plane
    occlusal: Vec3  # unit arch-plane normal, aligned with the caller's up hint
    is_upper: bool
    is_fallback: bool  # True when arch geometry was insufficient for a real frame


def _fallback_frame(fdi: int, origin: Vec3, up: Vec3) -> ToothFrame:
    """Global-axis frame with the pre-existing quadrant sign convention —
    used only when the arch has too few teeth to derive real directions."""
    is_right = (11 <= fdi <= 18) or (41 <= fdi <= 48)
    mesial_sign = 1.0 if is_right else -1.0
    # Pick a horizontal X orthogonal to up.
    x = _normalize(_cross((0.0, 1.0, 0.0), up)) or (1.0, 0.0, 0.0)
    y = _normalize(_cross(up, x)) or (0.0, 0.0, 1.0)
    return ToothFrame(
        fdi=fdi,
        origin=origin,
        mesial=_scale(x, mesial_sign),
        buccal=y,
        occlusal=up,
        is_upper=fdi < 30,
        is_fallback=True,
    )


def compute_tooth_frames(
    centroids: dict[int, Vec3],
    up_hint: Vec3 = (0.0, 0.0, 1.0),
) -> dict[int, ToothFrame]:
    """
    Compute a ToothFrame for every FDI in ``centroids``.

    ``up_hint`` disambiguates the occlusal-axis sign (the arch normal is
    only defined up to ±): the engine passes +Z, the viewer passes +Y.
    """
    frames: dict[int, ToothFrame] = {}
    up_unit = _normalize(up_hint) or (0.0, 0.0, 1.0)

    for order in (UPPER_ORDER, LOWER_ORDER):
        present = [fdi for fdi in order if fdi in centroids]
        pts = [centroids[fdi] for fdi in present]

        if len(present) < 3:
            for fdi in present:
                frames[fdi] = _fallback_frame(fdi, centroids[fdi], up_unit)
            continue

        # Arch centre and Newell normal of the (open) centroid polygon.
        n_pts = len(pts)
        center = _scale(
            (sum(p[0] for p in pts), sum(p[1] for p in pts), sum(p[2] for p in pts)),
            1.0 / n_pts,
        )
        normal_acc: Vec3 = (0.0, 0.0, 0.0)
        for i in range(n_pts - 1):
            a = _sub(pts[i], center)
            b = _sub(pts[i + 1], center)
            normal_acc = _add(normal_acc, _cross(a, b))
        occlusal = _normalize(normal_acc)
        if occlusal is None:
            for fdi in present:
                frames[fdi] = _fallback_frame(fdi, centroids[fdi], up_unit)
            continue
        if _dot(occlusal, up_unit) < 0.0:
            occlusal = _scale(occlusal, -1.0)

        # Midline: the first index belonging to the left-side quadrant.
        # Walking the arch order right→left, increasing index moves TOWARD
        # the midline on the right side and AWAY from it on the left.
        midline_idx = next(
            i for i, fdi in enumerate(present)
            if (21 <= fdi <= 28) or (31 <= fdi <= 38)
        ) if any((21 <= f <= 28) or (31 <= f <= 38) for f in present) else n_pts

        for i, fdi in enumerate(present):
            p = pts[i]
            prev_p = pts[max(0, i - 1)]
            next_p = pts[min(n_pts - 1, i + 1)]
            tangent = _sub(next_p, prev_p)
            # Project into the arch plane.
            tangent = _sub(tangent, _scale(occlusal, _dot(tangent, occlusal)))
            t_unit = _normalize(tangent)

            outward = _sub(p, center)
            outward = _sub(outward, _scale(occlusal, _dot(outward, occlusal)))
            o_unit = _normalize(outward)

            if t_unit is None or o_unit is None:
                frames[fdi] = _fallback_frame(fdi, p, up_unit)
                continue

            mesial_sign = 1.0 if i < midline_idx else -1.0
            mesial = _scale(t_unit, mesial_sign)

            # Buccal: outward, orthogonalized against mesial within the plane.
            buccal_raw = _sub(o_unit, _scale(mesial, _dot(o_unit, mesial)))
            buccal = _normalize(buccal_raw)
            if buccal is None:
                frames[fdi] = _fallback_frame(fdi, p, up_unit)
                continue

            frames[fdi] = ToothFrame(
                fdi=fdi,
                origin=p,
                mesial=mesial,
                buccal=buccal,
                occlusal=occlusal,
                is_upper=fdi < 30,
                is_fallback=False,
            )

    return frames


def _axis_angle_matrix(axis: Vec3, angle_rad: float) -> list[list[float]]:
    """Rodrigues rotation matrix for a unit axis."""
    x, y, z = axis
    c = math.cos(angle_rad)
    s = math.sin(angle_rad)
    t = 1.0 - c
    return [
        [t * x * x + c,     t * x * y - s * z, t * x * z + s * y],
        [t * x * y + s * z, t * y * y + c,     t * y * z - s * x],
        [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
    ]


def _mat_mul(a: list[list[float]], b: list[list[float]]) -> list[list[float]]:
    return [
        [sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)]
        for i in range(3)
    ]


def movement_transform(
    frame: ToothFrame,
    mesiodistal_mm: float,
    buccolingual_mm: float,
    occlusogingival_mm: float,
    rotation_deg: float,
    torque_deg: float,
    tip_deg: float,
) -> tuple[list[list[float]], Vec3]:
    """
    Map canonical signed movement components onto this tooth's frame.

    Returns (R, t): rotation matrix about the tooth origin and translation,
    to be applied as  v' = R @ (v - origin) + origin + t.

    Sign conventions (mirroring the established clinical convention used by
    the viewer): + mesiodistal = mesial; + buccolingual = buccal;
    + occlusogingival = extrusion, directed along -occlusal for the upper
    arch and +occlusal for the lower (teeth erupt toward the occlusal
    plane); rotation about the occlusal axis, torque about the mesial axis
    (mirrored between arches), tip about the buccal axis — composed as
    R = R_rotation @ R_tip @ R_torque.
    """
    extrusion_sign = -1.0 if frame.is_upper else 1.0
    mesial_sign = 1.0 if (11 <= frame.fdi <= 18) or (41 <= frame.fdi <= 48) else -1.0
    arch_sign = 1.0 if frame.is_upper else -1.0

    t = _add(
        _add(
            _scale(frame.mesial, mesiodistal_mm),
            _scale(frame.buccal, buccolingual_mm),
        ),
        _scale(frame.occlusal, occlusogingival_mm * extrusion_sign),
    )

    r_torque = _axis_angle_matrix(frame.mesial, math.radians(torque_deg) * arch_sign)
    r_tip = _axis_angle_matrix(frame.buccal, math.radians(tip_deg) * mesial_sign)
    r_rot = _axis_angle_matrix(frame.occlusal, math.radians(rotation_deg) * mesial_sign)
    r = _mat_mul(r_rot, _mat_mul(r_tip, r_torque))
    return r, t
