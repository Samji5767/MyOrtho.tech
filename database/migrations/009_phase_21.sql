-- Phase 21: Advanced AI Segmentation, Treatment Workspace, AI Proposals, Pre-export QA, Manufacturing Prep
-- Idempotent: uses IF NOT EXISTS / ON CONFLICT DO NOTHING

-- ─── AI Segmentation Jobs ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS segmentation_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scan_id          UUID        REFERENCES scans(id) ON DELETE SET NULL,
  model_type       TEXT        NOT NULL DEFAULT 'cpu' CHECK (model_type IN ('monai','nnunet','onnx','pytorch','cpu')),
  arch             TEXT        CHECK (arch IN ('upper','lower','both')),
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  progress         INTEGER     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  tooth_count      INTEGER,
  result_summary   JSONB       NOT NULL DEFAULT '{}',
  error_message    TEXT,
  ai_version       TEXT        NOT NULL DEFAULT '1.0.0',
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  submitted_by     UUID        REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segmentation_jobs_case   ON segmentation_jobs(case_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_jobs_status ON segmentation_jobs(status);

-- ─── Tooth Segments (per-job) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tooth_segments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID        NOT NULL REFERENCES segmentation_jobs(id) ON DELETE CASCADE,
  case_id           UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  tooth_number      INTEGER     NOT NULL,            -- FDI notation primary
  universal_number  INTEGER,                         -- Universal notation mirror
  label             TEXT        NOT NULL,
  arch              TEXT        CHECK (arch IN ('upper','lower')),
  confidence        DECIMAL(5,4) CHECK (confidence BETWEEN 0 AND 1),
  mesh_path         TEXT,
  landmark_data     JSONB       NOT NULL DEFAULT '{}',
  bounding_box      JSONB       NOT NULL DEFAULT '{}',
  surface_area_mm2  DECIMAL(10,3),
  volume_mm3        DECIMAL(10,3),
  is_impacted       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_missing        BOOLEAN     NOT NULL DEFAULT FALSE,
  is_supernumerary  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_locked         BOOLEAN     NOT NULL DEFAULT FALSE,
  version           INTEGER     NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, tooth_number)
);

CREATE INDEX IF NOT EXISTS idx_tooth_segments_job  ON tooth_segments(job_id);
CREATE INDEX IF NOT EXISTS idx_tooth_segments_case ON tooth_segments(case_id);

-- ─── Segmentation Corrections ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS segmentation_corrections (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID        NOT NULL REFERENCES segmentation_jobs(id) ON DELETE CASCADE,
  tooth_number        INTEGER,
  correction_type     TEXT        NOT NULL CHECK (correction_type IN (
                        'fix_geometry','improve_segmentation','repair_mesh',
                        'recalculate_landmarks','rebuild_tooth','merge_teeth',
                        'split_tooth','fill_hole','smooth_boundary',
                        'smart_grow','smart_shrink','lock_region','unlock_region'
                      )),
  before_confidence   DECIMAL(5,4),
  after_confidence    DECIMAL(5,4),
  details             JSONB       NOT NULL DEFAULT '{}',
  applied_by          UUID        REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seg_corrections_job ON segmentation_corrections(job_id);

-- ─── AI Treatment Proposals ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_treatment_proposals (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                 UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  treatment_plan_id       UUID        REFERENCES treatment_plans(id) ON DELETE SET NULL,
  organization_id         UUID        NOT NULL REFERENCES organizations(id),
  status                  TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','accepted','rejected')),
  angle_classification    TEXT        CHECK (angle_classification IN ('I','II_div1','II_div2','III')),
  ideal_occlusion         JSONB       NOT NULL DEFAULT '{}',
  movement_sequence       JSONB       NOT NULL DEFAULT '[]',
  estimated_stages        INTEGER,
  suggested_attachments   JSONB       NOT NULL DEFAULT '[]',
  suggested_ipr           JSONB       NOT NULL DEFAULT '[]',
  anchorage_recs          JSONB       NOT NULL DEFAULT '[]',
  expansion_recs          JSONB       NOT NULL DEFAULT '[]',
  predicted_duration_weeks INTEGER,
  refinement_probability  DECIMAL(4,3) CHECK (refinement_probability BETWEEN 0 AND 1),
  complexity_score        DECIMAL(4,3) CHECK (complexity_score BETWEEN 0 AND 1),
  ai_notes                TEXT,
  reviewed_by             UUID        REFERENCES profiles(id),
  reviewed_at             TIMESTAMPTZ,
  review_notes            TEXT,
  generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_proposals_case ON ai_treatment_proposals(case_id);

-- ─── Pre-export QA Reports ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS preexport_qa_reports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  treatment_plan_id UUID       REFERENCES treatment_plans(id) ON DELETE SET NULL,
  organization_id  UUID        NOT NULL REFERENCES organizations(id),
  generated_by     UUID        REFERENCES profiles(id),
  overall_status   TEXT        NOT NULL DEFAULT 'pending' CHECK (overall_status IN ('pending','passed','warnings','failed')),
  pass_count       INTEGER     NOT NULL DEFAULT 0,
  warning_count    INTEGER     NOT NULL DEFAULT 0,
  fail_count       INTEGER     NOT NULL DEFAULT 0,
  checks           JSONB       NOT NULL DEFAULT '[]',
  flagged_items    JSONB       NOT NULL DEFAULT '[]',
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by      UUID        REFERENCES profiles(id),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preexport_qa_case ON preexport_qa_reports(case_id);

-- ─── Manufacture Export Jobs ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS manufacture_exports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  treatment_plan_id UUID       REFERENCES treatment_plans(id) ON DELETE SET NULL,
  organization_id  UUID        NOT NULL REFERENCES organizations(id),
  export_format    TEXT        NOT NULL CHECK (export_format IN ('stl','obj','ply','3mf','zip')),
  export_type      TEXT        NOT NULL CHECK (export_type IN (
                     'stage_models','aligner_models','attachment_models',
                     'ibt','surgical_guide','full_case','qa_report'
                   )),
  stage_range_from INTEGER,
  stage_range_to   INTEGER,
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  file_path        TEXT,
  file_size_bytes  BIGINT,
  manifest         JSONB       NOT NULL DEFAULT '{}',
  error_message    TEXT,
  generated_by     UUID        REFERENCES profiles(id),
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manufacture_exports_case   ON manufacture_exports(case_id);
CREATE INDEX IF NOT EXISTS idx_manufacture_exports_status ON manufacture_exports(status);
