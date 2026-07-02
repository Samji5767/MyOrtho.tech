-- Phase 11: Performance indexes
-- All indexes use IF NOT EXISTS to be idempotent
-- Covering indexes are chosen based on the most common query patterns

-- ─── Core entity lookups ──────────────────────────────────────────────────────

-- Cases: primary access patterns
-- NOTE: cases.organization_id does not exist in the base schema.
-- It is added via migration 034_add_org_id_to_cases.sql.
-- The idx_cases_org_status and idx_cases_org_created indexes are created there.

-- Patients: org-scoped lookup (patients.organization_id exists; patients has no deleted_at)
CREATE INDEX IF NOT EXISTS idx_patients_org_id
  ON patients (organization_id);

CREATE INDEX IF NOT EXISTS idx_patients_org_name
  ON patients (organization_id, last_name, first_name);

-- Scans: case FK with jaw type for filtering
-- NOTE: scans.organization_id does not exist in the base schema.
-- scans are org-scoped via case_id → cases.organization_id.
-- idx_scans_org_case is created in migration 034_add_org_id_to_cases.sql.
CREATE INDEX IF NOT EXISTS idx_scans_case_id
  ON scans (case_id);

-- ─── Treatment planning ───────────────────────────────────────────────────────

-- NOTE: treatment_plans.organization_id and treatment_plans.status do not exist
-- in the base schema. Scoped via case_id → cases.
CREATE INDEX IF NOT EXISTS idx_treatment_plans_case_id
  ON treatment_plans (case_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'movement_prescriptions' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_movement_prescriptions_plan_id ON movement_prescriptions (plan_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'aligner_generation_plans' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_aligner_generation_plans_plan_id ON aligner_generation_plans (plan_id)';
  END IF;
END $$;

-- ─── Aligner stages ───────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'aligner_stages' AND column_name = 'plan_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_aligner_stages_plan_id ON aligner_stages (plan_id, stage_number)';
  END IF;
END $$;

-- ─── Monitoring & quality ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_treatment_check_ins_case_id
  ON treatment_check_ins (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_off_track_alerts_case_id
  ON off_track_alerts (case_id, resolved_at)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_quality_scores_plan_id
  ON treatment_quality_scores (plan_id);

-- ─── PDL / biomechanics ───────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'pdl_simulation_results' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pdl_simulation_results_plan_id ON pdl_simulation_results (plan_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'attachment_force_analysis' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_attachment_force_analysis_plan_id ON attachment_force_analysis (plan_id)';
  END IF;
END $$;

-- ─── IPR ──────────────────────────────────────────────────────────────────────

-- ipr_plan_items uses treatment_plan_id (from migration 010_phase_22.sql)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'ipr_plan_items' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ipr_plan_items_plan_id ON ipr_plan_items (treatment_plan_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'ipr_enamel_estimates' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ipr_enamel_estimates_plan_id ON ipr_enamel_estimates (plan_id)';
  END IF;
END $$;

-- ─── Scan processing ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_scan_processing_jobs_scan_id
  ON scan_processing_jobs (scan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tooth_id_results_scan_id
  ON tooth_id_results (scan_id);

-- ─── CBCT ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cbct_scans_case_id
  ON cbct_scans (case_id);

CREATE INDEX IF NOT EXISTS idx_cbct_stl_fusions_case_id
  ON cbct_stl_fusions (case_id);

CREATE INDEX IF NOT EXISTS idx_bone_segments_fusion_id
  ON bone_segments (fusion_id);

-- ─── Audit events ─────────────────────────────────────────────────────────────

-- Table is audit_events (created in migration 002_vps_core_schema.sql)
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created
  ON audit_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_resource
  ON audit_events (resource_type, resource_id);

-- ─── Export / billing ─────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'export_packages' AND column_name = 'case_id'
             AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_export_packages_case_id ON export_packages (case_id)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_export_transactions_org_created
  ON export_transactions (organization_id, created_at DESC);

-- billing_subscriptions (from schema.sql line 678 and migration 002)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'billing_subscriptions' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_org_id ON billing_subscriptions (organization_id)';
  END IF;
END $$;

-- ─── Notifications ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_read
      ON notifications (user_id, read_at)
      WHERE read_at IS NULL';
  END IF;
END $$;

-- ─── Manufacturing ────────────────────────────────────────────────────────────
-- print_jobs is created in migration 026; guard for fresh-database ordering.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'print_jobs' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_print_jobs_org_status ON print_jobs (organization_id, status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_status
      ON print_jobs (printer_id, status)
      WHERE status IN (''queued'', ''printing'')';
  END IF;
END $$;

-- ─── Arch coordination / retention ───────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'arch_coordination_plans' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_arch_coordination_plans_plan_id ON arch_coordination_plans (plan_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'retention_protocols' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_retention_protocols_plan_id ON retention_protocols (plan_id)';
  END IF;
END $$;
