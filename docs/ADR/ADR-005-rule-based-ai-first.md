# ADR-005: Rule-Based AI Engine with LLM Fallback

## Status

Accepted

## Date

2026-01-15

## Context

MyOrtho.tech's AI Copilot provides clinical recommendations including appliance selection, treatment sequencing, and risk flagging. Clinical decision support software has strict requirements:

- **Explainability.** Clinicians must understand why a recommendation was made. "The model predicted X" is insufficient; the reasoning chain must be traceable.
- **Auditability.** Recommendations and their inputs must be logged and reproducible for clinical audit, regulatory review, and liability purposes.
- **Determinism.** Given the same patient data and clinical inputs, the system should produce the same recommendation (or a predictable range), not a stochastically varying one.
- **Confidence quantification.** Recommendations must carry a confidence level so clinicians can calibrate their reliance on the system.

Pure LLM-based inference fails the determinism and auditability requirements: the same prompt may produce different outputs across calls, the reasoning is opaque, and outputs are not reproducible from logs alone.

## Decision

We implement a **deterministic rule engine as the primary recommendation path**. The rule engine encodes clinical guidelines as explicit, auditable rules (condition → recommendation mappings). All rule engine outputs include:

- `recommendation` — the clinical recommendation
- `confidence_level` — a numeric value (`0.0`–`1.0`) or categorical (`high` / `medium` / `low`)
- `explainability_data` — the specific rules fired, the input values that triggered them, and the clinical rationale
- `disclaimer` — a mandatory clinical disclaimer indicating this is decision support, not a clinical decision

When the rule engine's confidence falls below a configurable threshold (or when no rule matches the input combination), the system falls back to an LLM call. LLM outputs are post-processed to enforce the same structured response format, including `confidence_level` and `explainability_data`. LLM calls are logged with their full prompt and response for auditability.

All AI outputs — from both the rule engine and LLM fallback — must include the clinical disclaimer before being returned to the frontend.

## Consequences

### Positive

- **Reproducible recommendations.** Rule engine outputs for a given input are deterministic and can be reproduced from logs
- **Auditable reasoning.** `explainability_data` provides a human-readable trace of which rules fired and why, suitable for clinical audit
- **Inspectable codebase.** Clinical guidelines are encoded as readable code (or configuration), not embedded in model weights. Clinicians and compliance reviewers can inspect and validate them
- **Confidence quantification.** The system always surfaces a confidence level, enabling clinicians to apply appropriate judgment before acting on a recommendation

### Negative

- **Rule engine maintenance burden.** Clinical guidelines evolve. As new evidence emerges or guidelines are updated, the rule engine must be updated to reflect them. This requires a process for clinician review → rule authoring → testing → deployment
- **Rule coverage gaps.** Novel or complex patient presentations may not match any rule, requiring LLM fallback. As the patient population grows, rule coverage gaps will surface and must be addressed
- **LLM fallback requires API key and connectivity.** The fallback path depends on an external LLM API (with associated cost, latency, and availability risk). Degraded mode (rule engine only, no LLM fallback) must be supported for resilience
- **LLM output variability.** Even with post-processing, LLM fallback outputs are inherently less deterministic than rule engine outputs. The `confidence_level` for LLM outputs should reflect this and may warrant a lower ceiling

## Implementation Requirements

All AI output objects must conform to the following shape before being returned:

```typescript
interface AiRecommendation {
  recommendation: string;
  confidence_level: 'high' | 'medium' | 'low' | number;
  explainability_data: {
    source: 'rule_engine' | 'llm_fallback';
    rules_fired?: string[];
    reasoning?: string;
  };
  disclaimer: string; // must be non-empty; use CLINICAL_DISCLAIMER constant
}
```

Returning a recommendation without `disclaimer`, `confidence_level`, or `explainability_data` is a defect and must not pass code review.
