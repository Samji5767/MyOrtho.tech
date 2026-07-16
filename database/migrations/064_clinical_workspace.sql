-- Migration 064: Clinical Workspace
-- Idempotent DDL for case discussions, patient timeline notes, and saved searches

-- ─── Patient timeline notes (manual/custom events) ───────────────────────────
CREATE TABLE IF NOT EXISTS patient_timeline_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES auth_users(id),
  note TEXT NOT NULL,
  event_type VARCHAR(50) NOT NULL DEFAULT 'note',
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Case discussions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth_users(id),
  content TEXT NOT NULL,
  mentioned_user_ids UUID[] NOT NULL DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth_users(id),
  parent_id UUID REFERENCES case_discussions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Saved searches ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  query TEXT NOT NULL DEFAULT '',
  filters JSONB NOT NULL DEFAULT '{}',
  scope VARCHAR(50) NOT NULL DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patient_timeline_notes_patient
  ON patient_timeline_notes(patient_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_timeline_notes_org
  ON patient_timeline_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_discussions_case
  ON case_discussions(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_discussions_org
  ON case_discussions(organization_id, case_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user
  ON saved_searches(user_id, organization_id);
