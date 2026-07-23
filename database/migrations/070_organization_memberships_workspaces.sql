-- ─── Migration 070: Organization memberships, workspaces, onboarding profiles ──
-- Adds multi-tenant membership tables and workspace abstraction.
-- Safe to run multiple times (all DDL is idempotent).

-- ─── organization_memberships ─────────────────────────────────────────────────
-- Replaces the single organization_id FK on auth_users for multi-tenant access.
-- The FK on auth_users is preserved for backward-compat (many query joins rely on it).

CREATE TABLE IF NOT EXISTS organization_memberships (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid        NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role              text        NOT NULL DEFAULT 'member',
  is_owner          boolean     NOT NULL DEFAULT false,
  invited_by        uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  CONSTRAINT uq_org_membership UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org  ON organization_memberships(organization_id);

-- ─── workspaces ───────────────────────────────────────────────────────────────
-- A workspace groups cases and people within an organization.
-- The first workspace for each org is created automatically and marked is_default.

CREATE TABLE IF NOT EXISTS workspaces (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  type              text        NOT NULL DEFAULT 'default'
                                CHECK (type IN ('default','clinical','lab','research')),
  is_default        boolean     NOT NULL DEFAULT false,
  settings          jsonb       DEFAULT '{}'::jsonb,
  created_by        uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(organization_id);

-- Only one default workspace per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_default
  ON workspaces(organization_id)
  WHERE is_default = true;

-- ─── workspace_memberships ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_memberships (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid        NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'member',
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT uq_workspace_membership UNIQUE (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user      ON workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace ON workspace_memberships(workspace_id);

-- ─── user_onboarding_profiles ─────────────────────────────────────────────────
-- Stores the rich preference data collected during the 7-step onboarding flow.

CREATE TABLE IF NOT EXISTS user_onboarding_profiles (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid        NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
  display_role      text,
  org_type          text,
  org_name          text,
  num_doctors       text,
  num_clinics       text,
  case_volume       text,
  primary_flow      text,
  cad_level         text,
  ai_readiness      text,
  enable_demo       boolean     DEFAULT false,
  primary_objective text,
  extra             jsonb       DEFAULT '{}'::jsonb,
  completed_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ─── Backfill: create membership rows for existing auth_users with an org ─────
INSERT INTO organization_memberships (user_id, organization_id, role, is_owner)
SELECT
  au.id,
  au.organization_id,
  au.role,
  true
FROM auth_users au
WHERE au.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.user_id = au.id AND om.organization_id = au.organization_id
  );

-- ─── Backfill: create a default workspace for orgs that have none ─────────────
INSERT INTO workspaces (organization_id, name, type, is_default)
SELECT
  o.id,
  o.name || ' Workspace',
  'default',
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w WHERE w.organization_id = o.id
);

-- ─── Backfill: add workspace memberships for all existing org members ─────────
INSERT INTO workspace_memberships (user_id, workspace_id, role)
SELECT
  om.user_id,
  w.id,
  om.role
FROM organization_memberships om
JOIN workspaces w
  ON w.organization_id = om.organization_id
  AND w.is_default = true
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_memberships wm
  WHERE wm.user_id = om.user_id AND wm.workspace_id = w.id
);
