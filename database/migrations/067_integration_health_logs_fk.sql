-- Add FK constraint on integration_health_logs.organization_id (was NOT NULL but unconstrained).
-- Idempotent: skipped if constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_integration_health_logs_org'
      AND conrelid = 'integration_health_logs'::regclass
  ) THEN
    ALTER TABLE integration_health_logs
      ADD CONSTRAINT fk_integration_health_logs_org
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;
