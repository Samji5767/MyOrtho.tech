-- Migration 040: Stage Quality Validation and Manufacturing Readiness
-- Adds a JSONB column to cache quality reports on generation plans.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'aligner_generation_plans' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'aligner_generation_plans' AND column_name = 'quality_report') THEN
      EXECUTE 'ALTER TABLE aligner_generation_plans ADD COLUMN quality_report JSONB';
    END IF;
  END IF;
END $$;
