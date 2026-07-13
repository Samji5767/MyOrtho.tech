# Model Versioning Guide

**Last updated:** 2026-07-11  
**Audience:** ML Engineering

---

## Version Scheme

Model versions follow the format: `<engine>-<checkpoint_version>-<validation_tag>`

Examples:
- `TGN-v1.0.0-unvalidated`
- `TGN-v1.2.0-internal-v50`
- `MESHSEGNET-v1.0.0-unvalidated`
- `MESHSEGNET-v1.0.0-internal-v50`

The validation tag suffix:

| Suffix | Meaning |
|--------|---------|
| `-unvalidated` | No internal validation run yet |
| `-internal-v<N>` | Validated on N de-identified scans internally |
| `-qa-cleared` | QA sign-off received for clinical/research use |
| `-prod` | Approved for production deployment |

---

## Current Version Registry

| Engine | Checkpoint Version | Validation Status | Notes |
|--------|--------------------|-------------------|-------|
| TGN | v1.0.0 | unvalidated | Feature-flagged off; CC BY-NC-ND blocker |
| MeshSegNet | — | not acquired | Checkpoint not yet obtained from authors |
| MONAI | N/A | N/A | Rule-based fallback; no checkpoint |

---

## Lifecycle States

```
NOT_ACQUIRED
    │
    ▼ (checkpoint received from authors)
ACQUIRED
    │
    ▼ (SHA-256 verified, loaded into dev volume)
VERIFIED
    │
    ▼ (internal validation run on ≥50 scans)
INTERNALLY_VALIDATED
    │
    ▼ (QA review complete)
QA_CLEARED
    │
    ▼ (feature flag enabled in production)
PRODUCTION
    │
    ▼ (new version supersedes this one)
RETIRED
```

---

## Version Environment Variables

Each engine exposes its version via an environment variable read at startup:

| Variable | Engine | Example |
|----------|--------|---------|
| `TGN_MODEL_VERSION` | TGN | `v1.0.0-unvalidated` |
| `MESHSEGNET_MODEL_VERSION` | MeshSegNet | `v1.0.0-unvalidated` |

The version string is:
1. Stored in the job record (`engine_version` field)
2. Returned in every API response from `/ai/engines`
3. Included in Prometheus metrics labels
4. Logged on service startup

---

## Promoting a Version

### To INTERNALLY_VALIDATED

Requirements:
1. Validation run completed on ≥50 de-identified clinical scans
2. DSC computed per tooth class and documented
3. Comparison against orthodontist ground truth recorded
4. Validation report saved to `docs/validation/`

Action:
```bash
# Update the version string in .env
MESHSEGNET_MODEL_VERSION=v1.0.0-internal-v50

# Restart to pick up the new version label
docker compose restart meshsegnet-api

# Confirm in API response
curl http://localhost:8000/ai/engines | jq '.engines[] | select(.name=="MESHSEGNET") | .version'
```

### To QA_CLEARED

Requirements:
1. QA engineer has reviewed the validation report
2. Written sign-off received (email or issue ticket)
3. Any flagged issues resolved or accepted

Action:
```bash
MESHSEGNET_MODEL_VERSION=v1.0.0-qa-cleared
```

### To PRODUCTION

Requirements:
1. QA-cleared
2. `MESHSEGNET_ENABLED=true` approved by Engineering Lead
3. Checkpoint redistribution terms confirmed in writing

Action:
```bash
MESHSEGNET_ENABLED=true
MESHSEGNET_MODEL_VERSION=v1.0.0-prod
```

---

## Upgrade Path

When a new checkpoint is released by the authors:

1. **Acquire and verify** new checkpoint (see `docs/CHECKPOINT_MANAGEMENT.md`)
2. **Assign version**: bump the checkpoint version component (e.g., `v1.0.0` → `v1.1.0`)
3. **Reset validation state**: set suffix to `-unvalidated`
4. **Run internal validation** on the same 50+ scan set used for v1.0.0 (enables apples-to-apples comparison)
5. **Document delta**: record which metrics improved or regressed vs. the previous version
6. **Follow promotion lifecycle** above

---

## Rollback

If a production version shows regression in live monitoring:

1. Set `MESHSEGNET_ENABLED=false` immediately (stops new jobs from using MeshSegNet)
2. Restore previous checkpoint from backup (see `docs/CHECKPOINT_MANAGEMENT.md` §Emergency Rollback)
3. Set version string back to the previous value
4. Open a post-mortem issue documenting the regression

---

## Version History Template

Maintain a version history table in the validation report for each engine:

```markdown
| Version | Date | Scans | Mean DSC | Notes |
|---------|------|-------|----------|-------|
| v1.0.0-internal-v50 | YYYY-MM-DD | 50 | 0.XX | Initial internal validation |
| v1.0.0-qa-cleared   | YYYY-MM-DD | 50 | 0.XX | QA sign-off by <name> |
| v1.0.0-prod         | YYYY-MM-DD | 50 | 0.XX | Deployed to production |
```
