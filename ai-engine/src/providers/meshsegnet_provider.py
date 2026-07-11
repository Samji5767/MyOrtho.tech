"""
MeshSegNet segmentation provider — wraps MeshSegNetEngine as a SegmentationProvider.

When MESHSEGNET_ENABLED is false or MESHSEGNET_API_URL is unset, returns a
disabled-state health report and raises on any attempt to segment.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from src.providers.base import ProviderHealth, SegmentationProvider

logger = logging.getLogger("ai-engine.providers.meshsegnet")


class MeshSegNetProvider(SegmentationProvider):
    """SegmentationProvider adapter for the MeshSegNet microservice."""

    def __init__(self, engine=None) -> None:
        # engine is an Optional[MeshSegNetEngine]; accepted as Any to avoid
        # a hard import cycle.
        self._engine = engine

    @property
    def engine_name(self) -> str:
        return "MESHSEGNET"

    @property
    def engine_version(self) -> str:
        return os.getenv("MESHSEGNET_MODEL_VERSION", "1.0.0")

    def health(self) -> ProviderHealth:
        if self._engine is None:
            return ProviderHealth(
                healthy=False,
                ready=False,
                model_loaded=False,
                engine_name=self.engine_name,
                engine_version=self.engine_version,
                error="MESHSEGNET_ENABLED=false or MESHSEGNET_API_URL not configured",
            )
        try:
            ok = self._engine._check_health()
            return ProviderHealth(
                healthy=ok,
                ready=ok,
                model_loaded=ok,
                engine_name=self.engine_name,
                engine_version=self.engine_version,
                error=None if ok else "MeshSegNet health check returned unhealthy",
            )
        except Exception as exc:
            logger.warning("MeshSegNet health check raised: %s", exc)
            return ProviderHealth(
                healthy=False,
                ready=False,
                model_loaded=False,
                engine_name=self.engine_name,
                engine_version=self.engine_version,
                error=str(exc),
            )

    def validate_checkpoint(self) -> bool:
        return self._engine is not None

    def preprocess(self, file_path: str, jaw_type: str) -> str:
        # MeshSegNet service handles preprocessing internally.
        return file_path

    def infer(self, preprocessed_path: str, jaw_type: str) -> dict:
        if self._engine is None:
            raise RuntimeError(
                "MeshSegNet engine is not available — "
                "MESHSEGNET_ENABLED=false or MESHSEGNET_API_URL not set"
            )
        return self._engine.segment_mesh(preprocessed_path, jaw_type)

    def validate_output(self, raw_output: dict) -> dict:
        raw_output.setdefault("weights_loaded", True)
        raw_output.setdefault("engine_name", self.engine_name)
        raw_output.setdefault("engine_version", self.engine_version)
        return raw_output

    def generate_metrics(self, validated_output: dict, timing_ms: int) -> dict:
        tooth_ids = validated_output.get("tooth_ids", [])
        return {
            "engine": self.engine_name,
            "version": self.engine_version,
            "tooth_count": len(tooth_ids),
            "requires_manual_review": validated_output.get("requires_manual_review", False),
            "fdi_valid": validated_output.get("fdi_valid", True),
            "timing_ms": timing_ms,
        }
