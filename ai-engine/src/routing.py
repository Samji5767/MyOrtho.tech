"""
Segmentation router — selects the active provider and executes fallback chains.

Provider selection is controlled entirely by environment variables:

  SEGMENTATION_PROVIDER   AUTO | TGN | MESHSEGNET | MANUAL
    AUTO  (default) — try PRIMARY engine; on failure try the other AI engine;
                      on second failure fall back to MANUAL.
    TGN             — use TGN only; fall back to MANUAL if TGN fails.
    MESHSEGNET      — use MeshSegNet only; fall back to MANUAL if it fails.
    MANUAL          — skip all AI engines; route directly to manual review.

  SEGMENTATION_PRIMARY    TGN | MESHSEGNET  (default: TGN)
    Which engine is tried first when SEGMENTATION_PROVIDER=AUTO.

The router never imports provider-specific engine classes; it only operates on
SegmentationProvider instances registered in the ProviderRegistry it receives.
"""
from __future__ import annotations

import logging
import os
from typing import List, Optional

from src.providers.base import SegmentationProvider, SegmentationResult
from src.providers.registry import ProviderRegistry

logger = logging.getLogger("ai-engine.routing")

_PROVIDER_ENV = os.getenv("SEGMENTATION_PROVIDER", "MANUAL").upper().strip()
_PRIMARY_ENV = os.getenv("SEGMENTATION_PRIMARY", "TGN").upper().strip()


class SegmentationRouter:
    """
    Routes a segmentation request to the correct provider according to
    SEGMENTATION_PROVIDER / SEGMENTATION_PRIMARY env vars.

    Fallback order (AUTO mode):
      1. PRIMARY engine (TGN or MESHSEGNET, per SEGMENTATION_PRIMARY)
      2. The other AI engine
      3. MANUAL review
    """

    def __init__(self, registry: ProviderRegistry) -> None:
        self._registry = registry

    def _build_route_plan(self, provider_override: Optional[str] = None) -> List[str]:
        """
        Return an ordered list of provider names to try.

        provider_override allows per-request override (e.g. from the API body).
        Falls back to SEGMENTATION_PROVIDER env var when not provided.
        """
        mode = (provider_override or _PROVIDER_ENV).upper().strip()

        if mode == "TGN":
            return ["TGN", "MANUAL"]

        if mode == "MESHSEGNET":
            return ["MESHSEGNET", "MANUAL"]

        if mode == "MANUAL":
            return ["MANUAL"]

        # AUTO: primary first, then the other AI engine, then MANUAL
        primary = _PRIMARY_ENV if _PRIMARY_ENV in ("TGN", "MESHSEGNET") else "TGN"
        secondary = "MESHSEGNET" if primary == "TGN" else "TGN"
        return [primary, secondary, "MANUAL"]

    def get_active_provider(self, provider_override: Optional[str] = None) -> SegmentationProvider:
        """
        Return the first healthy provider in the route plan.
        Always returns something — MANUAL is always registered and always healthy.
        """
        for name in self._build_route_plan(provider_override):
            provider = self._registry.get(name)
            if provider is None:
                logger.debug("Provider %s not registered; skipping", name)
                continue
            h = provider.health()
            if h.healthy and h.ready:
                logger.info("SegmentationRouter selected provider: %s", name)
                return provider
            logger.info(
                "Provider %s not ready (healthy=%s ready=%s error=%s); skipping",
                name, h.healthy, h.ready, h.error,
            )

        # Should never reach here because MANUAL is always healthy.
        raise RuntimeError("No segmentation provider available — MANUAL provider must always be registered")

    def route(
        self,
        file_path: str,
        jaw_type: str,
        provider_override: Optional[str] = None,
    ) -> SegmentationResult:
        """
        Execute segmentation with automatic fallback through the route plan.

        On each provider failure, logs the error and tries the next candidate.
        The MANUAL provider never raises, so the chain always terminates.
        """
        plan = self._build_route_plan(provider_override)
        last_error: Optional[Exception] = None

        for name in plan:
            provider = self._registry.get(name)
            if provider is None:
                logger.debug("Provider %s not registered; skipping", name)
                continue

            h = provider.health()
            if not (h.healthy and h.ready):
                logger.info("Skipping unhealthy provider %s: %s", name, h.error)
                continue

            try:
                logger.info("Attempting segmentation with provider: %s", name)
                result = provider.segment(file_path, jaw_type)
                if name != plan[0]:
                    result.warnings.append(
                        f"Primary segmentation engine was unavailable; "
                        f"result produced by {name}."
                    )
                return result
            except Exception as exc:
                logger.error("Provider %s raised during segmentation: %s", name, exc)
                last_error = exc
                continue

        raise RuntimeError(
            f"All segmentation providers failed. Last error: {last_error}"
        )

    def describe_route_plan(self, provider_override: Optional[str] = None) -> List[dict]:
        """Return a human-readable description of the current route plan."""
        plan = self._build_route_plan(provider_override)
        result = []
        for i, name in enumerate(plan):
            provider = self._registry.get(name)
            if provider is None:
                result.append({"priority": i + 1, "name": name, "registered": False})
                continue
            h = provider.health()
            result.append({
                "priority": i + 1,
                "name": name,
                "registered": True,
                "healthy": h.healthy,
                "ready": h.ready,
                "version": h.engine_version,
                "error": h.error,
            })
        return result
