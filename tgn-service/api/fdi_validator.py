"""
FDI tooth numbering validation and confidence assessment.

FDI World Dental Federation two-digit notation:
  Quadrant 1 (upper-right, patient's right):  11–18
  Quadrant 2 (upper-left,  patient's left):   21–28
  Quadrant 3 (lower-left,  patient's left):   31–38
  Quadrant 4 (lower-right, patient's right):  41–48

  Deciduous:
  Quadrants 5–8: 51–55, 61–65, 71–75, 81–85

  Label 0 = gingiva / background.

TGN output convention (from predict_utils.py):
  - For "upper" scans: labels stay in range 11–28
  - For "lower" scans: TGN adds 20 to non-zero labels
    (so raw model output in 11–28 range → 31–48 after adjustment)
"""

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

# Ordered positions within each quadrant (mesial → distal)
QUADRANT_POSITIONS: Dict[int, List[int]] = {
    1: list(range(11, 19)),
    2: list(range(21, 29)),
    3: list(range(31, 39)),
    4: list(range(41, 49)),
}

DEFAULT_CONFIDENCE_THRESHOLD = 0.70


@dataclass
class FDIValidationResult:
    jaw: str
    detected_teeth: List[int]
    missing_teeth: List[int]
    unexpected_teeth: List[int]         # wrong jaw
    low_confidence_teeth: List[int]
    confidence_scores: Dict[str, float]
    warnings: List[str]
    is_valid: bool
    requires_manual_review: bool
    deciduous_detected: bool
    gingiva_only: bool = False          # model returned no tooth labels at all
    partial_segmentation: bool = False  # fewer teeth than minimum viable arch


def compute_per_tooth_confidence(
    labels: List[int],
    instances: List[int],
) -> Dict[str, float]:
    """
    Estimate per-tooth segmentation confidence from instance consistency.

    Each vertex has a semantic label (FDI code) and an instance id.
    For a clean segmentation, all vertices assigned to FDI code X should
    belong to the same instance.  The confidence for tooth X is:

        dominant_instance_vertex_count / total_vertices_with_label_X

    Score = 1.0 means perfect instance agreement (all vertices same instance).
    Score < 0.5 suggests ambiguous / split segmentation → flag for review.
    """
    tooth_instances: Dict[int, List[int]] = collections.defaultdict(list)
    for lbl, ins in zip(labels, instances):
        if lbl != 0:
            tooth_instances[lbl].append(ins)

    confidence: Dict[str, float] = {}
    for fdi, ins_list in tooth_instances.items():
        if not ins_list:
            continue
        dominant_count = max(collections.Counter(ins_list).values())
        confidence[str(fdi)] = round(dominant_count / len(ins_list), 4)

    return confidence


def validate_fdi_sequence(
    labels: List[int],
    jaw: str,
    confidence_scores: Optional[Dict[str, float]] = None,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> FDIValidationResult:
    """
    Validate FDI tooth labels produced by TGN.

    Args:
        labels:              Per-vertex FDI label list (0 = gingiva).
        jaw:                 "upper", "lower", or "combined".
        confidence_scores:   Optional {str(fdi): float} from compute_per_tooth_confidence.
        confidence_threshold: Minimum score to accept without flagging for review.

    Returns:
        FDIValidationResult with detected/missing/unexpected teeth and warnings.
    """
    confidence_scores = confidence_scores or {}
    warnings: List[str] = []

    # Unique non-zero labels
    label_set: Set[int] = {lbl for lbl in labels if lbl != 0}

    # Expected set for this jaw (needed before early-exit checks)
    if jaw == "upper":
        expected_set = MAXILLARY_FDI
    elif jaw == "lower":
        expected_set = MANDIBULAR_FDI
    else:
        expected_set = ALL_PERMANENT_FDI

    # ── Gingiva-only / empty output ────────────────────────────────────────────
    if not label_set:
        warnings.append(
            "No tooth labels detected — output is gingiva-only (label 0). "
            "Model may have failed, scan may be empty, or only soft tissue is present."
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
            partial_segmentation=False,
        )

    # Separate deciduous from permanent
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
            "May be genuinely absent, impacted, or below the model's confidence."
        )

    if unexpected_teeth:
        warnings.append(
            f"Cross-jaw FDI codes for {jaw} scan: {unexpected_teeth}. "
            "Possible cross-jaw contamination or supernumerary teeth."
        )

    # Confidence gate
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

    # Per-quadrant continuity
    for q, positions in QUADRANT_POSITIONS.items():
        detected_q = [t for t in positions if t in permanent_detected]
        if len(detected_q) < 2:
            continue
        first_i = positions.index(detected_q[0])
        last_i = positions.index(detected_q[-1])
        run = positions[first_i : last_i + 1]
        gaps = [t for t in run if t not in permanent_detected]
        if gaps:
            warnings.append(
                f"Q{q} non-contiguous sequence: gaps at {gaps}. "
                "Possible missing teeth or segmentation artifact."
            )

    # ── Partial segmentation check ──────────────────────────────────────────────
    # Minimum viable arch: at least 4 permanent teeth in the correct jaw
    MIN_VIABLE_TEETH = 4
    partial = len(permanent_detected & expected_set) < MIN_VIABLE_TEETH
    if partial and permanent_detected:
        warnings.append(
            f"Partial segmentation: only {len(permanent_detected & expected_set)} "
            f"teeth detected in expected jaw range (minimum: {MIN_VIABLE_TEETH}). "
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
