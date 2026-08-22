-- ============================================================================
-- Migration 076: relax legacy aligner_stages.plan_id
--
-- Background: schema.sql creates aligner_stages with plan_id uuid NOT NULL.
-- Migration 038 added treatment_plan_id (the column the application writes)
-- but left the legacy plan_id NOT NULL with no default, so on any database
-- built from schema.sql every stage INSERT fails with a not-null violation.
-- No code reads or writes plan_id.
--
-- This migration backfills plan_id from treatment_plan_id for consistency and
-- drops the NOT NULL constraint so application inserts succeed.
--
-- Safe to re-run: all operations are guarded.
-- ============================================================================

DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_stages' AND column_name = 'plan_id'
  ) THEN
    EXECUTE $q$UPDATE aligner_stages
       SET plan_id = treatment_plan_id
     WHERE plan_id IS NULL AND treatment_plan_id IS NOT NULL$q$;
    EXECUTE $q$ALTER TABLE aligner_stages ALTER COLUMN plan_id DROP NOT NULL$q$;
  END IF;
END $mig$;
