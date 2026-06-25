-- ============================================================================
-- Migration 003: Phases 15D–15F enterprise clinical schema additions
--
-- Phase 15D: Tooth movement data model + clinical measurements
-- Phase 15E: Printer connector states + job failure tracking
-- Phase 15F: Persistent segmentation jobs (replaces in-memory map)
--
-- Safe to re-run: all statements use IF NOT EXISTS / DO $$ guards.
-- Run after: 001_auth_users.sql, schema.sql, 002_vps_core_schema.sql
-- ============================================================================

-- ─── Phase 15D: Tooth Movements ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tooth_movements (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id        uuid        REFERENCES aligner_stages(id) ON DELETE CASCADE NOT NULL,
    fdi_number      int         NOT NULL CHECK (fdi_number BETWEEN 11 AND 48),
    -- Translation (mm)
    translate_x     float       NOT NULL DEFAULT 0,
    translate_y     float       NOT NULL DEFAULT 0,
    translate_z     float       NOT NULL DEFAULT 0,
    -- Rotation (degrees)
    rotate_x        float       NOT NULL DEFAULT 0,
    rotate_y        float       NOT NULL DEFAULT 0,
    rotate_z        float       NOT NULL DEFAULT 0,
    -- Clinical values (degrees/mm)
    tip             float       NOT NULL DEFAULT 0,
    torque          float       NOT NULL DEFAULT 0,
    intrusion       float       NOT NULL DEFAULT 0,
    extrusion       float       NOT NULL DEFAULT 0,
    -- State
    is_locked       boolean     NOT NULL DEFAULT false,
    notes           text,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE (stage_id, fdi_number)
);

CREATE INDEX IF NOT EXISTS idx_tooth_movements_stage ON tooth_movements(stage_id);

-- ─── Phase 15D: Clinical Measurements ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinical_measurements (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id             uuid        REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    measured_by         uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    measurement_label   text,
    overjet_mm          float,
    overbite_mm         float,
    angle_class         text,
    distance_mm         float,
    notes               text,
    created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_measurements_case ON clinical_measurements(case_id);

-- ─── Phase 15E: Printer Connector Status ────────────────────────────────────

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'printers' AND column_name = 'connector_status'
    ) THEN
        ALTER TABLE printers
            ADD COLUMN connector_status text NOT NULL DEFAULT 'not_configured'
            CHECK (connector_status IN (
                'not_configured', 'connector_required', 'configured',
                'offline', 'online', 'error'
            ));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'printers' AND column_name = 'api_endpoint'
    ) THEN
        ALTER TABLE printers ADD COLUMN api_endpoint text;
    END IF;
END $$;

-- ─── Phase 15E: Print Job Failure Tracking ───────────────────────────────────

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'print_jobs' AND column_name = 'failure_reason'
    ) THEN
        ALTER TABLE print_jobs ADD COLUMN failure_reason text;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'print_jobs' AND column_name = 'retry_count'
    ) THEN
        ALTER TABLE print_jobs ADD COLUMN retry_count int NOT NULL DEFAULT 0;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'print_jobs' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE print_jobs
            ADD COLUMN created_by uuid REFERENCES auth_users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ─── Phase 15F: Persistent Segmentation Jobs ────────────────────────────────

CREATE TABLE IF NOT EXISTS segmentation_jobs (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    ai_job_id       text        NOT NULL UNIQUE,   -- AI engine job ID
    case_id         uuid        REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    scan_id         uuid        REFERENCES scans(id) ON DELETE CASCADE NOT NULL,
    organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    -- Status
    status          text        NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','processing','completed','failed','review_required')),
    failure_reason  text,
    -- AI engine metadata
    model_name      text,
    model_version   text,
    validation_status text      NOT NULL DEFAULT 'not_validated'
                    CHECK (validation_status IN ('not_validated','research_use_only','cleared')),
    disclaimer      text,
    -- Results
    teeth_detected  int,
    missing_teeth   int[]       DEFAULT '{}'::int[],
    confidence_scores jsonb     DEFAULT '{}'::jsonb,
    output_metadata   jsonb     DEFAULT '{}'::jsonb,
    -- Timestamps
    queued_at       timestamptz DEFAULT now(),
    started_at      timestamptz,
    completed_at    timestamptz,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_segmentation_jobs_ai_job_id ON segmentation_jobs(ai_job_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_jobs_case_id   ON segmentation_jobs(case_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_jobs_scan_id   ON segmentation_jobs(scan_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_jobs_org       ON segmentation_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_jobs_status    ON segmentation_jobs(status);

-- ─── Phase 15D: Scans original filename ─────────────────────────────────────

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scans' AND column_name = 'original_filename'
    ) THEN
        ALTER TABLE scans ADD COLUMN original_filename text;
    END IF;
END $$;
