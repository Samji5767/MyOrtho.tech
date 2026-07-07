-- Migration 048: add description column to feature_flags
-- Idempotent: ADD COLUMN IF NOT EXISTS is safe on re-run.

ALTER TABLE feature_flags
  ADD COLUMN IF NOT EXISTS description TEXT;
