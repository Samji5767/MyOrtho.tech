"""
Abstract base class for all segmentation engine providers.

Contract:
  health()              → ProviderHealth
  validate_checkpoint() → bool
  preprocess(path, jaw) → str  (preprocessed file path)
  infer(path, jaw)      → dict (raw engine output dict)
  validate_output(raw)  → dict (validated/normalized output)
  generate_metrics(out, ms) → dict

The default segment() implementation chains these steps. Providers
override individual steps — not segment() directly.

No provider may import from another provider.
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional

CLINICAL_DISCLAIMER = (
    "Research-use segmentation. Manual clinical review required. "
    "AI-assisted recommendation only. "
    "Final treatment decisions remain the responsibility of the licensed orthodontist."
)


@dataclass
class ProviderHealth:
    healthy: bool
    ready: bool
    model_loaded: bool
    engine_name: str
    engine_version: str
    error: Optional[str] = None
    checkpoint_sha256: Optional[str] = None
    extra: Dict = field(default_factory=dict)


@dataclass
class SegmentationResult:
    tooth_ids: List[int]
    missing_teeth: List[int]
    confidence_scores: Dict[str, float]
    confidence_maps: Dict[str, float]
    fdi_valid: bool
    requires_manual_review: bool
    deciduous_detected: bool
    warnings: List[str]
    vertex_labels: List[int]
    vertex_instances: List[int]
    segmented_mesh_path: Optional[str]
    timing_ms: int
    engine_name: str
    engine_version: str
    weights_loaded: bool
    research_use: bool = True
    disclaimer: str = CLINICAL_DISCLAIMER


class SegmentationProvider(ABC):
    """Abstract segmentation provider — each engine implements this interface."""

    @property
    @abstractmethod
    def engine_name(self) -> str: ...

    @property
    @abstractmethod
    def engine_version(self) -> str: ...

    @abstractmethod
    def health(self) -> ProviderHealth: ...

    @abstractmethod
    def validate_checkpoint(self) -> bool: ...

    @abstractmethod
    def preprocess(self, file_path: str, jaw_type: str) -> str: ...

    @abstractmethod
    def infer(self, preprocessed_path: str, jaw_type: str) -> dict: ...

    @abstractmethod
    def validate_output(self, raw_output: dict) -> dict: ...

    @abstractmethod
    def generate_metrics(self, validated_output: dict, timing_ms: int) -> dict: ...

    def segment(self, file_path: str, jaw_type: str) -> SegmentationResult:
        t0 = time.perf_counter()
        preprocessed = self.preprocess(file_path, jaw_type)
        raw = self.infer(preprocessed, jaw_type)
        validated = self.validate_output(raw)
        timing_ms = int((time.perf_counter() - t0) * 1000)
        self.generate_metrics(validated, timing_ms)
        return SegmentationResult(
            tooth_ids=validated.get("tooth_ids", []),
            missing_teeth=validated.get("missing_teeth", []),
            confidence_scores=validated.get("confidence_scores", {}),
            confidence_maps=validated.get("confidence_maps", {}),
            fdi_valid=validated.get("fdi_valid", True),
            requires_manual_review=validated.get("requires_manual_review", False),
            deciduous_detected=validated.get("deciduous_detected", False),
            warnings=validated.get("warnings", []),
            vertex_labels=validated.get("vertex_labels", []),
            vertex_instances=validated.get("vertex_instances", []),
            segmented_mesh_path=validated.get("segmented_mesh_path"),
            timing_ms=timing_ms,
            engine_name=self.engine_name,
            engine_version=self.engine_version,
            weights_loaded=validated.get("weights_loaded", False),
        )
