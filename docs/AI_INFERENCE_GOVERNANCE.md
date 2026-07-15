# AI Inference Governance

Every AI inference in MyOrtho.tech is logged to the `ai_inference_audit` table via `AiAuditService`. This provides a complete audit trail for clinical safety, regulatory compliance, and model performance review.

## Audit Lifecycle

```
beginAudit()         → audit_status = 'in_progress'
    ↓ AI executes
finalizeAudit()      → audit_status = 'completed'
   OR
failAudit()          → audit_status = 'failed'
```

## Hard Rules

1. **No fabricated records.** Every audit entry must correspond to a real AI call with a real result.
2. **Disclaimer required.** All AI outputs surfaced to clinicians must set `disclaimer_shown = TRUE`. The API enforces this via `beginAudit()` defaulting `disclaimerShown` to `true`.
3. **No PHI in audit metadata.** The `input_metadata` and `output_metadata` fields must contain only technical parameters — never patient names, DOBs, or identifiers.
4. **No automatic clinical approval.** No AI output may update `clinical_approved` or equivalent fields without explicit clinician action.
5. **Manual review flag.** Inference calls with low confidence or in research-only models must set `manual_review_required = TRUE`.

## Inference Types

| `inference_type` | System | Description |
|-----------------|--------|-------------|
| `copilot.chat` | CopilotService | Synchronous chat completion |
| `copilot.stream` | CopilotService | Streaming chat completion |
| `segmentation` | SegmentationService | Tooth/jaw segmentation job |

## AiAuditService API

```typescript
// Begin before executing
const audit = await aiAudit.beginAudit({
  organizationId, invokedBy, modelName, modelVersion,
  inferenceType, correlationId, caseId,
  disclaimerShown: true,  // always true for patient-facing outputs
});

// On success
await aiAudit.finalizeAudit(audit.id, {
  outcome: 'accepted',
  latencyMs,
  confidenceScore,
  fallbackUsed: false,
  manualReviewRequired: false,
});

// On failure
await aiAudit.failAudit(audit.id, 'MODEL_UNAVAILABLE', 'Provider returned 503');
```

## Disclaimer Rate Monitoring

The compliance target is 100% disclaimer shown. The metrics endpoint reports:

```
GET /api/metrics/prometheus

myortho_ai_disclaimer_rate 1.0000   # must stay at 1.0000
```

An alert should fire if this drops below 0.99.

## Data Retention

Inference audit records are retained for 7 years per HIPAA § 164.530(j). Do not delete `ai_inference_audit` rows. Use status filtering to archive completed records to cold storage if needed.
