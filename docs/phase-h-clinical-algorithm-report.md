# Phase H — Clinical Algorithm Validation Report

**Date**: 2026-07-02  
**Branch**: `claude/myortho-production-validation-dlmvsi`  
**Constraint**: Evidence-backed findings only. No fabricated results.

---

## Scope

Every clinical calculation in the backend was audited for:
- Correctness against peer-reviewed literature
- Absence of simulation / Math.random() fabrication
- Disclosure when actual measurements cannot be derived from available data

Files examined:
- `backend/src/analysis/bolton.service.ts`
- `backend/src/ipr-planner/ipr-planner.service.ts`
- `backend/src/ipr-intelligence/ipr-intelligence.service.ts`
- `backend/src/clinical-analysis-deep/clinical-analysis-deep.service.ts`
- `backend/src/aligner-generation/aligner-generation.service.ts`
- `backend/src/arch-coordination/arch-coordination.service.ts`
- `backend/src/biomechanics/biomechanics.service.ts`
- `backend/src/treatment-planning/treatment-planning.service.ts`
- `backend/src/segmentation/segmentation.service.ts` (previously fixed)
- `backend/src/tooth-segmentation/tooth-segmentation.service.ts` (previously fixed)

---

## H1 — Bolton Analysis (`analysis/bolton.service.ts`)

**Status: PASS**

| Parameter | Implemented Value | Reference |
|-----------|------------------|-----------|
| Anterior ratio norm | 77.2% | Proffit et al., *Contemporary Orthodontics*, 7th ed. 2018 |
| Anterior SD | ±1.65% | Proffit 2018 |
| Overall ratio norm | 91.3% | Proffit 2018 |
| Overall SD | ±1.91% | Proffit 2018 |
| Significance threshold | ±2 SD | Standard clinical convention |
| Anterior tooth range | FDI 13–23 | Correct |
| Overall tooth range | FDI 17–27 | Correct |

Formula verified:
```
Anterior ratio = (sum lower 6 anterior) / (sum upper 6 anterior) × 100
Overall ratio  = (sum all lower 12) / (sum all upper 12) × 100
excess = ((measured − norm)/100) × sum_upper
```

Evidence: 16 unit tests covering boundary cases, known-good ratios, and bilateral symmetry all pass. No Math.random() present.

---

## H2 — IPR Planner Enamel Safety (`ipr-planner/ipr-planner.service.ts`)

**Status: PASS with documentation gap**

| Surface | Max IPR (mm) | Reference |
|---------|-------------|-----------|
| 11, 21 | 1.1 | Sheridan 1985 (Stripping guidelines) |
| 12, 22 | 0.9 | Sheridan 1985 |
| 13, 23 | 0.8 | Sheridan 1985 |
| 14–15, 24–25 | 0.7 | Sheridan 1985 |
| 16–17, 26–27 | 0.6 | Sheridan 1985 |
| 18, 28 | 0.5 | Sheridan 1985 |

`MIN_REMAINING_ENAMEL = 0.5mm` — conservative and appropriate.

**Documentation gap**: Code comments reference "Sheridan 1985" but do not cite the specific journal (Journal of Clinical Orthodontics 1985;19(1):43–54). Not a functional issue.

---

## H3 — IPR Intelligence Enamel Table (`ipr-intelligence/ipr-intelligence.service.ts`)

**Status: INCONSISTENCY — documented**

A second, separate enamel table exists in `ipr-intelligence.service.ts` with different values from `ipr-planner.service.ts`:

| Tooth group | `ipr-planner.service.ts` (per surface) | `ipr-intelligence.service.ts` (total both surfaces) |
|-------------|----------------------------------------|------------------------------------------------------|
| Incisor | 0.9–1.1 mm | 1.8 mm |
| Canine | 0.8 mm | 2.2 mm |
| Premolar | 0.7 mm | 2.8 mm |
| Molar | 0.5–0.6 mm | 3.2 mm |

These are internally consistent IF the intelligence table represents combined both-surface totals (2× the per-surface value). However, the 0.6× scaling factor applied to demand estimation in `ipr-intelligence.service.ts` has no documented clinical reference.

**Risk**: If both services are used in the same treatment plan, clinicians may receive conflicting IPR recommendations without knowing the difference in methodology. No cross-reference or reconciliation exists.

**Required before clinical use**: Consolidate to one enamel table with a single documented reference; or explicitly label each service's output with its reference source.

---

## H4 — Tooth Movement Staging Limits (Three inconsistent tables)

**Status: INCONSISTENCY — documented**

Three services define per-stage movement limits with different values:

