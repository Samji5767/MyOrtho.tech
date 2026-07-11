"""
Segmentation benchmarking engine.

Runs multiple providers in parallel on the same input and returns a side-by-side
comparison.  Results are stored in Redis (or in-memory fallback) for async retrieval.

This module is for internal validation only — it is never exposed as a production
clinical API.  Every result carries `research_use: true` and the clinical disclaimer.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from typing import Dict, List, Optional

from src.providers.registry import ProviderRegistry

logger = logging.getLogger("ai-engine.benchmarking")

# Max workers: one per provider plus headroom
_MAX_WORKERS = 8
_BENCHMARK_TTL_SECONDS = 3600  # 1 hour


class BenchmarkEngine:
    """
    Runs a segmentation benchmark across multiple registered providers.

    Usage:
        engine = BenchmarkEngine(registry, redis_client)
        bench_id = engine.start(file_path, jaw_type, provider_names=["TGN", "MESHSEGNET"])
        # ... later ...
        result = engine.get_result(bench_id)
    """

    def __init__(self, registry: ProviderRegistry, redis_client=None) -> None:
        self._registry = registry
        self._redis = redis_client
        self._in_memory: Dict[str, dict] = {}

    def _store(self, bench_id: str, data: dict) -> None:
        payload = json.dumps(data)
        if self._redis:
            try:
                self._redis.setex(f"bench:{bench_id}", _BENCHMARK_TTL_SECONDS, payload)
                return
            except Exception as exc:
                logger.warning("Redis store failed; using in-memory fallback: %s", exc)
        self._in_memory[bench_id] = data

    def _load(self, bench_id: str) -> Optional[dict]:
        if self._redis:
            try:
                raw = self._redis.get(f"bench:{bench_id}")
                if raw:
                    return json.loads(raw)
            except Exception as exc:
                logger.warning("Redis load failed; checking in-memory: %s", exc)
        return self._in_memory.get(bench_id)

    def get_result(self, bench_id: str) -> Optional[dict]:
        return self._load(bench_id)

    def start(
        self,
        file_path: str,
        jaw_type: str,
        provider_names: Optional[List[str]] = None,
    ) -> str:
        """
        Launch benchmark in the calling thread (blocking).
        Returns bench_id for later retrieval.

        For async use, call this inside a background thread/task.
        """
        bench_id = str(uuid.uuid4())
        names = provider_names or self._registry.list_names()
        # Exclude MANUAL from benchmarks — it has no AI output to compare.
        names = [n for n in names if n.upper() != "MANUAL"]

        logger.info(
            "Starting benchmark %s: providers=%s file=%s jaw=%s",
            bench_id, names, file_path, jaw_type,
        )

        initial = {
            "bench_id": bench_id,
            "status": "running",
            "file_path": file_path,
            "jaw_type": jaw_type,
            "providers": names,
            "results": {},
            "started_at": time.time(),
            "completed_at": None,
            "research_use": True,
            "disclaimer": (
                "Research-use benchmark only. "
                "AI-assisted segmentation. Manual clinical review required. "
                "Final treatment decisions remain the responsibility of "
                "the licensed orthodontist."
            ),
        }
        self._store(bench_id, initial)

        results: Dict[str, dict] = {}

        def _run_one(name: str) -> tuple:
            provider = self._registry.get(name)
            if provider is None:
                return name, {"status": "skipped", "error": "provider not registered"}
            t0 = time.perf_counter()
            try:
                seg = provider.segment(file_path, jaw_type)
                elapsed = int((time.perf_counter() - t0) * 1000)
                out = asdict(seg)
                out["benchmark_timing_ms"] = elapsed
                out["status"] = "completed"
                return name, out
            except Exception as exc:
                elapsed = int((time.perf_counter() - t0) * 1000)
                logger.error("Benchmark provider %s failed: %s", name, exc)
                return name, {
                    "status": "failed",
                    "error": str(exc),
                    "benchmark_timing_ms": elapsed,
                }

        with ThreadPoolExecutor(max_workers=min(_MAX_WORKERS, len(names))) as pool:
            futures = {pool.submit(_run_one, n): n for n in names}
            for future in as_completed(futures):
                name, result = future.result()
                results[name] = result

        final = {
            **initial,
            "status": "completed",
            "results": results,
            "completed_at": time.time(),
            "summary": self._summarise(results),
        }
        self._store(bench_id, final)
        logger.info("Benchmark %s completed", bench_id)
        return bench_id

    @staticmethod
    def _summarise(results: Dict[str, dict]) -> dict:
        """Build a cross-provider comparison summary."""
        summary: dict = {
            "tooth_counts": {},
            "timing_ms": {},
            "requires_manual_review": {},
            "fdi_valid": {},
        }
        for name, r in results.items():
            if r.get("status") != "completed":
                continue
            summary["tooth_counts"][name] = len(r.get("tooth_ids", []))
            summary["timing_ms"][name] = r.get("timing_ms", r.get("benchmark_timing_ms", 0))
            summary["requires_manual_review"][name] = r.get("requires_manual_review", False)
            summary["fdi_valid"][name] = r.get("fdi_valid", True)
        return summary
