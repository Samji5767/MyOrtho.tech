-- Migration 031: RC-1 — Missing FK indexes and high-value composite indexes
--
-- Adds indexes for every foreign-key column that had no index, prioritising:
--   1. Columns used in ON DELETE CASCADE (mandatory for DELETE performance)
--   2. Columns used in high-volume JOIN/filter patterns (case_id, patient_id,
--      plan_id, organization_id where not already a composite leading key)
--   3. Actor columns (created_by, approved_by, reviewed_by) for audit queries
--
-- All statements use IF NOT EXISTS — safe to re-run.
-- Does NOT use WHERE clauses that reference columns not guaranteed to exist
-- (e.g. deleted_at) to avoid errors on fresh schemas.

BEGIN;

-- ── Core clinical: patients / cases ──────────────────────────────────────────

-- patients.created_by → auth_users (for user-activity queries)
CREATE INDEX IF NOT EXISTS idx_patients_created_by
  ON patients(created_by);

-- cases.created_by → auth_users (no existing index)
CREATE INDEX IF NOT EXISTS idx_cases_created_by
  ON cases(created_by);

-- ── Clinical measurements ─────────────────────────────────────────────────────

-- clinical_measurements.measured_by → auth_users
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'clinical_measurements' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clinical_measurements_measured_by ON clinical_measurements(measured_by)';
  END IF;
END $$;

-- ── Subscriptions ─────────────────────────────────────────────────────────────

-- organization_subscriptions.plan_id → subscription_plans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'organization_subscriptions' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_org_subscriptions_plan_id ON organization_subscriptions(plan_id)';
  END IF;
END $$;

-- ── Manufacturing / print jobs ────────────────────────────────────────────────

-- print_jobs.case_id → cases
-- schema.sql creates print_jobs WITHOUT case_id; migration 026 adds it only when
-- the table doesn't already exist. Guard to avoid failing on legacy VPS installs.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'print_jobs' AND column_name = 'case_id'
             AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_print_jobs_case_id ON print_jobs(case_id)';
  END IF;
END $$;

-- print_jobs.created_by → auth_users (added by migration 003)
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_by
  ON print_jobs(created_by);

-- ── Treatment stages ──────────────────────────────────────────────────────────

-- treatment_stages.approved_by → auth_users (column added in migration 029)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'treatment_stages' AND column_name = 'approved_by'
             AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_treatment_stages_approved_by ON treatment_stages(approved_by)';
  END IF;
END $$;

-- ── IPR / attachment (columns added by migration 029 DO blocks) ───────────────

-- ipr_points.completed_by → auth_users (table is legacy VPS; column added by migration 029)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'ipr_points' AND column_name = 'completed_by'
             AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ipr_points_completed_by ON ipr_points(completed_by)';
  END IF;
END $$;

-- digital_setups.parent_setup_id → digital_setups (column added by migration 029)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'digital_setups' AND column_name = 'parent_setup_id'
             AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_digital_setups_parent_id ON digital_setups(parent_setup_id)';
  END IF;
END $$;

-- ── CBCT / fusion ─────────────────────────────────────────────────────────────

-- cbct_stl_fusions.reviewed_by / created_by → auth_users
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'cbct_stl_fusions' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cbct_fusions_reviewed_by ON cbct_stl_fusions(reviewed_by)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cbct_fusions_created_by ON cbct_stl_fusions(created_by)';
  END IF;
END $$;

-- cbct_scans.uploaded_by → auth_users
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'cbct_scans' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cbct_scans_uploaded_by ON cbct_scans(uploaded_by)';
  END IF;
END $$;

