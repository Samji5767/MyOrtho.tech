-- Migration 041: Ensure core orthodontic CAD schema tables exist
--
-- Target workflow tables:
--   stl_uploads, segmented_teeth, tooth_movements, attachments,
--   ipr_points, aligner_stages, treatment_reports, exports, ai_jobs
--
-- This migration adds any tables that are missing from the existing schema.
-- All statements use IF NOT EXISTS / DO $ guards and are fully idempotent.

-- ─── stl_uploads ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stl_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_size_bytes BIGINT,
  arch            TEXT CHECK (arch IN ('upper', 'lower', 'both')),
  scan_type       TEXT CHECK (scan_type IN ('intraoral', 'model', 'cbct', 'study')),
  status          TEXT NOT NULL DEFAULT 'uploaded'
                    CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stl_uploads_case    ON stl_uploads (case_id);
CREATE INDEX IF NOT EXISTS idx_stl_uploads_org     ON stl_uploads (organization_id);
CREATE INDEX IF NOT EXISTS idx_stl_uploads_status  ON stl_uploads (status) WHERE status <> 'ready';

-- If stl_uploads was created by migration 028 (storage_path, no file_url/arch/scan_type),
-- add the columns that 041's CREATE TABLE IF NOT EXISTS would have silently skipped.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'stl_uploads' AND column_name = 'file_url') THEN
    ALTER TABLE stl_uploads ADD COLUMN file_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'stl_uploads' AND column_name = 'arch') THEN
    ALTER TABLE stl_uploads ADD COLUMN arch TEXT CHECK (arch IN ('upper', 'lower', 'both'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'stl_uploads' AND column_name = 'scan_type') THEN
    ALTER TABLE stl_uploads ADD COLUMN scan_type TEXT
      CHECK (scan_type IN ('intraoral', 'model', 'cbct', 'study'));
  END IF;
END $$;

-- ─── segmented_teeth ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS segmented_teeth (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stl_upload_id   UUID NOT NULL REFERENCES stl_uploads(id) ON DELETE CASCADE,
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  fdi_number      SMALLINT NOT NULL CHECK (fdi_number BETWEEN 11 AND 48),
  arch            TEXT NOT NULL CHECK (arch IN ('upper', 'lower')),
  mesh_url        TEXT,
  confidence      NUMERIC(5,4) CHECK (confidence BETWEEN 0 AND 1),
  label           TEXT,
  is_present      BOOLEAN NOT NULL DEFAULT TRUE,
  manual_edit     BOOLEAN NOT NULL DEFAULT FALSE,
  ai_job_id       UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stl_upload_id, fdi_number)
);

CREATE INDEX IF NOT EXISTS idx_segmented_teeth_case   ON segmented_teeth (case_id);
CREATE INDEX IF NOT EXISTS idx_segmented_teeth_upload ON segmented_teeth (stl_upload_id);

-- ─── tooth_movements ──────────────────────────────────────────────────────────

