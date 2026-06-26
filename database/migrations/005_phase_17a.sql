-- ============================================================================
-- Migration 005: Phase 17A — Bootstrap admin defaults + admin API
--
-- Changes:
--   • Add is_active column to auth_users (defaults true; admin can deactivate)
--   • Add last_login_at column to auth_users (updated on each login)
--   • Ensure admin bootstrap upsert works with ON CONFLICT DO NOTHING
--
-- Safe to re-run: all statements use IF NOT EXISTS / idempotent patterns.
-- Run after: 001–004 migrations.
-- ============================================================================

-- Add is_active if not present (backend deactivation support)
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- last_login_at already present from migration 001 — no-op guard
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Index for fast admin user listing
CREATE INDEX IF NOT EXISTS idx_auth_users_org_role
  ON auth_users(organization_id, role);

CREATE INDEX IF NOT EXISTS idx_auth_users_active
  ON auth_users(is_active);
