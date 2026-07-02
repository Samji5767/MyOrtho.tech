-- Migration 030: Phase 25 — Security hardening and query performance improvements
-- Adds indexes for admin audit queries and tooth movement records,
-- and hardens the admin audit trail with missing indexes.

BEGIN;

-- ── Audit events: index for actor-based lookups (admin audit trail) ───────────
CREATE INDEX IF NOT EXISTS idx_audit_events_actor
  ON audit_events(actor_id, created_at DESC);

-- ── Workflow events: index for actor-based lookups ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workflow_events_actor
  ON workflow_events(actor_id, created_at DESC);

-- ── Tooth movement records: index for setup history ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_tooth_movement_records_setup
  ON tooth_movement_records(digital_setup_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_tooth_movement_records_tooth
  ON tooth_movement_records(digital_setup_id, tooth_fdi, created_at ASC);

-- ── Aligner stages: index for bulk generate performance ──────────────────────
-- Conditional: VPS databases may have aligner_stages with plan_id (old schema)
-- and no treatment_plan_id column. migration 038 adds it idempotently.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'aligner_stages' AND column_name = 'treatment_plan_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_aligner_stages_plan ON aligner_stages(treatment_plan_id, stage_number ASC)';
  END IF;
END $$;

-- ── AI segmentation jobs: compound index for case+status polling ──────────────
CREATE INDEX IF NOT EXISTS idx_ai_segmentation_jobs_case_status
  ON ai_segmentation_jobs(case_id, job_status)
  WHERE case_id IS NOT NULL;

-- ── Digital setups: index for case listing (version history) ─────────────────
CREATE INDEX IF NOT EXISTS idx_digital_setups_case_created
  ON digital_setups(case_id, created_at DESC)
  WHERE case_id IS NOT NULL;

-- ── Cases: status-based indexes for workflow queries ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_cases_status_updated
  ON cases(status, updated_at DESC);

-- ── Feature flags: index for flag_key lookups ─────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_key
  ON feature_flags(flag_key);

COMMIT;
