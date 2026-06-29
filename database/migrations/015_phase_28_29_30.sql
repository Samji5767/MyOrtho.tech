-- Phases 28–30: Attachment Intelligence, IPR Engine, Treatment Simulation
-- Idempotent: safe to re-run

-- ── Phase 28: Attachment Intelligence ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attachment_libraries (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        REFERENCES organizations(id) ON DELETE SET NULL,
    name                text        NOT NULL,
    library_type        text        NOT NULL DEFAULT 'standard'
                        CHECK (library_type IN ('standard','precision','retention','custom')),
    attachment_type     text        NOT NULL,
    width_mm            float       NOT NULL DEFAULT 2.0,
    height_mm           float       NOT NULL DEFAULT 1.0,
    depth_mm            float       NOT NULL DEFAULT 0.5,
    -- Force effectiveness scores 0.0–1.0
    rotation_score      float       NOT NULL DEFAULT 0.5,
    torque_score        float       NOT NULL DEFAULT 0.5,
    extrusion_score     float       NOT NULL DEFAULT 0.5,
    translation_score   float       NOT NULL DEFAULT 0.5,
    intrusion_score     float       NOT NULL DEFAULT 0.3,
    is_system           boolean     NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachment_force_analysis (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id             uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    tooth_number        int         NOT NULL,
    attachment_type     text        NOT NULL,
    force_vector        jsonb       NOT NULL DEFAULT '{"x":0,"y":0,"z":0}',
    moment_vector       jsonb       NOT NULL DEFAULT '{"x":0,"y":0,"z":0}',
    effectiveness_score float       NOT NULL DEFAULT 0,
    recommended         boolean     NOT NULL DEFAULT false,
    collision_risk      text        NOT NULL DEFAULT 'none'
                        CHECK (collision_risk IN ('none','low','moderate','high')),
    manufacturing_valid boolean     NOT NULL DEFAULT true,
    validation_notes    text,
    analyzed_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, tooth_number, attachment_type)
);

CREATE TABLE IF NOT EXISTS attachment_collisions (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    tooth_number    int         NOT NULL,
    adjacent_fdi    int         NOT NULL,
    overlap_mm      float       NOT NULL DEFAULT 0,
    severity        text        NOT NULL CHECK (severity IN ('warning','critical')),
    suggestion      text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, tooth_number, adjacent_fdi)
);

-- ── Phase 29: Complete IPR Engine ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ipr_optimization_results (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                 uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    total_ipr_mm            float       NOT NULL DEFAULT 0,
    pairs_optimized         int         NOT NULL DEFAULT 0,
    enamel_safety_passed    boolean     NOT NULL DEFAULT true,
    clinical_warning_count  int         NOT NULL DEFAULT 0,
    optimized_items         jsonb       NOT NULL DEFAULT '[]',
    optimized_by            uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    optimized_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id)
);

CREATE TABLE IF NOT EXISTS ipr_enamel_estimates (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                 uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    fdi_a                   int         NOT NULL,
    fdi_b                   int         NOT NULL,
    enamel_a_mm             float       NOT NULL,
    enamel_b_mm             float       NOT NULL,
    available_ipr_mm        float       NOT NULL,
    recommended_ipr_mm      float       NOT NULL DEFAULT 0,
    remaining_enamel_mm     float       NOT NULL,
    is_safe                 boolean     NOT NULL DEFAULT true,
    warning                 text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, fdi_a, fdi_b)
);

-- ── Phase 30: Treatment Simulation ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS treatment_simulations (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                 uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    organization_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    total_frames            int         NOT NULL DEFAULT 0,
    arch_coordination_score float,
    occlusion_score         float,
    smile_arc_score         float,
    overjet_initial_mm      float,
    overjet_final_mm        float,
    overbite_initial_mm     float,
    overbite_final_mm       float,
    generation_duration_ms  int,
    generated_by            uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    generated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id)
);

CREATE TABLE IF NOT EXISTS simulation_frames (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id       uuid        NOT NULL REFERENCES treatment_simulations(id) ON DELETE CASCADE,
    stage_num           int         NOT NULL,
    -- Serialized tooth positions at this stage: {fdi: {tx,ty,tz,rx,ry,rz}}
    tooth_positions     jsonb       NOT NULL DEFAULT '{}',
    upper_arch_width_mm float,
    lower_arch_width_mm float,
    overbite_mm         float,
    overjet_mm          float,
    midline_deviation_mm float,
    is_keyframe         boolean     NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (simulation_id, stage_num)
);

CREATE INDEX IF NOT EXISTS idx_attach_force_plan        ON attachment_force_analysis(plan_id);
CREATE INDEX IF NOT EXISTS idx_attach_collision_plan    ON attachment_collisions(plan_id);
CREATE INDEX IF NOT EXISTS idx_ipr_enamel_plan          ON ipr_enamel_estimates(plan_id);
CREATE INDEX IF NOT EXISTS idx_sim_frames_simulation    ON simulation_frames(simulation_id, stage_num);
CREATE INDEX IF NOT EXISTS idx_treatment_sims_plan      ON treatment_simulations(plan_id);

-- Seed system attachment library (idempotent)
INSERT INTO attachment_libraries
    (name, library_type, attachment_type, width_mm, height_mm, depth_mm,
     rotation_score, torque_score, extrusion_score, translation_score, intrusion_score, is_system)
VALUES
    ('Horizontal Rectangular', 'standard',   'horizontal_rectangular', 3.0, 1.0, 0.5, 0.85, 0.45, 0.60, 0.70, 0.30, true),
    ('Vertical Rectangular',   'standard',   'vertical_rectangular',   1.5, 2.5, 0.5, 0.55, 0.90, 0.85, 0.50, 0.25, true),
    ('Optimized Multi-Plane',  'standard',   'optimized_multiplane',   2.5, 2.0, 0.6, 0.80, 0.80, 0.75, 0.80, 0.50, true),
    ('Beveled Rectangular',    'precision',  'beveled_rectangular',    3.0, 1.2, 0.7, 0.90, 0.60, 0.65, 0.75, 0.35, true),
    ('Ellipsoid',              'precision',  'ellipsoid',              2.8, 1.8, 0.5, 0.92, 0.70, 0.72, 0.78, 0.40, true),
    ('Diagonal Cut',           'precision',  'diagonal_cut',           3.2, 1.0, 0.5, 0.88, 0.55, 0.58, 0.82, 0.30, true),
    ('Hook Attachment',        'retention',  'hook',                   2.0, 2.0, 0.8, 0.40, 0.40, 0.90, 0.40, 0.85, true),
    ('Precision Cut',          'retention',  'precision_cut',          1.5, 1.5, 0.6, 0.55, 0.55, 0.75, 0.50, 0.70, true)
ON CONFLICT DO NOTHING;
