# ADR-010: MLOps / AI Governance

**Status:** Accepted  
**Date:** 2026-07-14  
**Deciders:** AI Engineering, Clinical Engineering, Security

---

## Context

MyOrtho.tech uses AI models for segmentation, treatment proposals, movement prediction, and QA scoring. Currently there is no formal record of which model version produced a given recommendation, no mechanism to roll back a misbehaving model, and no audit trail proving that clinician disclaimers were displayed before AI output was accepted. This is a compliance and patient safety gap.

## Decision

Implement an **MLOps / AI Governance** layer comprising two database tables and a supporting API module.

**Model Registry (`ai_model_registry`)**
- One row per model version. The `(name, version)` pair is unique — re-deploying the same version is a deliberate conflict rather than a silent overwrite.
- Status lifecycle: `staged → active → deprecated | rolled_back`.
  - `deployed_at` is stamped on first transition to `active`.
  - `deprecated_at` / rollback date is stamped on terminal transitions.
- `metrics_json` stores evaluation metrics (accuracy, F1, IoU, latency P95) captured at training time.
- `organization_id` is nullable: `NULL` indicates a global/system model available to all orgs; a non-null value scopes the model to one org (for fine-tuned or org-specific models).

**Inference Audit (`ai_inference_audit`)**
- Every AI call that could produce a clinical recommendation must produce one row.
- `disclaimer_shown` is `NOT NULL DEFAULT TRUE` — the default forces callers to explicitly set it. A missing disclaimer is an application bug, not a silent gap.
- `input_hash` (SHA-256 of the inference input) enables reproducibility verification without storing PHI.
- `outcome` records whether the clinician accepted, modified, or rejected the AI recommendation — enabling feedback-loop analysis.
- `patient_id` and `case_id` are nullable and constitute PHI; they are only stored when the calling service explicitly includes them.

**Governance constraints enforced at the application layer:**
- No segmentation result may automatically become clinically approved (existing architectural constraint, now reinforced by audit trail).
- Every AI recommendation must include a disclaimer (enforced by `disclaimer_shown` audit field).
- Model rollback is a status update (`rolled_back`) not a deletion — history is preserved.

## Consequences

**Positive:**
- Complete traceability: for any clinical recommendation, the model version, invocation time, latency, and clinician decision are recorded.
- Rollback is a one-API-call operation; previous model versions remain in the registry and can be reactivated.
- `disclaimer_shown` rate is a KPI surfaced by the AI utilization report.

**Negative:**
- Every AI service must instrument itself to call `POST /api/mlops/inference-audit` after each inference. Existing AI modules do not yet do this — it is a required follow-on task for each module.
- `input_hash` provides reproducibility verification but not replay — the original input is not stored (by design, to avoid PHI retention in the audit table).

## Alternatives Considered

- **MLflow**: Full-featured model registry, but requires separate infrastructure and adds operational complexity.
- **No registry (implicit versioning via deployment)**: Current state. Fails audit requirements for regulated environments.
- **Store raw inputs**: Rejected — PHI storage without explicit consent tracking in this table is out of scope.
