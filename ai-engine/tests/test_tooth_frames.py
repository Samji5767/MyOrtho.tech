"""Tests for per-tooth anatomical frames (src/tooth_frames.py).

The same algorithm is mirrored in frontend/src/lib/toothFrames.ts; a change
that alters any numeric result here must be applied to both files.
"""
import math

import pytest

from src.tooth_frames import compute_tooth_frames, movement_transform

UPPERS = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]
LOWERS = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37]


def _arch_centroids():
    cent = {}
    for arr, zoff in ((UPPERS, 12.0), (LOWERS, 0.0)):
        for i, fdi in enumerate(arr):
            ang = -1.9 + 3.8 * i / (len(arr) - 1)
            cent[fdi] = (27.0 * math.sin(ang), 27.0 * math.cos(ang), zoff)
    return cent


def _dist(a, b):
    return math.dist(a, b)


def test_mesial_points_toward_midline():
    cent = _arch_centroids()
    frames = compute_tooth_frames(cent)
    for fdi, midline_fdi in ((16, 11), (26, 21), (46, 41), (36, 31)):
        f = frames[fdi]
        stepped = tuple(f.origin[i] + 3.0 * f.mesial[i] for i in range(3))
        assert _dist(stepped, cent[midline_fdi]) < _dist(f.origin, cent[midline_fdi]), fdi


def test_buccal_points_outward():
    cent = _arch_centroids()
    frames = compute_tooth_frames(cent)
    for arch in (UPPERS, LOWERS):
        cx = sum(cent[f][0] for f in arch) / len(arch)
        cy = sum(cent[f][1] for f in arch) / len(arch)
        for fdi in arch:
            f = frames[fdi]
            p2 = (f.origin[0] + 2 * f.buccal[0], f.origin[1] + 2 * f.buccal[1])
            assert math.hypot(p2[0] - cx, p2[1] - cy) > math.hypot(
                f.origin[0] - cx, f.origin[1] - cy
            ), fdi


def test_frames_orthonormal_and_occlusal_up():
    frames = compute_tooth_frames(_arch_centroids(), up_hint=(0.0, 0.0, 1.0))
    for fdi, f in frames.items():
        assert not f.is_fallback
        assert f.occlusal[2] > 0.95, (fdi, f.occlusal)
        for axis in (f.mesial, f.buccal, f.occlusal):
            assert abs(math.sqrt(sum(c * c for c in axis)) - 1.0) < 1e-9
        assert abs(sum(f.mesial[i] * f.buccal[i] for i in range(3))) < 1e-9


def test_sparse_arch_falls_back():
    frames = compute_tooth_frames({11: (0.0, 27.0, 0.0), 21: (3.0, 27.0, 0.0)})
    assert all(f.is_fallback for f in frames.values())


def test_movement_transform_rotation_is_orthonormal():
    frames = compute_tooth_frames(_arch_centroids())
    r, t = movement_transform(
        frames[16],
        mesiodistal_mm=1.0, buccolingual_mm=-0.5, occlusogingival_mm=0.3,
        rotation_deg=12.0, torque_deg=6.0, tip_deg=-4.0,
    )
    # R must be a proper rotation: R Rᵀ = I, det = +1.
    for i in range(3):
        for j in range(3):
            rrt = sum(r[i][k] * r[j][k] for k in range(3))
            assert abs(rrt - (1.0 if i == j else 0.0)) < 1e-9
    det = (
        r[0][0] * (r[1][1] * r[2][2] - r[1][2] * r[2][1])
        - r[0][1] * (r[1][0] * r[2][2] - r[1][2] * r[2][0])
        + r[0][2] * (r[1][0] * r[2][1] - r[1][1] * r[2][0])
    )
    assert abs(det - 1.0) < 1e-9


def test_extrusion_direction_flips_between_arches():
    frames = compute_tooth_frames(_arch_centroids(), up_hint=(0.0, 0.0, 1.0))
    _, t_up = movement_transform(frames[16], 0, 0, 1.0, 0, 0, 0)
    _, t_low = movement_transform(frames[46], 0, 0, 1.0, 0, 0, 0)
    # Extrusion moves teeth toward the occlusal plane: down (-Z) for the
    # upper arch in an occlusal-up frame, up (+Z) for the lower.
    assert t_up[2] < -0.9
    assert t_low[2] > 0.9


def test_pure_mesial_movement_stays_in_arch_plane():
    frames = compute_tooth_frames(_arch_centroids())
    r, t = movement_transform(frames[13], 1.0, 0, 0, 0, 0, 0)
    assert abs(t[2]) < 1e-9              # planar fixture arch: no vertical drift
    assert r[0][0] == pytest.approx(1.0)  # no rotation requested
    assert abs(math.sqrt(sum(c * c for c in t)) - 1.0) < 1e-9
