# MyOrtho CAD Capability Roadmap

> **Last updated**: 2026-06-23 — Phase 10

This document covers all 33 CAD capabilities tracked in `frontend/src/lib/cad/roadmap.ts`.
Capabilities are organized by clinical category. Maturity labels match the application UI.

## Maturity Labels

| Label | Meaning |
|---|---|
| **Implemented** | Working today. Real computation on real user input. |
| **Simulated** | Realistic UI with representative data. NOT production-validated. |
| **Planned** | Data model defined; interactive feature not yet built. |

---

## Category: Scan Import

| Capability | Maturity | Stakeholder | Risk |
|---|---|---|---|
| STL Import | Implemented | Lab Technician | Low |
| PLY Import | Implemented | Lab Technician | Low |
| OBJ Import | Implemented | Lab Technician | Low |

**Notes**: All three mesh formats import via Three.js loaders (STLLoader, PLYLoader, OBJLoader) in the CAD Studio (`/studio`). No server-side processing.

---

## Category: Measurement

| Capability | Maturity | Stakeholder | Risk |
|---|---|---|---|
| Distance Measurement | Implemented | Orthodontist | Low |
| Angle Measurement (3-point) | Implemented | Orthodontist | Low |
| Overjet Measurement | Implemented | Orthodontist | Medium |
| Overbite Measurement | Implemented | Orthodontist | Medium |

**Notes**: All measurements are geometric, performed via raycasting and vector math on the loaded mesh. Clinical interpretation is the prescribing orthodontist's responsibility.

---

## Category: Arch Analysis

| Capability | Maturity | Stakeholder | Risk |
|---|---|---|---|
| Bolton Analysis | Simulated | Orthodontist | Medium |
| Arch Analysis (AI) | Simulated | Orthodontist | Medium |

**Bolton Analysis**: UI accepts manually entered tooth widths and computes anterior/overall ratios. Values are user-entered, not auto-detected from mesh. Clinical accuracy depends on manual measurement quality.

**Arch Analysis**: Representative data. Automated extraction of arch width, length, and symmetry from mesh is planned.

---

## Category: Segmentation

| Capability | Maturity | Stakeholder | Risk |
|---|---|---|---|
| Tooth Segmentation (AI) | Planned | Lab Technician | High |
| Landmark Detection (AI) | Planned | Orthodontist | High |

**Important**: A MONAI-backed segmentation endpoint exists in the `ai-engine`. The model has not been validated against a representative clinical dataset. These features must not be used clinically until validation is complete.

---

## Category: Treatment Planning

| Capability | Maturity | Stakeholder | Risk |
|---|---|---|---|
| Stage Timeline | Simulated | Orthodontist | Medium |
| Tooth Movement (6-DoF) | Implemented | Orthodontist | High |
| PDL Biomechanical Limits | Implemented | Orthodontist | High |
| Collision Detection | Implemented | Lab Technician | Medium |
| IPR Planning | Simulated | Orthodontist | High |
| Attachment Placement | Simulated | Lab Technician | Medium |

**Tooth Movement**: Each tooth can be individually translated and rotated across all 6 degrees of freedom. PDL limits are enforced with visual warnings based on published reference values. Clinical appropriateness is patient-specific and requires orthodontist review.

**Collision Detection**: Detects geometric mesh interpenetration at each stage. Does not model soft tissue, bone, or periodontal biomechanics. Clinical contact verification is the orthodontist's responsibility.

**IPR**: Markers and staging only. IPR amounts are never applied automatically. Orthodontist written authorization is required before any clinical IPR.

---

## Category: Auto Planning (Planned Only)

| Capability | Maturity | Stakeholder | Risk | Clinical Dependency |
|---|---|---|---|---|
| Auto Setup Proposal | Planned | Orthodontist | Critical | Requires: Segmentation, Landmarks, PDL model |
| Refinement Stage Prediction | Planned | Orthodontist | Medium | Requires: outcome data, longitudinal study |
| Root-Aware Movement | Planned | Orthodontist | Critical | Requires: CBCT integration or root estimation model |

**Auto Setup Proposal**: Highest-risk planned capability. Will require mandatory orthodontist review of every stage before any proposal can be exported or used clinically. No autonomous treatment planning.

---

## Category: Visualization

| Capability | Maturity | Stakeholder | Risk |
|---|---|---|---|
| Cross-section Viewer | Simulated | Orthodontist | Low |
| Occlusal Heatmap | Planned | Orthodontist | Medium |
| Occlusal Contact Mapping | Planned | Orthodontist | Medium |

**Cross-section**: Clipping plane applied to mesh. Geometry only — not a clinical radiograph substitute.

**Occlusal Heatmap / Contact Map**: Planned. Will require FEM-based occlusal contact simulation, validated against physical articulation.

---

## Category: Manufacturing Prep

| Capability | Maturity | Stakeholder | Risk |
|---|---|---|---|
| Trimline Design | Planned | Lab Technician | Low |
| Margin Drawing | Planned | Lab Technician | Low |
| Undercut Detection | Planned | Lab Technician | Low |
| Blockout Visualization | Planned | Lab Technician | Low |

**All four** are manufacturing-side features with no direct clinical risk. Physical QC of manufactured parts is always required.

---

## Category: Attachment

| Capability | Maturity | Stakeholder | Risk |
|---|---|---|---|
| Attachment Recommendation | Simulated | Orthodontist | Medium |
| Button Placement | Planned | Orthodontist | Low |

---

## Category: Export

| Capability | Maturity | Stakeholder | Risk |
|---|---|---|---|
| CAD Export (JSON package) | Implemented | Lab Technician | Low |

**Export** produces a structured JSON package with mesh metadata, stage transformations, measurements, and annotations. Does not export manufacturable STL files for aligner thermoforming (planned).

---

## Capability Count Summary

| Category | Implemented | Simulated | Planned | Total |
|---|---|---|---|---|
| Scan Import | 3 | 0 | 0 | 3 |
| Measurement | 4 | 0 | 0 | 4 |
| Arch Analysis | 0 | 2 | 0 | 2 |
| Segmentation | 0 | 0 | 2 | 2 |
| Treatment Planning | 4 | 3 | 0 | 7 |
| Auto Planning | 0 | 0 | 3 | 3 |
| Visualization | 0 | 1 | 2 | 3 |
| Manufacturing Prep | 0 | 0 | 4 | 4 |
| Attachment | 0 | 1 | 1 | 2 |
| Export | 1 | 0 | 0 | 1 |
| **Total** | **12** | **7** | **12** | **33** |

---

## Path to Full Capability

### Prerequisite: Clinical AI Validation
Segmentation and landmark detection must be validated before Auto Planning capabilities can be built.

### Short-term (available now for implementation)
- Trimline design, margin drawing, undercut detection, blockout visualization — manufacturing prep, no AI dependency
- Button placement — geometric placement, no AI dependency
- Cross-section viewer improvement — existing clipping plane needs edge case fixes

### Medium-term (requires validated segmentation)
- Arch analysis from mesh (replaces manual entry Bolton Analysis)
- Occlusal heatmap (requires contact simulation library)
- Refinement stage prediction (requires outcome dataset)

### Long-term (requires clinical validation study + regulatory review)
- Auto setup proposal
- Root-aware movement simulation
- CBCT integration
