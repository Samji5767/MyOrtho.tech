# Deployment Guide — Multi-Engine Segmentation Services

**Last updated:** 2026-07-12  
**Audience:** DevOps / ML Engineering  
**Scope:** VPS deployment of ai-engine, tgn-service, and meshsegnet-service

---

## Current Production Activation Status (2026-07-12)

**SCENARIO D** — Both AI engines are BLOCKED. The correct and only permissible production configuration is:

```
TGN_ENABLED=false
MESHSEGNET_ENABLED=false
SEGMENTATION_PROVIDER=MANUAL
```

- **TGN**: P0 blocker — no LICENSE file; training data CC BY-NC-ND 4.0 (prohibits commercial use). See `TOOTHGROUPNETWORK_LICENSE_REVIEW.md`.
- **MeshSegNet**: P1 blocker — checkpoint not obtained; commercial-use and redistribution rights of the checkpoint unconfirmed. See `AI_CHECKPOINT_REGISTRY.md`.

Do not enable either engine until all blockers in `AI_LICENSE_ACTIVATION_STATUS.md` are resolved.

---

## Architecture Overview

```
                ┌──────────────┐
                │   backend    │ :4000
                └──────┬───────┘
                       │ HTTP (internal)
                ┌──────▼───────┐
                │  ai-engine   │ :8000
                └──┬────────┬──┘
                   │        │
         ┌─────────▼─┐  ┌───▼──────────┐
         │ tgn-service│  │meshsegnet-svc│
         │   :8001    │  │   :8002      │
         └────────────┘  └──────────────┘
```

All services run as Docker containers on the same host. Inter-service communication is over the Docker internal network (`myortho_net`). No service except the backend is exposed to the public internet.

---

## Prerequisites

- VPS with Docker Engine 24+ and Docker Compose v2
- Minimum 8 GB RAM (16 GB recommended if running both AI engines)
- Minimum 40 GB disk (model checkpoints are ~500 MB each)
- GPU optional but strongly recommended for inference (<5 s vs 60–180 s)
- All deployment changes must be backward-compatible (sprint hard rule)

**IMPORTANT:** Do not modify nginx, Docker daemon config, or authentication architecture. See `.claude/session_constraints.md` for the full constraint list.

---

## Environment Variables

Copy `.env.example` to `.env` on the VPS and fill in all required values.

### ai-engine

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TGN_ENABLED` | No | `false` | Enable TGN provider |
| `TGN_API_URL` | If TGN on | *(empty)* | Internal URL of tgn-service |
| `MESHSEGNET_ENABLED` | No | `false` | Enable MeshSegNet provider |
| `MESHSEGNET_API_URL` | If MSN on | *(empty)* | Internal URL of meshsegnet-service |
| `SEGMENTATION_PROVIDER` | No | `MANUAL` | `AUTO\|TGN\|MESHSEGNET\|MANUAL` |
| `SEGMENTATION_PRIMARY` | No | `TGN` | Primary engine in AUTO mode |
| `INTERNAL_API_SECRET` | Yes | — | Shared secret for engine-to-engine calls |
| `REDIS_URL` | No | *(empty)* | Redis for benchmark result caching |

### meshsegnet-service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CHECKPOINT_PATH` | No | `/ckpts/meshsegnet.pth` | Absolute path to checkpoint file |
| `MESHSEGNET_SHA256` | Recommended | *(empty)* | Expected SHA-256 of checkpoint (hex) |
| `INTERNAL_API_SECRET` | Yes | — | Must match ai-engine value |
| `MESHSEGNET_MODEL_VERSION` | No | `unknown` | Version string for observability |

### tgn-service

Refer to the existing TGN deployment documentation. No changes to tgn-service env vars in this sprint.

---

## Deploying the Base Stack (no AI engines)

```bash
# On VPS
cd /opt/myortho

# Pull latest images / rebuild
docker compose pull
docker compose build

# Start without any AI engine
SEGMENTATION_PROVIDER=MANUAL docker compose up -d

# Verify
curl http://localhost:8000/health
curl http://localhost:8000/ready
```

The stack is operational. All segmentation jobs route to `ManualReviewProvider` and return `requires_manual_review: true`.

---

## Enabling TGN

TGN requires its checkpoint and a running tgn-service container.

```bash
# 1. Start tgn-service (existing docker-compose service)
docker compose up -d tgn-api

# 2. Set env and restart ai-engine
export TGN_ENABLED=true
export TGN_API_URL=http://tgn-api:8001

docker compose up -d ai-engine

# 3. Verify TGN is healthy
curl http://localhost:8000/ready | jq '.providers.TGN'
```

Expected response: `{"healthy": true, "ready": true, ...}`

If TGN is unavailable, ai-engine falls back to MANUAL automatically (no crash).

---

## Enabling MeshSegNet

### Step 1: Obtain and verify the checkpoint

MeshSegNet checkpoint weights must be obtained directly from the authors (Lian et al., IEEE TMI 2021). **Do not redistribute** the checkpoint until redistribution terms are confirmed in writing.

