-- ============================================================================
-- Migration 078: clinical review sign-off on segmentation jobs
--
-- Adds reviewer identity, timestamp, decision, and note to segmentation_jobs
-- so a licensed clinician can approve or reject a segmentation result. The
-- review is separate from the pipeline status: approval of a review_required
-- job resolves it to completed; a rejection records the verdict without
-- destroying the job history.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS throughout.
-- ============================================================================

ALTER TABLE segmentation_jobs ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE segmentation_jobs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE segmentation_jobs ADD COLUMN IF NOT EXISTS review_decision VARCHAR(16);
ALTER TABLE segmentation_jobs ADD COLUMN IF NOT EXISTS review_note TEXT;

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'segmentation_jobs_review_decision_check'
  ) THEN
    ALTER TABLE segmentation_jobs
      ADD CONSTRAINT segmentation_jobs_review_decision_check
      CHECK (review_decision IS NULL OR review_decision IN ('approved', 'rejected'));
  END IF;
END $mig$;

-- The relabel workflow records a 'relabel' correction; the original 13-value
-- CHECK from migration 009 predates it. Recreate the constraint with the new
-- value (idempotent: the final constraint always has the full list).
DO $mig$
BEGIN
  ALTER TABLE segmentation_corrections
    DROP CONSTRAINT IF EXISTS segmentation_corrections_correction_type_check;
  ALTER TABLE segmentation_corrections
    ADD CONSTRAINT segmentation_corrections_correction_type_check
    CHECK (correction_type IN (
      'fix_geometry', 'improve_segmentation', 'repair_mesh',
      'recalculate_landmarks', 'rebuild_tooth', 'merge_teeth',
      'split_tooth', 'fill_hole', 'smooth_boundary',
      'smart_grow', 'smart_shrink', 'lock_region', 'unlock_region',
      'relabel'
    ));
END $mig$;
