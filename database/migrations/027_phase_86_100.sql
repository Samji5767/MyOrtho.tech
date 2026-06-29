-- Phase 86: Post-Processing Tracking
CREATE TABLE IF NOT EXISTS post_processing_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  print_job_id    UUID,
  step            TEXT NOT NULL DEFAULT 'wash' CHECK (step IN ('wash','cure','support_removal','surface_finish','inspection')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  operator_id     UUID,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_postproc_org ON post_processing_jobs(organization_id, status);

-- Phase 87: Device Tracking / Recall
CREATE TABLE IF NOT EXISTS device_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_code      TEXT NOT NULL,
  device_type     TEXT NOT NULL DEFAULT 'aligner',
  material_lot    TEXT,
  manufacture_date DATE,
  expiry_date     DATE,
  case_ids        UUID[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','recalled','quarantined','expired')),
  recall_reason   TEXT,
  recalled_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, batch_code)
);
CREATE INDEX IF NOT EXISTS idx_device_batches_org ON device_batches(organization_id, status);

-- Phase 88: Material Testing
CREATE TABLE IF NOT EXISTS material_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  material_name   TEXT NOT NULL,
  lot_number      TEXT,
  test_date       DATE NOT NULL,
  test_type       TEXT NOT NULL DEFAULT 'hardness' CHECK (test_type IN ('hardness','tensile','flexural','color_stability','biocompatibility','dimensional')),
  result_value    NUMERIC(10,4),
  result_unit     TEXT,
  pass_threshold  NUMERIC(10,4),
  passed          BOOLEAN,
  tested_by       UUID NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_material_tests_org ON material_tests(organization_id, test_date DESC);

-- Phase 89: Regulatory Device Classification
CREATE TABLE IF NOT EXISTS device_classifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_name     TEXT NOT NULL,
  device_class    TEXT NOT NULL DEFAULT 'II' CHECK (device_class IN ('I','II','III')),
  product_code    TEXT,
  regulation_number TEXT,
  fda_510k_number TEXT,
  predicate_device TEXT,
  intended_use    TEXT,
  is_custom       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_class_org ON device_classifications(organization_id);

-- Phase 91: ML Data Pipeline
CREATE TABLE IF NOT EXISTS ml_datasets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dataset_name    TEXT NOT NULL,
  dataset_type    TEXT NOT NULL DEFAULT 'treatment_outcome',
  record_count    INTEGER NOT NULL DEFAULT 0,
  feature_columns JSONB NOT NULL DEFAULT '[]',
  filters_applied JSONB NOT NULL DEFAULT '{}',
  export_format   TEXT NOT NULL DEFAULT 'csv',
  file_url        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ml_datasets_org ON ml_datasets(organization_id, status);

-- Phase 92: Prediction Model Registry
CREATE TABLE IF NOT EXISTS ml_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  model_name      TEXT NOT NULL,
  model_version   TEXT NOT NULL DEFAULT '1.0',
  model_type      TEXT NOT NULL DEFAULT 'classification',
  target_variable TEXT NOT NULL,
  accuracy        NUMERIC(5,4),
  precision_score NUMERIC(5,4),
  recall_score    NUMERIC(5,4),
  f1_score        NUMERIC(5,4),
  training_samples INTEGER,
  model_url       TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','training','active','deprecated','failed')),
  is_global       BOOLEAN NOT NULL DEFAULT FALSE,
  deployed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, model_name, model_version)
);
CREATE INDEX IF NOT EXISTS idx_ml_models_org ON ml_models(organization_id, status);

-- Phase 95: Patient Intake Forms
CREATE TABLE IF NOT EXISTS intake_form_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_name   TEXT NOT NULL,
  form_type       TEXT NOT NULL DEFAULT 'medical_history' CHECK (form_type IN ('medical_history','consent','questionnaire','registration','insurance')),
  fields          JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intake_templates_org ON intake_form_templates(organization_id, form_type);

CREATE TABLE IF NOT EXISTS intake_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id     UUID NOT NULL REFERENCES intake_form_templates(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id),
  case_id         UUID REFERENCES cases(id),
  submitted_data  JSONB NOT NULL DEFAULT '{}',
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_intake_subs_org ON intake_submissions(organization_id, template_id);

-- Phase 96: Smart Scheduling
CREATE TABLE IF NOT EXISTS schedule_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES org_locations(id),
  provider_id     UUID NOT NULL,
  slot_start      TIMESTAMPTZ NOT NULL,
  slot_end        TIMESTAMPTZ NOT NULL,
  appointment_type TEXT NOT NULL DEFAULT 'consultation',
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  booked_for_case UUID REFERENCES cases(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_slots_org_time ON schedule_slots(organization_id, slot_start, is_available);

-- Phase 97: Revenue Cycle
CREATE TABLE IF NOT EXISTS revenue_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES cases(id),
  patient_id      UUID REFERENCES patients(id),
  transaction_type TEXT NOT NULL DEFAULT 'charge' CHECK (transaction_type IN ('charge','payment','adjustment','refund','writeoff')),
  amount_cents    INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  description     TEXT,
  cdt_code        TEXT,
  insurance_plan_id UUID,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','cleared','voided')),
  posted_at       TIMESTAMPTZ,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revenue_org ON revenue_transactions(organization_id, status, created_at DESC);
