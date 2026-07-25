-- ============================================================================
-- Migration 073: notification_preferences — user preference storage
--
-- Notification preferences were previously stored in localStorage only,
-- meaning they were lost when the browser data was cleared and could not
-- be shared across devices or browser sessions.  This table persists the
-- preference map (a flat JSON object of boolean flags keyed by preference
-- name) server-side, scoped to the authenticated user.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id         uuid        PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  organization_id uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  prefs           jsonb       NOT NULL DEFAULT '{}',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_org
  ON notification_preferences(organization_id)
  WHERE organization_id IS NOT NULL;
