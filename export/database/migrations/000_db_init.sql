-- Mock Supabase Auth Schema for local Postgres dev database
CREATE SCHEMA IF NOT EXISTS auth;

-- Create a mock auth.users table if not exists
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Mock the auth.uid() function used by RLS policies
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  -- Retrieve user ID from JWT claims or fallback to Dr. Sarah Jenkins profile
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (SELECT id FROM auth.users WHERE email = 'sarah.jenkins@myortho.tech' LIMIT 1)
  );
$$;
