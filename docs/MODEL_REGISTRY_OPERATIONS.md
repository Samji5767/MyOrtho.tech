# Model Registry Operations

The AI Model Registry tracks all AI models used within MyOrtho.tech, their lifecycle status, and governance metadata.

## Model Lifecycle

```
staging → active → deprecated
    ↑                  ↓
    └──── rollback ────┘
```

| Status | Description |
|--------|-------------|
| `staging` | Model staged for validation; not yet serving production traffic |
| `active` | Production model; may receive inference requests |
| `deprecated` | Retired; no new inference calls; records retained |

## Governance Fields

| Field | Purpose |
|-------|---------|
| `checkpoint_checksum` | SHA-256 of model artifact; used to verify deployment integrity |
| `is_research_only` | If `TRUE`, all inferences must set `manual_review_required = TRUE` |
| `intended_use` | Clinical indication this model is validated for |
| `disclaimer_policy` | Required disclaimer text for clinician-facing outputs |

## Admin Operations

All model operations require `mlops:manage` permission.

```bash
# List models
GET /api/mlops/models?status=active

# Register a new model
POST /api/mlops/models
{
  "name": "segmentation-v3",
  "modelType": "segmentation",
  "version": "3.0.0",
  "provider": "internal",
  "metricsJson": { "dice_score": 0.94 }
}

# Activate / deprecate / roll back
PATCH /api/mlops/models/:id/status
{ "status": "active" }
```

## Research-Only Models

If `is_research_only = TRUE`, the integration must:
1. Never surface outputs directly to clinicians.
2. Set `manual_review_required = TRUE` on every inference record.
3. Show an additional disclaimer: "For research use only — not for clinical decision-making."

## Checkpoint Verification

Before activating a new model version, verify the artifact checksum:

```bash
sha256sum /models/segmentation-v3.pt
# Update checkpoint_checksum via PATCH /api/mlops/models/:id
```

The worker's `ai.segmentation` handler should log the checksum used at inference time to `ai_inference_audit.checkpoint_checksum`.
