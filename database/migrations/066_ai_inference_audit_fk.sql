-- Migration 066: Add foreign key constraints to ai_inference_audit
--
-- The table was created in 062 without FK constraints on case_id, patient_id,
-- invoked_by, and organization_id. Audit records must survive the deletion of
-- the referenced entity (they are legal records), so all non-org FKs use
-- ON DELETE SET NULL. organization_id uses ON DELETE RESTRICT to prevent
-- silent data loss — an org cannot be deleted while audit records exist.
--
-- Idempotent: each ADD CONSTRAINT is guarded by a DO block that checks
-- pg_constraint before executing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_audit_case'
  ) THEN
    ALTER TABLE ai_inference_audit
      ADD CONSTRAINT fk_ai_audit_case
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_audit_patient'
  ) THEN
    ALTER TABLE ai_inference_audit
      ADD CONSTRAINT fk_ai_audit_patient
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_audit_invoked_by'
  ) THEN
    -- invoked_by is NOT NULL, so RESTRICT is correct: a user with audit records
    -- must be soft-deleted (deactivated) rather than hard-deleted.
    ALTER TABLE ai_inference_audit
      ADD CONSTRAINT fk_ai_audit_invoked_by
      FOREIGN KEY (invoked_by) REFERENCES auth_users(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_audit_org'
  ) THEN
    ALTER TABLE ai_inference_audit
      ADD CONSTRAINT fk_ai_audit_org
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
  END IF;
END $$;