-- ── Scan processing results (ON DELETE CASCADE FKs without indexes) ───────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'scan_orientation_results' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_scan_orient_job_id ON scan_orientation_results(job_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'scan_cleanup_results' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_scan_cleanup_job_id ON scan_cleanup_results(job_id)';
  END IF;
END $$;

-- ── Off-track / monitoring ────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'off_track_alerts' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_off_track_plan_id ON off_track_alerts(plan_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_off_track_check_in_id ON off_track_alerts(check_in_id)';
  END IF;
END $$;

-- ── Supply chain ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'purchase_orders' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON purchase_orders(vendor_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'purchase_order_items' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_order_items_inv_id ON purchase_order_items(inventory_item_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'inventory_transactions' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_transactions_case_id ON inventory_transactions(case_id)';
  END IF;
END $$;

-- ── Patient-facing tables ─────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'clinical_alerts' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clinical_alerts_patient_id ON clinical_alerts(patient_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'radiology_images' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_radiology_images_patient_id ON radiology_images(patient_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'compliance_check_ins' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_compliance_check_ins_patient_id ON compliance_check_ins(patient_id)';
  END IF;
END $$;

-- ── Insurance / billing ───────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'insurance_preauths' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_insurance_preauths_plan_id ON insurance_preauths(insurance_plan_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_insurance_preauths_created_by ON insurance_preauths(created_by)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'revenue_transactions' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_revenue_transactions_case_id ON revenue_transactions(case_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_revenue_transactions_patient_id ON revenue_transactions(patient_id)';
  END IF;
END $$;

-- ── Scheduling ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'schedule_slots' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_schedule_slots_location_id ON schedule_slots(location_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_schedule_slots_booked_case ON schedule_slots(booked_for_case)';
  END IF;
END $$;

-- ── Intake forms ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'intake_submissions' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_intake_submissions_patient_id ON intake_submissions(patient_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_intake_submissions_case_id ON intake_submissions(case_id)';
  END IF;
END $$;

-- ── FHIR exports ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'fhir_exports' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fhir_exports_patient_id ON fhir_exports(patient_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fhir_exports_case_id ON fhir_exports(case_id)';
  END IF;
END $$;

-- ── Lab orders / revisions ────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'lab_revisions' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lab_revisions_order_id ON lab_revisions(order_id)';
  END IF;
END $$;

-- ── Referrals ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'referrals' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_referrals_created_by ON referrals(created_by)';
  END IF;
END $$;

-- ── Patient education ─────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'patient_education_assignments' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_edu_assignments_patient_id ON patient_education_assignments(patient_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_edu_assignments_content_id ON patient_education_assignments(content_id)';
  END IF;
END $$;

-- ── Documents ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'documents' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)';
  END IF;
END $$;

-- ── Clinical tasks ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'clinical_tasks' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clinical_tasks_patient_id ON clinical_tasks(patient_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clinical_tasks_created_by ON clinical_tasks(created_by)';
  END IF;
END $$;

-- ── Surveys ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'survey_responses' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_survey_responses_patient_id ON survey_responses(patient_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_survey_responses_case_id ON survey_responses(case_id)';
  END IF;
END $$;

-- ── Post-processing jobs ──────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'post_processing_jobs' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_postproc_print_job_id ON post_processing_jobs(print_job_id)';
  END IF;
END $$;

-- ── Composite indexes for high-volume queries not yet covered ─────────────────

-- cases(patient_id, organization_id): patient case listing filtered by org
-- organization_id is NOT in base schema; added by migration 034.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'cases' AND column_name = 'organization_id'
             AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cases_patient_org ON cases(patient_id, organization_id)';
  END IF;
END $$;

-- treatment_stages(treatment_plan_id, qa_status): manufacturing QA queries
-- Both columns are optional additions; guard each before creating composite index.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'treatment_stages' AND column_name = 'treatment_plan_id'
             AND table_schema = 'public')
  AND EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'treatment_stages' AND column_name = 'qa_status'
              AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_treatment_stages_plan_qa ON treatment_stages(treatment_plan_id, qa_status)';
  END IF;
END $$;

-- audit_events(organization_id, resource_type, created_at DESC): resource-type
-- audit drill-down (narrows the existing idx_audit_events_org)
CREATE INDEX IF NOT EXISTS idx_audit_events_org_type
  ON audit_events(organization_id, resource_type, created_at DESC);

-- ── Correct naming collision from migration 029 ───────────────────────────────
-- Migration 029 intended to create a partial index on cases(patient_id) for
-- active-only case listing, but used the same name as migration 021's index
-- idx_cases_org_status, so the IF NOT EXISTS guard silently skipped it.
-- Guard on cases.status existence for compatibility with older VPS schemas.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'cases' AND column_name = 'status'
             AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cases_patient_active
      ON cases(patient_id, status)
      WHERE status NOT IN (''completed'', ''canceled'')';
  END IF;
END $$;

COMMIT;
