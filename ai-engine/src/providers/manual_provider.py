"""
Manual review provider — always routes to human clinical review.

Used as the terminal fallback when every AI engine is unavailable.
Never performs inference; returns a result that immediately flags the case
for manual review by the licensed orthodontist.
"""
from __future__ import annotations

import logging

from src.providers.base import (
    CLINICAL_DISCLAIMER,
    ProviderHealth,
    SegmentationProvider,
)

logger = logging.getLogger("ai-engine.providers.manual")

_MANUAL_VERSION = "1.0.0"


class ManualReviewProvider(SegmentationProvider):
    """
    Fallback provider that returns an empty segmentation marked for manual review.

    This provider never fabricates AI inference results.  It signals to the
    clinical workflow that no automated segmentation is available and that a
    licensed orthodontist must review the scan directly.
    """

    @property
    def engine_name(self) -> str:
        return "MANUAL"

    @property
    def engine_version(self) -> str:
        return _MANUAL_VERSION

    def health(self) -> ProviderHealth:
        return ProviderHealth(
            healthy=True,
            ready=True,
            model_loaded=False,
            engine_name=self.engine_name,
            engine_version=self.engine_version,
            error=None,
            extra={"note": "Manual review provider is always available"},
        )

    def validate_checkpoint(self) -> bool:
        return True

    def preprocess(self, file_path: str, jaw_type: str) -> str:
        return file_path

    def infer(self, preprocessed_path: str, jaw_type: str) -> dict:
        logger.info(
            "ManualReviewProvider: returning empty result for manual clinical review"
        )
        return {
            "success": True,
            "tooth_ids": [],
            "missing_teeth": [],
            "confidence_scores": {},
            "confidence_maps": {},
            "fdi_valid": True,
            "requires_manual_review": True,
            "deciduous_detected": False,
            "vertex_labels": [],
            "vertex_instances": [],
            "weights_loaded": False,
            "warnings": [
                "No automated segmentation engine is available. "
                "Manual clinical review required by a licensed orthodontist."
            ],
            "engine_name": self.engine_name,
            "engine_version": self.engine_version,
            "disclaimer": CLINICAL_DISCLAIMER,
        }

    def validate_output(self, raw_output: dict) -> dict:
        return raw_output

    def generate_metrics(self, validated_output: dict, timing_ms: int) -> dict:
        return {
            "engine": self.engine_name,
            "version": self.engine_version,
            "tooth_count": 0,
            "requires_manual_review": True,
            "fdi_valid": True,
            "timing_ms": timing_ms,
        }
