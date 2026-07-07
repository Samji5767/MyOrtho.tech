-- Migration 050: Fix runtime schema mismatches between service code and DB
-- Covers: segmentation_jobs missing columns, profiles→auth_users FK fixes

-- ── 1. segmentation_jobs: add columns required by segmentation.service.ts ──────

-- ai_job_id is managed by the external AI service, not by NestJS — make nullable
ALTER TABLE segmentation_jobs
  ALTER COLUMN ai_job_id DROP NOT NULL;

-- scan_id is optional on job submission (can be NULL when submitting a CPU job)
ALTER TABLE segmentation_jobs
  ALTER COLUMN scan_id DROP NOT NULL;

ALTER TABLE segmentation_jobs
  ADD COLUMN IF NOT EXISTS submitted_by    uuid    REFERENCES auth_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model_type      text,
  ADD COLUMN IF NOT EXISTS arch            text    DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS progress        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tooth_count     integer,
  ADD COLUMN IF NOT EXISTS result_summary  jsonb,
  ADD COLUMN IF NOT EXISTS ai_version      text,
  ADD COLUMN IF NOT EXISTS error_message   text;

-- ── 2. ai_treatment_proposals: reviewed_by → profiles (empty) → auth_users ─────

ALTER TABLE ai_treatment_proposals
  DROP CONSTRAINT IF EXISTS ai_treatment_proposals_reviewed_by_fkey;

ALTER TABLE ai_treatment_proposals
  ADD CONSTRAINT ai_treatment_proposals_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ── 3. segmentation_corrections: applied_by → profiles (empty) → auth_users ────

ALTER TABLE segmentation_corrections
  DROP CONSTRAINT IF EXISTS segmentation_corrections_applied_by_fkey;

ALTER TABLE segmentation_corrections
  ADD CONSTRAINT segmentation_corrections_applied_by_fkey
  FOREIGN KEY (applied_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ── 4. treatment_plans: created_by → profiles (empty) → auth_users ──────────────

-- Null out any created_by values that exist in profiles but not in auth_users
-- (legacy seed data from before the profiles→auth_users migration)
UPDATE treatment_plans
  SET created_by = NULL
  WHERE created_by IS NOT NULL
    AND created_by NOT IN (SELECT id FROM auth_users);

ALTER TABLE treatment_plans
  DROP CONSTRAINT IF EXISTS treatment_plans_created_by_fkey;

ALTER TABLE treatment_plans
  ADD CONSTRAINT treatment_plans_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;
