-- Add email verification and password reset columns to auth_users.
-- Idempotent: each ALTER is wrapped in a DO block that checks IF NOT EXISTS.

DO $$
BEGIN
  -- Email verification timestamp (NULL = unverified)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'email_verified_at'
  ) THEN
    ALTER TABLE auth_users ADD COLUMN email_verified_at timestamptz DEFAULT NULL;
  END IF;

  -- Raw (unhashed) email verification token — short-lived, single-use
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'verification_token'
  ) THEN
    ALTER TABLE auth_users ADD COLUMN verification_token text DEFAULT NULL;
  END IF;

  -- Expiration for verification token
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'verification_token_expires_at'
  ) THEN
    ALTER TABLE auth_users ADD COLUMN verification_token_expires_at timestamptz DEFAULT NULL;
  END IF;

  -- SHA-256 hash of the password reset token (never stored in plaintext)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'reset_token_hash'
  ) THEN
    ALTER TABLE auth_users ADD COLUMN reset_token_hash text DEFAULT NULL;
  END IF;

  -- Expiration for password reset token (15-minute window)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'reset_token_expires_at'
  ) THEN
    ALTER TABLE auth_users ADD COLUMN reset_token_expires_at timestamptz DEFAULT NULL;
  END IF;
END
$$;

-- Mark existing admin account as verified so bootstrap admin can log in immediately
UPDATE auth_users
SET email_verified_at = now()
WHERE role = 'super_admin' AND email_verified_at IS NULL;

-- Index for quick token lookups
CREATE INDEX IF NOT EXISTS idx_auth_users_verification_token
  ON auth_users (verification_token)
  WHERE verification_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_users_reset_token_hash
  ON auth_users (reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;
