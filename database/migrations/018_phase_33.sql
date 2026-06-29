-- Phase 33: Retention Protocol Engine
-- Post-treatment retention planning, retainer types, wear schedules, relapse risk

CREATE TABLE IF NOT EXISTS retention_protocols (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL,
  plan_id                 UUID NOT NULL UNIQUE,
  relapse_risk_score      NUMERIC(5,3),   -- 0.0 = low, 1.0 = high
  relapse_risk_level      TEXT CHECK (relapse_risk_level IN ('low', 'moderate', 'high', 'very_high')),
  primary_retainer_type   TEXT NOT NULL CHECK (primary_retainer_type IN (
    'essix_full', 'essix_partial', 'hawley', 'fixed_lingual', 'vivera', 'combo'
  )),
  lower_retainer_type     TEXT CHECK (lower_retainer_type IN (
    'essix_full', 'essix_partial', 'hawley', 'fixed_lingual', 'vivera', 'combo', 'none'
  )),
  total_retention_months  INTEGER NOT NULL DEFAULT 24,
  night_only_starts_month INTEGER,
  risk_factors            JSONB NOT NULL DEFAULT '[]',
  clinical_notes          TEXT,
  approved_by             UUID,
  approved_at             TIMESTAMPTZ,
  created_by              UUID NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_protocols_plan  ON retention_protocols(plan_id);
CREATE INDEX IF NOT EXISTS idx_retention_protocols_org   ON retention_protocols(organization_id);

CREATE TABLE IF NOT EXISTS retention_wear_schedule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id         UUID NOT NULL REFERENCES retention_protocols(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL,
  phase_num           INTEGER NOT NULL,
  start_month         INTEGER NOT NULL,
  end_month           INTEGER NOT NULL,
  wear_hours_per_day  NUMERIC(4,1) NOT NULL,
  wear_label          TEXT NOT NULL,   -- 'Full-time (22h)', 'Night-only (10h)', etc.
  clinical_instruction TEXT,
  UNIQUE (protocol_id, phase_num)
);

CREATE INDEX IF NOT EXISTS idx_retention_schedule_protocol ON retention_wear_schedule(protocol_id);

CREATE TABLE IF NOT EXISTS retention_relapse_factors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id         UUID NOT NULL REFERENCES retention_protocols(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL,
  factor_type         TEXT NOT NULL CHECK (factor_type IN (
    'severe_crowding', 'large_expansion', 'rotation_correction', 'skeletal_discrepancy',
    'open_bite_correction', 'deep_bite_correction', 'midline_shift', 'bolton_discrepancy',
    'young_patient', 'compliance_risk', 'class_ii_correction', 'class_iii_correction'
  )),
  factor_weight       NUMERIC(4,3) NOT NULL,   -- contribution to risk score
  description         TEXT NOT NULL,
  detected_value      TEXT,   -- e.g. '4.2mm expansion', '8 teeth rotated'
  UNIQUE (protocol_id, factor_type)
);

CREATE INDEX IF NOT EXISTS idx_retention_factors_protocol ON retention_relapse_factors(protocol_id);
