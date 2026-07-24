-- Migration 071: workspace scoping for patients/cases, patient lifecycle, case_activity
--
-- Adds workspace_id FK to patients and cases so resources are scoped through the
-- Workspace → Organization chain rather than direct organization_id alone.
-- Adds patient status/archived_at for soft-archival.
-- Creates case_activity table for structured event history.
--
-- All changes are idempotent (IF NOT EXISTS / IF NOT EXISTS guards).

-- ─── patients.workspace_id ────────────────────────────────────────────────────

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

-- Backfill: assign each patient to the default workspace of their org
UPDATE patients
SET workspace_id = w.id
FROM workspaces w
WHERE w.organization_id = patients.organization_id
  AND w.is_default = true
  AND patients.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_workspace
  ON patients(workspace_id);

-- ─── patients.status / archived_at ───────────────────────────────────────────

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived'));

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_patients_workspace_status
  ON patients(workspace_id, status);

-- ─── cases.workspace_id ───────────────────────────────────────────────────────

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

-- Backfill: inherit workspace_id from the patient
UPDATE cases
SET workspace_id = p.workspace_id
FROM patients p
WHERE p.id = cases.patient_id
  AND cases.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cases_workspace
  ON cases(workspace_id);

CREATE INDEX IF NOT EXISTS idx_cases_workspace_status
  ON cases(workspace_id, status);

-- ─── case_activity ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS case_activity (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id     uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  actor_id    uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  details     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_activity_case
  ON case_activity(case_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_activity_actor
  ON case_activity(actor_id);