DO $ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tooth_movements'
  ) THEN
    CREATE TABLE tooth_movements (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      setup_id        UUID REFERENCES digital_setups(id) ON DELETE SET NULL,
      fdi_number      SMALLINT NOT NULL CHECK (fdi_number BETWEEN 11 AND 48),
      stage_index     SMALLINT NOT NULL DEFAULT 0,
      -- Translation (mm)
      tx              NUMERIC(8,4) NOT NULL DEFAULT 0,
      ty              NUMERIC(8,4) NOT NULL DEFAULT 0,
      tz              NUMERIC(8,4) NOT NULL DEFAULT 0,
      -- Rotation (degrees)
      rx              NUMERIC(8,4) NOT NULL DEFAULT 0,
      ry              NUMERIC(8,4) NOT NULL DEFAULT 0,
      rz              NUMERIC(8,4) NOT NULL DEFAULT 0,
      -- Torque / tip / rotation (clinical labels)
      torque          NUMERIC(6,2),
      tip             NUMERIC(6,2),
      rotation        NUMERIC(6,2),
      intrusion       NUMERIC(6,2),
      created_by      UUID REFERENCES profiles(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (case_id, fdi_number, stage_index)
    );
    CREATE INDEX idx_tooth_movements_case    ON tooth_movements (case_id);
    CREATE INDEX idx_tooth_movements_setup   ON tooth_movements (setup_id);
    CREATE INDEX idx_tooth_movements_stage   ON tooth_movements (case_id, stage_index);
  END IF;
END $;

-- ─── attachments ──────────────────────────────────────────────────────────────

DO $ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attachments'
  ) THEN
    CREATE TABLE attachments (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      setup_id        UUID REFERENCES digital_setups(id) ON DELETE SET NULL,
      fdi_number      SMALLINT NOT NULL CHECK (fdi_number BETWEEN 11 AND 48),
      attachment_type TEXT NOT NULL CHECK (attachment_type IN (
        'optimized', 'retention', 'rotation', 'extrusion',
        'intrusion', 'root_control', 'power_ridge', 'beveled', 'precision_cut'
      )),
      surface         TEXT CHECK (surface IN ('buccal', 'lingual', 'mesial', 'distal', 'occlusal')),
      stage_start     SMALLINT NOT NULL DEFAULT 1,
      stage_end       SMALLINT,
      height_mm       NUMERIC(5,2),
      width_mm        NUMERIC(5,2),
      depth_mm        NUMERIC(5,2),
      notes           TEXT,
      created_by      UUID REFERENCES profiles(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_attachments_case   ON attachments (case_id);
    CREATE INDEX idx_attachments_setup  ON attachments (setup_id);
  END IF;
END $;

-- ─── ipr_points ───────────────────────────────────────────────────────────────

DO $ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ipr_points'
  ) THEN
    CREATE TABLE ipr_points (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      setup_id        UUID REFERENCES digital_setups(id) ON DELETE SET NULL,
      fdi_mesial      SMALLINT NOT NULL CHECK (fdi_mesial BETWEEN 11 AND 48),
      fdi_distal      SMALLINT NOT NULL CHECK (fdi_distal BETWEEN 11 AND 48),
      stage_index     SMALLINT NOT NULL DEFAULT 1,
      amount_mm       NUMERIC(4,2) NOT NULL CHECK (amount_mm > 0 AND amount_mm <= 1.5),
      surface         TEXT NOT NULL DEFAULT 'interproximal',
      approved        BOOLEAN NOT NULL DEFAULT FALSE,
      approved_by     UUID REFERENCES profiles(id),
      approved_at     TIMESTAMPTZ,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_ipr_points_case   ON ipr_points (case_id);
    CREATE INDEX idx_ipr_points_stage  ON ipr_points (case_id, stage_index);
  END IF;
END $;

-- ─── aligner_stages ───────────────────────────────────────────────────────────

DO $ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'aligner_stages'
  ) THEN
    CREATE TABLE aligner_stages (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      setup_id        UUID REFERENCES digital_setups(id) ON DELETE SET NULL,
      stage_number    SMALLINT NOT NULL,
      arch            TEXT NOT NULL CHECK (arch IN ('upper', 'lower')),
      stl_url         TEXT,
      thumbnail_url   TEXT,
      wear_weeks      SMALLINT NOT NULL DEFAULT 2,
      status          TEXT NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'generated', 'approved', 'printing', 'delivered', 'worn')),
      generated_at    TIMESTAMPTZ,
      approved_by     UUID REFERENCES profiles(id),
      approved_at     TIMESTAMPTZ,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (case_id, stage_number, arch)
    );
    CREATE INDEX idx_aligner_stages_case    ON aligner_stages (case_id);
    CREATE INDEX idx_aligner_stages_setup   ON aligner_stages (setup_id);
    CREATE INDEX idx_aligner_stages_status  ON aligner_stages (case_id, status);
  END IF;
END $;

-- ─── treatment_reports ────────────────────────────────────────────────────────

