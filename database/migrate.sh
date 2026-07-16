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

SCRIPT_DIR="$(dirname "$0")"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
SCHEMA_FILE="$SCRIPT_DIR/schema.sql"

echo "[migrate] Starting migration runner against database..."

# On a bare-metal install the migrations alone are not enough — schema.sql
# creates the baseline tables (organizations, auth_users, uuid-ossp extension)
# that migrations assume exist.  Apply schema.sql first when the database
# appears empty (organizations table missing).
if [ -f "$SCHEMA_FILE" ]; then
  TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.organizations')" 2>/dev/null || echo "")
  if [ -z "$TABLE_EXISTS" ] || [ "$TABLE_EXISTS" = "" ]; then
    echo "[migrate] Applying schema.sql (baseline — organizations table not found)..."
    psql "$DATABASE_URL" -f "$SCHEMA_FILE" -v ON_ERROR_STOP=1 -q
  fi
fi

# Sort files numerically so 002 < 003 < ... < 031 regardless of file name format
for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  name=$(basename "$file")
  echo "[migrate] Applying: $name"
  psql "$DATABASE_URL" -f "$file" -v ON_ERROR_STOP=1 -q
done

echo "[migrate] All migrations applied successfully."
