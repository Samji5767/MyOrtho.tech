# Backup & Restore — MyOrtho.tech

All patient data is encrypted at rest with AES-256-GCM. The encryption key (ENCRYPTION_KEY) is stored only in your `.env` file — it is **not** embedded in the database. A database backup without the matching ENCRYPTION_KEY is unrecoverable.

---

## What to Back Up

| Asset | Location | Criticality |
|---|---|---|
| PostgreSQL database | Docker volume `postgres_data` | Critical |
| ENCRYPTION_KEY | `.env` file / secrets manager | Critical — back up separately |
| Redis snapshot | Docker volume `redis_data` | High (session + queue state) |
| Uploaded scan files | Docker volume `uploads` | High |
| `.env` file | VPS filesystem | High |

---

## PostgreSQL Backup with pg_dump

The `database` service is not exposed to the host network. Run pg_dump through `docker compose exec`:

```bash
docker compose exec database pg_dump \
  -U "${POSTGRES_USER:-myortho_admin}" \
  -d "${POSTGRES_DB:-myortho_tech}" \
  --format=custom \
  --compress=9 \
  > /var/backups/myortho/myortho_$(date +%Y%m%d_%H%M%S).pgdump
```

The `--format=custom` flag produces a compressed, parallel-restoreable archive. Do not use plain SQL dumps for production — they cannot be restored incrementally.

---

## Redis Snapshot

Redis is configured with append-only persistence (`appendonly yes`) by default. The snapshot file is in the `redis_data` volume. To trigger a manual snapshot before a planned maintenance:

```bash
docker compose exec redis redis-cli BGSAVE
```

For disaster recovery, copy `/var/lib/docker/volumes/myortho_redis_data/_data/appendonly.aof` to offsite storage.

---

## ENCRYPTION_KEY — Critical Backup Warning

The ENCRYPTION_KEY is the only key that can decrypt PHI fields (patient names, dates of birth, gender, clinical notes). It is never written to the database.

**If you lose ENCRYPTION_KEY, all PHI in the database is permanently unreadable. There is no recovery path.**

Store ENCRYPTION_KEY in at minimum two separate locations:
1. A hardware-based or cloud secrets manager (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault)
2. An offline encrypted backup (e.g. printed QR code in a physical safe)

Never store ENCRYPTION_KEY in the same location as the database backup.

---

## Daily Backup Cron Script

Save to `/usr/local/bin/myortho-backup.sh` and make executable (`chmod +x`):

```bash
#!/usr/bin/env bash
# MyOrtho.tech — daily PostgreSQL backup
# Requires: docker compose stack running at /opt/myortho
# Configure: BACKUP_DIR, RETAIN_DAYS, COMPOSE_DIR

set -euo pipefail

COMPOSE_DIR="/opt/myortho"
BACKUP_DIR="/var/backups/myortho"
RETAIN_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="myortho_${TIMESTAMP}.pgdump"

mkdir -p "${BACKUP_DIR}"

cd "${COMPOSE_DIR}"

# Load POSTGRES_USER and POSTGRES_DB from .env
source <(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' .env)

docker compose exec -T database pg_dump \
  -U "${POSTGRES_USER:-myortho_admin}" \
  -d "${POSTGRES_DB:-myortho_tech}" \
  --format=custom \
  --compress=9 \
  > "${BACKUP_DIR}/${FILENAME}"

echo "[$(date -Iseconds)] Backup written: ${BACKUP_DIR}/${FILENAME} ($(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1))"

# Remove backups older than RETAIN_DAYS
find "${BACKUP_DIR}" -name "myortho_*.pgdump" -mtime "+${RETAIN_DAYS}" -delete

echo "[$(date -Iseconds)] Pruned backups older than ${RETAIN_DAYS} days"
```

Register the cron job (runs daily at 02:00):

```bash
echo "0 2 * * * root /usr/local/bin/myortho-backup.sh >> /var/log/myortho-backup.log 2>&1" \
  > /etc/cron.d/myortho-backup
```

Verify the first backup ran:

```bash
tail -20 /var/log/myortho-backup.log
ls -lh /var/backups/myortho/
```

---

## Restore Procedure

**Step 1 — Stop the backend (prevent writes during restore):**

```bash
cd /opt/myortho
docker compose stop backend ai-engine
```

**Step 2 — Drop and recreate the database:**

```bash
docker compose exec database psql -U myortho_admin -c "DROP DATABASE myortho_tech;"
docker compose exec database psql -U myortho_admin -c "CREATE DATABASE myortho_tech;"
```

**Step 3 — Restore from backup archive:**

```bash
docker compose exec -T database pg_restore \
  -U myortho_admin \
  -d myortho_tech \
  --no-owner \
  --no-privileges \
  < /var/backups/myortho/myortho_YYYYMMDD_HHMMSS.pgdump
```

**Step 4 — Verify ENCRYPTION_KEY matches the backup era.** If restoring a backup from before a key rotation, you must also restore the ENCRYPTION_KEY that was active at backup time. Mismatched keys produce garbled PHI without raising errors.

**Step 5 — Restart services:**

```bash
docker compose up -d
```

**Step 6 — Verify health:**

```bash
curl -s https://your-domain.com/api/health | jq .
```
