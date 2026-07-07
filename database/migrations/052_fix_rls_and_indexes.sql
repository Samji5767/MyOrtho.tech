-- Migration 052: Fix cases/patients RLS policies and drop duplicate indexes
--
-- Issue 1: cases and patients use auth.uid()→profiles lookup for RLS.
-- profiles is empty on VPS; auth.uid() falls back to a hardcoded user.
-- All other 49 RLS-protected tables correctly use app_current_org_id().
-- Fix: rewrite both policies to use app_current_org_id() directly.
--
-- Issue 2: Duplicate btree indexes on cases and patients tables waste
-- write overhead with zero read benefit — one index per column is enough.

-- ── 1. Fix patients RLS ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS patient_access_policy ON patients;
CREATE POLICY patient_access_policy ON patients
  USING (organization_id = app_current_org_id());

-- ── 2. Fix cases RLS ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS case_access_policy ON cases;
CREATE POLICY case_access_policy ON cases
  USING (
    patient_id IN (
      SELECT id FROM patients
      WHERE organization_id = app_current_org_id()
    )
  );

-- ── 3. Drop duplicate indexes on cases ──────────────────────────────────────
-- Keep the most specific/composite index; drop the redundant single-column ones.

-- patient_id: keep idx_cases_patient_id, drop idx_cases_patient (identical)
DROP INDEX IF EXISTS idx_cases_patient;

-- status: keep idx_cases_status_text, drop idx_cases_status (identical)
DROP INDEX IF EXISTS idx_cases_status;

-- ── 4. Drop duplicate indexes on patients ────────────────────────────────────
-- organization_id: three identical indexes — keep idx_patients_organization_id

DROP INDEX IF EXISTS idx_patients_org;
DROP INDEX IF EXISTS idx_patients_org_id;

-- ── 5. Add missing index on workflow_events ──────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workflow_events_case_status
  ON workflow_events (case_id, to_status);

CREATE INDEX IF NOT EXISTS idx_workflow_events_created_at
  ON workflow_events (created_at DESC);
