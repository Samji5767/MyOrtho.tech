#!/usr/bin/env bash
# PostgreSQL backup script for MyOrtho.tech
# Creates a compressed pg_dump, retains backups for RETENTION_DAYS, and logs results.
#
# Usage:
#   ./scripts/backup.sh
#
# Required environment variables:
#   DATABASE_URL   — PostgreSQL connection string
#   BACKUP_DIR     — Directory where backup files are stored (default: /var/backups/myortho)
#   RETENTION_DAYS — Number of days to retain backups (default: 7)
#
# Restore procedure:
#   pg_restore -d <DATABASE_URL> --no-owner --role=<db_user> <backup_file>
#   Or for SQL dumps: psql <DATABASE_URL> < <backup_file.sql>

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/myortho}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/myortho_${TIMESTAMP}.dump"
LOG_FILE="${BACKUP_DIR}/backup.log"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set. Cannot perform backup." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting backup → ${BACKUP_FILE}" | tee -a "${LOG_FILE}"

# pg_dump in custom format (compressed, supports parallel restore)
pg_dump \
  --format=custom \
  --compress=9 \
  --no-password \
  "${DATABASE_URL}" \
  --file="${BACKUP_FILE}"

if [ $? -eq 0 ]; then
  SIZE="$(du -sh "${BACKUP_FILE}" | cut -f1)"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete. File: ${BACKUP_FILE} Size: ${SIZE}" | tee -a "${LOG_FILE}"
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ERROR: pg_dump failed for ${BACKUP_FILE}" | tee -a "${LOG_FILE}"
  exit 1
fi

# Verify the backup is readable by listing its contents
pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup verified (pg_restore --list passed)." | tee -a "${LOG_FILE}"
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] WARNING: pg_restore --list failed — backup may be corrupt." | tee -a "${LOG_FILE}"
  exit 1
fi

# Prune backups older than RETENTION_DAYS
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Pruning backups older than ${RETENTION_DAYS} days..." | tee -a "${LOG_FILE}"
find "${BACKUP_DIR}" -name "myortho_*.dump" -mtime "+${RETENTION_DAYS}" -print -delete | tee -a "${LOG_FILE}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup run complete." | tee -a "${LOG_FILE}"
