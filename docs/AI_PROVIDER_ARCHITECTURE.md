# AI Segmentation Provider Architecture

## Overview

The `ai-engine` service uses a provider abstraction layer to support multiple
segmentation engines with automatic fallback and per-engine observability.

```
Request
  │
  ▼
SegmentationRouter
  │  reads SEGMENTATION_PROVIDER + SEGMENTATION_PRIMARY
  │
  ├─► TGNProvider  ──► TGN microservice (port 8001)
  │
  ├─► MeshSegNetProvider  ──► MeshSegNet microservice (port 8002)
  │
  └─► ManualReviewProvider  ──► returns requires_manual_review=true
```

## Classes

### `SegmentationProvider` (ABC)
- `engine_name: str` — provider identifier ("TGN", "MESHSEGNET", "MANUAL")
- `engine_version: str`
- `health() → ProviderHealth`
- `validate_checkpoint() → bool`
- `preprocess(file_path, jaw_type) → str`
- `infer(preprocessed_path, jaw_type) → dict`
- `validate_output(raw_output) → dict`
- `generate_metrics(validated_output, timing_ms) → dict`
- `segment(file_path, jaw_type) → SegmentationResult` — default chain

### `ProviderRegistry`
- `register(provider)` — keyed by `engine_name.upper()`
- `get(name) → Optional[provider]`
- `health_report() → Dict[str, dict]`

### `SegmentationRouter`
- `route(file_path, jaw_type, provider_override?) → SegmentationResult`
- `get_active_provider(provider_override?) → SegmentationProvider`
- `describe_route_plan(provider_override?) → List[dict]`

### `BenchmarkEngine`
- `start(file_path, jaw_type, provider_names?) → bench_id`
- `get_result(bench_id) → Optional[dict]`

### `SegmentationMetrics`
- `record_request(engine)`
- `record_success(engine, duration_ms, requires_manual_review)`
- `record_failure(engine, duration_ms)`
- `get_prometheus_text() → str`
- `get_json_metrics() → dict`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SEGMENTATION_PROVIDER` | `AUTO` | `AUTO\|TGN\|MESHSEGNET\|MANUAL` |
| `SEGMENTATION_PRIMARY` | `TGN` | Primary engine in AUTO mode |
| `TGN_ENABLED` | `false` | Enable TGN provider |
| `TGN_API_URL` | *(empty)* | TGN service base URL |
| `MESHSEGNET_ENABLED` | `false` | Enable MeshSegNet provider |
| `MESHSEGNET_API_URL` | *(empty)* | MeshSegNet service base URL |

## API Endpoints (ai-engine)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Liveness probe |
| GET | `/ready` | None | Readiness + provider health |
| GET | `/metrics` | None | Prometheus text metrics |
| GET | `/metrics/json` | JWT | JSON metrics |
| GET | `/ai/engines` | JWT | Provider list + route plan |
| POST | `/ai/engines/benchmark` | JWT | Cross-engine benchmark |
| POST | `/ai/segment` | JWT | Submit segmentation job |
| GET | `/ai/jobs/{job_id}` | JWT | Poll job status |

## Clinical Disclaimers

Every `SegmentationResult` carries:

```
research_use: True
disclaimer: "Research-use segmentation. Manual clinical review required.
             AI-assisted recommendation only.
             Final treatment decisions remain the responsibility of
             the licensed orthodontist."
```

This disclaimer is propagated through all API responses and frontend display.
The `ManualReviewProvider` always sets `requires_manual_review=True`.
