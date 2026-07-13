# ADR 006 — Multi-Engine Segmentation Architecture

**Status:** Accepted  
**Date:** 2026-07-11  
**Deciders:** Engineering, ML Engineering  
**Supersedes:** Implicit single-engine design in ADR 005 (TGN integration)

---

## Context

MyOrtho.tech's AI segmentation pipeline originally used a single engine
(ToothGroupNetwork, TGN) behind a feature flag. This created three risks:

1. **Single point of failure**: if TGN is unavailable, the only fallback is a
   rule-based scaffold with no real inference.
2. **License lock-in**: TGN is trained on CC BY-NC-ND 4.0 data; a commercial
   license has not yet been obtained (see `TOOTHGROUPNETWORK_LICENSE_REVIEW.md`).
3. **No benchmarking path**: no mechanism exists to compare engine accuracy
   on the same inputs.

## Decision

Introduce a **provider abstraction layer** that:

- Defines a `SegmentationProvider` abstract base class.
- Registers all engines in a `ProviderRegistry`.
- Routes requests through `SegmentationRouter` using `SEGMENTATION_PROVIDER`
  and `SEGMENTATION_PRIMARY` environment variables.
- Adds **MeshSegNet** (IEEE TMI 2021, MIT license) as a second production-ready
  engine, replacing TGN where licensing permits.
- Adds a `ManualReviewProvider` as the terminal fallback.
- Adds a `BenchmarkEngine` for parallel cross-engine comparison (research only).

## Consequences

**Positive:**
- Fallback chain: AUTO → PRIMARY engine → SECONDARY engine → MANUAL.
- MeshSegNet provides a fully MIT-licensed alternative path.
- Per-engine Prometheus metrics enable production monitoring.
- Engine selection is a runtime env-var change with no code deployment.

**Negative / risks:**
- Two separate microservices must be deployed and health-checked.
- MeshSegNet checkpoint redistribution rights are unverified; keep behind
  `MESHSEGNET_ENABLED=false` until confirmed.
- Per-face graph convolution in MeshSegNet is slower than TGN on CPU-only hosts.

## Alternatives considered

- **TGN only (status quo)**: rejected — license P0 blocker.
- **TSegFormer / DTSN**: rejected — no public checkpoints available.
- **Custom MONAI fine-tune**: valid future path; included as `MONAI` fallback
  that already exists in the codebase.

## Provider selection guide

| SEGMENTATION_PROVIDER | SEGMENTATION_PRIMARY | Behavior |
|-----------------------|----------------------|----------|
| `AUTO` (default)      | `TGN` (default)      | TGN → MeshSegNet → MANUAL |
| `AUTO`                | `MESHSEGNET`         | MeshSegNet → TGN → MANUAL |
| `TGN`                 | *(ignored)*          | TGN → MANUAL |
| `MESHSEGNET`          | *(ignored)*          | MeshSegNet → MANUAL |
| `MANUAL`              | *(ignored)*          | MANUAL only (no AI) |
