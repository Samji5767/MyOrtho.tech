"""
FDI tooth numbering validation for MeshSegNet outputs.

Per-service copy — each microservice owns its own validator to maintain
isolation between TGN and MeshSegNet service deployments.

FDI World Dental Federation two-digit notation:
  Quadrant 1 (upper-right): 11–18
  Quadrant 2 (upper-left):  21–28
  Quadrant 3 (lower-left):  31–38
  Quadrant 4 (lower-right): 41–48
  Deciduous: 51–55, 61–65, 71–75, 81–85

MeshSegNet label 0 = gingiva / background.
"""
from __future__ import annotations

import collections
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

# ── FDI taxonomy ──────────────────────────────────────────────────────────────

MAXILLARY_FDI: Set[int] = set(range(11, 19)) | set(range(21, 29))
MANDIBULAR_FDI: Set[int] = set(range(31, 39)) | set(range(41, 49))
ALL_PERMANENT_FDI: Set[int] = MAXILLARY_FDI | MANDIBULAR_FDI
DECIDUOUS_FDI: Set[int] = (
    set(range(51, 56)) | set(range(61, 66))
    | set(range(71, 76)) | set(range(81, 86))
)

QUADRANT_POSITIONS: Dict[int, List[int]] = {
    1: list(range(11, 19)),
    2: list(range(21, 29)),
    3: list(range(31, 39)),
    4: list(range(41, 49)),
}

DEFAULT_CONFIDENCE_THRESHOLD = 0.70
MIN_VIABLE_TEETH = 4


@dataclass
class FDIValidationResult:
    jaw: str
    detected_teeth: List[int]
    missing_teeth: List[int]
    unexpected_teeth: List[int]
    low_confidence_teeth: List[int]
    confidence_scores: Dict[str, float]
    warnings: List[str]
    is_valid: bool
    requires_manual_review: bool
    deciduous_detected: bool
    gingiva_only: bool = False
    partial_segmentation: bool = False


def compute_per_face_confidence(
    fdi_labels: List[int],
) -> Dict[str, float]:
    """
    Estimate per-tooth confidence from the frequency of the dominant label
    assignment.  Unlike TGN (which uses instance IDs), MeshSegNet assigns
    a single class per face.  Confidence = fraction of faces whose assigned
    class matches the plurality class for that spatial region.

    Here we approximate: confidence = 1.0 for all detected teeth since
    MeshSegNet outputs a single argmax class per face.  Callers may supply
    per-face softmax probabilities for a richer estimate.
    """
    counts: Dict[int, int] = collections.Counter(lbl for lbl in fdi_labels if lbl != 0)
    total_face_count = sum(counts.values())
    if total_face_count == 0:
        return {}
    confidence: Dict[str, float] = {}
    for fdi, cnt in counts.items():
        confidence[str(fdi)] = round(cnt / total_face_count, 4)
    return confidence


def compute_per_face_softmax_confidence(
    fdi_labels: List[int],
    per_face_max_prob: List[float],
) -> Dict[str, float]:
    """
    Aggregate per-face softmax max-probability into per-tooth confidence.

    For each detected FDI code, averages the max softmax probability of all
    faces labelled with that code.
    """
    sums: Dict[int, float] = collections.defaultdict(float)
    counts: Dict[int, int] = collections.defaultdict(int)
    for lbl, prob in zip(fdi_labels, per_face_max_prob):
        if lbl != 0:
            sums[lbl] += prob
            counts[lbl] += 1
    return {
        str(fdi): round(sums[fdi] / counts[fdi], 4)
        for fdi in sums
        if counts[fdi] > 0
    }


