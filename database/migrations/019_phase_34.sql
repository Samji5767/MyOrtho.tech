-- Phase 34: Clinical Export Package
-- Structured export bundles for labs and manufacturing with validation gates

CREATE TABLE IF NOT EXISTS export_packages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL,
  plan_id                 UUID NOT NULL,
  export_type             TEXT NOT NULL CHECK (export_type IN (
    'lab_full', 'aligner_stl', 'treatment_summary', 'patient_instructions', 'insurance_report'
  )),
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'validated', 'approved', 'exported', 'failed')),
  validation_results      JSONB NOT NULL DEFAULT '[]',
  validation_passed       BOOLEAN,
  approved_by             UUID,
  approved_at             TIMESTAMPTZ,
  exported_at             TIMESTAMPTZ,
  export_format           TEXT CHECK (export_format IN ('json', 'pdf', 'stl', 'zip', 'csv')),
  file_size_bytes         BIGINT,
  checksum_sha256         TEXT,
  created_by              UUID NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_packages_plan   ON export_packages(plan_id);
CREATE INDEX IF NOT EXISTS idx_export_packages_org    ON export_packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_packages_status ON export_packages(status);

CREATE TABLE IF NOT EXISTS export_checklist_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id          UUID NOT NULL REFERENCES export_packages(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL,
  check_key           TEXT NOT NULL,
  check_label         TEXT NOT NULL,
  module              TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'passed', 'failed', 'warning', 'skipped')),
  message             TEXT,
  is_blocking         BOOLEAN NOT NULL DEFAULT true,
  checked_at          TIMESTAMPTZ,
  UNIQUE (package_id, check_key)
);

CREATE INDEX IF NOT EXISTS idx_export_checklist_pkg ON export_checklist_items(package_id);
