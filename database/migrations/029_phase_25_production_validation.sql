-- Migration 029: Phase 25 — Production validation, clinical accuracy & workflow hardening
-- Adds missing indexes, tightens constraints, and ensures all phase 23–28 tables exist with
-- the correct structure before production deployment.

BEGIN;

-- ── Ensure treatment_planning_pipeline has correct UNIQUE index ────────────────
-- (phase 028 already creates this, but use IF NOT EXISTS for safety)
CREATE UNIQUE INDEX IF NOT EXISTS idx_treatment_planning_pipeline_case_unique
  ON treatment_planning_pipeline(organization_id, case_id)
  WHERE case_id IS NOT NULL;

-- ── Additional performance indexes for case detail lookups ────────────────────
-- These cover the new "linked resources" subquery in cases.service.ts findOne()
CREATE INDEX IF NOT EXISTS idx_stl_uploads_case_created
  ON stl_uploads(case_id, created_at DESC)
  WHERE case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_digital_setups_case_created
  ON digital_setups(case_id, created_at DESC)
  WHERE case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_analyses_case_created
  ON clinical_analyses(case_id, created_at DESC)
  WHERE case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_goals_case_created
  ON treatment_goals(case_id, created_at DESC)
  WHERE case_id IS NOT NULL;

-- treatment_plans are linked via patient_id, not case_id — index for the subquery
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_created
  ON treatment_plans(patient_id, created_at DESC)
  WHERE patient_id IS NOT NULL;

-- ── AI Segmentation job tracking table ────────────────────────────────────────
-- Provides persistent job state that survives AI engine restarts,
-- complementing the Redis-backed in-memory store.
CREATE TABLE IF NOT EXISTS ai_segmentation_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  case_id         uuid REFERENCES cases(id) ON DELETE SET NULL,
  scan_id         uuid REFERENCES stl_uploads(id) ON DELETE SET NULL,
  job_status      text NOT NULL DEFAULT 'queued',
  started_at      timestamptz,
  completed_at    timestamptz,
  teeth_detected  int,
  missing_teeth   int[] NOT NULL DEFAULT '{}',
  confidence_data jsonb NOT NULL DEFAULT '{}',
  error_message   text,
  disclaimer      text NOT NULL DEFAULT 'AI output is not clinically validated.',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_segmentation_jobs_case ON ai_segmentation_jobs(case_id);
CREATE INDEX IF NOT EXISTS idx_ai_segmentation_jobs_scan ON ai_segmentation_jobs(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_segmentation_jobs_status ON ai_segmentation_jobs(job_status);

-- ── Workflow event index for case detail history queries ──────────────────────
CREATE INDEX IF NOT EXISTS idx_workflow_events_case_created
  ON workflow_events(case_id, created_at DESC);

-- ── Audit events index for case audit trail ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_events_resource
  ON audit_events(resource_type, resource_id, created_at DESC);

-- ── Manufacturing readiness: ensure aligner_designs table has required columns ─
-- The manufacturing package panel needs these to generate a complete manifest.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aligner_designs'
      AND column_name = 'print_profile'
  ) THEN
    ALTER TABLE aligner_designs
      ADD COLUMN print_profile    jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN resin_type       text,
      ADD COLUMN layer_height_mm  numeric(4,3),
      ADD COLUMN supports_needed  boolean NOT NULL DEFAULT false,
      ADD COLUMN printable        boolean NOT NULL DEFAULT true,
      ADD COLUMN qa_passed        boolean;
  END IF;
END $$;

-- ── Treatment stages: ensure qa_status column exists ──────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treatment_stages'
      AND column_name = 'qa_status'
  ) THEN
    ALTER TABLE treatment_stages
      ADD COLUMN qa_status        text NOT NULL DEFAULT 'pending',
      ADD COLUMN qa_score         numeric(5,2),
      ADD COLUMN qa_warnings      jsonb NOT NULL DEFAULT '[]',
      ADD COLUMN approved_by      uuid REFERENCES auth_users(id) ON DELETE SET NULL,
      ADD COLUMN approved_at      timestamptz;
  END IF;
END $$;

