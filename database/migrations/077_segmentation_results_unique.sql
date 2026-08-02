-- ============================================================================
-- Migration 077: one segmentation result per (case, scan)
--
-- Background: ScansService wrote segmentation_results with a bare
-- ON CONFLICT DO NOTHING and no unique constraint existed, so every status
-- poll of a completed job inserted a duplicate row. Deduplicate (keep the
-- newest row per pair) and add the unique index the upsert targets.
--
-- Safe to re-run: guarded / IF NOT EXISTS.
-- ============================================================================

DO $mig$
BEGIN
  EXECUTE $q$DELETE FROM segmentation_results sr
    USING segmentation_results newer
    WHERE sr.case_id = newer.case_id
      AND sr.scan_id = newer.scan_id
      AND (sr.created_at, sr.ctid) < (newer.created_at, newer.ctid)$q$;
END $mig$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_segmentation_results_case_scan
  ON segmentation_results (case_id, scan_id);
