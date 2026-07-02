-- Migration 035: Add measurement_source column to clinical_analyses
-- Records which field values were clinician-measured vs. computed vs. not available.
-- Replaces the prior behavior of storing Math.random() values as if they were measurements.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'clinical_analyses' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'clinical_analyses' AND column_name = 'measurement_source') THEN
      EXECUTE 'ALTER TABLE clinical_analyses ADD COLUMN measurement_source JSONB DEFAULT ''{}''::jsonb';
    END IF;
  END IF;
END $$;
