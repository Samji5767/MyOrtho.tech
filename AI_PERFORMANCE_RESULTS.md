# AI Performance Results

**Sprint:** Final AI Segmentation Activation & Production Verification  
**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Date:** 2026-07-12  
**Status:** BASELINE ONLY — AI inference not run (SCENARIO D); benchmarks pending checkpoint acquisition  

---

## Overview

This document records available performance data for the MyOrtho.tech AI segmentation engines. Because both TGN and MeshSegNet are BLOCKED (no checkpoints, license issues), no live inference benchmarks were performed during this sprint. The data below is drawn from published literature and architecture analysis.

Once checkpoints are obtained and engines are cleared, this document must be updated with observed timing, accuracy, and resource utilization from real STL inference on representative clinical scans.

---

## Published Performance Data (Literature)

### MeshSegNet (IEEE TMI 2021)

Source: Tian et al. (2021). "Automatic Tooth Segmentation of Dental Mesh Based on Sparse Point Supervision." *IEEE Transactions on Medical Imaging*, 40(11), 3256–3268.

| Metric | Value | Notes |
|--------|-------|-------|
| Mean Dice Similarity Coefficient (DSC) | 0.948 | On the MICCAI 2012 dataset |
| Mean Hausdorff Distance (HD) | 1.2 mm | On the MICCAI 2012 dataset |
| Sensitivity | 0.952 | Per-tooth average |
| Specificity | 0.994 | Per-tooth average |
| FDI classes | 17 (gingiva + 16 teeth) | |
| Input | Triangular mesh (STL/OBJ) | Per-face features |
| Output | Per-face class label + confidence | |
| GPU inference time (approx.) | 5–30 s | Depends on mesh complexity |
| CPU inference time (approx.) | 60–180 s | On commodity hardware |

**Important caveat:** These figures are from the published paper using the authors' test set. MyOrtho.tech has not performed independent clinical validation. Until validation on MyOrtho.tech's own patient data is complete, these figures must not be cited as MyOrtho.tech performance claims.

### TGN (ToothGroupNetwork)

Source: Jung et al. (2022). "ToothGroupNetwork: Tooth Segmentation and Identification from IOS Scans." *ICCV 2022 Workshop*.

| Metric | Value | Notes |
|--------|-------|-------|
| Tooth identification accuracy | 0.978 | On proprietary test set |
| Segmentation IOU | 0.921 | |
| Input | Point cloud | |
| GPU inference time (approx.) | 3–10 s | |
| CPU inference time (approx.) | 120–300 s | |

**Note:** TGN is BLOCKED (P0 — CC BY-NC-ND 4.0). These figures are provided for architectural reference only.

---

## MyOrtho.tech Hardware Profile

| Resource | Specification |
|----------|--------------|
| CPU | Intel Xeon (4 cores) |
| RAM | 14 GB free (measured) |
| GPU | None detected |
| Disk | 27 GB available |
| Inference device | CPU (`AI_DEVICE=cpu`) |

**Expected inference times on this hardware:**
- MeshSegNet: 60–180 s per scan (CPU, no GPU)
- TGN: 120–300 s per scan (CPU, no GPU)
- MANUAL: < 100 ms (no inference)

GPU acceleration is strongly recommended before enabling AI engines in production. Expected GPU speedup: 10–20× reduction in inference time.

---

## MANUAL Provider Performance

The MANUAL provider is the only active provider in SCENARIO D. Its performance characteristics:

| Metric | Value |
|--------|-------|
| Response time | < 100 ms |
| Throughput | Limited only by HTTP layer |
| CPU usage | Negligible |
| Memory usage | Negligible |
| Accuracy | N/A — no inference performed |
| Availability | 100% (no external dependencies) |

---

## Benchmarking Infrastructure

`BenchmarkEngine` (`ai-engine/src/benchmarking.py`) is implemented and available for cross-engine comparison once AI engines are activated. Capabilities:

- Parallel execution of both engines via `ThreadPoolExecutor`
- Timing per engine in milliseconds
- Redis-backed result storage with in-memory fallback
- Accessible via `POST /ai/engines/benchmark` (JWT-authenticated)

Prometheus metrics are tracked per engine in `ai-engine/src/metrics.py`:
- `segmentation_requests_total{engine="TGN|MESHSEGNET|MANUAL"}`
- `segmentation_errors_total{engine=...}`
- `segmentation_duration_ms{engine=...}` (histogram)

These will populate with real data once engines are activated.

---

## Accuracy Baseline Requirements

Before any AI engine is used in a clinical workflow, the following accuracy gates must be met on MyOrtho.tech's own internal test dataset (not the published benchmark dataset):

| Gate | Threshold | Rationale |
|------|-----------|-----------|
| Mean Dice per tooth | ≥ 0.90 | Clinical usability minimum |
| FDI classification accuracy | ≥ 0.95 | Incorrect FDI label could cause wrong tooth treatment |
| False-negative rate (missed teeth) | < 5% | Missing a tooth must not be silent |
| False-positive rate (phantom teeth) | < 2% | Phantom labels cause unnecessary treatment steps |
| Confidence gate (gating manual review) | 0.70 | Configured in `fdi_validator.py` |

**These thresholds have not yet been measured.** No internal clinical validation dataset exists. Establishing this dataset is a pre-requisite for moving any AI segmentation output into a non-research clinical pathway.

---

## Performance Measurement Plan

Once a checkpoint is obtained and the engine is activated in a staging environment:

1. Run inference on 50 clinical STL scans (upper and lower jaw, mixed complexity)
2. Record per-scan inference time, confidence scores, tooth count, gingiva detection
3. Compare predicted FDI labels against ground-truth annotations
4. Compute DSC, HD, sensitivity, specificity, FDI accuracy
5. Run 5× repeated inference on the same scan to measure variance
6. Record peak GPU/CPU and RAM usage
7. Update this document with observed results
8. Route to clinical lead for sign-off before enabling in any clinical workflow

---

## Disclaimer

All performance figures in this document are from published literature or architectural estimates. They are not MyOrtho.tech internal validation results. Any AI output produced by these engines after activation must carry the disclaimer:

> "AI-assisted segmentation. Manual clinical review required."

No AI segmentation result may be used in clinical decision-making without review by a licensed orthodontist, regardless of the confidence score.
