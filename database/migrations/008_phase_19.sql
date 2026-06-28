-- ============================================================================
-- Migration 008: Phase 19 — Photo Documentation, Ceph Analysis, Aligner Stages,
--                QC Checks, Scanner Integrations
--
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ============================================================================

-- ─── Scanner Integrations ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scanner_integrations (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vendor          text        NOT NULL,   -- 3shape | medit | itero | shining3d | carestream
    client_id       text,
    client_secret   text,
    endpoint_url    text,
    is_active       boolean     NOT NULL DEFAULT true,
    last_sync_at    timestamptz,
    created_at      timestamptz DEFAULT now(),
    UNIQUE(organization_id, vendor)
);

CREATE INDEX IF NOT EXISTS idx_scanner_integrations_org ON scanner_integrations(organization_id);

-- ─── Aligner Stages ──────────────────────────────────────────────────────────
-- One row per stage per treatment plan. movement_data is per-tooth deltas.
-- attachment_data: list of { tooth, type } objects.
-- ipr_data: list of { toothA, toothB, amountMm } objects.

CREATE TABLE IF NOT EXISTS aligner_stages (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    treatment_plan_id   uuid        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    stage_number        int         NOT NULL,
    movement_data       jsonb       NOT NULL DEFAULT '{}',   -- { "11": { tx, ty, tz, rx, ry, rz }, ... }
    attachment_data     jsonb       NOT NULL DEFAULT '[]',   -- [{ tooth, type, shape }]
    ipr_data            jsonb       NOT NULL DEFAULT '[]',   -- [{ toothA, toothB, amountMm }]
    maxillary_mesh_path text,
    mandibular_mesh_path text,
    velocity_mm_per_week double precision,
    is_approved         boolean     NOT NULL DEFAULT false,
    approved_by         uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    approved_at         timestamptz,
    created_at          timestamptz DEFAULT now(),
    UNIQUE(treatment_plan_id, stage_number)
);

CREATE INDEX IF NOT EXISTS idx_aligner_stages_plan     ON aligner_stages(treatment_plan_id, stage_number);
CREATE INDEX IF NOT EXISTS idx_aligner_stages_case     ON aligner_stages(case_id);

-- ─── Cephalometric Analyses ──────────────────────────────────────────────────
-- Stores landmark coordinates and computed measurements for ceph X-rays.

CREATE TABLE IF NOT EXISTS cephalometric_analyses (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    image_path          text,
    landmarks           jsonb       NOT NULL DEFAULT '{}',
    -- Computed measurements (degrees unless noted)
    sna_deg             double precision,
    snb_deg             double precision,
    anb_deg             double precision,
    wits_mm             double precision,
    fma_deg             double precision,   -- Frankfort Mandibular Angle
    impa_deg            double precision,   -- Incisor Mandibular Plane Angle
    fmia_deg            double precision,
    ui_sn_deg           double precision,   -- Upper incisor to SN
    li_mp_deg           double precision,   -- Lower incisor to mandibular plane
    interincisal_deg    double precision,
    facial_axis_deg     double precision,
    gonial_angle_deg    double precision,
    pg_na_mm            double precision,   -- Pg to NA (mm)
    soft_tissue         jsonb       NOT NULL DEFAULT '{}',
    -- Classification
    skeletal_class      text,   -- I | II | III
    vertical_pattern    text,   -- hypodivergent | normodivergent | hyperdivergent
    growth_pattern      text,   -- horizontal | average | vertical
    ai_notes            text,
    created_by          uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ceph_case        ON cephalometric_analyses(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ceph_org         ON cephalometric_analyses(organization_id);

-- ─── QC Checks ───────────────────────────────────────────────────────────────
-- Per-print-job quality control check items.

CREATE TABLE IF NOT EXISTS qc_checks (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    print_job_id    uuid        NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
    check_type      text        NOT NULL,
    -- print_quality | model_integrity | thickness_verification | fit_verification
    -- surface_finish | dimensional_accuracy | material_compliance
    status          text        NOT NULL DEFAULT 'pending',  -- pending | pass | fail | warning
    measured_value  double precision,
    expected_min    double precision,
    expected_max    double precision,
    unit            text,
    notes           text,
    checked_by      uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    checked_at      timestamptz,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_checks_job ON qc_checks(print_job_id);

-- Seed QC check templates (inserted when a print job is created)
-- These are inserted per print_job by the application layer, not here.

-- ─── Patient Portal Invites ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_portal_invites (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_hash      text        NOT NULL UNIQUE,
    email           text        NOT NULL,
    expires_at      timestamptz NOT NULL,
    accepted_at     timestamptz,
    created_by      uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_invites_patient ON patient_portal_invites(patient_id);
CREATE INDEX IF NOT EXISTS idx_portal_invites_token   ON patient_portal_invites(token_hash);

-- ─── Photo type constraint ────────────────────────────────────────────────────
-- patient_photos.photo_type already has a CHECK constraint from migration 007
-- if it doesn't, add the 15 standard orthodontic photo types.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'patient_photos' AND constraint_type = 'CHECK'
          AND constraint_name = 'patient_photos_photo_type_check'
    ) THEN
        ALTER TABLE patient_photos
            ADD CONSTRAINT patient_photos_photo_type_check
            CHECK (photo_type IN (
                'frontal_rest', 'frontal_smile', 'profile_rest', 'profile_smile',
                'three_quarter', 'three_quarter_smile',
                'intraoral_frontal', 'intraoral_upper_occlusal', 'intraoral_lower_occlusal',
                'buccal_left', 'buccal_right', 'buccal_both',
                'panoramic', 'lateral_ceph', 'other'
            ));
    END IF;
END $$;