```bash
# Set the download URL (obtain from authors)
export MESHSEGNET_CKPT_URL="<url-from-authors>"
export MESHSEGNET_SHA256="<sha256-from-authors>"   # optional but recommended

# Run the download script inside the meshsegnet container
docker run --rm \
  -v myortho_meshsegnet-ckpts:/ckpts \
  -e MESHSEGNET_CKPT_URL="$MESHSEGNET_CKPT_URL" \
  -e MESHSEGNET_SHA256="$MESHSEGNET_SHA256" \
  myortho-meshsegnet-api:latest \
  /app/scripts/download_checkpoints.sh
```

Alternatively, copy the checkpoint manually:

```bash
docker volume create myortho_meshsegnet-ckpts
docker run --rm -v myortho_meshsegnet-ckpts:/ckpts alpine sh -c \
  "cp /path/to/meshsegnet.pth /ckpts/meshsegnet.pth"
```

### Step 2: Start meshsegnet-service

```bash
# Using the overlay compose file
docker compose \
  -f docker-compose.yml \
  -f docker-compose.meshsegnet.yml \
  up -d meshsegnet-api
```

### Step 3: Enable in ai-engine

```bash
export MESHSEGNET_ENABLED=true
export MESHSEGNET_API_URL=http://meshsegnet-api:8002

docker compose \
  -f docker-compose.yml \
  -f docker-compose.meshsegnet.yml \
  up -d ai-engine

# Verify
curl http://localhost:8000/ready | jq '.providers.MESHSEGNET'
```

### Step 4: Clinical validation gate

Before setting `MESHSEGNET_ENABLED=true` in any production `.env`:

1. Run internal validation on ≥50 de-identified clinical scans
2. Document DSC per tooth class
3. Compare against TGN and orthodontist ground truth
4. Obtain QA sign-off

See `docs/ENGINE_SELECTION_REPORT.md` §Clinical Validation Requirements.

---

## Provider Routing in Production

Edit the `.env` file on the VPS and restart ai-engine:

```bash
# AUTO mode: TGN first, MeshSegNet fallback
SEGMENTATION_PROVIDER=AUTO
SEGMENTATION_PRIMARY=TGN

# AUTO mode: MeshSegNet first, TGN fallback
SEGMENTATION_PROVIDER=AUTO
SEGMENTATION_PRIMARY=MESHSEGNET

# Force TGN only
SEGMENTATION_PROVIDER=TGN

# Force MeshSegNet only
SEGMENTATION_PROVIDER=MESHSEGNET

# No AI — manual review only
SEGMENTATION_PROVIDER=MANUAL
```

No code deployment required — routing is a runtime env-var change.

---

## Health Checks

```bash
# ai-engine liveness
curl http://localhost:8000/health

# ai-engine readiness (includes provider health)
curl http://localhost:8000/ready | jq .

# tgn-service health
curl http://localhost:8001/health

# meshsegnet-service health
curl http://localhost:8002/health

# Prometheus metrics (no auth required)
curl http://localhost:8000/metrics

# Engine list + route plan (requires JWT)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/ai/engines | jq .
```

---

## Rolling Restart Procedure

```bash
# Restart ai-engine with zero AI downtime
# (MANUAL provider always healthy; requests fall back immediately)
docker compose restart ai-engine

# Restart with env change
docker compose stop ai-engine
# edit .env
docker compose up -d ai-engine
```

---

## Logs

```bash
# ai-engine
docker compose logs -f ai-engine

# meshsegnet-service
docker compose -f docker-compose.yml -f docker-compose.meshsegnet.yml \
  logs -f meshsegnet-api

# Filter for errors only
docker compose logs ai-engine 2>&1 | grep -i error
```

---

## Backup and Recovery

### Checkpoint backup

```bash
# Backup meshsegnet checkpoint
docker run --rm \
  -v myortho_meshsegnet-ckpts:/ckpts:ro \
  -v /opt/backups:/backup \
  alpine cp /ckpts/meshsegnet.pth /backup/meshsegnet_$(date +%Y%m%d).pth
```

### Job store

The ai-engine job store is backed by the main PostgreSQL database. Standard database backup procedures apply (see existing backup runbooks).

Redis benchmark cache is ephemeral; no backup required.

---

## Security Checklist

- [ ] `INTERNAL_API_SECRET` is a randomly generated 32+ character secret
- [ ] meshsegnet-service and tgn-service are NOT exposed on host ports
- [ ] All inter-service traffic is over the Docker internal network
- [ ] JWT validation in ai-engine is enforced on all authenticated endpoints
- [ ] Checkpoint file is stored in a named Docker volume, not bind-mounted from the host filesystem
- [ ] `MESHSEGNET_ENABLED=false` in all environments until QA sign-off
- [ ] `TGN_ENABLED=false` in all environments until CC BY-NC-ND license resolved
- [ ] `SEGMENTATION_PROVIDER=MANUAL` is the default and current production value
