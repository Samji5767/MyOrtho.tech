-- Migration 065: Pilot readiness tables
-- pilot_feedback, onboarding_checklists, demo_data marker column

-- ── Pilot feedback ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pilot_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submitted_by    UUID NOT NULL REFERENCES auth_users(id) ON DELETE SET NULL,
  category        TEXT NOT NULL CHECK (category IN (
    'bug','usability','clinical_workflow','manufacturing','missing_capability',
    'performance','training_request','general'
  )),
  severity        TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')) DEFAULT 'medium',
  page_route      TEXT,
  browser_info    TEXT,
  correlation_id  TEXT,
  description     TEXT NOT NULL,
  screenshot_ref  TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','triaged','in_progress','resolved','wont_fix')),
  assigned_to     UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org ON pilot_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_pilot_feedback_status ON pilot_feedback(status);
CREATE INDEX IF NOT EXISTS idx_pilot_feedback_category ON pilot_feedback(category);
CREATE INDEX IF NOT EXISTS idx_pilot_feedback_submitted_by ON pilot_feedback(submitted_by);

-- ── Onboarding checklists ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  step_key        TEXT NOT NULL,
  completed       BOOLEAN NOT NULL DEFAULT false,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_org ON onboarding_checklists(organization_id);

-- ── Demo data marker on patients ──────────────────────────────────────────────
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_patients_is_demo ON patients(is_demo) WHERE is_demo = true;

-- ── Demo data marker on cases ─────────────────────────────────────────────────
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_cases_is_demo ON cases(is_demo) WHERE is_demo = true;
