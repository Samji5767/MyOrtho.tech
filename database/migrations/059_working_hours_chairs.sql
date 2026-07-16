-- 059: Working hours and chair management
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS working_hours (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID       NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id   UUID         REFERENCES org_locations(id) ON DELETE CASCADE,
  day_of_week   SMALLINT     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time     TIME         NOT NULL DEFAULT '08:00',
  close_time    TIME         NOT NULL DEFAULT '17:00',
  is_open       BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_working_hours_unique
  ON working_hours (organization_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid), day_of_week);

CREATE INDEX IF NOT EXISTS idx_working_hours_org ON working_hours(organization_id);

CREATE TABLE IF NOT EXISTS chairs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     UUID        REFERENCES org_locations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  chair_type      TEXT        NOT NULL DEFAULT 'treatment'
                              CHECK (chair_type IN ('treatment','consultation','imaging','lab')),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chairs_org      ON chairs(organization_id);
CREATE INDEX IF NOT EXISTS idx_chairs_location ON chairs(location_id);
