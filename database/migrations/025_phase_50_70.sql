-- Phase 51: Clinical Decision Support
CREATE TABLE IF NOT EXISTS clinical_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL DEFAULT 'clinical' CHECK (alert_type IN ('drug_interaction','allergy','contraindication','clinical','compliance','lab_value')),
  severity        TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_case ON clinical_alerts(case_id, acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON clinical_alerts(organization_id, acknowledged_at, severity);

-- Phase 52: Patient Education
CREATE TABLE IF NOT EXISTS education_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content_type    TEXT NOT NULL DEFAULT 'article' CHECK (content_type IN ('article','video','pdf','infographic')),
  category        TEXT NOT NULL DEFAULT 'general',
  body            TEXT,
  url             TEXT,
  tags            TEXT[],
  is_published    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edu_org ON education_content(organization_id, is_published, category);

CREATE TABLE IF NOT EXISTS patient_education_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  content_id      UUID NOT NULL REFERENCES education_content(id) ON DELETE CASCADE,
  assigned_by     UUID NOT NULL,
  viewed_at       TIMESTAMPTZ,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 55: Document Management
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES cases(id),
  patient_id      UUID REFERENCES patients(id),
  document_type   TEXT NOT NULL DEFAULT 'other',
  title           TEXT NOT NULL,
  file_url        TEXT,
  file_size_bytes BIGINT,
  mime_type       TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  uploaded_by     UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_docs_case ON documents(case_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_docs_patient ON documents(patient_id, organization_id);

-- Phase 57: Task Management
CREATE TABLE IF NOT EXISTS clinical_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES cases(id),
  patient_id      UUID REFERENCES patients(id),
  title           TEXT NOT NULL,
  description     TEXT,
  assigned_to     UUID,
  created_by      UUID NOT NULL,
  due_date        DATE,
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON clinical_tasks(assigned_to, organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_case ON clinical_tasks(case_id, status);

-- Phase 59: Quality Metrics / KPIs
CREATE TABLE IF NOT EXISTS quality_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_name     TEXT NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  target_value    NUMERIC,
  actual_value    NUMERIC,
  unit            TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_qm_unique ON quality_metrics(organization_id, metric_name, period_start);

-- Phase 60: Regulatory Compliance
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requirement_name TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'hipaa' CHECK (category IN ('hipaa','gdpr','iso','fda','other')),
  description     TEXT,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','compliant','non_compliant')),
  evidence_url    TEXT,
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comp_req_org ON compliance_requirements(organization_id, status, category);

-- Phase 65: Patient Feedback / Surveys
CREATE TABLE IF NOT EXISTS surveys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  questions       JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id       UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id),
  case_id         UUID REFERENCES cases(id),
  answers         JSONB NOT NULL DEFAULT '{}',
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_survey_responses ON survey_responses(survey_id, submitted_at DESC);

-- Phase 70: Feature Flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  flag_name       TEXT NOT NULL,
  is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  conditions      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, flag_name)
);
