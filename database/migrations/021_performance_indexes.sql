-- Phase 11: Performance indexes
-- All indexes use IF NOT EXISTS to be idempotent
-- Covering indexes are chosen based on the most common query patterns

-- ─── Core entity lookups ──────────────────────────────────────────────────────

-- Cases: primary access patterns
CREATE INDEX IF NOT EXISTS idx_cases_org_status
  ON cases (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cases_org_created
  ON cases (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Patients: org-scoped lookup
CREATE INDEX IF NOT EXISTS idx_patients_org_id
  ON patients (organization_id);

CREATE INDEX IF NOT EXISTS idx_patients_org_name
  ON patients (organization_id, last_name, first_name)
  WHERE deleted_at IS NULL;

-- Scans: case FK with jaw type for filtering
CREATE INDEX IF NOT EXISTS idx_scans_case_id
  ON scans (case_id);

CREATE INDEX IF NOT EXISTS idx_scans_org_case
  ON scans (organization_id, case_id);

-- ─── Treatment planning ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_treatment_plans_case_id
  ON treatment_plans (case_id);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_org_status
  ON treatment_plans (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_movement_prescriptions_plan_id
  ON movement_prescriptions (plan_id);

CREATE INDEX IF NOT EXISTS idx_aligner_generation_plans_plan_id
  ON aligner_generation_plans (plan_id);

-- ─── Aligner stages ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_aligner_stages_plan_id
  ON aligner_stages (plan_id, stage_number);

-- ─── Monitoring & quality ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_treatment_check_ins_case_id
  ON treatment_check_ins (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_off_track_alerts_case_id
  ON off_track_alerts (case_id, resolved_at)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_quality_scores_plan_id
  ON treatment_quality_scores (plan_id);

-- ─── PDL / biomechanics ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pdl_simulation_results_plan_id
  ON pdl_simulation_results (plan_id);

CREATE INDEX IF NOT EXISTS idx_attachment_force_analysis_plan_id
  ON attachment_force_analysis (plan_id);

-- ─── IPR ──────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ipr_contacts_plan_id
  ON ipr_contacts (plan_id);

CREATE INDEX IF NOT EXISTS idx_ipr_enamel_estimates_plan_id
  ON ipr_enamel_estimates (plan_id);

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

-- ─── Audit log ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_log_org_created
  ON audit_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_resource
  ON audit_log (resource_type, resource_id);

-- ─── Export / billing ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_export_packages_case_id
  ON export_packages (case_id);

CREATE INDEX IF NOT EXISTS idx_export_transactions_org_created
  ON export_transactions (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id
  ON subscriptions (organization_id);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read_at)
  WHERE read_at IS NULL;

-- ─── Manufacturing ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_print_jobs_org_status
  ON print_jobs (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_status
  ON print_jobs (printer_id, status)
  WHERE status IN ('queued', 'printing');

-- ─── Arch coordination / retention ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_arch_coordination_plans_plan_id
  ON arch_coordination_plans (plan_id);

CREATE INDEX IF NOT EXISTS idx_retention_protocols_plan_id
  ON retention_protocols (plan_id);
