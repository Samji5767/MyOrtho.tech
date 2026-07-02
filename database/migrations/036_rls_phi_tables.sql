-- Migration 036: Row-Level Security for high-risk PHI tables from migrations
--
-- All ALTER TABLE … ENABLE ROW LEVEL SECURITY statements are wrapped in
-- table-existence guards so the migration is safe on VPS schemas that were
-- created without certain optional (ERP/legacy) tables.
--
-- DEPLOYMENT REQUIREMENTS:
--   The database role in DATABASE_URL must NOT be a superuser.

-- ─── Helper function ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  AS $$
    SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid
  $$;

-- ─── Macro: enable RLS + upsert policy for one table ─────────────────────────
-- Called once per table with the table name as argument.

CREATE OR REPLACE FUNCTION _migrate_036_enable_org_rls(p_table text) RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_name = p_table AND table_schema = 'public') THEN
    RETURN;
  END IF;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_org_isolation', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I USING (organization_id = app_current_org_id())',
    p_table || '_org_isolation', p_table
  );
END $$;

-- ─── Apply to each PHI table ──────────────────────────────────────────────────

SELECT _migrate_036_enable_org_rls('audit_events');
SELECT _migrate_036_enable_org_rls('patient_notes');
SELECT _migrate_036_enable_org_rls('patient_consents');
SELECT _migrate_036_enable_org_rls('fhir_exports');
SELECT _migrate_036_enable_org_rls('cephalometric_analyses');
SELECT _migrate_036_enable_org_rls('ai_treatment_proposals');
SELECT _migrate_036_enable_org_rls('radiology_images');
SELECT _migrate_036_enable_org_rls('intake_submissions');
SELECT _migrate_036_enable_org_rls('prescriptions');
SELECT _migrate_036_enable_org_rls('treatment_outcomes');
SELECT _migrate_036_enable_org_rls('notifications');
SELECT _migrate_036_enable_org_rls('organization_credits');

-- ─── Cleanup helper (not needed at runtime) ───────────────────────────────────
DROP FUNCTION IF EXISTS _migrate_036_enable_org_rls(text);
