-- Migration 049: Fix scans.uploaded_by FK to reference auth_users instead of profiles
--
-- schema.sql creates scans.uploaded_by as REFERENCES profiles(id).
-- On the VPS deployment the profiles table is never populated (users are stored
-- in auth_users, not in Supabase's profiles). Every scan upload therefore fails
-- with a FK constraint violation, producing HTTP 500 ("Internal server error")
-- which Safari reports as "Load failed".
--
-- Fix: drop the profiles FK and add an auth_users FK instead.
-- Idempotent: all statements use IF EXISTS / NOT EXISTS guards.

-- Step 1: Null out any uploaded_by values that can't be matched in auth_users
--         (handles any stale references from testing / seeding)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'auth_users' AND table_schema = 'public'
  ) THEN
    UPDATE scans
    SET uploaded_by = NULL
    WHERE uploaded_by IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM auth_users WHERE id = scans.uploaded_by);
  END IF;
END $$;

-- Step 2: Drop the profiles FK if it exists
DO $$ DECLARE
  v_con text;
BEGIN
  SELECT c.conname INTO v_con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_class ref ON ref.oid = c.confrelid
  WHERE t.relname = 'scans'
    AND c.contype = 'f'
    AND c.conkey = ARRAY(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = t.oid AND attname = 'uploaded_by'
    )
    AND ref.relname = 'profiles';

  IF v_con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE scans DROP CONSTRAINT ' || quote_ident(v_con);
  END IF;
END $$;

-- Step 3: Add FK to auth_users (only if auth_users table exists and constraint is absent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'auth_users' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'scans'
      AND c.contype = 'f'
      AND c.conname = 'scans_uploaded_by_auth_fkey'
  ) THEN
    ALTER TABLE scans
      ADD CONSTRAINT scans_uploaded_by_auth_fkey
      FOREIGN KEY (uploaded_by) REFERENCES auth_users(id) ON DELETE SET NULL;
  END IF;
END $$;
