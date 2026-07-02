-- Migration 036: Row-Level Security for high-risk PHI tables from migrations
--
-- DEPLOYMENT REQUIREMENTS:
--   This migration enables RLS on tables created by prior migrations that lacked
--   it. Policies use current_setting('app.current_org_id', true) which the
--   application must set before any query in a transaction:
--
--     BEGIN;
--     SELECT set_config('app.current_org_id', $orgId, true);
--     -- ... your queries ...
--     COMMIT;
--
--   The database role embedded in DATABASE_URL must NOT be a superuser —
--   superusers bypass RLS. Create a dedicated role:
--
--     CREATE ROLE app_user LOGIN PASSWORD '...';
--     GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public
--       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
--
--   Migration runner (migrate.sh) must use a superuser/owner role, not app_user,
--   so it can ALTER TABLE and CREATE POLICY without RLS blocking it.
--
-- TABLES COVERED (migration-created PHI tables):
--   audit_events, patient_notes, patient_consents, fhir_exports,
--   cephalometric_analyses, ai_treatment_proposals, radiology_images,
--   intake_submissions, prescriptions, treatment_outcomes
--
-- Tables already covered by schema.sql RLS are NOT repeated here.
-- Tables without an organization_id column (joined via FK chain) are
-- excluded from direct RLS — they rely on app-layer JOIN isolation.

-- ─── Helper: policy creation function ────────────────────────────────────────

-- Returns the current org ID set by the application for this transaction.
-- Returns NULL if not set (which means all RLS policies will deny access —
-- correct behavior when the app forgets to set the context).
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  AS $$
    SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid
  $$;

-- ─── audit_events ─────────────────────────────────────────────────────────────

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_org_isolation ON audit_events;
CREATE POLICY audit_events_org_isolation ON audit_events
  USING (organization_id = app_current_org_id());

-- ─── patient_notes ───────────────────────────────────────────────────────────

ALTER TABLE patient_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_notes_org_isolation ON patient_notes;
CREATE POLICY patient_notes_org_isolation ON patient_notes
  USING (organization_id = app_current_org_id());

-- ─── patient_consents ────────────────────────────────────────────────────────

ALTER TABLE patient_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_consents_org_isolation ON patient_consents;
CREATE POLICY patient_consents_org_isolation ON patient_consents
  USING (organization_id = app_current_org_id());

-- ─── fhir_exports ────────────────────────────────────────────────────────────

ALTER TABLE fhir_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fhir_exports_org_isolation ON fhir_exports;
CREATE POLICY fhir_exports_org_isolation ON fhir_exports
  USING (organization_id = app_current_org_id());

-- ─── cephalometric_analyses ──────────────────────────────────────────────────

ALTER TABLE cephalometric_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cephalometric_analyses_org_isolation ON cephalometric_analyses;
CREATE POLICY cephalometric_analyses_org_isolation ON cephalometric_analyses
  USING (organization_id = app_current_org_id());

-- ─── ai_treatment_proposals ──────────────────────────────────────────────────

ALTER TABLE ai_treatment_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_treatment_proposals_org_isolation ON ai_treatment_proposals;
CREATE POLICY ai_treatment_proposals_org_isolation ON ai_treatment_proposals
  USING (organization_id = app_current_org_id());

-- ─── radiology_images ────────────────────────────────────────────────────────

ALTER TABLE radiology_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS radiology_images_org_isolation ON radiology_images;
CREATE POLICY radiology_images_org_isolation ON radiology_images
  USING (organization_id = app_current_org_id());

-- ─── intake_submissions ──────────────────────────────────────────────────────

ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intake_submissions_org_isolation ON intake_submissions;
CREATE POLICY intake_submissions_org_isolation ON intake_submissions
  USING (organization_id = app_current_org_id());

-- ─── prescriptions ───────────────────────────────────────────────────────────

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prescriptions_org_isolation ON prescriptions;
CREATE POLICY prescriptions_org_isolation ON prescriptions
  USING (organization_id = app_current_org_id());

-- ─── treatment_outcomes ──────────────────────────────────────────────────────

ALTER TABLE treatment_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS treatment_outcomes_org_isolation ON treatment_outcomes;
CREATE POLICY treatment_outcomes_org_isolation ON treatment_outcomes
  USING (organization_id = app_current_org_id());

-- ─── notifications ───────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_org_isolation ON notifications;
CREATE POLICY notifications_org_isolation ON notifications
  USING (organization_id = app_current_org_id());

-- ─── organization_credits ────────────────────────────────────────────────────

ALTER TABLE organization_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_credits_org_isolation ON organization_credits;
CREATE POLICY organization_credits_org_isolation ON organization_credits
  USING (organization_id = app_current_org_id());
