-- Phase 28: Patient Portal
CREATE TABLE IF NOT EXISTS patient_portal_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ppt_patient ON patient_portal_tokens(patient_id, expires_at);

-- Phase 29: Insurance & Authorization
CREATE TABLE IF NOT EXISTS insurance_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  payer_name      TEXT NOT NULL,
  plan_name       TEXT,
  member_id       TEXT,
  group_number    TEXT,
  is_primary      BOOLEAN NOT NULL DEFAULT TRUE,
  effective_date  DATE,
  termination_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_insurance_plans_patient ON insurance_plans(patient_id, organization_id);

CREATE TABLE IF NOT EXISTS insurance_preauths (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  insurance_plan_id UUID REFERENCES insurance_plans(id),
  auth_number     TEXT,
  cdt_codes       JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','approved','denied','expired')),
  submitted_at    TIMESTAMPTZ,
  decision_at     TIMESTAMPTZ,
  approved_amount_cents INTEGER,
  notes           TEXT,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_preauths_case ON insurance_preauths(case_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_preauths_status ON insurance_preauths(organization_id, status);

-- Phase 30: Material & Supply Inventory
CREATE TABLE IF NOT EXISTS inventory_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sku             TEXT,
  category        TEXT NOT NULL DEFAULT 'material',
  unit            TEXT NOT NULL DEFAULT 'unit',
  unit_cost_cents INTEGER,
  reorder_threshold INTEGER NOT NULL DEFAULT 10,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_org ON inventory_items(organization_id, category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_org_sku ON inventory_items(organization_id, sku) WHERE sku IS NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('receipt','usage','adjustment','waste')),
  quantity_delta   INTEGER NOT NULL,
  quantity_after   INTEGER NOT NULL,
  case_id         UUID REFERENCES cases(id),
  notes           TEXT,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_txn_item ON inventory_transactions(item_id, created_at DESC);

-- Phase 31: Digital Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  prescribed_by   UUID NOT NULL,
  medication_name TEXT NOT NULL,
  strength        TEXT,
  dosage_form     TEXT,
  sig             TEXT NOT NULL,
  quantity        TEXT NOT NULL,
  refills         INTEGER NOT NULL DEFAULT 0,
  indication      TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','filled','cancelled','expired')),
  filled_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_case ON prescriptions(case_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id, status);

-- Phase 32: Remote Patient Monitoring
CREATE TABLE IF NOT EXISTS compliance_check_ins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  check_in_date   DATE NOT NULL,
  wear_hours      NUMERIC(4,1),
  pain_score      SMALLINT CHECK (pain_score BETWEEN 0 AND 10),
  issues_reported TEXT[],
  photo_urls      TEXT[],
  aligner_stage   INTEGER,
  clinician_notes TEXT,
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_check_ins_case ON compliance_check_ins(case_id, check_in_date DESC);

-- Phase 33: Outcome Tracking
CREATE TABLE IF NOT EXISTS treatment_outcomes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  recorded_by     UUID NOT NULL,
  outcome_date    DATE NOT NULL,
  final_overjet_mm       NUMERIC(4,2),
  final_overbite_mm      NUMERIC(4,2),
  final_midline_deviation_mm NUMERIC(4,2),
  arch_coordination_achieved BOOLEAN,
  total_aligners_used    INTEGER,
  refinements_count      INTEGER NOT NULL DEFAULT 0,
  treatment_duration_days INTEGER,
  patient_satisfaction   SMALLINT CHECK (patient_satisfaction BETWEEN 1 AND 5),
  clinician_satisfaction SMALLINT CHECK (clinician_satisfaction BETWEEN 1 AND 5),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_outcomes_case ON treatment_outcomes(case_id);

-- Phase 34: Training & CPD
CREATE TABLE IF NOT EXISTS cpd_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  title           TEXT NOT NULL,
  provider        TEXT,
  activity_type   TEXT NOT NULL DEFAULT 'course' CHECK (activity_type IN ('course','webinar','conference','self_study','simulation','other')),
  cpd_hours       NUMERIC(5,1) NOT NULL,
  completion_date DATE NOT NULL,
  certificate_url TEXT,
  notes           TEXT,
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cpd_user ON cpd_activities(user_id, organization_id, completion_date DESC);

CREATE TABLE IF NOT EXISTS cpd_requirements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  required_hours  NUMERIC(5,1) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id, period_start)
);
