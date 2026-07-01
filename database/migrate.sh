#!/bin/sh
# Runs all SQL migration files in numeric order against $DATABASE_URL.
# Safe to re-run: every migration uses IF NOT EXISTS / DO $$ guards.
#
# Usage (standalone):
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./database/migrate.sh
#
# Used by the docker-compose `migrate` service which exits 0 on success.

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[migrate] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

MIGRATIONS_DIR="$(dirname "$0")/migrations"

echo "[migrate] Starting migration runner against database..."

# Sort files numerically so 002 < 003 < ... < 031 regardless of file name format
for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  name=$(basename "$file")
  echo "[migrate] Applying: $name"
  psql "$DATABASE_URL" -f "$file" -v ON_ERROR_STOP=1 -q
done

echo "[migrate] All migrations applied successfully."
