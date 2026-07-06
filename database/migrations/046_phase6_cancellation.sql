-- Migration 046: Segmentation Job Cancellation Support
-- Adds 'cancelled' to segmentation_jobs.status and a cancelled_reason column.

DO $$ DECLARE
  constraint_name text;
BEGIN
  -- Drop the existing status CHECK constraint (name varies by PostgreSQL version)
  SELECT tc.constraint_name
    INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'segmentation_jobs'
      AND tc.constraint_type = 'CHECK'
      AND tc.constraint_name LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE segmentation_jobs DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE segmentation_jobs
    ADD CONSTRAINT segmentation_jobs_status_check
    CHECK (status IN ('queued','processing','completed','failed','review_required','cancelled'));

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'segmentation_jobs' AND column_name = 'cancelled_reason'
  ) THEN
    ALTER TABLE segmentation_jobs ADD COLUMN cancelled_reason TEXT;
  END IF;
END $$;
