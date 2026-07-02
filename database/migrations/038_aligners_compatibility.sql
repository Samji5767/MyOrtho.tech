-- ============================================================================
-- Migration 038: aligner_stages VPS compatibility
--
-- Background: The VPS database was originally created with an older schema for
-- aligner_stages that used plan_id and movements columns.  Later application
-- versions renamed/added columns (treatment_plan_id, case_id, movement_data).
-- This migration adds the missing columns idempotently and backfills from the
-- existing data.  It is safe to run on both VPS and fresh databases.
--
-- Does NOT drop plan_id, movements, or any existing column.
-- Does NOT break existing data.
-- Safe to re-run: all operations use IF NOT EXISTS / DO $$ guards.
-- ============================================================================

DO $$
BEGIN

  -- ── treatment_plan_id ────────────────────────────────────────────────────
  -- Add if missing (VPS may have plan_id instead)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'treatment_plan_id'
  ) THEN
    EXECUTE 'ALTER TABLE aligner_stages ADD COLUMN treatment_plan_id uuid REFERENCES treatment_plans(id) ON DELETE CASCADE';
  END IF;

  -- Backfill treatment_plan_id from plan_id where both columns exist and target is NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'plan_id'
  ) THEN
    UPDATE aligner_stages
       SET treatment_plan_id = plan_id
     WHERE treatment_plan_id IS NULL AND plan_id IS NOT NULL;
  END IF;

  -- ── case_id ──────────────────────────────────────────────────────────────
  -- Add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'case_id'
  ) THEN
    EXECUTE 'ALTER TABLE aligner_stages ADD COLUMN case_id uuid REFERENCES cases(id) ON DELETE CASCADE';
  END IF;

  -- Backfill case_id from treatment_plans via treatment_plan_id
  UPDATE aligner_stages a
     SET case_id = tp.case_id
    FROM treatment_plans tp
   WHERE a.case_id IS NULL
     AND a.treatment_plan_id IS NOT NULL
     AND a.treatment_plan_id = tp.id;

  -- ── movement_data ────────────────────────────────────────────────────────
  -- Add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'movement_data'
  ) THEN
    EXECUTE 'ALTER TABLE aligner_stages ADD COLUMN movement_data jsonb NOT NULL DEFAULT ''{}''';
  END IF;

  -- Backfill movement_data from movements if the old column still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'movements'
  ) THEN
    UPDATE aligner_stages
       SET movement_data = movements
     WHERE movement_data = '{}'::jsonb
       AND movements IS NOT NULL;
  END IF;

  -- ── indexes ──────────────────────────────────────────────────────────────
  -- Create the case_id index now that the column is guaranteed to exist
  -- (idx_aligner_stages_plan for treatment_plan_id is created by migration 030)
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_aligner_stages_case ON aligner_stages(case_id)';

END $$;
