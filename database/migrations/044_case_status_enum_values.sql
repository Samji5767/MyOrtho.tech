-- Migration 044: Add missing case_status ENUM values
--
-- schema.sql seeded case_status with the legacy set:
--   draft, scan_uploaded, segmenting, planning, pending_approval, approved,
--   staging, manufacturing, completed, canceled
--
-- The application (from migration 002 onward) expects the extended set used
-- in WorkflowService TRANSITIONS:
--   scan_review, segmentation, clinical_review, active_treatment, monitoring,
--   retention, archived, cancelled
--
-- PostgreSQL allows adding ENUM values but not removing them, so the old
-- values are kept for now (they do not appear in TRANSITIONS so they are
-- unreachable by the workflow engine).
--
-- Safe to re-run: every ADD VALUE is guarded with IF NOT EXISTS.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'case_status' AND e.enumlabel = 'scan_review') THEN
    ALTER TYPE case_status ADD VALUE 'scan_review';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'case_status' AND e.enumlabel = 'segmentation') THEN
    ALTER TYPE case_status ADD VALUE 'segmentation';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'case_status' AND e.enumlabel = 'clinical_review') THEN
    ALTER TYPE case_status ADD VALUE 'clinical_review';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'case_status' AND e.enumlabel = 'active_treatment') THEN
    ALTER TYPE case_status ADD VALUE 'active_treatment';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'case_status' AND e.enumlabel = 'monitoring') THEN
    ALTER TYPE case_status ADD VALUE 'monitoring';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'case_status' AND e.enumlabel = 'retention') THEN
    ALTER TYPE case_status ADD VALUE 'retention';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'case_status' AND e.enumlabel = 'archived') THEN
    ALTER TYPE case_status ADD VALUE 'archived';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'case_status' AND e.enumlabel = 'cancelled') THEN
    ALTER TYPE case_status ADD VALUE 'cancelled';
  END IF;
END $$;
