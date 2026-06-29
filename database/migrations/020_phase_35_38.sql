-- Phases 35-38: Auto Scan Processing, Off-Track Detection, Quality Scoring, CBCT Fusion, Pricing Tiers

-- ── Phase 35: Auto Scan Processing ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scan_processing_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL,
  scan_id             UUID NOT NULL,
  case_id             UUID NOT NULL,
  job_type            TEXT NOT NULL CHECK (job_type IN (
    'auto_orient', 'auto_cleanup', 'auto_trim', 'full_pipeline'
  )),
  status              TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  duration_ms         INTEGER,
  error_message       TEXT,
  result              JSONB NOT NULL DEFAULT '{}',
  created_by          UUID NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_proc_scan   ON scan_processing_jobs(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_proc_case   ON scan_processing_jobs(case_id);
CREATE INDEX IF NOT EXISTS idx_scan_proc_status ON scan_processing_jobs(status) WHERE status IN ('queued','processing');

CREATE TABLE IF NOT EXISTS scan_orientation_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                UUID NOT NULL REFERENCES scan_processing_jobs(id) ON DELETE CASCADE,
  scan_id               UUID NOT NULL,
  organization_id       UUID NOT NULL,
  detected_arch         TEXT CHECK (detected_arch IN ('maxillary', 'mandibular', 'unknown')),
  occlusal_plane_normal JSONB,   -- {x,y,z} unit vector of occlusal plane
  centroid              JSONB,   -- {x,y,z} model centroid
  bounding_box          JSONB,   -- {minX,maxX,minY,maxY,minZ,maxZ}
  rotation_correction   JSONB,   -- {rx,ry,rz} degrees to apply for standard orientation
  confidence            NUMERIC(5,3),
  applied               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_orient_scan ON scan_orientation_results(scan_id);

CREATE TABLE IF NOT EXISTS scan_cleanup_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                UUID NOT NULL REFERENCES scan_processing_jobs(id) ON DELETE CASCADE,
  scan_id               UUID NOT NULL,
  organization_id       UUID NOT NULL,
  disconnected_removed  INTEGER NOT NULL DEFAULT 0,
  holes_filled          INTEGER NOT NULL DEFAULT 0,
  spikes_smoothed       INTEGER NOT NULL DEFAULT 0,
  vertices_before       INTEGER,
  vertices_after        INTEGER,
  reduction_pct         NUMERIC(5,2),
  trim_plane_z          NUMERIC(8,3),   -- Z coordinate of gingival trim plane
  trimmed_vertices      INTEGER,
  quality_score_before  NUMERIC(5,3),
  quality_score_after   NUMERIC(5,3),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_cleanup_scan ON scan_cleanup_results(scan_id);

CREATE TABLE IF NOT EXISTS tooth_id_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL,
  case_id               UUID NOT NULL,
  scan_id               UUID NOT NULL,
  segmentation_job_id   UUID,
  fdi_number            INTEGER NOT NULL,
  assigned_label        INTEGER NOT NULL,   -- class index from model
  confidence            NUMERIC(5,3),
  centroid_x            NUMERIC(8,3),
  centroid_y            NUMERIC(8,3),
  centroid_z            NUMERIC(8,3),
  arch                  TEXT CHECK (arch IN ('upper', 'lower')),
  is_primary_tooth      BOOLEAN NOT NULL DEFAULT false,
  confirmed_by          UUID,   -- clinician who confirmed this assignment
  confirmed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scan_id, fdi_number)
);

CREATE INDEX IF NOT EXISTS idx_tooth_id_scan  ON tooth_id_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_tooth_id_case  ON tooth_id_results(case_id);

-- ── Phase 36: Off-Track Detection + Treatment Quality Score ─────────────────

