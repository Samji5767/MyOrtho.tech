#!/usr/bin/env bash
# MyOrtho.tech — service health check
# Probes every service endpoint and reports status.
set -uo pipefail

# Load ports from .env if present
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

FRONTEND_PORT="${FRONTEND_PORT:-3005}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
AI_ENGINE_PORT="${AI_ENGINE_PORT:-8000}"

ok()   { printf "  \033[32m✓\033[0m %-12s %s\n" "$1" "$2"; }
fail() { printf "  \033[31m✗\033[0m %-12s %s\n" "$1" "$2"; }

failures=0

check_http() {
  local name="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
    ok "$name" "$url → HTTP $code"
  else
    fail "$name" "$url → unreachable (HTTP $code)"
    failures=$((failures + 1))
  fi
}

# Postgres and Redis are not published to the host (internal network only),
# so probe them through their containers instead of a host TCP connection.
check_container() {
  local name="$1"; shift
  if docker compose exec -T "$name" "$@" >/dev/null 2>&1; then
    ok "$name" "container probe → ok"
  else
    fail "$name" "container probe → failed (is the stack up?)"
    failures=$((failures + 1))
  fi
}

printf "\033[1mMyOrtho.tech health check\033[0m\n"
check_http "frontend"  "http://localhost:${FRONTEND_PORT}"
check_http "backend"   "http://localhost:${BACKEND_PORT}/health"
check_http "ai-engine" "http://localhost:${AI_ENGINE_PORT}/health"
check_container "database" pg_isready -U "${POSTGRES_USER:-myortho_admin}" -d "${POSTGRES_DB:-myortho_tech}"
check_container "redis" redis-cli ping

echo
if [ "$failures" -eq 0 ]; then
  printf "\033[32mAll services healthy.\033[0m\n"
  exit 0
else
  printf "\033[31m%d service(s) unhealthy.\033[0m Try: make logs\n" "$failures"
  exit 1
fi
