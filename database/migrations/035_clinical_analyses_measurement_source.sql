-- Migration 035: Add measurement_source column to clinical_analyses
-- Records which field values were clinician-measured vs. computed vs. not available.
-- Replaces the prior behavior of storing Math.random() values as if they were measurements.

ALTER TABLE clinical_analyses
  ADD COLUMN IF NOT EXISTS measurement_source JSONB DEFAULT '{}'::jsonb;
