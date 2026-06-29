-- ─── Phase 23: Digital Consent Forms ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consent_templates (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  content_markdown text       NOT NULL,
  version         text        NOT NULL DEFAULT '1.0',
  is_active       boolean     NOT NULL DEFAULT true,
  requires_witness boolean    NOT NULL DEFAULT false,
  created_by      uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_templates_org ON consent_templates(organization_id) WHERE is_active=true;

CREATE TABLE IF NOT EXISTS patient_consents (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  case_id         uuid        REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  template_id     uuid        REFERENCES consent_templates(id) NOT NULL,
  patient_name    text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','signed','declined','expired')),
  signed_at       timestamptz,
  signature_data  text,       -- base64 SVG path or typed name
  witness_name    text,
  witness_signed_at timestamptz,
  ip_address      text,
  expires_at      timestamptz DEFAULT (now() + interval '30 days'),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_consents_case  ON patient_consents(case_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_org   ON patient_consents(organization_id, status);

-- ─── Phase 24: Appointment Scheduling ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_types (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name            text        NOT NULL,
  duration_minutes int        NOT NULL DEFAULT 30,
  color_hex       text        NOT NULL DEFAULT '#3b82f6',
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  case_id         uuid        REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  appointment_type_id uuid    REFERENCES appointment_types(id),
  scheduled_at    timestamptz NOT NULL,
  duration_minutes int        NOT NULL DEFAULT 30,
  status          text        NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  notes           text,
  reminder_sent   boolean     NOT NULL DEFAULT false,
  clinician_id    uuid        REFERENCES auth_users(id),
  created_by      uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_case_id ON appointments(case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_org_date ON appointments(organization_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status, scheduled_at) WHERE status IN ('scheduled','confirmed');

CREATE TABLE IF NOT EXISTS treatment_milestones (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  case_id         uuid        REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  plan_id         uuid        REFERENCES treatment_plans(id),
  title           text        NOT NULL,
  milestone_type  text        NOT NULL DEFAULT 'stage_check'
                              CHECK (milestone_type IN ('stage_check','midpoint_scan','refinement','retention_delivery','case_completion','recall')),
  target_date     date,
  completed_at    timestamptz,
  notes           text,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_treatment_milestones_case ON treatment_milestones(case_id);

-- ─── Phase 25: Clinical Report Generator ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_templates (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  report_type     text        NOT NULL
                              CHECK (report_type IN ('treatment_summary','aligner_progress','insurance_preauth','patient_education','lab_order','referral_letter','outcome_report')),
  sections        jsonb       NOT NULL DEFAULT '[]',
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generated_reports (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  case_id         uuid        REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  plan_id         uuid        REFERENCES treatment_plans(id),
  report_type     text        NOT NULL,
  title           text        NOT NULL,
  content_json    jsonb       NOT NULL DEFAULT '{}',
  content_markdown text,
  generated_by    uuid,
  approved_by     uuid,
  approved_at     timestamptz,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_generated_reports_case ON generated_reports(case_id, report_type);

-- ─── Phase 26: Lab Orders ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lab_orders (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  case_id         uuid        REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  order_number    text        NOT NULL,
  lab_name        text        NOT NULL DEFAULT 'In-House Lab',
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','submitted','in_production','quality_check','shipped','delivered','rejected')),
  priority        text        NOT NULL DEFAULT 'standard'
                              CHECK (priority IN ('standard','rush','stat')),
  due_date        date,
  special_instructions text,
  submitted_at    timestamptz,
  delivered_at    timestamptz,
  submitted_by    uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_orders_order_number ON lab_orders(organization_id, order_number);
CREATE INDEX IF NOT EXISTS idx_lab_orders_case ON lab_orders(case_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(organization_id, status);

CREATE TABLE IF NOT EXISTS lab_order_items (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        uuid        REFERENCES lab_orders(id) ON DELETE CASCADE NOT NULL,
  item_type       text        NOT NULL
                              CHECK (item_type IN ('aligner_set','retainer','hawley','splint','model','attachment_template','ipr_guide','cbct_model')),
  arch            text        CHECK (arch IN ('maxillary','mandibular','both')),
  quantity        int         NOT NULL DEFAULT 1,
  stage_from      int,
  stage_to        int,
  material        text        DEFAULT 'PET-G 0.75mm',
  notes           text,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_order_items_order ON lab_order_items(order_id);

CREATE TABLE IF NOT EXISTS lab_revisions (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        uuid        REFERENCES lab_orders(id) ON DELETE CASCADE NOT NULL,
  revision_number int         NOT NULL DEFAULT 1,
  reason          text        NOT NULL,
  requested_by    uuid,
  resolved_at     timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- ─── Phase 27: Referral Management ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  case_id         uuid        REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  referral_type   text        NOT NULL DEFAULT 'specialist'
                              CHECK (referral_type IN ('specialist','lab','imaging','oral_surgery','periodontist','endodontist','general_dentist')),
  recipient_name  text        NOT NULL,
  recipient_email text,
  recipient_phone text,
  urgency         text        NOT NULL DEFAULT 'routine'
                              CHECK (urgency IN ('routine','urgent','stat')),
  reason          text        NOT NULL,
  clinical_notes  text,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','sent','accepted','declined','completed')),
  sent_at         timestamptz,
  responded_at    timestamptz,
  response_notes  text,
  created_by      uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_case ON referrals(case_id);
CREATE INDEX IF NOT EXISTS idx_referrals_org_status ON referrals(organization_id, status);
