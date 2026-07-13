"""
Provider registry — registers and resolves segmentation engine providers.

Providers self-register via ProviderRegistry.register().
The registry never imports provider modules directly — it only holds
references passed to it.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

from src.providers.base import SegmentationProvider

logger = logging.getLogger("ai-engine.registry")


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: Dict[str, SegmentationProvider] = {}

    def register(self, provider: SegmentationProvider) -> None:
        key = provider.engine_name.upper()
        self._providers[key] = provider
        logger.info(
            "Registered segmentation provider: %s v%s",
            provider.engine_name,
            provider.engine_version,
        )

    def get(self, name: str) -> Optional[SegmentationProvider]:
        return self._providers.get(name.upper())

    def list_names(self) -> List[str]:
        return list(self._providers.keys())

    def health_report(self) -> Dict[str, dict]:
        out: Dict[str, dict] = {}
        for name, provider in self._providers.items():
            try:
                h = provider.health()
                out[name] = {
                    "healthy": h.healthy,
                    "ready": h.ready,
                    "model_loaded": h.model_loaded,
                    "version": h.engine_version,
                    "error": h.error,
                    "checkpoint_sha256": h.checkpoint_sha256,
                }
            except Exception as exc:
                out[name] = {
                    "healthy": False,
                    "ready": False,
                    "model_loaded": False,
                    "version": "unknown",
                    "error": str(exc),
                }
        return out
