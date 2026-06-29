-- Phase 39: Printer Maintenance
CREATE TABLE IF NOT EXISTS printer_maintenance_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  printer_id      UUID,
  maintenance_type TEXT NOT NULL DEFAULT 'routine' CHECK (maintenance_type IN ('routine','calibration','repair','cleaning','firmware_update')),
  performed_by    UUID NOT NULL,
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT,
  next_due_date   DATE,
  passed          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_maint_org ON printer_maintenance_logs(organization_id, performed_at DESC);

-- Phase 40: FHIR Export
CREATE TABLE IF NOT EXISTS fhir_exports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL DEFAULT 'Patient' CHECK (resource_type IN ('Patient','Observation','Condition','Procedure','DiagnosticReport')),
  patient_id      UUID REFERENCES patients(id),
  case_id         UUID REFERENCES cases(id),
  fhir_version    TEXT NOT NULL DEFAULT 'R4',
  payload         JSONB NOT NULL,
  exported_by     UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fhir_org ON fhir_exports(organization_id, resource_type, created_at DESC);

-- Phase 43: White Label / Branding
CREATE TABLE IF NOT EXISTS org_branding (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  clinic_name     TEXT,
  logo_url        TEXT,
  primary_color   TEXT,
  secondary_color TEXT,
  accent_color    TEXT,
  custom_domain   TEXT,
  footer_text     TEXT,
  updated_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 45: Business Intelligence
CREATE TABLE IF NOT EXISTS bi_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,
  metric_name     TEXT NOT NULL,
  metric_value    NUMERIC NOT NULL,
  dimensions      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bi_snapshots ON bi_snapshots(organization_id, metric_name, snapshot_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bi_unique ON bi_snapshots(organization_id, snapshot_date, metric_name, (dimensions::text));

-- Phase 46: Supply Chain
CREATE TABLE IF NOT EXISTS vendors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  website         TEXT,
  notes           TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendors_org ON vendors(organization_id, active);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id),
  po_number       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','received','cancelled')),
  ordered_at      DATE,
  expected_date   DATE,
  received_at     DATE,
  total_cents     INTEGER,
  notes           TEXT,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, po_number)
);
CREATE INDEX IF NOT EXISTS idx_po_org ON purchase_orders(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id),
  description     TEXT NOT NULL,
  quantity        INTEGER NOT NULL,
  unit_price_cents INTEGER,
  received_quantity INTEGER NOT NULL DEFAULT 0
);

-- Phase 47: CRM
CREATE TABLE IF NOT EXISTS patient_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL,
  note_type       TEXT NOT NULL DEFAULT 'general' CHECK (note_type IN ('general','call','email','sms','visit','financial','clinical')),
  content         TEXT NOT NULL,
  is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_notes ON patient_notes(patient_id, organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS patient_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tag             TEXT NOT NULL,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, patient_id, tag)
);

-- Phase 48: Workflow Builder
CREATE TABLE IF NOT EXISTS workflow_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_event   TEXT NOT NULL,
  steps           JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wf_templates_org ON workflow_templates(organization_id, is_active);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id     UUID NOT NULL REFERENCES workflow_templates(id),
  trigger_data    JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  current_step    INTEGER NOT NULL DEFAULT 0,
  result          JSONB,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wf_exec_org ON workflow_executions(organization_id, template_id, started_at DESC);

-- Phase 49: Command Palette
CREATE TABLE IF NOT EXISTS command_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  command_id      TEXT NOT NULL,
  command_label   TEXT NOT NULL,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmd_user ON command_history(user_id, organization_id, executed_at DESC);