-- ── Digital setups: ensure version tracking exists ────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'digital_setups'
      AND column_name = 'version'
  ) THEN
    ALTER TABLE digital_setups
      ADD COLUMN version          int NOT NULL DEFAULT 1,
      ADD COLUMN parent_setup_id  uuid REFERENCES digital_setups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Clinical analyses: ensure Bolton analysis fields exist ────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinical_analyses'
      AND column_name = 'bolton_anterior_ratio'
  ) THEN
    ALTER TABLE clinical_analyses
      ADD COLUMN bolton_anterior_ratio  numeric(6,3),
      ADD COLUMN bolton_overall_ratio   numeric(6,3),
      ADD COLUMN bolton_discrepancy_mm  numeric(5,2),
      ADD COLUMN arch_length_upper_mm   numeric(6,2),
      ADD COLUMN arch_length_lower_mm   numeric(6,2),
      ADD COLUMN ald_upper_mm           numeric(5,2),
      ADD COLUMN ald_lower_mm           numeric(5,2),
      ADD COLUMN midline_deviation_mm   numeric(4,2),
      ADD COLUMN curve_of_spee_mm       numeric(4,2),
      ADD COLUMN transverse_discrepancy_mm numeric(5,2);
  END IF;
END $$;

-- ── IPR requirements: ensure contact point precision ─────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ipr_points'
      AND column_name = 'scheduled_at_stage'
  ) THEN
    ALTER TABLE ipr_points
      ADD COLUMN scheduled_at_stage  int,
      ADD COLUMN completed           boolean NOT NULL DEFAULT false,
      ADD COLUMN completed_at        timestamptz,
      ADD COLUMN completed_by        uuid REFERENCES auth_users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Attachment records: ensure placement precision ────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachment_records'
      AND column_name = 'placed_at_stage'
  ) THEN
    ALTER TABLE attachment_records
      ADD COLUMN placed_at_stage     int,
      ADD COLUMN removed_at_stage    int,
      ADD COLUMN placement_confirmed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── Treatment QA reports: ensure completeness score column ────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treatment_qa_reports'
      AND column_name = 'manufacturing_ready'
  ) THEN
    ALTER TABLE treatment_qa_reports
      ADD COLUMN manufacturing_ready  boolean NOT NULL DEFAULT false,
      ADD COLUMN clinical_score       numeric(5,2),
      ADD COLUMN engineering_score    numeric(5,2),
      ADD COLUMN manufacturing_score  numeric(5,2);
  END IF;
END $$;

-- ── Update stl_uploads to track processing stages ─────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stl_uploads'
      AND column_name = 'processing_stage'
  ) THEN
    ALTER TABLE stl_uploads
      ADD COLUMN processing_stage  text NOT NULL DEFAULT 'uploaded',
      ADD COLUMN is_validated      boolean NOT NULL DEFAULT false,
      ADD COLUMN is_processed      boolean NOT NULL DEFAULT false,
      ADD COLUMN quality_score     numeric(5,2),
      ADD COLUMN vertex_count      int,
      ADD COLUMN face_count        int,
      ADD COLUMN is_watertight     boolean;
  END IF;
END $$;

-- ── Biomechanical analyses: ensure setup FK is indexable ──────────────────────
CREATE INDEX IF NOT EXISTS idx_biomechanical_analyses_setup
  ON biomechanical_analyses(digital_setup_id);

CREATE INDEX IF NOT EXISTS idx_treatment_stages_setup
  ON treatment_stages(digital_setup_id);

CREATE INDEX IF NOT EXISTS idx_treatment_qa_reports_setup
  ON treatment_qa_reports(digital_setup_id);

CREATE INDEX IF NOT EXISTS idx_aligner_designs_setup
  ON aligner_designs(digital_setup_id);

-- ── Cases: composite index for organization + status (dashboard queries) ──────
CREATE INDEX IF NOT EXISTS idx_cases_org_status
  ON cases(patient_id)
  WHERE status NOT IN ('completed', 'canceled');

-- ── Ensure updated_at is auto-maintained on key tables via trigger ─────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_digital_setups_updated_at') THEN
    CREATE TRIGGER update_digital_setups_updated_at
      BEFORE UPDATE ON digital_setups
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_treatment_planning_pipeline_updated_at') THEN
    CREATE TRIGGER update_treatment_planning_pipeline_updated_at
      BEFORE UPDATE ON treatment_planning_pipeline
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ai_segmentation_jobs_updated_at') THEN
    CREATE TRIGGER update_ai_segmentation_jobs_updated_at
      BEFORE UPDATE ON ai_segmentation_jobs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMIT;
