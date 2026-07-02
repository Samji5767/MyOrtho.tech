-- Migration 040: Stage Quality Validation and Manufacturing Readiness
-- Adds a JSONB column to cache quality reports on generation plans.

ALTER TABLE aligner_generation_plans ADD COLUMN IF NOT EXISTS quality_report JSONB;
