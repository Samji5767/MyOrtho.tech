# ToothGroupNetwork — Inference Validation Report

**Status:** Framework ready. Awaiting checkpoint deployment on target VPS hardware.

> This document defines the inference validation methodology and expected metrics.
> Actual measurements must be taken after checkpoint installation on the production VPS.
> Fabricated benchmarks are not included — see §4 for the validation procedure.

---

## 1. Validation Overview

| Item | Value |
|------|-------|
| Model | TGNet (FPS + BDL modules) |
| Dataset | Clinical STL scans (upper + lower, per patient) |
| Inference mode | CPU (production) / GPU (if available) |
| Input format | OBJ after STL → OBJ preprocessing |
| Output format | JSON: `{jaw, labels[], instances[]}` |

---

## 2. Test Inputs

### Reference Mesh Specifications

| Property | Expected Range |
|----------|---------------|
| File format | STL (binary) / OBJ |
| Vertex count | 30,000 – 200,000 |
| Face count | 60,000 – 400,000 |
| Scale | Millimetre (1 unit = 1 mm) |
| Coordinate origin | Centred near arch centroid |
| Normals | Outward-pointing |

### Test Cases Required

| Case Type | Count |
|-----------|-------|
| Fully erupted adult dentition | ≥ 10 |
| Missing teeth (extraction cases) | ≥ 5 |
| Crowded dentition | ≥ 5 |
| Mixed dentition (child) | ≥ 3 |
| Implant crowns | ≥ 3 |
| Normal adult (control) | ≥ 10 |
| **Total minimum** | **36** |

---

## 3. Metrics to Measure

### 3.1 Inference Performance

| Metric | How to Measure |
|--------|---------------|
| Wall-clock time per jaw | `time.monotonic()` around `process()` call |
| GPU memory peak (GPU mode) | `torch.cuda.max_memory_allocated()` |
| CPU memory peak (CPU mode) | `psutil.Process().memory_info().rss` |
| Throughput (scans/hour) | `3600 / mean_seconds_per_scan` |

### 3.2 Segmentation Accuracy

| Metric | Definition |
|--------|-----------|
| Dice Score (DSC) per tooth | `2|P∩G| / (|P| + |G|)` |
| IoU (Jaccard) per tooth | `|P∩G| / |P∪G|` |
| Tooth Detection Rate | `detected_correct / total_ground_truth_teeth` |
| False Positive Rate | `false_positives / (false_positives + true_negatives)` |
| FDI Assignment Accuracy | `correctly_labelled_teeth / total_detected_teeth` |

### 3.3 Preprocessing Performance

| Metric | Target |
|--------|--------|
| STL → OBJ conversion time | < 5 s per file |
| Conversion failure rate | < 0.1% of valid STL files |
| Manifold validation pass rate | > 99% on clinic-sourced scans |

---

## 4. Validation Procedure

```bash
# 1. Start the TGN API service
cd /opt/toothgroupnetwork
docker compose up -d tgn-api

# 2. Verify model loaded
curl -s http://localhost:8001/ready | jq .model_loaded

# 3. Run a single scan (upper jaw)
curl -s -X POST http://localhost:8001/segment \
  -H "X-Internal-Token: $INTERNAL_API_SECRET" \
  -F "file=@/path/to/scan_upper.stl" \
  -F "jaw=upper" \
  -F "scan_id=TEST001" | jq .job_id

# 4. Poll for result
JOB_ID="<job_id from step 3>"
curl -s http://localhost:8001/jobs/$JOB_ID \
  -H "X-Internal-Token: $INTERNAL_API_SECRET" | jq .

# 5. Record timing and tooth_ids for accuracy evaluation
```

### Expected Output Structure

```json
{
  "status": "completed",
  "jaw": "upper",
  "tooth_ids": [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27],
  "missing_teeth": [18, 28],
  "confidence_scores": {
    "11": 0.94,
    "12": 0.91,
    "...": "..."
  },
  "fdi_valid": true,
  "requires_manual_review": false,
  "timing_ms": 35000,
  "disclaimer": "AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist."
}
```

---

## 5. Published Benchmark (MICCAI 2022 Challenge)

The following figures are from the original TGNet paper and challenge results.
**These are not measurements taken in this installation.** They represent the
upper bound of performance achievable with this model and the challenge dataset.

| Metric | Published Value | Source |
|--------|----------------|--------|
| Mean DSC (all teeth) | 0.9554 | MICCAI 2022 challenge leaderboard |
| Mean IoU (all teeth) | 0.9150 | MICCAI 2022 challenge leaderboard |
| Tooth Detection Rate | 98.2% | MICCAI 2022 challenge leaderboard |
| Rank | 1st (winner) | MICCAI 2022 3D Teeth Scan Segmentation |

> **Note:** Performance on clinical scans from scanners not represented in the
> challenge training set may differ. Validation on your own scan data is required
> before clinical deployment.

---

## 6. GPU Memory Requirements (Expected)

| GPU | VRAM Required | Status |
|-----|--------------|--------|
| RTX 3080 (10 GB) | ~3.2 GB | Sufficient |
| RTX 3090 (24 GB) | ~3.2 GB | Comfortable headroom |
| A100 (40/80 GB) | ~3.2 GB | Ample |
| T4 (16 GB) | ~3.2 GB | Sufficient |
| GTX 1080 (8 GB) | ~3.2 GB | Marginal |

CPU inference uses ~2–3 GB system RAM peak.

---

## 7. Latency Targets

| Mode | Target per jaw | Acceptable maximum |
|------|---------------|-------------------|
| GPU (RTX 3080) | < 5 s | 15 s |
| CPU (8-core) | < 60 s | 120 s |
| API round-trip (GPU) | < 10 s | 20 s |
| API round-trip (CPU) | < 90 s | 150 s |

---

## 8. Fill-in Section (Complete after VPS validation)

```
Date of validation:          _______________
VPS hardware:                _______________
GPU model (if any):          _______________
TGN image version:           _______________
Checkpoint files (hashes):   _______________

Single-jaw CPU time (mean):  ___ s   (std: ___ s)
Single-jaw GPU time (mean):  ___ s   (std: ___ s)
GPU peak memory:             ___ MB

Tooth detection rate:        ___ %
FDI assignment accuracy:     ___ %
Mean DSC (observed):         ___
Mean IoU (observed):         ___

Cases with manual review:    ___ / ___
Cases auto-accepted:         ___ / ___
```

---

## 9. Clinical Disclaimer

> **AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist.**
>
> Inference performance metrics do not constitute regulatory clearance. This model must not be used as the sole basis for clinical decision-making.
