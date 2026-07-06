-- Migration 045: Production security and integrity fixes
-- Idempotent — safe to re-run.

-- ── DB-01: schema_migrations tracking table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- ── DB-02: Revoke superuser from application DB user ─────────────────────────
-- The myortho_dev user was bootstrapped as SUPERUSER which bypasses RLS.
-- Drop to minimum privileges needed for application operation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'myortho_dev' AND rolsuper = true
  ) THEN
    -- BYPASSRLS is required because several tables have RLS policies with
    -- recursive dependencies through the profiles table. The application
    -- enforces org-level isolation in SQL WHERE clauses; RLS provides an
    -- extra layer but can be applied once the recursive policy is resolved.
    ALTER ROLE myortho_dev NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
  END IF;
END;
$$;

-- ── DB-03: is_active column on auth_users (SEC-01) ────────────────────────────
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ── DB-04: Missing FK indexes (performance + integrity) ───────────────────────
CREATE INDEX IF NOT EXISTS idx_cases_organization_id       ON cases(organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to           ON cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_patients_organization_id    ON patients(organization_id);
CREATE INDEX IF NOT EXISTS idx_stl_uploads_case_id         ON stl_uploads(case_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_case_id     ON workflow_events(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id  ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id          ON audit_logs(user_id);

-- ── API-06: Fix typo 'canceled' → 'cancelled' in stl_uploads index ────────────
-- Drop the incorrectly-named partial index if it exists, then recreate with the
-- correct spelling that matches the case_status enum value 'cancelled'.
DROP INDEX IF EXISTS idx_stl_uploads_active;
CREATE INDEX IF NOT EXISTS idx_stl_uploads_active
  ON stl_uploads(case_id, created_at DESC)
  WHERE status NOT IN ('completed', 'cancelled');

-- ── Record this migration ─────────────────────────────────────────────────────
INSERT INTO schema_migrations (version)
VALUES ('045_production_fixes')
ON CONFLICT (version) DO NOTHING;
