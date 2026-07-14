-- Migration 062: Enterprise 2.0 Framework
-- Adds tables for: Integration Provider Registry, Background Job Queue,
-- Clinical Knowledge Platform, and MLOps/AI Governance.
-- All tables are org-scoped (organization_id) and idempotent.

-- ─── Integration Provider Registry ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_providers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_type     TEXT NOT NULL, -- 'dicom_pacs' | 'hl7_fhir' | 'pms' | 'scanner' | 'printer' | 'payment' | 'email' | 'sms' | 'calendar'
  name              TEXT NOT NULL,
  vendor            TEXT,
  version           TEXT,
  config_json       JSONB NOT NULL DEFAULT '{}',
  health_status     TEXT NOT NULL DEFAULT 'unknown', -- 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  last_checked_at   TIMESTAMPTZ,
  capabilities_json JSONB NOT NULL DEFAULT '[]',
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_health_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL,
  provider_id         UUID NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  status              TEXT NOT NULL,
  response_time_ms    INTEGER,
  error_message       TEXT,
  checked_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_providers_org ON integration_providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_providers_type ON integration_providers(organization_id, provider_type);
CREATE INDEX IF NOT EXISTS idx_integration_health_logs_provider ON integration_health_logs(provider_id, checked_at DESC);

-- ─── Background Job Queue ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS background_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- nullable for system-level jobs
  job_type        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'dead_letter'
  priority        INTEGER NOT NULL DEFAULT 5,      -- 1 = highest, 10 = lowest
  payload_json    JSONB NOT NULL DEFAULT '{}',
  result_json     JSONB,
  error           TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_org ON background_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status, run_at) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON background_jobs(job_type, status);

-- ─── Clinical Knowledge Platform ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinical_protocols (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  title           TEXT NOT NULL,
  clinical_area   TEXT NOT NULL, -- 'orthodontics' | 'restorative' | 'surgical' | 'pediatric' | 'general'
  evidence_level  TEXT NOT NULL DEFAULT 'C', -- 'A' | 'B' | 'C' (A=RCT, B=Cohort, C=Expert Opinion)
  status          TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'active' | 'archived'
  content_json    JSONB NOT NULL DEFAULT '{}',
  version         INTEGER NOT NULL DEFAULT 1,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, code, version)
);

CREATE TABLE IF NOT EXISTS protocol_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  protocol_id     UUID REFERENCES clinical_protocols(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  template_type   TEXT NOT NULL, -- 'consent_form' | 'treatment_plan' | 'progress_note' | 'referral'
  content_json    JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_libraries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL, -- 'resin' | 'wire' | 'bracket' | 'composite' | 'adhesive' | 'other'
  manufacturer         TEXT,
  sku                  TEXT,
  properties_json      JSONB NOT NULL DEFAULT '{}',
  compatible_printers  TEXT[] NOT NULL DEFAULT '{}',
  status               TEXT NOT NULL DEFAULT 'active', -- 'active' | 'discontinued' | 'trial'
  created_by           UUID NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appliance_libraries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  appliance_type  TEXT NOT NULL, -- 'aligner' | 'retainer' | 'splint' | 'expander' | 'positioner' | 'other'
  description     TEXT,
  design_params   JSONB NOT NULL DEFAULT '{}',
  material_ids    UUID[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manufacturing_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  printer_model   TEXT,
  resin_material  TEXT,
  layer_height_mm NUMERIC(6,4),
  exposure_ms     INTEGER,
  supports_json   JSONB NOT NULL DEFAULT '{}',
  post_cure_json  JSONB NOT NULL DEFAULT '{}',
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_protocols_org ON clinical_protocols(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_protocol_templates_org ON protocol_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_material_libraries_org ON material_libraries(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_appliance_libraries_org ON appliance_libraries(organization_id, appliance_type);
CREATE INDEX IF NOT EXISTS idx_manufacturing_profiles_org ON manufacturing_profiles(organization_id);

-- ─── MLOps / AI Governance ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_model_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- null = global/system model
  name            TEXT NOT NULL,
  model_type      TEXT NOT NULL, -- 'segmentation' | 'movement_prediction' | 'treatment_proposal' | 'qa_scoring' | 'other'
  version         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'staged', -- 'staged' | 'active' | 'deprecated' | 'rolled_back'
  provider        TEXT NOT NULL DEFAULT 'internal', -- 'internal' | 'openai' | 'anthropic' | 'custom'
  artifact_path   TEXT,
  metrics_json    JSONB NOT NULL DEFAULT '{}',
  deployed_at     TIMESTAMPTZ,
  deprecated_at   TIMESTAMPTZ,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, version)
);

CREATE TABLE IF NOT EXISTS ai_inference_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  model_id        UUID REFERENCES ai_model_registry(id) ON DELETE SET NULL,
  model_name      TEXT NOT NULL,
  model_version   TEXT NOT NULL,
  invoked_by      UUID NOT NULL,
  case_id         UUID,
  patient_id      UUID,
  input_hash      TEXT,
  output_summary  TEXT,
  latency_ms      INTEGER,
  tokens_used     INTEGER,
  outcome         TEXT, -- 'accepted' | 'modified' | 'rejected' | 'pending_review'
  disclaimer_shown BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_model_registry_status ON ai_model_registry(status, model_type);
CREATE INDEX IF NOT EXISTS idx_ai_inference_audit_org ON ai_inference_audit(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_inference_audit_case ON ai_inference_audit(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_inference_audit_model ON ai_inference_audit(model_id, created_at DESC);
