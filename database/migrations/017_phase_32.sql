-- Phase 32: Multi-Arch Treatment Coordinator
-- Cross-arch staging coordination, occlusion checkpoints, arch synchronization

CREATE TABLE IF NOT EXISTS arch_coordination_plans (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL,
  plan_id                 UUID NOT NULL UNIQUE,
  strategy                TEXT NOT NULL DEFAULT 'simultaneous'
                          CHECK (strategy IN ('simultaneous', 'upper_first', 'lower_first', 'alternating')),
  upper_total_stages      INTEGER,
  lower_total_stages      INTEGER,
  synchronized_stages     INTEGER,
  phase_offset_stages     INTEGER NOT NULL DEFAULT 0,
  expansion_coordination  BOOLEAN NOT NULL DEFAULT true,
  arch_width_discrepancy_mm NUMERIC(6,3),
  coordination_score      NUMERIC(5,3),
  created_by              UUID NOT NULL,
  approved_by             UUID,
  approved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arch_coord_plan  ON arch_coordination_plans(plan_id);
CREATE INDEX IF NOT EXISTS idx_arch_coord_org   ON arch_coordination_plans(organization_id);

CREATE TABLE IF NOT EXISTS arch_checkpoints (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id     UUID NOT NULL REFERENCES arch_coordination_plans(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL,
  checkpoint_stage    INTEGER NOT NULL,
  checkpoint_type     TEXT NOT NULL CHECK (checkpoint_type IN (
    'occlusion_check', 'midline_check', 'arch_width_check',
    'bolton_check', 'overjet_check', 'overbite_check', 'expansion_sync'
  )),
  description         TEXT NOT NULL,
  target_metric       TEXT,      -- field name to measure at this stage
  target_value_mm     NUMERIC(6,3),
  tolerance_mm        NUMERIC(6,3),
  is_mandatory        BOOLEAN NOT NULL DEFAULT true,
  clinical_note       TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'passed', 'failed', 'deferred')),
  evaluated_at        TIMESTAMPTZ,
  UNIQUE (coordination_id, checkpoint_stage, checkpoint_type)
);

CREATE INDEX IF NOT EXISTS idx_arch_checkpoints_coord  ON arch_checkpoints(coordination_id);
CREATE INDEX IF NOT EXISTS idx_arch_checkpoints_status ON arch_checkpoints(status) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS arch_sync_allocations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id     UUID NOT NULL REFERENCES arch_coordination_plans(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL,
  arch                TEXT NOT NULL CHECK (arch IN ('upper', 'lower')),
  stage_num           INTEGER NOT NULL,
  synchronized_stage  INTEGER NOT NULL,   -- stage number in the coordinated timeline
  tooth_fdi           INTEGER NOT NULL,
  movement_type       TEXT NOT NULL,
  amount_mm_or_deg    NUMERIC(7,4) NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (coordination_id, arch, stage_num, tooth_fdi, movement_type)
);

CREATE INDEX IF NOT EXISTS idx_arch_sync_coord   ON arch_sync_allocations(coordination_id);
CREATE INDEX IF NOT EXISTS idx_arch_sync_stage   ON arch_sync_allocations(synchronized_stage);
