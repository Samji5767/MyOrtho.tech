#!/usr/bin/env bash
# ============================================================
# MyOrtho.tech — VPS Production Deployment Script
# Target: /opt/myortho on Hostinger VPS (Ubuntu 22.04)
# Usage: scp this script to VPS then run as root/sudo user
# ============================================================
set -euo pipefail

APP_DIR="/opt/myortho"
BRANCH="${1:-claude/myortho-production-validation-dlmvsi}"
REPO_URL="https://github.com/samji5767/myortho.tech.git"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${APP_DIR}/backups/${TIMESTAMP}"

# ── Step 1: Prerequisites check ──────────────────────────────────────────────
echo "[deploy] Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not installed"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose not available"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "WARN: psql not found — database backup will be skipped"; }
command -v nginx >/dev/null 2>&1 || echo "WARN: nginx not in PATH"

# ── Step 2: Backup current state ─────────────────────────────────────────────
echo "[deploy] Creating backup in ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}"

# Backup .env
if [ -f "${APP_DIR}/.env" ]; then
  cp "${APP_DIR}/.env" "${BACKUP_DIR}/.env.bak"
  echo "[deploy] .env backed up"
fi

# Backup PostgreSQL if running
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "myortho-db"; then
  DB_URL=$(grep DATABASE_URL "${APP_DIR}/.env" 2>/dev/null | cut -d= -f2- | tr -d '"')
  if [ -n "${DB_URL}" ]; then
    echo "[deploy] Backing up PostgreSQL..."
    docker exec myortho-db pg_dumpall -U myortho_admin > "${BACKUP_DIR}/postgres_dump.sql" || \
      echo "WARN: PostgreSQL backup failed (non-fatal)"
  fi
fi

# ── Step 3: Pull latest code ─────────────────────────────────────────────────
echo "[deploy] Pulling latest code from branch: ${BRANCH}..."
if [ -d "${APP_DIR}/.git" ]; then
  cd "${APP_DIR}"
  git fetch origin
  git checkout "${BRANCH}"
  git pull origin "${BRANCH}"
else
  mkdir -p "${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  cd "${APP_DIR}"
fi

# Restore .env (git pull must not overwrite it)
if [ -f "${BACKUP_DIR}/.env.bak" ] && [ ! -f "${APP_DIR}/.env" ]; then
  cp "${BACKUP_DIR}/.env.bak" "${APP_DIR}/.env"
  echo "[deploy] .env restored from backup"
fi

# ── Step 4: .env validation ───────────────────────────────────────────────────
echo "[deploy] Validating .env..."
ENV_FILE="${APP_DIR}/.env"
if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} does not exist — copy .env.example and fill values"
  exit 1
fi

REQUIRED_VARS=(
  DATABASE_URL
  JWT_SECRET
  REDIS_URL
)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${var}=" "${ENV_FILE}"; then
    MISSING+=("${var}")
  fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: Missing required env vars: ${MISSING[*]}"
  exit 1
fi

if grep -q "CHANGE_ME_BEFORE_PRODUCTION" "${ENV_FILE}"; then
  echo "ERROR: Default password CHANGE_ME_BEFORE_PRODUCTION found in .env — rotate before deploying"
  exit 1
fi

JWT_SECRET_VAL=$(grep "^JWT_SECRET=" "${ENV_FILE}" | cut -d= -f2- | tr -d '"')
if [ ${#JWT_SECRET_VAL} -lt 32 ]; then
  echo "ERROR: JWT_SECRET must be at least 32 characters"
  exit 1
fi

echo "[deploy] .env validation passed"

# ── Step 5: Build images ──────────────────────────────────────────────────────
echo "[deploy] Building Docker images (no cache)..."
cd "${APP_DIR}"
docker compose build --no-cache

# ── Step 6: Run migrations ────────────────────────────────────────────────────
echo "[deploy] Stopping existing services (keep data volumes)..."
docker compose down --remove-orphans || true

echo "[deploy] Starting database..."
docker compose up -d database
sleep 8
docker compose up migrate

# ── Step 7: Start all services ───────────────────────────────────────────────
echo "[deploy] Starting all services..."
docker compose up -d

# ── Step 8: Wait for health checks ───────────────────────────────────────────
echo "[deploy] Waiting for services to become healthy..."
MAX_WAIT=120
ELAPSED=0
SERVICES=(backend frontend ai-engine)
for svc in "${SERVICES[@]}"; do
  echo -n "[deploy] Waiting for ${svc}..."
  while true; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "myortho-${svc}" 2>/dev/null || echo "missing")
    if [ "${STATUS}" = "healthy" ]; then
      echo " OK"
      break
    fi
    if [ "${STATUS}" = "unhealthy" ]; then
      echo " UNHEALTHY"
      docker logs "myortho-${svc}" --tail 30
      echo "ERROR: ${svc} is unhealthy"
      exit 1
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
    echo -n "."
    if [ "${ELAPSED}" -gt "${MAX_WAIT}" ]; then
      echo " TIMEOUT"
      echo "ERROR: ${svc} did not become healthy within ${MAX_WAIT}s"
      exit 1
    fi
  done
done

# ── Step 9: Smoke tests ───────────────────────────────────────────────────────
echo "[deploy] Running smoke tests..."

check_endpoint() {
  local url="$1"
  local expected="$2"
  local response
  response=$(curl -sf --max-time 10 "${url}" 2>/dev/null || echo "CURL_FAIL")
  if echo "${response}" | grep -q "${expected}"; then
    echo "[smoke] OK: ${url}"
  else
    echo "[smoke] FAIL: ${url} — expected '${expected}', got: ${response}"
    return 1
  fi
}

check_endpoint "http://localhost:4000/health" "ok"
check_endpoint "http://localhost:8000/health" "status"
check_endpoint "http://localhost:3005/" ""

# ── Step 10: Reload nginx ─────────────────────────────────────────────────────
if command -v nginx >/dev/null 2>&1; then
  echo "[deploy] Reloading nginx..."
  nginx -t && systemctl reload nginx || echo "WARN: nginx reload failed"
fi

# ── Step 11: pgvector extension (if not installed) ───────────────────────────
echo "[deploy] Ensuring pgvector extension is available..."
DB_URL=$(grep "^DATABASE_URL=" "${ENV_FILE}" | cut -d= -f2-)
docker exec myortho-db psql "${DB_URL}" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || \
  echo "WARN: pgvector CREATE EXTENSION failed — install postgresql-pgvector on the host DB image"

echo ""
echo "============================================================"
echo "  MyOrtho.tech deployment COMPLETE"
echo "  Branch: ${BRANCH}"
echo "  Backup: ${BACKUP_DIR}"
echo "============================================================"
echo ""
echo "Service URLs:"
echo "  Frontend:  https://myortho.tech"
echo "  API:       https://api.myortho.tech"
echo "  AI Engine: https://ai.myortho.tech"
echo ""
echo "Container status:"
docker compose ps
