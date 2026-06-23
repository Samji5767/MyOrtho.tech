# MyOrtho AI Readiness

> **Last updated**: 2026-06-23 — Phase 10

This document describes the AI capabilities in MyOrtho, their current maturity, clinical use cases, required data, human review requirements, risk levels, and regulatory status.

## Governing Principle

> **Every AI feature in MyOrtho is decision support, not a replacement for clinical judgement.**
>
> MyOrtho does not claim autonomous diagnosis, FDA clearance, or treatment automation.
> Every AI output requires explicit review by a licensed clinical professional before any clinical action is taken.

---

## Maturity Labels

| Label | Meaning |
|---|---|
| **Implemented** | Working feature today. Real computation on real user input. |
| **Simulated** | Realistic UI with representative data. NOT a validated clinical engine. |
| **Planned** | Architecture and data model defined. Feature not yet built. |

---

## Capability Matrix

### 1. Scan Intake

| Capability | Maturity | Risk | Human Review |
|---|---|---|---|
| Scan import (STL/PLY/OBJ) | Implemented | Low | Clinician confirms scan quality |
| Scan quality assessment | Simulated | Medium | Clinician reviews flagged areas |

**Implemented today**: File import and validation. Supported formats: STL, PLY, OBJ.

**Not implemented**: Automated scan quality scoring, coverage gap detection.

---

### 2. Landmark Detection

| Capability | Maturity | Risk | Human Review |
|---|---|---|---|
| Dental landmark detection | Planned | High | Every landmark requires clinician review |
| Cephalometric analysis | Planned | High | Orthodontist verifies all values |

**Regulatory note**: Landmark detection accuracy directly affects measurement validity and treatment outcomes.
Automated detection is decision support only. Clinical gold standard is manual identification by a trained clinician.

---

### 3. Tooth Segmentation

| Capability | Maturity | Risk | Human Review |
|---|---|---|---|
| Automated tooth segmentation | Planned | High | Lab tech or clinician must review all boundaries |
| Arch analysis | Simulated | Medium | Clinician verifies measurements |

**Backend status**: The `ai-engine` has a segmentation endpoint with a MONAI backbone.
The model has not been validated on a representative clinical dataset for production use.

**Not to be used clinically until**: Segmentation accuracy is validated in a prospective study with a qualified clinical reviewer in the loop.

---

### 4. Root Prediction

| Capability | Maturity | Risk | Human Review |
|---|---|---|---|
| Root position estimation | Planned | Critical | CBCT confirmation required for high-risk movements |
| Root resorption risk scoring | Planned | Critical | Orthodontist assesses risk; not a guarantee |

**Regulatory note**: Root estimation from crown anatomy alone is statistical. Physical CBCT imaging is the clinical standard.
Root resorption risk scoring is NOT a substitute for periodic radiographic monitoring.

---

### 5. Movement Planning

| Capability | Maturity | Risk | Human Review |
|---|---|---|---|
| Tooth movement prescription (6-DoF) | Implemented | High | Orthodontist reviews and approves all movements |
| PDL biomechanical limit validation | Implemented | High | Reference values; clinical appropriateness is patient-specific |
| Auto setup proposal | Planned | Critical | Every proposal requires explicit orthodontist prescription |

**Implemented today**: Interactive per-tooth transformation with PDL limit checking.
**Not implemented**: Automated setup generation. Every movement is hand-prescribed by the treating orthodontist.

---

### 6. Collision Detection

| Capability | Maturity | Risk | Human Review |
|---|---|---|---|
| Inter-tooth collision detection | Implemented | Medium | Clinician resolves; system does not auto-correct |
| Occlusal heatmap | Planned | Medium | Physical articulation verification recommended |

**Implemented today**: Geometric collision detection between tooth meshes at each stage.
**Limitation**: Detects mesh interpenetration only. Does not model soft tissue, bone, or periodontal biomechanics.

---

### 7. IPR Suggestion

| Capability | Maturity | Risk | Human Review |
|---|---|---|---|
| IPR planning | Simulated | High | Orthodontist authorization required; IPR is irreversible |
| Bolton analysis | Simulated | Medium | Clinician verifies tooth widths |

**Regulatory note**: IPR is an irreversible procedure. No IPR amount from the platform may be executed clinically without explicit written authorization from the treating orthodontist.

---

### 8. Attachment Recommendation

| Capability | Maturity | Risk | Human Review |
|---|---|---|---|
| Attachment recommendation | Simulated | Medium | Prescribing orthodontist must approve all placements |
| Refinement stage prediction | Planned | Medium | Informational only; clinical need determined at treatment |

---

### 9. Treatment Risk Scoring

| Capability | Maturity | Risk | Human Review |
|---|---|---|---|
| Treatment risk scoring | Planned | High | Scores are decision support; clinical appropriateness is patient-specific |

**Not implemented**: No risk scoring engine exists today.
Risk labels in the UI are illustrative.

---

### 10. Manufacturing QC

| Capability | Maturity | Risk | Human Review |
|---|---|---|---|
| Digital manufacturing QC check | Simulated | Low | Physical inspection always required |

**Implemented today**: Mesh hollowing and labelling endpoint in the `ai-engine`.
**Validation**: Physical QC of manufactured parts by a lab technician is always required regardless of digital pre-check results.

---

## AI Engine Status

The `ai-engine` (FastAPI + PyTorch + MONAI) provides:

| Endpoint | Status | Notes |
|---|---|---|
| `/health` | Implemented | System health check |
| `/segment` | Planned | Backbone exists; model not production-validated |
| `/arch-analysis` | Simulated | Returns representative arch metrics |
| `/mesh/hollow` | Planned | Manufacturing prep endpoint |

---

## Regulatory Position

| Claim | Status |
|---|---|
| FDA clearance | ❌ Not claimed, not obtained |
| CE marking (MDR) | ❌ Not claimed, not obtained |
| HIPAA certification | ❌ Not a thing; HIPAA is compliance, not certification |
| HIPAA-prepared deployment | ✅ Designed for (data on your VPS; access logged; no third-party PHI sharing) |
| Decision support only | ✅ Explicit in all AI feature labels and documentation |
| Clinician-in-the-loop | ✅ Required for all AI outputs |

---

## Path to Clinical AI Validation

To advance AI capabilities from Simulated to Implemented (with clinical validity):

1. **Tooth segmentation**: Annotated dataset of ≥500 arches; IoU validation against expert segmentation; prospective clinical study.
2. **Landmark detection**: Ground-truth landmark annotations from ≥3 expert clinicians; ICR/ICC inter-rater agreement study.
3. **Treatment risk scoring**: Longitudinal outcome data linking case complexity metrics to actual refinement rates and adverse events.
4. **Root prediction**: CBCT-derived root shape dataset; validation against physical measurement.
5. **Auto setup proposal**: Randomized controlled evaluation comparing AI-proposed vs. expert-designed setups on outcome metrics.
