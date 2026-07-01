-- Phase 23: AI Autonomous Treatment Planning & Digital Setup Studio
-- Migration: 028_phase_23_treatment_planning.sql

BEGIN;

-- ============================================================
-- STL Uploads Tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS stl_uploads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL,
  case_id           uuid REFERENCES cases(id) ON DELETE SET NULL,
  patient_id        uuid REFERENCES patients(id) ON DELETE SET NULL,
  file_name         text NOT NULL,
  file_size_bytes   bigint,
  storage_path      text NOT NULL,
  arch_type         text NOT NULL DEFAULT 'unknown'
                      CHECK (arch_type IN ('maxillary','mandibular','bite_registration','unknown')),
  status            text NOT NULL DEFAULT 'uploaded',
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stl_uploads_org      ON stl_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_stl_uploads_case     ON stl_uploads(case_id);
CREATE INDEX IF NOT EXISTS idx_stl_uploads_patient  ON stl_uploads(patient_id);

-- ============================================================
-- Scan Validation Results (Step 1)
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_validations (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL,
  stl_upload_id             uuid NOT NULL REFERENCES stl_uploads(id) ON DELETE CASCADE,
  quality_score             int CHECK (quality_score BETWEEN 0 AND 100),
  confidence                numeric(4,3),
  is_watertight             bool,
  has_inverted_normals      bool,
  has_duplicate_vertices    bool,
  has_non_manifold_edges    bool,
  has_self_intersections    bool,
  vertex_count              int,
  face_count                int,
  is_arch_complete          bool,
  missing_teeth_detected    text[],
  has_excessive_noise       bool,
  trimming_quality          text,
  orientation_status        text,
  auto_fix_suggestions      jsonb NOT NULL DEFAULT '[]',
  issues                    jsonb NOT NULL DEFAULT '[]',
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_validations_org    ON scan_validations(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_validations_upload ON scan_validations(stl_upload_id);

-- ============================================================
-- Scan Processing Results (Step 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_processing (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL,
  stl_upload_id             uuid NOT NULL REFERENCES stl_uploads(id) ON DELETE CASCADE,
  arch_type                 text,
  orientation_matrix        jsonb,
  occlusal_plane            jsonb,
  midline_deviation_mm      numeric(6,3),
  gingival_trim_applied     bool,
  islands_removed           int,
  holes_filled              int,
  scale_factor              numeric(8,6),
  bite_registration_estimate jsonb,
  confidence                numeric(4,3),
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_processing_org    ON scan_processing(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_processing_upload ON scan_processing(stl_upload_id);

-- ============================================================
-- Tooth Segmentation (Step 3)
-- ============================================================
CREATE TABLE IF NOT EXISTS tooth_segmentations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  stl_upload_id       uuid NOT NULL REFERENCES stl_uploads(id) ON DELETE CASCADE,
  teeth               jsonb NOT NULL DEFAULT '[]',
  overall_confidence  numeric(4,3),
  status              text NOT NULL DEFAULT 'pending',
  clinician_reviewed  bool NOT NULL DEFAULT false,
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tooth_segmentations_org    ON tooth_segmentations(organization_id);
CREATE INDEX IF NOT EXISTS idx_tooth_segmentations_upload ON tooth_segmentations(stl_upload_id);

-- ============================================================
-- Tooth Identification (Step 4)
-- ============================================================
CREATE TABLE IF NOT EXISTS tooth_identifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  segmentation_id     uuid NOT NULL REFERENCES tooth_segmentations(id) ON DELETE CASCADE,
  tooth_map           jsonb NOT NULL DEFAULT '[]',
  missing_teeth       text[],
  supernumerary_teeth text[],
  retained_deciduous  text[],
  impacted_teeth      text[],
  extracted_teeth     text[],
  ai_confidence       numeric(4,3),
  clinician_reviewed  bool NOT NULL DEFAULT false,
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tooth_identifications_org ON tooth_identifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_tooth_identifications_seg ON tooth_identifications(segmentation_id);

-- ============================================================
-- Clinical Analysis (Step 5)
-- ============================================================
CREATE TABLE IF NOT EXISTS clinical_analyses (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL,
  case_id                     uuid REFERENCES cases(id) ON DELETE SET NULL,
  stl_upload_id               uuid,
  bolton_anterior_ratio       numeric(6,3),
  bolton_overall_ratio        numeric(6,3),
  bolton_discrepancy_mm       numeric(6,3),
  arch_length_upper_mm        numeric(7,3),
  arch_length_lower_mm        numeric(7,3),
  arch_length_discrepancy_mm  numeric(7,3),
  crowding_upper_mm           numeric(7,3),
  crowding_lower_mm           numeric(7,3),
  spacing_upper_mm            numeric(7,3),
  spacing_lower_mm            numeric(7,3),
  overjet_mm                  numeric(6,3),
  overbite_mm                 numeric(6,3),
  overbite_percent            numeric(5,2),
  curve_of_spee_mm            numeric(5,2),
  midline_deviation_mm        numeric(6,3),
  midline_direction           text,
  angle_class                 text,
  canine_relationship_right   text,
  canine_relationship_left    text,
  molar_relationship_right    text,
  molar_relationship_left     text,
  upper_arch_width_mm         numeric(6,3),
  lower_arch_width_mm         numeric(6,3),
  transverse_discrepancy_mm   numeric(6,3),
  occlusal_contacts           jsonb,
  diagnostic_summary          text,
  confidence                  numeric(4,3),
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_analyses_org  ON clinical_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_clinical_analyses_case ON clinical_analyses(case_id);

-- ============================================================
-- Treatment Goals AI (Step 6)
-- ============================================================
CREATE TABLE IF NOT EXISTS treatment_goals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL,
  case_id                 uuid REFERENCES cases(id) ON DELETE SET NULL,
  clinical_analysis_id    uuid,
  ideal_arch_form         text,
  predicted_duration_weeks int,
  predicted_aligner_count  int,
  predicted_refinement_count int,
  total_ipr_upper_mm      numeric(6,3),
  total_ipr_lower_mm      numeric(6,3),
  anchorage_strategy      text,
  retention_strategy      text,
  tooth_movements         jsonb NOT NULL DEFAULT '[]',
  attachment_plan         jsonb NOT NULL DEFAULT '[]',
  ipr_plan                jsonb NOT NULL DEFAULT '[]',
  confidence              numeric(4,3),
  rationale               text,
  clinician_modified      bool NOT NULL DEFAULT false,
  clinician_notes         text,
  status                  text NOT NULL DEFAULT 'pending',
  approved_by             uuid,
  approved_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treatment_goals_org  ON treatment_goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_treatment_goals_case ON treatment_goals(case_id);

-- ============================================================
-- Digital Setup (Step 7)
-- ============================================================
CREATE TABLE IF NOT EXISTS digital_setups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  case_id             uuid REFERENCES cases(id) ON DELETE SET NULL,
  treatment_goal_id   uuid,
  name                text NOT NULL DEFAULT 'Setup 1',
  tooth_positions     jsonb NOT NULL DEFAULT '[]',
  initial_positions   jsonb NOT NULL DEFAULT '[]',
  status              text NOT NULL DEFAULT 'draft',
  version             int NOT NULL DEFAULT 1,
  created_by          uuid,
  approved_by         uuid,
  approved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_setups_org  ON digital_setups(organization_id);
CREATE INDEX IF NOT EXISTS idx_digital_setups_case ON digital_setups(case_id);

-- ============================================================
-- Tooth Movement Audit Trail
-- ============================================================
CREATE TABLE IF NOT EXISTS tooth_movement_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  digital_setup_id    uuid NOT NULL REFERENCES digital_setups(id) ON DELETE CASCADE,
  tooth_fdi           text NOT NULL,
  movement_type       text NOT NULL,
  axis                text,
  delta_value         numeric(8,4),
  from_position       jsonb,
  to_position         jsonb,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tooth_movement_records_setup ON tooth_movement_records(digital_setup_id);
CREATE INDEX IF NOT EXISTS idx_tooth_movement_records_org   ON tooth_movement_records(organization_id);

-- ============================================================
-- Biomechanical Analysis (Step 8)
-- ============================================================
CREATE TABLE IF NOT EXISTS biomechanical_analyses (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL,
  digital_setup_id            uuid NOT NULL REFERENCES digital_setups(id) ON DELETE CASCADE,
  movement_feasible           bool,
  has_collisions              bool,
  collision_pairs             jsonb NOT NULL DEFAULT '[]',
  max_pdl_stress_percentage   numeric(5,2),
  pdl_overload_teeth          text[],
  excessive_movements         jsonb NOT NULL DEFAULT '[]',
  anchorage_demand_score      int,
  ipr_requirements            jsonb NOT NULL DEFAULT '[]',
  attachment_requirements     jsonb NOT NULL DEFAULT '[]',
  root_collision_risk         text[],
  aligner_force_estimates     jsonb NOT NULL DEFAULT '[]',
  staging_feasible            bool,
  recommended_staging         jsonb,
  biomechanical_score         int,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biomechanical_analyses_setup ON biomechanical_analyses(digital_setup_id);
CREATE INDEX IF NOT EXISTS idx_biomechanical_analyses_org   ON biomechanical_analyses(organization_id);

-- ============================================================
-- AI Clinical Assistant Suggestions (Step 9)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_treatment_suggestions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  digital_setup_id    uuid NOT NULL REFERENCES digital_setups(id) ON DELETE CASCADE,
  suggestion_type     text NOT NULL,
  tooth_fdi           text,
  message             text NOT NULL,
  severity            text NOT NULL DEFAULT 'info',
  confidence          numeric(4,3),
  supporting_data     jsonb,
  acknowledged_by     uuid,
  acknowledged_at     timestamptz,
  applied             bool NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_treatment_suggestions_setup ON ai_treatment_suggestions(digital_setup_id);
CREATE INDEX IF NOT EXISTS idx_ai_treatment_suggestions_org   ON ai_treatment_suggestions(organization_id);

-- ============================================================
-- Treatment Stages (Step 10)
-- ============================================================
CREATE TABLE IF NOT EXISTS treatment_stages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  digital_setup_id    uuid NOT NULL REFERENCES digital_setups(id) ON DELETE CASCADE,
  stage_number        int NOT NULL,
  stage_type          text NOT NULL DEFAULT 'active',
  tooth_positions     jsonb NOT NULL DEFAULT '[]',
  tooth_movements     jsonb NOT NULL DEFAULT '[]',
  attachments         jsonb NOT NULL DEFAULT '[]',
  ipr_points          jsonb NOT NULL DEFAULT '[]',
  elastics            jsonb NOT NULL DEFAULT '[]',
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treatment_stages_setup ON treatment_stages(digital_setup_id);
CREATE INDEX IF NOT EXISTS idx_treatment_stages_org   ON treatment_stages(organization_id);

-- ============================================================
-- QA Reports (Step 12)
-- ============================================================
CREATE TABLE IF NOT EXISTS treatment_qa_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL,
  digital_setup_id        uuid NOT NULL REFERENCES digital_setups(id) ON DELETE CASCADE,
  treatment_quality_score int,
  clinical_safety_score   int,
  manufacturing_score     int,
  overall_score           int,
  excessive_movements     jsonb NOT NULL DEFAULT '[]',
  collision_issues        jsonb NOT NULL DEFAULT '[]',
  pdl_warnings            jsonb NOT NULL DEFAULT '[]',
  attachment_warnings     jsonb NOT NULL DEFAULT '[]',
  ipr_warnings            jsonb NOT NULL DEFAULT '[]',
  staging_issues          jsonb NOT NULL DEFAULT '[]',
  export_ready            bool NOT NULL DEFAULT false,
  issues                  jsonb NOT NULL DEFAULT '[]',
  warnings                jsonb NOT NULL DEFAULT '[]',
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treatment_qa_reports_setup ON treatment_qa_reports(digital_setup_id);
CREATE INDEX IF NOT EXISTS idx_treatment_qa_reports_org   ON treatment_qa_reports(organization_id);

-- ============================================================
-- Aligner Designs (Step 13)
-- ============================================================
CREATE TABLE IF NOT EXISTS aligner_designs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  digital_setup_id    uuid NOT NULL REFERENCES digital_setups(id) ON DELETE CASCADE,
  stage_id            uuid REFERENCES treatment_stages(id) ON DELETE SET NULL,
  arch_type           text,
  aligner_number      int,
  trimline_data       jsonb,
  thickness_mm        numeric(4,2) NOT NULL DEFAULT 0.75,
  has_relief          bool NOT NULL DEFAULT false,
  attachment_windows  jsonb NOT NULL DEFAULT '[]',
  pressure_areas      jsonb NOT NULL DEFAULT '[]',
  label               text,
  export_ready        bool NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aligner_designs_setup ON aligner_designs(digital_setup_id);
CREATE INDEX IF NOT EXISTS idx_aligner_designs_org   ON aligner_designs(organization_id);

-- ============================================================
-- Treatment Planning Pipeline Status Tracker
-- ============================================================
CREATE TABLE IF NOT EXISTS treatment_planning_pipeline (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  case_id             uuid REFERENCES cases(id) ON DELETE CASCADE,
  stl_upload_id       uuid,
  current_step        int NOT NULL DEFAULT 1,
  steps_completed     int[] NOT NULL DEFAULT '{}',
  steps_data          jsonb NOT NULL DEFAULT '{}',
  overall_status      text NOT NULL DEFAULT 'pending',
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_treatment_planning_pipeline_case
  ON treatment_planning_pipeline(organization_id, case_id)
  WHERE case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_planning_pipeline_org ON treatment_planning_pipeline(organization_id);

COMMIT;
