-- Migration 001: auth_users table
-- Run on existing deployed databases that already have the base schema.
-- Safe to re-run: all statements use IF NOT EXISTS guards.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS auth_users (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           text        UNIQUE NOT NULL,
  password_hash   text        NOT NULL,
  full_name       text,
  role            text        NOT NULL DEFAULT 'orthodontist',
  organization_id uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  is_onboarded    boolean     NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  last_login_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);

-- Verify
DO $$ BEGIN
  RAISE NOTICE 'auth_users table ready (migration 001)';
END $$;
