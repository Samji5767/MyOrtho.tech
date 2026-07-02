-- Migration 039: Extended clinical analysis columns on case_analyses
-- Adds arch-length discrepancy, Little's Irregularity Index, treatment difficulty,
-- space analysis (JSONB), and crowding severity classification.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'case_analyses' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'case_analyses' AND column_name = 'arch_length_discrepancy_upper') THEN
      EXECUTE 'ALTER TABLE case_analyses
        ADD COLUMN arch_length_discrepancy_upper NUMERIC(6,2),
        ADD COLUMN arch_length_discrepancy_lower NUMERIC(6,2),
        ADD COLUMN littles_irregularity_index    NUMERIC(6,2),
        ADD COLUMN treatment_difficulty_index    INTEGER,
        ADD COLUMN space_analysis                JSONB,
        ADD COLUMN crowding_severity             VARCHAR(20)
          CHECK (crowding_severity IN (''none'',''mild'',''moderate'',''severe''))';
    END IF;
  END IF;
END $$;
