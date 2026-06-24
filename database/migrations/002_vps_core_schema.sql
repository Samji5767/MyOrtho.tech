-- ============================================================================
-- Migration 002: VPS-native core clinical schema
--
-- Purpose: Extends the base schema (schema.sql) with VPS-native columns
-- and tables that reference auth_users instead of Supabase profiles.
-- Safe to re-run: all statements use IF NOT EXISTS / DO $$ guards.
-- Run after: 001_auth_users.sql and schema.sql
-- ============================================================================

-- ─── 1. Patients ─────────────────────────────────────────────────────────────
-- Schema.sql creates a patients table. We add VPS-native columns if they don't
-- exist, and create the table from scratch if it was never created.

CREATE TABLE IF NOT EXISTS patients (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    first_name      text        NOT NULL,
    last_name       text        NOT NULL,
    date_of_birth   date,
    gender          text        CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    clinical_notes  text,
    created_by      uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- Add created_by column to patients if it didn't exist from schema.sql
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE patients
            ADD COLUMN created_by uuid REFERENCES auth_users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patients_org_id ON patients(organization_id);

-- ─── 2. Cases — add VPS-native columns ───────────────────────────────────────
-- Schema.sql creates cases with dentist_id → profiles (Supabase).
-- We add new columns that reference auth_users without removing the old ones.

CREATE TABLE IF NOT EXISTS cases (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          uuid        REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    assigned_to         uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    status              text        NOT NULL DEFAULT 'draft',
    chief_complaint     text,
    malocclusion_class  text,
    notes               text,
    created_by          uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Add columns to existing cases table if created by schema.sql
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cases' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE cases
            ADD COLUMN assigned_to uuid REFERENCES auth_users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cases' AND column_name = 'chief_complaint'
    ) THEN
        ALTER TABLE cases ADD COLUMN chief_complaint text;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cases' AND column_name = 'malocclusion_class'
    ) THEN
        ALTER TABLE cases ADD COLUMN malocclusion_class text;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cases' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE cases
            ADD COLUMN created_by uuid REFERENCES auth_users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure status column is text (may be an enum in schema.sql)
-- We let it coexist with the enum type; text values are compatible
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cases' AND column_name = 'status'
    ) THEN
        ALTER TABLE cases ADD COLUMN status text NOT NULL DEFAULT 'draft';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cases_patient_id  ON cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_cases_status_text ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to);

-- ─── 3. Workflow Events (immutable transition log) ────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_events (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id     uuid        REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    from_status text,
    to_status   text        NOT NULL,
    actor_id    uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    actor_role  text,
    notes       text,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_case_id ON workflow_events(case_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_actor   ON workflow_events(actor_id);

-- ─── 4. Audit Events (append-only compliance log) ────────────────────────────

CREATE TABLE IF NOT EXISTS audit_events (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id        uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    actor_email     text,
    resource_type   text        NOT NULL,
    resource_id     uuid,
    action          text        NOT NULL,
    details         jsonb       DEFAULT '{}'::jsonb,
    ip_address      text,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_org      ON audit_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor    ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts       ON audit_events(created_at DESC);