CREATE TABLE IF NOT EXISTS treatment_check_ins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL,
  case_id             UUID NOT NULL,
  plan_id             UUID NOT NULL,
  current_stage       INTEGER NOT NULL,
  total_stages        INTEGER NOT NULL,
  check_in_type       TEXT NOT NULL CHECK (check_in_type IN (
    'photo_review', 'scan_comparison', 'clinical_exam', 'patient_self_report'
  )),
  submitted_by        UUID NOT NULL,
  notes               TEXT,
  photo_ids           JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_check_ins_case ON treatment_check_ins(case_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_plan ON treatment_check_ins(plan_id);

CREATE TABLE IF NOT EXISTS off_track_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL,
  case_id             UUID NOT NULL,
  plan_id             UUID NOT NULL,
  check_in_id         UUID REFERENCES treatment_check_ins(id) ON DELETE SET NULL,
  alert_type          TEXT NOT NULL CHECK (alert_type IN (
    'aligner_not_seating', 'movement_lagging', 'patient_non_compliance',
    'unexpected_relapse', 'attachment_detached', 'bite_opening', 'midline_shift'
  )),
  severity            TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  affected_stage      INTEGER,
  affected_teeth      JSONB NOT NULL DEFAULT '[]',
  description         TEXT NOT NULL,
  recommended_action  TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved', 'escalated')),
  resolved_by         UUID,
  resolved_at         TIMESTAMPTZ,
  resolution_note     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_off_track_case   ON off_track_alerts(case_id);
CREATE INDEX IF NOT EXISTS idx_off_track_status ON off_track_alerts(status) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS treatment_quality_scores (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL,
  plan_id                 UUID NOT NULL UNIQUE,
  overall_score           NUMERIC(5,3) NOT NULL,
  grade                   TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
  -- Component scores
  movement_safety_score   NUMERIC(5,3),
  pdl_safety_score        NUMERIC(5,3),
  ipr_safety_score        NUMERIC(5,3),
  attachment_score        NUMERIC(5,3),
  simulation_score        NUMERIC(5,3),
  arch_coord_score        NUMERIC(5,3),
  retention_score         NUMERIC(5,3),
  export_readiness_score  NUMERIC(5,3),
  -- Flags
  has_critical_issues     BOOLEAN NOT NULL DEFAULT false,
  critical_issue_count    INTEGER NOT NULL DEFAULT 0,
  warning_count           INTEGER NOT NULL DEFAULT 0,
  score_breakdown         JSONB NOT NULL DEFAULT '{}',
  recommendations         JSONB NOT NULL DEFAULT '[]',
  scored_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  scored_by               UUID
);

CREATE INDEX IF NOT EXISTS idx_quality_scores_plan ON treatment_quality_scores(plan_id);
CREATE INDEX IF NOT EXISTS idx_quality_scores_org  ON treatment_quality_scores(organization_id);

-- ── Phase 37: Pricing Tiers ─────────────────────────────────────────────────

-- Upsert the two canonical subscription plans
INSERT INTO subscription_plans (slug, name, price_usd_cents, max_cases_per_month, is_unlimited, is_active)
VALUES
  ('unlimited_professional', 'Unlimited Professional', 49900, NULL, true, true),
  ('payg', 'Pay-As-You-Go', 0, NULL, false, true)
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name,
  price_usd_cents=EXCLUDED.price_usd_cents,
  max_cases_per_month=EXCLUDED.max_cases_per_month,
  is_unlimited=EXCLUDED.is_unlimited,
  is_active=EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS export_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL,
  plan_id             UUID,
  export_package_id   UUID,
  transaction_type    TEXT NOT NULL CHECK (transaction_type IN (
    'payg_export', 'subscription_charge', 'credit_use', 'refund'
  )),
  amount_cents        INTEGER NOT NULL,
  description         TEXT NOT NULL,
  stripe_payment_id   TEXT,
  credit_balance_after INTEGER,
  status              TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_txn_org  ON export_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_txn_plan ON export_transactions(plan_id) WHERE plan_id IS NOT NULL;

-- ── Phase 38: CBCT Fusion ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cbct_scans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL,
  case_id             UUID NOT NULL,
  original_filename   TEXT,
  file_path           TEXT NOT NULL,
  file_format         TEXT NOT NULL CHECK (file_format IN ('dicom', 'dcm_zip', 'nifti', 'raw')),
  file_size_bytes     BIGINT,
  voxel_size_mm       NUMERIC(6,3),
  fov_mm              NUMERIC(8,2),
  kvp                 INTEGER,
  ma                  INTEGER,
  acquisition_date    DATE,
  uploaded_by         UUID NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cbct_case ON cbct_scans(case_id);

CREATE TABLE IF NOT EXISTS cbct_stl_fusions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL,
  case_id                 UUID NOT NULL,
  cbct_scan_id            UUID NOT NULL REFERENCES cbct_scans(id) ON DELETE CASCADE,
  stl_scan_id             UUID NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  -- Registration matrix (4x4 affine, stored as flat array)
  registration_matrix     JSONB,
  registration_error_mm   NUMERIC(6,4),
  registration_method     TEXT DEFAULT 'icp' CHECK (registration_method IN ('icp', 'surface_match', 'landmark', 'manual')),
  -- Segmentation outputs
  bone_segment_path       TEXT,
  tooth_root_path         TEXT,
  nerve_canal_path        TEXT,
  -- Quality
  fusion_quality_score    NUMERIC(5,3),
  clinician_reviewed      BOOLEAN NOT NULL DEFAULT false,
  reviewed_by             UUID,
  reviewed_at             TIMESTAMPTZ,
  created_by              UUID NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cbct_fusion_case ON cbct_stl_fusions(case_id);
CREATE INDEX IF NOT EXISTS idx_cbct_fusion_cbct ON cbct_stl_fusions(cbct_scan_id);

CREATE TABLE IF NOT EXISTS bone_segments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fusion_id           UUID NOT NULL REFERENCES cbct_stl_fusions(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL,
  segment_type        TEXT NOT NULL CHECK (segment_type IN (
    'maxilla', 'mandible', 'tooth_root', 'nerve_canal', 'sinus', 'condyle'
  )),
  density_hu          NUMERIC(6,1),   -- Hounsfield units
  volume_mm3          NUMERIC(10,2),
  surface_area_mm2    NUMERIC(10,2),
  bone_quality        TEXT CHECK (bone_quality IN ('D1', 'D2', 'D3', 'D4')),
  mesh_path           TEXT,
  fdi_number          INTEGER,   -- for tooth_root segments
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bone_seg_fusion ON bone_segments(fusion_id);
