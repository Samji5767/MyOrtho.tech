# Segmentation Provider Operations Guide

**Last updated:** 2026-07-12  
**Audience:** Engineering / On-Call  
**Current production mode:** SCENARIO D — `SEGMENTATION_PROVIDER=MANUAL` (both AI engines BLOCKED)

---

## Quick Reference

| Scenario | `SEGMENTATION_PROVIDER` | `SEGMENTATION_PRIMARY` | Result |
|----------|------------------------|----------------------|--------|
| **Current production (SCENARIO D)** | **`MANUAL`** | *(ignored)* | **MANUAL only** |
| Both engines available, TGN preferred | `AUTO` | `TGN` | TGN → MeshSegNet → MANUAL |
| Both engines available, MeshSegNet preferred | `AUTO` | `MESHSEGNET` | MeshSegNet → TGN → MANUAL |
| Force TGN only | `TGN` | *(ignored)* | TGN → MANUAL |
| Force MeshSegNet only | `MESHSEGNET` | *(ignored)* | MeshSegNet → MANUAL |
| No AI (audit / maintenance) | `MANUAL` | *(ignored)* | MANUAL only |

Change is effective after restarting ai-engine. No code deployment required.

> **Note (2026-07-12):** Both TGN and MeshSegNet are BLOCKED and cannot be enabled. TGN has a P0 license blocker (CC BY-NC-ND 4.0). MeshSegNet checkpoint has not been obtained. Do not change `SEGMENTATION_PROVIDER` away from `MANUAL` until blockers are resolved. See `AI_LICENSE_ACTIVATION_STATUS.md`.

---

## Provider Status

### Checking current provider state

```bash
# Readiness probe (includes per-provider health)
curl http://localhost:8000/ready | jq .

# Authenticated engine list + active route plan
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/ai/engines | jq .
```

Sample `/ai/engines` response:
```json
{
  "providers": {
    "TGN": { "healthy": true, "ready": true, "version": "v1.0.0-unvalidated", "error": null },
    "MESHSEGNET": { "healthy": false, "ready": false, "version": "unknown", "error": "model_not_loaded" },
    "MANUAL": { "healthy": true, "ready": true, "version": "1.0.0", "error": null }
  },
  "route_plan": [
    { "provider": "TGN", "reason": "primary" },
    { "provider": "MESHSEGNET", "reason": "secondary" },
    { "provider": "MANUAL", "reason": "terminal_fallback" }
  ],
  "active_provider": "TGN"
}
```

---

## Switching Providers

### Via environment variable (recommended for operations)

```bash
# On VPS
cd /opt/myortho
vim .env   # edit SEGMENTATION_PROVIDER and/or SEGMENTATION_PRIMARY
docker compose up -d ai-engine   # picks up new env
```

### Via per-request override (for testing only)

The segmentation job submission API accepts an optional `provider` field:

```bash
curl -X POST http://localhost:4000/api/cases/<case-id>/segmentation/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider": "MESHSEGNET", "arch": "upper"}'
```

This overrides the global routing for a single job. Useful for A/B testing and benchmarking. Do not use for production clinical workflows.

---

## Fallback Behavior

The router tries providers in the route plan order. If a provider fails (unhealthy, inference error, or timeout), it moves to the next provider automatically.

Fallback is logged and included in the job result:
```json
{
  "engine": "MESHSEGNET",
  "engine_version": "v1.0.0-unvalidated",
  "warnings": ["TGN unavailable — fell back to MESHSEGNET"],
  "requires_manual_review": false,
  "research_use": true,
  "disclaimer": "Research-use segmentation. Manual clinical review required. ..."
}
```

The `MANUAL` provider is always the terminal fallback and is always healthy. A job will never fail due to AI engine unavailability — it will always complete with `requires_manual_review: true` if all AI engines are down.

---

## Benchmarking

To run a head-to-head comparison of all available engines on a single scan:

```bash
curl -X POST http://localhost:8000/ai/engines/benchmark \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/path/to/scan.stl", "jaw_type": "upper"}' | jq .bench_id
```

Poll for results:

```bash
# Results are stored in Redis (with in-memory fallback) keyed by bench_id
# The benchmark endpoint returns results once all engines complete or timeout
```

Benchmark results include per-engine: tooth count, timing, manual review flag, and a cross-engine comparison summary. Results carry `research_use: true` and the clinical disclaimer.

**Note:** Benchmarks run both engines in parallel. Do not run during peak load.

---

## Metrics

### Prometheus (no auth required)

```bash
curl http://localhost:8000/metrics
```

Key metrics:

| Metric | Description |
|--------|-------------|
| `segmentation_requests_total{engine="TGN"}` | Total requests routed to TGN |
| `segmentation_successes_total{engine="TGN"}` | Successful TGN completions |
| `segmentation_failures_total{engine="TGN"}` | TGN failures (triggers fallback) |
| `segmentation_manual_review_total{engine="TGN"}` | Jobs requiring manual review via TGN |
| `segmentation_duration_ms_sum{engine="TGN"}` | Total inference time (ms) |
| Same metrics for `engine="MESHSEGNET"` and `engine="MANUAL"` | — |

### JSON metrics (requires JWT)

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/metrics/json | jq .
```

Includes `avg_duration_ms` per engine computed from sum/count.

---

## Alerting Guidelines

| Condition | Severity | Action |
|-----------|----------|--------|
| `segmentation_failures_total{engine="TGN"}` rate > 10/min | P2 | Check TGN service logs; consider switching `SEGMENTATION_PROVIDER=MESHSEGNET` |
| All AI providers unhealthy (only MANUAL active) | P1 | Investigate both engine services; notify on-call ML engineer |
| `segmentation_manual_review_total` spikes significantly | P3 | Check for scan quality issues or engine degradation |
| ai-engine `/ready` returns `any_ai_provider_ready: false` | P2 | Both AI engines are down; MANUAL fallback active |

---

## Clinical Disclaimer

Every segmentation response from every provider includes:

```
research_use: true
disclaimer: "Research-use segmentation. Manual clinical review required.
             AI-assisted recommendation only.
             Final treatment decisions remain the responsibility of
             the licensed orthodontist."
```

This is enforced in code and cannot be disabled by configuration. See `ai-engine/src/providers/base.py` for the constant.

---

## Troubleshooting

### Engine shows `healthy: false`

1. Check the engine's own health endpoint:
   ```bash
   curl http://localhost:8001/health   # TGN
   curl http://localhost:8002/health   # MeshSegNet
   ```
2. Check for checkpoint loading errors:
   ```bash
   docker compose logs meshsegnet-api | grep -i error
   ```
3. Common causes:
   - Checkpoint file not present in volume
   - SHA-256 mismatch (wrong checkpoint or corrupted download)
   - Out-of-memory error during model load
   - `MESHSEGNET_ENABLED=false` (engine intentionally disabled)

### Jobs stuck in preprocessing or running

1. Check the ai-engine polling log for the job:
   ```bash
   docker compose logs ai-engine | grep <job_id>
   ```
2. The default poll interval is 2s with a 360s timeout. If a job times out, it transitions to `failed` with an appropriate error message.
3. Check the engine service for the job:
   ```bash
   curl http://localhost:8002/jobs/<engine-job-id>
   ```

### Provider override not working

Verify the `provider` field is being passed through the backend to the ai-engine:
```bash
# Check the backend segmentation service log for the outgoing call
docker compose logs backend | grep segmentation
```

The backend reads `provider` from `result_summary` JSON and passes it in the POST body to ai-engine's `/ai/segment` endpoint.
