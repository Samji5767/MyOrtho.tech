-- Phase 27: Aligner Generation Engine
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS aligner_generation_plans (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                 uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    organization_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Stage configuration
    total_active_stages     int         NOT NULL DEFAULT 0,
    passive_aligner_count   int         NOT NULL DEFAULT 2,
    retention_stage_count   int         NOT NULL DEFAULT 3,
    aligner_change_weeks    int         NOT NULL DEFAULT 2,
    -- Distribution strategy
    staging_strategy        text        NOT NULL DEFAULT 'balanced'
                            CHECK (staging_strategy IN ('balanced','anterior_first','posterior_first','arch_coordinated')),
    -- Timing recommendations (stored as stage numbers)
    attachment_start_stage  int,
    attachment_end_stage    int,
    ipr_stage_schedule      jsonb       NOT NULL DEFAULT '[]',
    elastic_stage_schedule  jsonb       NOT NULL DEFAULT '[]',
    -- Per-stage movement allocation
    stage_allocations       jsonb       NOT NULL DEFAULT '[]',
    -- Manufacturing
    estimated_total_weeks   int,
    stl_export_ready        boolean     NOT NULL DEFAULT false,
    stl_export_path         text,
    -- Status
    status                  text        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','approved','manufacturing','complete')),
    notes                   text,
    generated_by            uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    approved_by             uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    approved_at             timestamptz,
    generated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id)
);

CREATE TABLE IF NOT EXISTS aligner_stage_allocations (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_plan_id  uuid        NOT NULL REFERENCES aligner_generation_plans(id) ON DELETE CASCADE,
    stage_num           int         NOT NULL,
    tooth_number        int         NOT NULL,
    -- Movement allocated to this stage for this tooth
    translation_mm      float       NOT NULL DEFAULT 0,
    rotation_deg        float       NOT NULL DEFAULT 0,
    torque_deg          float       NOT NULL DEFAULT 0,
    tip_deg             float       NOT NULL DEFAULT 0,
    vertical_mm         float       NOT NULL DEFAULT 0,
    arch_mm             float       NOT NULL DEFAULT 0,
    -- Stage flags
    has_attachment      boolean     NOT NULL DEFAULT false,
    has_ipr             boolean     NOT NULL DEFAULT false,
    is_passive          boolean     NOT NULL DEFAULT false,
    is_retention        boolean     NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (generation_plan_id, stage_num, tooth_number)
);

CREATE INDEX IF NOT EXISTS idx_aligner_gen_plans_plan     ON aligner_generation_plans(plan_id);
CREATE INDEX IF NOT EXISTS idx_stage_alloc_gen_plan       ON aligner_stage_allocations(generation_plan_id);
CREATE INDEX IF NOT EXISTS idx_stage_alloc_stage          ON aligner_stage_allocations(generation_plan_id, stage_num);
