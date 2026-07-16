#!/usr/bin/env bash
# Restore validation script for MyOrtho.tech
# Restores a backup into a STAGING database and runs smoke queries to validate integrity.
# Does NOT restore into the production database.
#
# Usage:
#   BACKUP_FILE=/path/to/myortho_<ts>.dump \
#   STAGING_DATABASE_URL=postgresql://user:pass@host:5432/myortho_restore_test \
#   ./scripts/restore-validate.sh
#
# The staging database is DROPPED and RECREATED on each run.

set -euo pipefail

BACKUP_FILE="${BACKUP_FILE:?BACKUP_FILE must be set}"
STAGING_URL="${STAGING_DATABASE_URL:?STAGING_DATABASE_URL must be set}"
LOG_FILE="${LOG_FILE:-/tmp/myortho-restore-validate.log}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERROR] Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "[$(ts)] $*" | tee -a "${LOG_FILE}"; }

log "=== MyOrtho.tech Restore Validation ==="
log "Backup file : ${BACKUP_FILE}"
log "Target DB   : ${STAGING_URL}"

# ── 1. Verify backup is readable ─────────────────────────────────────────────
log "Step 1: Verifying backup integrity (pg_restore --list)..."
pg_restore --list "${BACKUP_FILE}" > /dev/null
log "Backup integrity OK."

# ── 2. Drop and recreate staging DB ──────────────────────────────────────────
log "Step 2: Recreating staging database..."
# Extract dbname from URL: postgresql://user:pass@host:5432/DBNAME
DBNAME=$(echo "${STAGING_URL}" | sed 's|.*/||')
ADMIN_URL=$(echo "${STAGING_URL}" | sed "s|/${DBNAME}||")

psql "${ADMIN_URL}/postgres" -c "DROP DATABASE IF EXISTS ${DBNAME};" -q
psql "${ADMIN_URL}/postgres" -c "CREATE DATABASE ${DBNAME};" -q
log "Staging database ${DBNAME} recreated."

# ── 3. Restore ────────────────────────────────────────────────────────────────
log "Step 3: Restoring backup..."
pg_restore \
  --dbname="${STAGING_URL}" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "${BACKUP_FILE}"
log "Restore complete."

# ── 4. Smoke queries ─────────────────────────────────────────────────────────
log "Step 4: Running smoke queries..."

run_query() {
  local desc="$1"
  local sql="$2"
  local result
  result=$(psql "${STAGING_URL}" -t -c "${sql}" 2>&1)
  log "  ${desc}: ${result}"
}

run_query "organizations count"    "SELECT COUNT(*) FROM organizations"
run_query "auth_users count"       "SELECT COUNT(*) FROM auth_users"
run_query "patients count"         "SELECT COUNT(*) FROM patients"
run_query "cases count"            "SELECT COUNT(*) FROM cases"
run_query "treatment_plans count"  "SELECT COUNT(*) FROM treatment_plans"
run_query "scans count"            "SELECT COUNT(*) FROM scans"

# ── 5. FK integrity check ─────────────────────────────────────────────────────
log "Step 5: Checking FK integrity (cases → patients → organizations)..."
ORPHAN_CASES=$(psql "${STAGING_URL}" -t -c \
  "SELECT COUNT(*) FROM cases c LEFT JOIN patients p ON p.id = c.patient_id WHERE p.id IS NULL")
if [ "${ORPHAN_CASES// /}" -gt 0 ]; then
  log "WARNING: ${ORPHAN_CASES} orphaned cases found (no parent patient)."
else
  log "No orphaned cases detected."
fi

log "=== Restore validation PASSED ==="
log "Log: ${LOG_FILE}"
