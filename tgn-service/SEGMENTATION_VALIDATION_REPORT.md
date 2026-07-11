# ToothGroupNetwork — Segmentation Validation Report

**Status:** Validation framework defined. Clinical scan dataset required.

> This report defines the clinical validation methodology for the ToothGroupNetwork
> segmentation pipeline. Actual results must be measured on real clinical STL cases.
> No clinical measurements are fabricated in this document.

---

## 1. Scope

This report covers Phase 6 clinical validation as defined in the MyOrtho AI integration
specification. The goal is to verify that TGN segmentation quality is clinically
acceptable before soft launch.

---

## 2. Dataset Requirements

### Minimum Dataset

| Parameter | Requirement |
|-----------|------------|
| Total scans | ≥ 100 unique patients |
| Upper jaw scans | ≥ 50 |
| Lower jaw scans | ≥ 50 |
| Scan sources | ≥ 2 different intraoral scanner models |
| Case types | See §2.2 |
| Ground truth | Expert-annotated FDI labels per vertex |
| Annotation standard | FDI World Dental Federation two-digit notation |

### Case Type Distribution

| Case Type | Minimum Count |
|-----------|--------------|
| Fully erupted adult (no extractions) | 20 |
| Extraction cases (1–4 missing teeth) | 15 |
| Multiple missing teeth (≥ 5) | 10 |
| Crowded dentition (≥ 3 mm crowding) | 10 |
| Rotated teeth (≥ 30°) | 10 |
| Crossbite cases | 5 |
| Open bite cases | 5 |
| Mixed dentition (6–12 years) | 5 |
| Implant crowns | 5 |
| Supernumerary teeth | 3 |
| Deep overbite | 5 |
| Skeletal Class III | 5 |
| Post-treatment (retainer present) | 2 |
| **Total** | **100** |

---

## 3. Ground Truth Annotation Protocol

1. **Annotator qualification:** Licensed orthodontist or trained oral radiology technician with ≥ 3 years of experience with FDI notation.
2. **Annotation tool:** Open3D or CloudCompare for vertex-level labelling.
3. **Inter-annotator agreement:** Each case annotated by 2 independent annotators; Fleiss' κ ≥ 0.90 required.
4. **Arbitration:** Disagreements resolved by senior clinician.
5. **Label format:** JSON matching TGN output schema: `{labels: int[], instances: int[], jaw: str}`.

---

## 4. Evaluation Metrics

### 4.1 Segmentation Quality

| Metric | Formula | Target |
|--------|---------|--------|
| Dice Score (DSC) per tooth | `2|P∩G| / (|P|+|G|)` | ≥ 0.90 |
| IoU (Jaccard Index) | `|P∩G| / (|P∪G|)` | ≥ 0.82 |
| Mean DSC (all teeth, all cases) | Mean over teeth × cases | ≥ 0.90 |
| Tooth Detection Rate | `correctly_detected / ground_truth_teeth` | ≥ 95% |
| False Detection Rate | `false_positives / total_detected` | ≤ 3% |

### 4.2 FDI Numbering Accuracy

| Metric | Definition | Target |
|--------|-----------|--------|
| FDI Accuracy | `correctly_labelled / detected_teeth` | ≥ 97% |
| Quadrant Error Rate | Cross-quadrant misassignment | ≤ 1% |
| Jaw Error Rate | Upper/lower confusion | ≤ 0.5% |

### 4.3 Special Case Performance

| Scenario | Metric | Target |
|----------|--------|--------|
| Missing teeth | Recall on absent teeth | ≥ 95% (absent → not detected) |
| Crowded teeth | DSC in crowded regions | ≥ 0.85 |
| Rotated teeth | Detection rate | ≥ 90% |
| Crossbite | FDI accuracy across midline | ≥ 95% |
| Supernumerary | FDI flagged as requires_manual_review | 100% |
| Mixed dentition | deciduous_detected flag set | 100% |

### 4.4 Clinical Acceptability

Each segmentation reviewed by a licensed orthodontist on a 5-point scale:

