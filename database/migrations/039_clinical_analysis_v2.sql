-- Migration 039: Extended clinical analysis columns on case_analyses
-- Adds arch-length discrepancy, Little's Irregularity Index, treatment difficulty,
-- space analysis (JSONB), and crowding severity classification.

ALTER TABLE case_analyses
  ADD COLUMN IF NOT EXISTS arch_length_discrepancy_upper NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS arch_length_discrepancy_lower NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS littles_irregularity_index    NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS treatment_difficulty_index    INTEGER,
  ADD COLUMN IF NOT EXISTS space_analysis                JSONB,
  ADD COLUMN IF NOT EXISTS crowding_severity             VARCHAR(20)
    CHECK (crowding_severity IN ('none','mild','moderate','severe'));
