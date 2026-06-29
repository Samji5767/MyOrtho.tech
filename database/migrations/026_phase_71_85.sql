-- Phase 71: Digital Imaging
CREATE TABLE IF NOT EXISTS radiology_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES cases(id),
  image_type      TEXT NOT NULL DEFAULT 'panoramic' CHECK (image_type IN ('panoramic','periapical','bitewing','lateral_ceph','cbct','intraoral','photo')),
  file_url        TEXT NOT NULL,
  capture_date    DATE,
  notes           TEXT,
  uploaded_by     UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_radio_case ON radiology_images(case_id, organization_id);

-- Phase 72: Occlusion Analysis
CREATE TABLE IF NOT EXISTS occlusion_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  analysis_date   DATE NOT NULL,
  angle_class     TEXT CHECK (angle_class IN ('I','II_div1','II_div2','III')),
  overjet_mm      NUMERIC(4,2),
  overbite_mm     NUMERIC(4,2),
  midline_shift_mm NUMERIC(4,2),
  crossbite_teeth INTEGER[],
  open_bite_teeth  INTEGER[],
  crowding_upper_mm NUMERIC(5,2),
  crowding_lower_mm NUMERIC(5,2),
  tmj_findings    TEXT,
  notes           TEXT,
  recorded_by     UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_occl_case ON occlusion_analyses(case_id);

-- Phase 73: Growth Prediction
CREATE TABLE IF NOT EXISTS growth_predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL,
  skeletal_age_years NUMERIC(4,1),
  cervical_maturation_stage TEXT CHECK (cervical_maturation_stage IN ('CS1','CS2','CS3','CS4','CS5','CS6')),
  growth_potential TEXT CHECK (growth_potential IN ('pre_peak','peak','post_peak','complete')),
  mandibular_growth_remaining_mm NUMERIC(4,1),
  predicted_adult_class TEXT,
  recommendations TEXT,
  recorded_by     UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_growth_patient ON growth_predictions(patient_id, organization_id);

-- Phase 74: Multi-Site Management
CREATE TABLE IF NOT EXISTS org_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address_line1   TEXT,
  city            TEXT,
  state           TEXT,
  postal_code     TEXT,
  country         TEXT NOT NULL DEFAULT 'US',
  phone           TEXT,
  email           TEXT,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  timezone        TEXT NOT NULL DEFAULT 'America/New_York',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_locations_org ON org_locations(organization_id, active);

-- Phase 75: Emergency Protocols
CREATE TABLE IF NOT EXISTS emergency_protocols (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  protocol_name   TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'medical' CHECK (category IN ('medical','allergy','trauma','equipment','evacuation')),
  steps           JSONB NOT NULL DEFAULT '[]',
  last_reviewed   DATE,
  reviewed_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 77: Attachment Library
CREATE TABLE IF NOT EXISTS attachment_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  attachment_type TEXT NOT NULL DEFAULT 'optimized' CHECK (attachment_type IN ('optimized','conventional','auxiliary','power_ridge','bite_ramp')),
  tooth_types     TEXT[] NOT NULL DEFAULT '{}',
  geometry        JSONB NOT NULL DEFAULT '{}',
  notes           TEXT,
  is_global       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_att_tmpl_org ON attachment_templates(organization_id, attachment_type);

-- Phase 78: Movement Constraints
CREATE TABLE IF NOT EXISTS movement_constraints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  max_translation_mm NUMERIC(4,2) NOT NULL DEFAULT 0.30,
  max_rotation_deg   NUMERIC(4,1) NOT NULL DEFAULT 3.0,
  max_torque_deg     NUMERIC(4,1) NOT NULL DEFAULT 3.5,
  max_tip_deg        NUMERIC(4,1) NOT NULL DEFAULT 4.0,
  max_intrusion_mm   NUMERIC(4,2) NOT NULL DEFAULT 0.40,
  max_extrusion_mm   NUMERIC(4,2) NOT NULL DEFAULT 0.75,
  is_default         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_constraints_org ON movement_constraints(organization_id);

-- Phase 84: Print Farm
CREATE TABLE IF NOT EXISTS print_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  printer_id      UUID,
  case_id         UUID REFERENCES cases(id),
  job_name        TEXT NOT NULL,
  material        TEXT NOT NULL DEFAULT 'ortho_resin',
  layer_height_um INTEGER NOT NULL DEFAULT 50,
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','printing','post_processing','qc','completed','failed')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  print_duration_minutes INTEGER,
  notes           TEXT,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_print_jobs_org ON print_jobs(organization_id, status, created_at DESC);

-- Phase 85: Batch Manufacturing
CREATE TABLE IF NOT EXISTS manufacturing_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_number    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'staging' CHECK (status IN ('staging','printing','post_processing','qc','shipped','cancelled')),
  case_ids        UUID[] NOT NULL DEFAULT '{}',
  scheduled_date  DATE,
  shipped_at      TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, batch_number)
);
CREATE INDEX IF NOT EXISTS idx_batches_org ON manufacturing_batches(organization_id, status, scheduled_date);
