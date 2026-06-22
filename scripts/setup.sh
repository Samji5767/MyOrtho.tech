#!/usr/bin/env bash
# MyOrtho.tech — first-time setup
# Creates the environment file, verifies prerequisites, and builds the stack.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; }

bold "MyOrtho.tech setup"

# --- 1. Prerequisite checks -------------------------------------------------
bold "Checking prerequisites"
missing=0
for cmd in docker; do
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "$cmd found"
  else
    fail "$cmd not found — please install it"
    missing=1
  fi
done

if docker compose version >/dev/null 2>&1; then
  ok "docker compose available"
else
  fail "docker compose plugin not available"
  missing=1
fi

if [ "$missing" -ne 0 ]; then
  fail "Missing prerequisites — aborting."
  exit 1
fi

# --- 2. Environment file ----------------------------------------------------
bold "Configuring environment"
if [ -f .env ]; then
  ok ".env already exists (left untouched)"
else
  cp .env.example .env
  ok "Created .env from .env.example"
  warn "Edit .env and replace all 'change_me' / placeholder secrets before going to production."
fi

# --- 3. Build images --------------------------------------------------------
bold "Building service images (this may take a while)"
docker compose build

bold "Setup complete."
echo "Next steps:"
echo "  make up       # start the stack"
echo "  make health   # verify all services"
