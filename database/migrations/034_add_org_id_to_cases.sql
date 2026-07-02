-- Migration 034: Add organization_id to cases and scans
-- cases is currently scoped only via patient_id → patients.organization_id.
-- Many service queries (BI, admin, FHIR) reference cases.organization_id directly.
-- This migration adds the column, backfills it, adds a NOT NULL constraint,
-- and creates covering indexes used throughout the application.

-- ─── cases.organization_id ────────────────────────────────────────────────────

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill from patients.organization_id
UPDATE cases c
SET organization_id = p.organization_id
FROM patients p
WHERE c.patient_id = p.id
  AND c.organization_id IS NULL;

-- Only enforce NOT NULL if every row was backfilled (guards against orphaned cases).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM cases WHERE organization_id IS NULL) THEN
    EXECUTE 'ALTER TABLE cases ALTER COLUMN organization_id SET NOT NULL';
  END IF;
END $$;

-- ─── Indexes for cases.organization_id ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cases_org_status
  ON cases (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_cases_org_created
  ON cases (organization_id, created_at DESC);

-- ─── scans.organization_id ────────────────────────────────────────────────────
-- scans references cases(id); adding organization_id makes org-scoped queries
-- possible without joining through cases.

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill via cases → patients chain
UPDATE scans s
SET organization_id = c.organization_id
FROM cases c
WHERE s.case_id = c.id
  AND s.organization_id IS NULL;

-- NOT NULL: a scan without an org-linked case is orphaned; backfill covers all valid rows.
-- Allow NULL for scans that exist without a case_id (unlikely but possible).

CREATE INDEX IF NOT EXISTS idx_scans_org_case
  ON scans (organization_id, case_id);
