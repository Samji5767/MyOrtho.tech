-- ============================================================================
-- Migration 043: Critical schema fixes
--
-- 1. patients.dob — schema.sql defined this as NOT NULL, but DOB is optional
--    in the application. Patient creation fails when DOB is omitted.
--    Make it nullable to match the application contract.
--
-- 2. patients — ensure the column is named 'dob' (migration 002 accidentally
--    named it 'date_of_birth'). If 'dob' is missing but 'date_of_birth'
--    exists, rename it.
--
-- 3. case_status — schema.sql creates this as an ENUM; on migration-only
--    deployments the ENUM doesn't exist and 'draft'::case_status fails.
--    Create it idempotently so both deployment paths work.
--    (The application has been updated to not cast, so this is a belt-and-
--    suspenders guard for mixed-schema deployments.)
--
-- Safe to re-run: all statements are guarded.
-- ============================================================================

-- 1. Rename date_of_birth → dob if the migration-002 column name was used
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'date_of_birth'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'dob'
    ) THEN
        ALTER TABLE patients RENAME COLUMN date_of_birth TO dob;
    END IF;
END $$;

-- 2. Make patients.dob nullable (DOB is optional in registration flow)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients'
          AND column_name = 'dob'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE patients ALTER COLUMN dob DROP NOT NULL;
    END IF;
END $$;

-- 3. Create case_status ENUM if it does not exist (migration-only deployments)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'case_status'
    ) THEN
        CREATE TYPE case_status AS ENUM (
            'draft',
            'scan_review',
            'segmentation',
            'planning',
            'clinical_review',
            'approved',
            'active_treatment',
            'monitoring',
            'retention',
            'completed',
            'archived',
            'cancelled'
        );
    END IF;
END $$;

-- 4. Add updated_at auto-update trigger to patients if not already present
--    (schema.sql omitted it; manual updates must set updated_at = now())
--    This is defensive only — the service already sets updated_at in UPDATE.
