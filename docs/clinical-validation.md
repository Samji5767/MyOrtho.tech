# Clinical Validation Reference
> Phase 28 — Part 6  
> All algorithms are sourced from published orthodontic literature. References included.

---

## 1. Biomechanical movement thresholds

**File:** `frontend/src/lib/biomechanics/vectorMath.ts`

| Threshold | Value | Source |
|-----------|-------|--------|
| `MAX_TRANSLATION_MM` | 0.25 mm/stage | Keim RG (2008); Proffit WR *Contemporary Orthodontics* 5th ed. |
| `MAX_ROTATION_DEG` | 2.0°/stage | Proffit WR; clinical consensus for clear aligner staging |

**Validation status:** `validateMovements()` correctly fires a warning when either
threshold is exceeded. Tested in `vectorMath.test.ts` (8 test cases).

---

## 2. IPR enamel safety

**File:** `backend/src/ipr-planner/ipr-planner.service.ts`

| Parameter | Value | Source |
|-----------|-------|--------|
| `MIN_REMAINING_ENAMEL` | 0.5 mm | Sheridan JJ (1985) *J Clin Orthod* 19(1):43-54 |
| Enamel thickness table | Per-FDI tooth type estimates | Black GV (1902) anatomical norms, updated Stroud et al. (1998) |

The `iprSafetyStatus()` function computes:
- `remainingA = enamelA − (amountMm / 2)`
- `remainingB = enamelB − (amountMm / 2)`
- Status `warning` when remaining < 0.5 mm; `unsafe` when remaining < 0 mm.

**Validation status:** Tested in `ipr-planner.service.spec.ts` (10 test cases).

---

## 3. Arch metrics

**File:** `frontend/src/lib/meshAnalysis.ts`

| Metric | Calculation | Clinical reference range |
|--------|-------------|--------------------------|
| Intercanine width | Euclidean distance FDI 13 ↔ 23 | 28–40 mm (adult upper) |
| Intermolar width | Euclidean distance FDI 16 ↔ 26 | 45–60 mm (adult upper) |
| Arch length | Sum of inter-tooth distances along midline | > 50 mm upper, > 45 mm lower |
| Crowding | `requiredSpace − availableSpace` | < 0 = spacing; > 0 = crowding |

**Validation status:** Tested in `meshAnalysis.test.ts` against demo geometry
(37 test cases). Demo geometry uses anatomically plausible coordinates but is not
validated against a clinical dataset.

---

## 4. Bolton analysis

**Status: NOT IMPLEMENTED**

Bolton overall ratio and anterior ratio are standard pre-treatment diagnostics.
The measurements table in `CasePlanningContext` captures individual tooth widths but
does not compute Bolton ratios. This is a known gap for clinical completeness.

**Required:** Add `computeBoltonAnalysis(toothWidths)` to `meshAnalysis.ts` that
returns `{ anteriorRatio, overallRatio, upperExcess, lowerExcess }` per
Bolton WA (1958) *Angle Orthod* 28(3):113-132.

---

## 5. Occlusion contacts

**File:** `frontend/src/lib/meshAnalysis.ts`  
**Function:** `computeOcclusionContacts(positions, thresholdMm?)`

Contact classification:
- `heavy`: inter-arch distance < 0.5 mm
- `light`: 0.5–2.0 mm
- `near`: 2.0–threshold mm
- `none`: > threshold mm (default 10 mm)

**Limitation:** This is a centroid-to-centroid distance proxy, not true mesh
intersection. It does not reflect actual cusp-fossa contact. A mesh-based
occlusion analysis (requiring loaded STL geometry) would be required for
clinical accuracy.

---

## 6. Aligner thickness standards

**File:** `frontend/src/components/CasePlanningContext.tsx`

| Property | Default | Clinically accepted range |
|----------|---------|--------------------------|
| `alignerThickness` | 0.5 mm | 0.3–1.5 mm |

Source: Martorelli M et al. (2013) *Dent Mater* 29(9):e271-82;
Cowley D et al. (2012) manufacturer specifications.

---

## 7. Gaps requiring clinical validation before CE/FDA clearance

1. **Bolton analysis** — not implemented (see §4)
2. **Real mesh occlusion** — centroid proxy only (see §5)
3. **AI segmentation accuracy** — no trained weights, no DSC measurement (see `ai-model-readiness.md`)
4. **Root torque prediction** — 3D torque biomechanics not modelled; only 6-DOF rigid-body displacements tracked
5. **Periodontal limits** — PDL stress not simulated; `MAX_TRANSLATION_MM` is a staging rate limit, not a biological force model
6. **Population validation** — demo geometry is not derived from a patient dataset; all arch metric ranges are literature-sourced averages
