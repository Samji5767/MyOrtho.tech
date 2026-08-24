-- ============================================================================
-- Migration 079: aligner generation progress tracking
--
-- generateStl() has been writing generation_progress (status, aligner index,
-- start/complete timestamps, elapsed) wrapped in try/catch because the column
-- never existed — every write silently no-opped. Create it so progress/ETA
-- tracking is actually recorded.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE aligner_generation_plans
  ADD COLUMN IF NOT EXISTS generation_progress JSONB;
