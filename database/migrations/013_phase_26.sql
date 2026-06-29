-- Phase 26: Complete Tooth Movement Engine
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS movement_prescriptions (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                 uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    tooth_number            int         NOT NULL,
    arch                    text        NOT NULL CHECK (arch IN ('upper','lower')),
    -- Translation (mm, positive = mesial/buccal/occlusal)
    translation_mesial_mm   float       NOT NULL DEFAULT 0,
    translation_distal_mm   float       NOT NULL DEFAULT 0,
    translation_buccal_mm   float       NOT NULL DEFAULT 0,
    translation_lingual_mm  float       NOT NULL DEFAULT 0,
    -- Vertical (separate from translation for clinical distinction)
    intrusion_mm            float       NOT NULL DEFAULT 0,
    extrusion_mm            float       NOT NULL DEFAULT 0,
    -- Angulation (degrees)
    rotation_deg            float       NOT NULL DEFAULT 0,
    torque_deg              float       NOT NULL DEFAULT 0,
    tip_mesial_deg          float       NOT NULL DEFAULT 0,
    tip_distal_deg          float       NOT NULL DEFAULT 0,
    -- Arch-level movements (mm)
    mesialization_mm        float       NOT NULL DEFAULT 0,
    distalization_mm        float       NOT NULL DEFAULT 0,
    expansion_mm            float       NOT NULL DEFAULT 0,
    constriction_mm         float       NOT NULL DEFAULT 0,
    -- Root movement
    root_movement_mm        float       NOT NULL DEFAULT 0,
    root_direction          jsonb       NOT NULL DEFAULT '{"x":0,"y":0,"z":1}',
    -- Metadata
    notes                   text,
    prescribed_by           uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    approved_by             uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    approved_at             timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, tooth_number)
);

CREATE TABLE IF NOT EXISTS movement_simulations (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                     uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    organization_id             uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    total_teeth_moved           int         NOT NULL DEFAULT 0,
    max_single_movement_mm      float,
    estimated_stages            int,
    collision_pairs             jsonb       NOT NULL DEFAULT '[]',
    constraint_violations       jsonb       NOT NULL DEFAULT '[]',
    anchorage_class             text        CHECK (anchorage_class IN ('maximum','moderate','minimum')),
    anchorage_units_required    float,
    anchorage_units_available   float,
    bone_remodeling_index       float,
    simulation_duration_ms      int,
    simulated_by                uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    simulated_at                timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id)
);

CREATE TABLE IF NOT EXISTS pdl_simulation_results (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    stage_num       int         NOT NULL,
    tooth_number    int         NOT NULL,
    stress_mpa      float       NOT NULL DEFAULT 0,
    strain_pct      float       NOT NULL DEFAULT 0,
    force_n         float       NOT NULL DEFAULT 0,
    moment_ncm      float       NOT NULL DEFAULT 0,
    mobility_risk   text        NOT NULL DEFAULT 'none'
                    CHECK (mobility_risk IN ('none','low','moderate','high')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, stage_num, tooth_number)
);

CREATE INDEX IF NOT EXISTS idx_movement_prescriptions_plan ON movement_prescriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_movement_simulations_plan   ON movement_simulations(plan_id);
CREATE INDEX IF NOT EXISTS idx_pdl_results_plan_stage      ON pdl_simulation_results(plan_id, stage_num);