| Score | Description |
|-------|-------------|
| 5 | No correction needed |
| 4 | Minor manual adjustment (< 5 min) |
| 3 | Moderate correction (5–15 min) |
| 2 | Major correction (> 15 min) |
| 1 | Re-segment from scratch |

**Minimum pass: ≥ 90% of cases score ≥ 4.**

---

## 5. Validation Procedure

```bash
# Run validation suite (requires ground truth annotations in GT_DIR)
python3 validate_segmentation.py \
  --scan_dir /data/validation/scans \
  --gt_dir /data/validation/ground_truth \
  --output_dir /data/validation/results \
  --tgn_api_url http://localhost:8001 \
  --token $INTERNAL_API_SECRET
```

### Script logic (to be implemented)

1. For each scan in `scan_dir`:
   a. Upload via `/segment` endpoint
   b. Poll until `completed`
   c. Compare `tooth_ids`, `vertex_labels` against ground truth
   d. Compute DSC, IoU, detection metrics
2. Aggregate across all cases
3. Break down by case type
4. Generate HTML report with visualisations

---

## 6. Acceptance Criteria

The TGN segmentation pipeline is **accepted for soft launch** when:

| Criterion | Threshold | Mandatory |
|-----------|-----------|-----------|
| Mean DSC (all teeth) | ≥ 0.90 | Yes |
| Tooth detection rate | ≥ 95% | Yes |
| FDI accuracy | ≥ 97% | Yes |
| Clinical acceptability (≥ 4/5) | ≥ 90% of cases | Yes |
| Zero jaw errors | 0 cases with wrong jaw | Yes |
| CPU inference latency | ≤ 90 s per jaw | Yes |

**If any mandatory criterion is not met, the system must not be used clinically.**

---

## 7. Results Section (Complete after validation)

```
Validation date:               _______________
Annotator(s):                  _______________
Total cases:                   ___  (upper: ___, lower: ___)
Scanner models:                _______________

SEGMENTATION QUALITY
  Mean DSC (all teeth):        ___   [target: ≥ 0.90]
  Mean IoU (all teeth):        ___   [target: ≥ 0.82]
  Worst per-tooth DSC:         ___   (tooth: ___)
  Best per-tooth DSC:          ___   (tooth: ___)

DETECTION
  Tooth detection rate:        ___ % [target: ≥ 95%]
  False detection rate:        ___ % [target: ≤ 3%]
  FDI accuracy:                ___ % [target: ≥ 97%]

CLINICAL ACCEPTABILITY
  Score 5 (no correction):     ___ %
  Score 4 (minor correction):  ___ %
  Score ≤ 3 (failed):          ___ %
  Overall pass rate:           ___ % [target: ≥ 90% ≥4]

SPECIAL CASES
  Missing tooth recall:        ___ %
  Crowded tooth DSC:           ___
  Crossbite FDI accuracy:      ___ %

LATENCY (per jaw)
  CPU mean:                    ___ s
  CPU p95:                     ___ s
  GPU mean (if available):     ___ s

ACCEPTANCE DECISION: [ ] PASS   [ ] CONDITIONAL PASS   [ ] FAIL
Reason:              _______________
Signed by:           _______________  (Licensed Orthodontist)
Date:                _______________
```

---

## 8. Limitations Acknowledged

- TGN was trained on the MICCAI 2022 challenge dataset (anonymous European clinic).
- Performance on scans from non-European populations has not been characterised.
- No validation data exists for deciduous-only (infant) dentitions.
- Implant crowns may produce lower DSC due to geometric dissimilarity from natural teeth.
- Rotated third molars (wisdom teeth) are the most challenging case for the model.

---

## 9. Clinical Disclaimer

> **AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist.**
>
> This validation report does not constitute regulatory clearance. The ToothGroupNetwork
> model is a research prototype. It has not been evaluated as a Software as a Medical
> Device (SaMD). Before clinical use, local regulatory requirements (CE marking,
> FDA 510(k), etc.) must be assessed with appropriate counsel.
