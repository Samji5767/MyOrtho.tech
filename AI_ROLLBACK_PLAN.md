# AI Rollback Plan

**Sprint:** Final AI Segmentation Activation & Production Verification  
**Branch:** `claude/myortho-production-validation-dlmvsi`  
**Date:** 2026-07-12  
**Applies to:** ai-engine, tgn-service, meshsegnet-service  

---

## Overview

This document defines rollback procedures for all AI segmentation-related changes. Because the current production state is SCENARIO D (MANUAL-only routing; both AI engines disabled), the rollback from this sprint is trivial — there are no AI engines to roll back. The procedures below cover:

1. Rolling back from a future AI activation (if TGN or MeshSegNet is later enabled)
2. Rolling back to the previous commit if a code defect is discovered in this sprint's changes

---

## Current State (Baseline for This Sprint)

```
Branch:                claude/myortho-production-validation-dlmvsi
Commit:                b4151cf
TGN_ENABLED:           false
MESHSEGNET_ENABLED:    false
SEGMENTATION_PROVIDER: MANUAL
Active provider:       ManualReviewProvider
```

This is a safe, stable state. No AI inference is running. Rolling back to this state is always safe.

---

## Scenario 1: Emergency Rollback from AI Engine Activation

If a future team activates TGN or MeshSegNet and discovers a P0 issue (incorrect inference, safety concern, security vulnerability, license violation), the following steps immediately disable the engine:

### Step 1 — Disable via environment variable (< 30 seconds)

```bash
# On the VPS, update .env:
TGN_ENABLED=false
MESHSEGNET_ENABLED=false
SEGMENTATION_PROVIDER=MANUAL

# Restart ai-engine only (no database changes needed):
docker compose restart ai-engine
```

The router will immediately stop selecting the disabled engine. All in-flight requests will complete on their current provider; new requests will route to MANUAL.

**This does not require a code deployment or downtime.**

### Step 2 — Verify the router switched to MANUAL

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/ai/engines | jq '.active_provider'
# Expected: "MANUAL"
```

### Step 3 — If meshsegnet-service must be stopped

```bash
docker compose -f docker-compose.yml -f docker-compose.meshsegnet.yml stop meshsegnet-api
```

The ai-engine router will detect that the MeshSegNet provider is unhealthy (no `/health` response) and fall through to MANUAL automatically.

### Step 4 — Document the incident

Create an incident entry in `AI_CHECKPOINT_REGISTRY.md` (if checkpoint-related) or `AI_LICENSE_ACTIVATION_STATUS.md` (if license-related). Record:
- Date and time of incident
- Engine(s) affected
- Root cause
- Rollback action taken
- Next steps

---

## Scenario 2: Rollback to Pre-Sprint Commit

If a defect is discovered in this sprint's code changes (commits `cbb23a4` or `b4151cf`), roll back the branch:

### Identify the safe rollback target

```bash
git log --oneline
# f79a3cc  audit(tgn): production acceptance audit — security fixes, license review, final report
# cbb23a4  feat: multi-engine AI segmentation — MeshSegNet integration + provider abstraction
# b4151cf  fix(sign-off-audit): 5 defects found in final sign-off audit
```

The pre-sprint commit is `f79a3cc`. Rolling back to it removes:
- The MeshSegNet microservice
- The provider abstraction layer
- The multi-engine routing logic

**Only roll back this far if the defect affects the entire provider architecture. For a defect in a single provider, disable that provider via env var (Scenario 1) rather than rolling back code.**

### Rollback procedure

```bash
# Stash any local changes
git stash -u

# Create a revert commit (safe — preserves history)
git revert b4151cf --no-edit
git revert cbb23a4 --no-edit

# Push
git push origin claude/myortho-production-validation-dlmvsi
```

**Do not use `git reset --hard` on a shared branch — it rewrites history and can break other contributors' branches.**

### Verify after rollback

```bash
# Confirm provider abstraction files are removed
ls ai-engine/src/providers/ 2>/dev/null || echo "directory removed — OK"

# Confirm segmentation falls back to previous (pre-provider) code path
curl -s http://localhost:8000/health | jq .
```

---

## Scenario 3: Checkpoint Integrity Failure at Startup

If `meshsegnet-service` or `tgn-service` starts and detects a SHA-256 mismatch on the checkpoint file:

1. The service sets its internal state to `ERROR`
2. `/health` returns `state=ERROR`, `healthy=false`, `ready=false`
3. The ai-engine router health-checks the provider, sees `ready=False`, skips it
4. The router falls to the next provider in the chain (and ultimately to MANUAL)
5. No inference is run with the invalid checkpoint

**This is automatic — no operator intervention required for safe fallback.**

Operator steps to resolve:
1. Investigate the mismatch: re-download the checkpoint, re-verify SHA-256
2. If the checkpoint file is corrupted: delete and re-run `scripts/download_checkpoints.sh`
3. If `MESHSEGNET_SHA256` is wrong in `.env`: correct it and restart the service
4. Confirm `/health` returns `state=READY` before re-enabling traffic

---

## Scenario 4: MeshSegNet Service Crash Loop

If `meshsegnet-api` enters a crash loop (OOM, model load error, GPU error):

```bash
# Check logs
docker compose logs --tail=50 meshsegnet-api

# The ai-engine router will detect unhealthy and route to MANUAL automatically.
# Stop the crashing container to reduce system pressure:
docker compose -f docker-compose.yml -f docker-compose.meshsegnet.yml stop meshsegnet-api

# Set env to prevent restart:
# MESHSEGNET_ENABLED=false in .env, then:
docker compose restart ai-engine
```

The ai-engine healthcheck on MeshSegNet runs every 30 s with a 3-retry threshold. A crash loop will be detected within 90–120 s and the router will skip the provider.

---

## Rollback Testing

The following rollback scenarios must be tested **before** enabling any AI engine in production:

| Test | Pass Criteria |
|------|---------------|
| Set `MESHSEGNET_ENABLED=false` while service is running | Router switches to MANUAL within one healthcheck cycle (30 s) |
| Kill `meshsegnet-api` container | Router detects unhealthy and routes to MANUAL within 3 healthcheck intervals (90 s) |
| Corrupt checkpoint SHA-256 in `.env` | Service starts in ERROR state; no inference attempted; router skips to MANUAL |
| `TGN_ENABLED=false` with AUTO routing | Router skips TGN, tries MeshSegNet, falls to MANUAL if both disabled |
| Both engines disabled | All requests route to MANUAL; no AI output returned |

---

## Rollback Contacts

| Situation | Contact |
|-----------|---------|
| License violation discovered | Legal + Engineering Lead immediately |
| Clinical safety concern | Clinical Lead + Engineering Lead; disable engine immediately |
| Security vulnerability | Security Lead + Engineering Lead; disable and patch before re-enabling |
| Performance degradation | Engineering Lead; disable engine if latency > 300 s in production |

---

## Current Rollback State

**The current production state IS the rollback target.** SCENARIO D is the stable, safe baseline:

```
TGN_ENABLED=false
MESHSEGNET_ENABLED=false
SEGMENTATION_PROVIDER=MANUAL
```

No rollback is required at this time. This document applies when AI engines are activated in a future sprint.