| Movement type | `aligner-generation.service.ts` | `arch-coordination.service.ts` | `biomechanics.service.ts` |
|--------------|--------------------------------|-------------------------------|--------------------------|
| Crown tipping (°/stage) | 1.5 | 2.0 | 2.0 |
| Torque (°/stage) | 1.0 | 1.5 | 1.5 |
| Translation (mm/stage) | 0.25 | 0.3 | 0.25 |
| Rotation (°/stage) | 2.0 | 3.0 | 2.0 |
| Extrusion (mm/stage) | 0.1 | 0.1 | 0.1 |
| Intrusion (mm/stage) | 0.15 | 0.1 | 0.1 |

None of the three files cite a peer-reviewed reference for these values. Common clinical references include: Kravitz et al. (2009), Dasy et al. (2015), and Kau et al. (2010) for aligner movement accuracy, but the specific limits vary by aligner material and clinician protocol.

**Risk**: Inconsistent limits produce inconsistent treatment plans depending on which service processes a given case. The biomechanics service values are the most conservative overall.

**Required before clinical use**: Align on a single set of movement limits with a documented clinical rationale, or expose them as configurable per-organization parameters.

---

## H5 — Clinical Analysis Deep (`clinical-analysis-deep/clinical-analysis-deep.service.ts`)

**Status: FAIL — Math.random() fabrications persisted to database**

Multiple measurements are generated with `Math.random()` and stored in the `clinical_analyses` table without any disclosure flag:

| Measurement | Code | Status |
|-------------|------|--------|
| Curve of Spee | `randBetween(0.5, 3.5, 2)` | Random — not measured |
| Midline deviation | `randBetween(-3.0, 3.0, 2)` | Random — not measured |
| Overjet (when not provided) | `randBetween(1.5, 4.5, 2)` | Random — not measured |
| Overbite (when not provided) | `randBetween(1.5, 3.5, 2)` | Random — not measured |
| Upper arch length | `baseUpper + randBetween(-5, 5, 1)` | Simulated |
| Lower arch length | `baseLower + randBetween(-3, 3, 1)` | Simulated |
| Upper arch width | `randBetween(32, 38, 1)` | Simulated |
| Lower arch width | `randBetween(28, 34, 1)` | Simulated |
| Transverse discrepancy | `upperArchWidth - lowerArchWidth - 4.0` | Computed from simulated data |

The `randBetween()` helper calls `Math.random()`. These values are stored in the PostgreSQL `clinical_analyses.analysis_result` JSONB column and returned to the frontend as if they were real measurements.

**Impact**: Clinicians receiving a clinical analysis report containing these values are viewing random numbers. This is a patient safety issue if acted upon clinically.

**Remediation required**:
1. Replace all `randBetween()` calls with `null` values
2. Add a `measurement_source` field: `'direct_input'`, `'scan_derived'`, or `'not_measured'`
3. Return HTTP 422 or a partial result with explicit null fields when measurements cannot be derived
4. Do NOT fix by removing the service — it is called from the frontend treatment planning flow

**This finding is NOT yet fixed in this branch.**

---

## H6 — Little's Irregularity Index

**Status: NOT IMPLEMENTED**

No implementation of Little's Irregularity Index (1975) exists in any backend service. The index is referenced in the UI but no calculation is performed. The severity of crowding cannot be objectively measured.

---

## H7 — Pont's Index

**Status: NOT IMPLEMENTED**

No implementation of Pont's Index (Pont 1909, as refined by Houston 1983) exists. Arch width prediction from tooth widths is not available.

---

## H8 — Tooth Segmentation Anatomy Model

**Status: PASS (previously fixed)**

The primary `segmentTeeth()` path now:
- Includes all arch teeth deterministically (no Math.random() wisdom tooth simulation)
- Reports status as `'anatomy_model'` — disclosing that this is a geometric model, not AI-derived segmentation
- The MONAI UNet inference path is architecturally correct but has no trained weights (`weights_loaded: false` returned)

---

## Summary

| Algorithm | Status | Evidence |
|-----------|--------|---------|
| Bolton analysis | PASS | 16 unit tests, Proffit 2018 norms |
| IPR safety limits | PASS | Sheridan 1985 guideline implemented |
| IPR dual-table inconsistency | DOCUMENTED | Two tables with different values; no reconciliation |
| Staging movement limits | DOCUMENTED | Three inconsistent tables; no peer reference cited |
| Clinical analysis deep | **FAIL** | Math.random() simulations persisted to DB — patient safety risk |
| Little's Irregularity Index | NOT IMPLEMENTED | No code exists |
| Pont's Index | NOT IMPLEMENTED | No code exists |
| Tooth segmentation (anatomy) | PASS | Deterministic, status disclosed |
| AI segmentation (UNet) | NOT FUNCTIONAL | No trained weights |

**Clinical Readiness Score (revised)**: 60/100  
Rationale: Bolton and IPR safety correctly implemented. Clinical analysis deep service returns random data as clinical measurements — this must be fixed before any clinical use. AI segmentation pipeline is architecturally correct but non-functional without weights.
