-- Token hardening and session revocation for auth_users.
--
-- 1. Rename verification_token → verification_token_hash  (consistent with reset_token_hash)
-- 2. Add sessions_invalidated_at for post-password-reset session revocation
--
-- Idempotent: all changes wrapped in DO blocks.

DO $$
BEGIN
  -- Rename column if the old name still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'verification_token'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'verification_token_hash'
  ) THEN
    ALTER TABLE auth_users RENAME COLUMN verification_token TO verification_token_hash;
  END IF;

  -- Add sessions_invalidated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'sessions_invalidated_at'
  ) THEN
    ALTER TABLE auth_users ADD COLUMN sessions_invalidated_at timestamptz DEFAULT NULL;
  END IF;
END
$$;

-- Replace old partial index with one on the renamed column
DROP INDEX IF EXISTS idx_auth_users_verification_token;

CREATE INDEX IF NOT EXISTS idx_auth_users_verification_token_hash
  ON auth_users (verification_token_hash)
  WHERE verification_token_hash IS NOT NULL;
