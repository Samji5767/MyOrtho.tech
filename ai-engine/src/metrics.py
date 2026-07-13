"""
Per-engine Prometheus-style metrics for the AI segmentation service.

Counters are stored in-process (no external deps).  Endpoints:
  GET /metrics        — Prometheus text format
  GET /metrics/json   — JSON format for dashboards

Metrics tracked per engine:
  seg_requests_total          — total segmentation requests routed to this engine
  seg_successes_total         — completed successfully
  seg_failures_total          — raised an exception
  seg_manual_review_total     — flagged requires_manual_review
  seg_validation_failures_total — output failed FDI validation
  seg_duration_ms_sum         — cumulative inference time
  seg_duration_ms_count       — observation count (for avg calculation)
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Dict


class _EngineCounters:
    __slots__ = (
        "requests", "successes", "failures",
        "manual_review", "validation_failures",
        "duration_ms_sum", "duration_ms_count",
    )

    def __init__(self) -> None:
        self.requests: int = 0
        self.successes: int = 0
        self.failures: int = 0
        self.manual_review: int = 0
        self.validation_failures: int = 0
        self.duration_ms_sum: float = 0.0
        self.duration_ms_count: int = 0


class SegmentationMetrics:
    """Thread-safe per-engine metric counters."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._engines: Dict[str, _EngineCounters] = defaultdict(_EngineCounters)
        self._started_at = time.time()

    def _get(self, engine: str) -> _EngineCounters:
        return self._engines[engine.upper()]

    def record_request(self, engine: str) -> None:
        with self._lock:
            self._get(engine).requests += 1

    def record_success(self, engine: str, duration_ms: int, requires_manual_review: bool = False) -> None:
        with self._lock:
            c = self._get(engine)
            c.successes += 1
            c.duration_ms_sum += duration_ms
            c.duration_ms_count += 1
            if requires_manual_review:
                c.manual_review += 1

    def record_failure(self, engine: str, duration_ms: int = 0) -> None:
        with self._lock:
            c = self._get(engine)
            c.failures += 1
            if duration_ms:
                c.duration_ms_sum += duration_ms
                c.duration_ms_count += 1

    def record_validation_failure(self, engine: str) -> None:
        with self._lock:
            self._get(engine).validation_failures += 1

    def get_json_metrics(self) -> dict:
        with self._lock:
            out = {
                "uptime_seconds": int(time.time() - self._started_at),
                "engines": {},
            }
            for name, c in self._engines.items():
                avg_ms = (
                    round(c.duration_ms_sum / c.duration_ms_count, 1)
                    if c.duration_ms_count > 0
                    else 0.0
                )
                out["engines"][name] = {
                    "requests_total": c.requests,
                    "successes_total": c.successes,
                    "failures_total": c.failures,
                    "manual_review_total": c.manual_review,
                    "validation_failures_total": c.validation_failures,
                    "avg_duration_ms": avg_ms,
                    "duration_ms_sum": c.duration_ms_sum,
                    "duration_ms_count": c.duration_ms_count,
                }
            return out

    def get_prometheus_text(self) -> str:
        """Return metrics in Prometheus exposition format (text/plain; version=0.0.4)."""
        lines: list[str] = []
        uptime = int(time.time() - self._started_at)

        def metric(name: str, help_text: str, mtype: str) -> None:
            lines.append(f"# HELP {name} {help_text}")
            lines.append(f"# TYPE {name} {mtype}")

        metric("seg_uptime_seconds", "Seconds since the ai-engine started", "gauge")
        lines.append(f'seg_uptime_seconds {uptime}')

        with self._lock:
            engines_snapshot = {k: (
                v.requests, v.successes, v.failures,
                v.manual_review, v.validation_failures,
                v.duration_ms_sum, v.duration_ms_count,
            ) for k, v in self._engines.items()}

        if engines_snapshot:
            metric("seg_requests_total", "Total segmentation requests per engine", "counter")
            for name, vals in engines_snapshot.items():
                lines.append(f'seg_requests_total{{engine="{name}"}} {vals[0]}')

            metric("seg_successes_total", "Successful segmentation completions per engine", "counter")
            for name, vals in engines_snapshot.items():
                lines.append(f'seg_successes_total{{engine="{name}"}} {vals[1]}')

            metric("seg_failures_total", "Failed segmentation attempts per engine", "counter")
            for name, vals in engines_snapshot.items():
                lines.append(f'seg_failures_total{{engine="{name}"}} {vals[2]}')

            metric("seg_manual_review_total", "Segmentations flagged for manual review per engine", "counter")
            for name, vals in engines_snapshot.items():
                lines.append(f'seg_manual_review_total{{engine="{name}"}} {vals[3]}')

            metric("seg_validation_failures_total", "FDI validation failures per engine", "counter")
            for name, vals in engines_snapshot.items():
                lines.append(f'seg_validation_failures_total{{engine="{name}"}} {vals[4]}')

            metric("seg_duration_ms_sum", "Cumulative inference duration in milliseconds per engine", "counter")
            for name, vals in engines_snapshot.items():
                lines.append(f'seg_duration_ms_sum{{engine="{name}"}} {vals[5]}')

            metric("seg_duration_ms_count", "Number of timed inference observations per engine", "counter")
            for name, vals in engines_snapshot.items():
                lines.append(f'seg_duration_ms_count{{engine="{name}"}} {vals[6]}')

        lines.append("")  # trailing newline
        return "\n".join(lines)


# Module-level singleton
_metrics = SegmentationMetrics()


def get_metrics() -> SegmentationMetrics:
    return _metrics