DO $ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'treatment_reports'
  ) THEN
    CREATE TABLE treatment_reports (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      report_type     TEXT NOT NULL CHECK (report_type IN (
        'initial_assessment', 'progress', 'completion', 'refinement', 'retention'
      )),
      title           TEXT NOT NULL,
      summary         TEXT,
      content         JSONB NOT NULL DEFAULT '{}',
      generated_by    UUID REFERENCES profiles(id),
      reviewed_by     UUID REFERENCES profiles(id),
      reviewed_at     TIMESTAMPTZ,
      pdf_url         TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_treatment_reports_case ON treatment_reports (case_id);
    CREATE INDEX idx_treatment_reports_org  ON treatment_reports (organization_id);
  END IF;
END $;

-- ─── exports ──────────────────────────────────────────────────────────────────

DO $ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exports'
  ) THEN
    CREATE TABLE exports (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      export_type     TEXT NOT NULL CHECK (export_type IN (
        'stl_aligners', 'stl_models', 'treatment_plan', 'report', 'full_package'
      )),
      format          TEXT NOT NULL CHECK (format IN ('stl', 'obj', 'pdf', 'zip', 'json')),
      status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'generating', 'ready', 'failed', 'expired')),
      file_url        TEXT,
      file_size_bytes BIGINT,
      metadata        JSONB NOT NULL DEFAULT '{}',
      expires_at      TIMESTAMPTZ,
      created_by      UUID REFERENCES profiles(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_exports_case    ON exports (case_id);
    CREATE INDEX idx_exports_status  ON exports (status) WHERE status IN ('pending', 'generating');
  END IF;
END $;

-- ─── ai_jobs ──────────────────────────────────────────────────────────────────

DO $ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_jobs'
  ) THEN
    CREATE TABLE ai_jobs (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      job_type        TEXT NOT NULL CHECK (job_type IN (
        'segmentation', 'landmark_detection', 'treatment_proposal',
        'collision_check', 'autostage', 'root_prediction', 'occlusion_analysis'
      )),
      status          TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
      input_ref       TEXT,
      result          JSONB,
      error_message   TEXT,
      model_version   TEXT,
      duration_ms     INTEGER,
      started_at      TIMESTAMPTZ,
      completed_at    TIMESTAMPTZ,
      created_by      UUID REFERENCES profiles(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_ai_jobs_case    ON ai_jobs (case_id);
    CREATE INDEX idx_ai_jobs_status  ON ai_jobs (status) WHERE status IN ('queued', 'running');
    CREATE INDEX idx_ai_jobs_type    ON ai_jobs (job_type, created_at DESC);
  END IF;
END $;

-- ─── RLS policies ─────────────────────────────────────────────────────────────

DO $ BEGIN
  -- stl_uploads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stl_uploads' AND policyname = 'stl_uploads_org_isolation'
  ) THEN
    ALTER TABLE stl_uploads ENABLE ROW LEVEL SECURITY;
    CREATE POLICY stl_uploads_org_isolation ON stl_uploads
      USING (organization_id = app_current_org_id());
  END IF;

  -- segmented_teeth (scoped via stl_upload → case → org)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'segmented_teeth' AND policyname = 'segmented_teeth_org_isolation'
  ) THEN
    ALTER TABLE segmented_teeth ENABLE ROW LEVEL SECURITY;
    CREATE POLICY segmented_teeth_org_isolation ON segmented_teeth
      USING (
        case_id IN (SELECT id FROM cases WHERE organization_id = app_current_org_id())
      );
  END IF;

  -- exports
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'exports' AND policyname = 'exports_org_isolation'
  ) THEN
    ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
    CREATE POLICY exports_org_isolation ON exports
      USING (organization_id = app_current_org_id());
  END IF;

  -- ai_jobs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_jobs' AND policyname = 'ai_jobs_org_isolation'
  ) THEN
    ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY ai_jobs_org_isolation ON ai_jobs
      USING (organization_id = app_current_org_id());
  END IF;

  -- treatment_reports
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'treatment_reports' AND policyname = 'treatment_reports_org_isolation'
  ) THEN
    ALTER TABLE treatment_reports ENABLE ROW LEVEL SECURITY;
    CREATE POLICY treatment_reports_org_isolation ON treatment_reports
      USING (organization_id = app_current_org_id());
  END IF;
END $;
