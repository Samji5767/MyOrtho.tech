-- Idempotent migration: add encrypted DOB column alongside existing date column
ALTER TABLE patients ADD COLUMN IF NOT EXISTS dob_encrypted TEXT;
