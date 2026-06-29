#!/usr/bin/env bash
# Run all SQL migrations in order.
# Usage: DATABASE_URL=postgres://... ./scripts/migrate.sh

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../database/migrations" && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[migrate] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

# Ensure the migrations tracking table exists
psql "$DATABASE_URL" -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz DEFAULT now()
  );
" > /dev/null

echo "[migrate] Scanning $MIGRATIONS_DIR …"

for sql_file in "$MIGRATIONS_DIR"/*.sql; do
  filename="$(basename "$sql_file")"
  already_applied=$(psql "$DATABASE_URL" -t -c \
    "SELECT COUNT(1) FROM schema_migrations WHERE filename = '$filename';" | tr -d ' ')

  if [[ "$already_applied" == "1" ]]; then
    echo "[migrate] SKIP  $filename (already applied)"
    continue
  fi

  echo "[migrate] APPLY $filename …"
  psql "$DATABASE_URL" -f "$sql_file"
  psql "$DATABASE_URL" -c \
    "INSERT INTO schema_migrations (filename) VALUES ('$filename') ON CONFLICT DO NOTHING;" > /dev/null
  echo "[migrate] DONE  $filename"
done

echo "[migrate] All migrations complete."
