-- Idempotent performance indexes for v1.0.0-rc2
-- All wrapped in DO blocks for fresh-install safety

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_org ON notifications (user_id, organization_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, organization_id) WHERE read_at IS NULL';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cases') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cases_org_status ON cases (organization_id, status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cases_patient_id ON cases (patient_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_events_org_created ON audit_events (organization_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events (resource_type, resource_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'copilot_messages') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_copilot_messages_conversation ON copilot_messages (conversation_id, created_at)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'treatment_plans') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_treatment_plans_case_id ON treatment_plans (case_id)';
  END IF;
END $$;