def validate_fdi_sequence(
    fdi_labels: List[int],
    jaw: str,
    confidence_scores: Optional[Dict[str, float]] = None,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> FDIValidationResult:
    """
    Validate FDI tooth labels produced by MeshSegNet (per-face labels).

    Args:
        fdi_labels:          Per-face FDI label list (0 = gingiva).
        jaw:                 "upper", "lower", or "combined".
        confidence_scores:   Optional {str(fdi): float}.
        confidence_threshold: Minimum score to accept without flagging.

    Returns:
        FDIValidationResult
    """
    confidence_scores = confidence_scores or {}
    warnings: List[str] = []

    label_set: Set[int] = {lbl for lbl in fdi_labels if lbl != 0}

    if jaw == "upper":
        expected_set = MAXILLARY_FDI
    elif jaw == "lower":
        expected_set = MANDIBULAR_FDI
    else:
        expected_set = ALL_PERMANENT_FDI

    if not label_set:
        warnings.append(
            "No tooth labels detected — output is gingiva-only. "
            "Model may have failed or scan contains only soft tissue."
        )
        return FDIValidationResult(
            jaw=jaw,
            detected_teeth=[],
            missing_teeth=sorted(expected_set),
            unexpected_teeth=[],
            low_confidence_teeth=[],
            confidence_scores={},
            warnings=warnings,
            is_valid=False,
            requires_manual_review=True,
            deciduous_detected=False,
            gingiva_only=True,
        )

    deciduous_found = label_set & DECIDUOUS_FDI
    deciduous_detected = bool(deciduous_found)
    if deciduous_detected:
        warnings.append(
            f"Deciduous teeth detected ({sorted(deciduous_found)}). "
            "Mixed/primary dentition — manual review required."
        )

    permanent_detected = label_set & ALL_PERMANENT_FDI
    missing_teeth = sorted(expected_set - permanent_detected)
    unexpected_teeth = sorted(permanent_detected - expected_set)

    if missing_teeth:
        warnings.append(
            f"Teeth not detected: {missing_teeth}. "
            "May be absent, impacted, or below confidence threshold."
        )

    if unexpected_teeth:
        warnings.append(
            f"Cross-jaw FDI codes for {jaw} scan: {unexpected_teeth}. "
            "Possible cross-jaw contamination or supernumerary teeth."
        )

    low_confidence_teeth: List[int] = []
    for fdi in sorted(permanent_detected):
        score = confidence_scores.get(str(fdi), 1.0)
        if score < confidence_threshold:
            low_confidence_teeth.append(fdi)

    if low_confidence_teeth:
        warnings.append(
            f"Low-confidence assignments (<{confidence_threshold:.0%}): "
            f"{low_confidence_teeth}. Manual correction recommended."
        )

    for q, positions in QUADRANT_POSITIONS.items():
        detected_q = [t for t in positions if t in permanent_detected]
        if len(detected_q) < 2:
            continue
        first_i = positions.index(detected_q[0])
        last_i = positions.index(detected_q[-1])
        run = positions[first_i: last_i + 1]
        gaps = [t for t in run if t not in permanent_detected]
        if gaps:
            warnings.append(
                f"Q{q} non-contiguous sequence: gaps at {gaps}. "
                "Possible missing teeth or segmentation artifact."
            )

    partial = len(permanent_detected & expected_set) < MIN_VIABLE_TEETH
    if partial and permanent_detected:
        warnings.append(
            f"Partial segmentation: only {len(permanent_detected & expected_set)} "
            f"teeth detected (minimum: {MIN_VIABLE_TEETH}). "
            "Result may be unreliable — manual review required."
        )

    is_valid = (
        not unexpected_teeth
        and not low_confidence_teeth
        and not deciduous_detected
        and not partial
    )
    requires_review = not is_valid or bool(missing_teeth) or bool(warnings)

    return FDIValidationResult(
        jaw=jaw,
        detected_teeth=sorted(permanent_detected),
        missing_teeth=missing_teeth,
        unexpected_teeth=unexpected_teeth,
        low_confidence_teeth=low_confidence_teeth,
        confidence_scores={str(t): confidence_scores.get(str(t), 1.0) for t in permanent_detected},
        warnings=warnings,
        is_valid=is_valid,
        requires_manual_review=requires_review,
        deciduous_detected=deciduous_detected,
        gingiva_only=False,
        partial_segmentation=partial,
    )
