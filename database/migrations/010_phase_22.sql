-- ─── Phase 22: Clinical Biomechanics & Aligner Planning Engine ────────────────
-- Idempotent: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.

-- ─── Biomechanics Assessments (22A/22E) ──────────────────────────────────────
-- Per-plan rule-based movement-limit and collision assessment.

CREATE TABLE IF NOT EXISTS biomechanics_assessments (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    treatment_plan_id   uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    overall_status      text        NOT NULL DEFAULT 'unknown'
                                    CHECK (overall_status IN ('safe','warning','unsafe','unknown')),
    stage_count         int         NOT NULL DEFAULT 0,
    safe_stage_count    int         NOT NULL DEFAULT 0,
    warning_stage_count int         NOT NULL DEFAULT 0,
    unsafe_stage_count  int         NOT NULL DEFAULT 0,
    anchorage_score     numeric(5,1),   -- 0–100, higher = more demanding
    root_control_score  numeric(5,1),   -- 0–100, higher = more root involvement
    difficulty_score    numeric(5,1),   -- 0–100
    collision_pairs     int         NOT NULL DEFAULT 0,
    findings            jsonb       NOT NULL DEFAULT '[]',
    -- [{ stageNumber, fdi, field, value, status, limit, explanation }]
    assessed_by         uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    assessed_at         timestamptz NOT NULL DEFAULT now(),
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biomechanics_plan
    ON biomechanics_assessments(treatment_plan_id);
CREATE INDEX IF NOT EXISTS idx_biomechanics_case
    ON biomechanics_assessments(case_id);

-- ─── Treatment Attachments (22B) ─────────────────────────────────────────────
-- Planned per-tooth attachments for a treatment plan.

CREATE TABLE IF NOT EXISTS treatment_attachments (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    treatment_plan_id   uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    fdi_number          int         NOT NULL CHECK (fdi_number BETWEEN 11 AND 48),
    attachment_type     text        NOT NULL
                                    CHECK (attachment_type IN (
                                      'vertical_rectangular','horizontal_rectangular',
                                      'optimized','rotation','extrusion',
                                      'root_control','retention','beveled'
                                    )),
    width_mm            numeric(5,2) NOT NULL DEFAULT 3.0,
    height_mm           numeric(5,2) NOT NULL DEFAULT 2.0,
    depth_mm            numeric(5,2) NOT NULL DEFAULT 0.5,
    surface             text        NOT NULL DEFAULT 'buccal'
                                    CHECK (surface IN ('buccal','lingual','occlusal')),
    activation_stage    int         NOT NULL DEFAULT 1,
    deactivation_stage  int,
    is_auto_recommended boolean     NOT NULL DEFAULT false,
    is_approved         boolean     NOT NULL DEFAULT false,
    approved_by         uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    approved_at         timestamptz,
    notes               text,
    created_by          uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (treatment_plan_id, fdi_number, attachment_type)
);

CREATE INDEX IF NOT EXISTS idx_treatment_attachments_plan
    ON treatment_attachments(treatment_plan_id);

-- ─── IPR Plan Items (22C) ────────────────────────────────────────────────────
-- Structured interproximal reduction schedule per treatment plan.

CREATE TABLE IF NOT EXISTS ipr_plan_items (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    treatment_plan_id   uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    tooth_a_fdi         int         NOT NULL CHECK (tooth_a_fdi BETWEEN 11 AND 48),
    tooth_b_fdi         int         NOT NULL CHECK (tooth_b_fdi BETWEEN 11 AND 48),
    amount_mm           numeric(4,2) NOT NULL CHECK (amount_mm > 0 AND amount_mm <= 2.0),
    before_stage        int         NOT NULL DEFAULT 1,
    remaining_enamel_a  numeric(4,2),   -- mm remaining on tooth_a after IPR
    remaining_enamel_b  numeric(4,2),   -- mm remaining on tooth_b after IPR
    safety_status       text        NOT NULL DEFAULT 'safe'
                                    CHECK (safety_status IN ('safe','warning','unsafe')),
    is_auto_recommended boolean     NOT NULL DEFAULT false,
    notes               text,
    created_by          uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (treatment_plan_id, tooth_a_fdi, tooth_b_fdi)
);

CREATE INDEX IF NOT EXISTS idx_ipr_plan_items_plan
    ON ipr_plan_items(treatment_plan_id);

-- ─── Refinement Cycles (22G) ─────────────────────────────────────────────────
-- Tracks mid-treatment refinement scans and stage restarts.

CREATE TABLE IF NOT EXISTS refinement_cycles (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    treatment_plan_id   uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    cycle_number        int         NOT NULL DEFAULT 1,
    restart_from_stage  int         NOT NULL,
    new_scan_id         uuid        REFERENCES scans(id) ON DELETE SET NULL,
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','planning','stages_generated','approved')),
    new_stages_generated int        NOT NULL DEFAULT 0,
    notes               text,
    created_by          uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refinement_cycles_case
    ON refinement_cycles(case_id);
CREATE INDEX IF NOT EXISTS idx_refinement_cycles_plan
    ON refinement_cycles(treatment_plan_id);

-- ─── Aligner Generation Jobs (22F) ───────────────────────────────────────────
-- Tracks aligner shell generation requests per treatment plan.

CREATE TABLE IF NOT EXISTS aligner_generation_jobs (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    treatment_plan_id   uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    status              text        NOT NULL DEFAULT 'queued'
                                    CHECK (status IN ('queued','processing','completed','failed')),
    shell_thickness_mm  numeric(4,2) NOT NULL DEFAULT 0.75,
    trim_preset         text        NOT NULL DEFAULT 'scalloped'
                                    CHECK (trim_preset IN ('scalloped','straight','sub_gingival')),
    material            text        NOT NULL DEFAULT 'TPU-alignclear',
    stages_included     int[],
    result_manifest     jsonb       NOT NULL DEFAULT '{}',
    error_message       text,
    requested_by        uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    started_at          timestamptz,
    completed_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aligner_gen_jobs_plan
    ON aligner_generation_jobs(treatment_plan_id);
CREATE INDEX IF NOT EXISTS idx_aligner_gen_jobs_status
    ON aligner_generation_jobs(status);

-- ─── Case Workflow Steps (22J) ────────────────────────────────────────────────
-- Tracks per-case completion of each workflow step for pipeline display.

CREATE TABLE IF NOT EXISTS case_workflow_steps (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    step_key            text        NOT NULL,
    -- e.g. scan_upload, segmentation, clinical_analysis, treatment_plan,
    --      biomechanics, attachments, ipr, stage_generation, qa, approval, manufacturing
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','in_progress','completed','skipped','error')),
    completed_at        timestamptz,
    completed_by        uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    metadata            jsonb       NOT NULL DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (case_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_case_workflow_steps_case
    ON case_workflow_steps(case_id);
