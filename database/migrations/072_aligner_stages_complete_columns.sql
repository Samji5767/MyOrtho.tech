-- ============================================================================
-- Migration 072: aligner_stages — complete missing columns
--
-- Background: Migration 038 added treatment_plan_id, case_id, and movement_data
-- for VPS compatibility. The backend stages.service.ts INSERT also writes
-- attachment_data, ipr_data, and velocity_mm_per_week — columns that were never
-- added to schema.sql or any prior migration. The ON CONFLICT clause requires a
-- unique constraint on (treatment_plan_id, stage_number) which was likewise
-- missing.  This migration completes the schema.
--
-- Safe to re-run: all operations use IF NOT EXISTS / DO $$ guards.
-- Does NOT drop or modify existing data.
-- ============================================================================

DO $$
BEGIN

  -- ── attachment_data ──────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'attachment_data'
  ) THEN
    EXECUTE $$ALTER TABLE aligner_stages
      ADD COLUMN attachment_data jsonb NOT NULL DEFAULT '[]'$$;
  END IF;

  -- ── ipr_data ─────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'ipr_data'
  ) THEN
    EXECUTE $$ALTER TABLE aligner_stages
      ADD COLUMN ipr_data jsonb NOT NULL DEFAULT '[]'$$;
  END IF;

  -- ── velocity_mm_per_week ─────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'velocity_mm_per_week'
  ) THEN
    EXECUTE $$ALTER TABLE aligner_stages
      ADD COLUMN velocity_mm_per_week double precision$$;
  END IF;

  -- ── is_approved ───────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'is_approved'
  ) THEN
    EXECUTE $$ALTER TABLE aligner_stages
      ADD COLUMN is_approved boolean NOT NULL DEFAULT false$$;
  END IF;

  -- ── approved_by ───────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'approved_by'
  ) THEN
    EXECUTE $$ALTER TABLE aligner_stages
      ADD COLUMN approved_by uuid REFERENCES auth_users(id) ON DELETE SET NULL$$;
  END IF;

  -- ── approved_at ───────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'approved_at'
  ) THEN
    EXECUTE $$ALTER TABLE aligner_stages
      ADD COLUMN approved_at timestamptz$$;
  END IF;

  -- ── unique constraint required by ON CONFLICT (treatment_plan_id, stage_number)
  -- stages.service.ts uses ON CONFLICT (treatment_plan_id, stage_number) DO UPDATE.
  -- The old schema only had UNIQUE (plan_id, stage_number).  Add the new constraint
  -- only if treatment_plan_id exists (guaranteed by migration 038) and the constraint
  -- is not already present.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_aligner_stages_plan_stage'
  ) THEN
    EXECUTE $$ALTER TABLE aligner_stages
      ADD CONSTRAINT uq_aligner_stages_plan_stage
      UNIQUE (treatment_plan_id, stage_number)$$;
  END IF;

  -- ── index on approved_by for audit queries ────────────────────────────────
  EXECUTE $$CREATE INDEX IF NOT EXISTS idx_aligner_stages_approved_by
    ON aligner_stages(approved_by)
    WHERE approved_by IS NOT NULL$$;

END $$;
