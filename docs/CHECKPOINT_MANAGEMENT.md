# Checkpoint Management Guide

**Last updated:** 2026-07-11  
**Audience:** ML Engineering / DevOps

---

## Overview

AI segmentation engines require pre-trained model checkpoint files (`.pth` format for PyTorch-based engines). This document covers acquisition, verification, storage, rotation, and retirement of checkpoint files.

---

## Checkpoint Inventory

| Engine | File | Size (approx) | License | Storage Location |
|--------|------|----------------|---------|-----------------|
| MeshSegNet | `meshsegnet.pth` | ~50–200 MB | Unverified — confirm with authors | `/ckpts/meshsegnet.pth` in `meshsegnet-ckpts` Docker volume |
| TGN | Managed by tgn-service | ~100–500 MB | CC BY-NC-ND 4.0 | `/ckpts/` in `tgn-ckpts` Docker volume |

---

## Acquisition

### MeshSegNet

1. Contact the MeshSegNet authors (Lian et al.) via the repository or DOI contact:
   - DOI: https://doi.org/10.1109/TMI.2020.3025508
2. Request the checkpoint file and **written confirmation** of redistribution terms.
3. Confirm that commercial use is permitted under the provided terms.
4. Record the SHA-256 hash of the received file immediately:
   ```bash
   sha256sum meshsegnet.pth
   ```
5. Store the hash in the team password manager / secrets vault alongside the checkpoint URL.

### TGN

Refer to the existing TGN integration documentation. TGN checkpoints are distributed under CC BY-NC-ND 4.0 — commercial redistribution is **not permitted**. A commercial license must be obtained before production deployment.

---

## Verification

Every checkpoint must be verified before loading. The meshsegnet-service performs automatic SHA-256 verification at startup when `MESHSEGNET_SHA256` is set.

### Manual verification

```bash
# Compute hash of the checkpoint on disk
sha256sum /path/to/meshsegnet.pth

# Compare against the known-good hash stored in your secrets vault
# If they differ, DO NOT load the checkpoint — re-download and re-verify
```

### Download-time verification

The `download_checkpoints.sh` script verifies SHA-256 automatically if `MESHSEGNET_SHA256` is set:

```bash
MESHSEGNET_CKPT_URL="<url>" \
MESHSEGNET_SHA256="<expected-hash>" \
  /app/scripts/download_checkpoints.sh
```

The script also performs a size sanity check (> 10 MB) to catch truncated downloads.

### Service-startup verification

The meshsegnet-service reads `MESHSEGNET_SHA256` from the environment. If set, it computes the file's SHA-256 at startup and refuses to load a mismatched checkpoint, entering `ERROR` state instead of `READY`.

---

## Storage

### Docker Volume

Checkpoints are stored in named Docker volumes, not bind-mounted host paths. This prevents accidental deletion during `docker compose down` with the default `--volumes` flag omitted.

```bash
# Create the volume (if not already created by compose)
docker volume create myortho_meshsegnet-ckpts

# Inspect volume location
docker volume inspect myortho_meshsegnet-ckpts
```

### Access Control

- Volume is mounted **read-only** (`ro`) in the meshsegnet-service container
- Write access is only granted to the `download_checkpoints.sh` script at provisioning time
- The meshsegnet container runs as non-root user `meshsegnet` (uid 1001)

### Backup

```bash
# Archive checkpoint to a backup directory
docker run --rm \
  -v myortho_meshsegnet-ckpts:/ckpts:ro \
  -v /opt/backups/checkpoints:/backup \
  alpine cp /ckpts/meshsegnet.pth /backup/meshsegnet_$(date +%Y%m%d_%H%M%S).pth

# Verify backup integrity
sha256sum /opt/backups/checkpoints/meshsegnet_*.pth
```

Keep at least 2 previous checkpoint versions on backup storage before rotating.

---

## Rotation Procedure

When updating to a new checkpoint version:

1. **Obtain and verify** the new checkpoint (see §Acquisition and §Verification above).
2. **Back up** the current checkpoint (see §Backup above).
3. **Upload** the new checkpoint to the Docker volume:
   ```bash
   docker run --rm \
     -v myortho_meshsegnet-ckpts:/ckpts \
     alpine cp /tmp/meshsegnet_v2.pth /ckpts/meshsegnet.pth
   ```
4. **Update** `MESHSEGNET_SHA256` in the `.env` file with the new checkpoint's hash.
5. **Update** `MESHSEGNET_MODEL_VERSION` in `.env` to the new version string.
6. **Restart** the meshsegnet-service:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.meshsegnet.yml \
     restart meshsegnet-api
   ```
7. **Verify** the service is in `READY` state:
   ```bash
   curl http://localhost:8002/health | jq '.state'
   # Expected: "READY"
   ```
8. **Run a smoke test** with a known scan to confirm output is consistent.
9. **Record** the rotation in the changelog.

---

## Retirement

When retiring a checkpoint version:

1. Ensure no jobs are in flight using the old version (check `/ai/engines` endpoint).
2. Remove from the Docker volume after the backup retention period (30 days minimum).
3. Record the retirement date in the engine's version history.

---

## Emergency Rollback

If a new checkpoint produces unexpected results:

```bash
# Stop meshsegnet-service
docker compose -f docker-compose.yml -f docker-compose.meshsegnet.yml \
  stop meshsegnet-api

# Restore previous checkpoint from backup
docker run --rm \
  -v myortho_meshsegnet-ckpts:/ckpts \
  -v /opt/backups/checkpoints:/backup:ro \
  alpine cp /backup/meshsegnet_<previous_date>.pth /ckpts/meshsegnet.pth

# Restore previous SHA256 and MODEL_VERSION in .env
# Then restart
docker compose -f docker-compose.yml -f docker-compose.meshsegnet.yml \
  start meshsegnet-api
```

If rollback is not possible, set `MESHSEGNET_ENABLED=false` and restart ai-engine to fall back to TGN or MANUAL.

---

## Secrets Management

The following checkpoint-related secrets must be stored in the team secrets vault (not in `.env` files committed to source control):

| Secret | Description |
|--------|-------------|
| `MESHSEGNET_CKPT_URL` | Authenticated download URL from authors |
| `MESHSEGNET_SHA256` | Expected SHA-256 hash of each checkpoint version |
| `INTERNAL_API_SECRET` | Shared secret for inter-service calls |

The `.env` file on VPS should reference these values but must never be committed to the repository.
