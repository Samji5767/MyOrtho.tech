-- Migration 051: Migrate all remaining profiles FK constraints → auth_users
-- profiles table is empty on VPS; all user references must target auth_users.
-- For each table: NULL out orphaned values, drop old FK, add new FK to auth_users.

-- ── Helper: NULL-out helper pattern for each column ──────────────────────────
-- We run UPDATE … SET col = NULL WHERE col NOT IN (SELECT id FROM auth_users)
-- before re-adding the FK to avoid constraint violations on existing data.

-- 1. academy_certifications.profile_id
UPDATE academy_certifications SET profile_id = NULL
  WHERE profile_id IS NOT NULL AND profile_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE academy_certifications DROP CONSTRAINT IF EXISTS academy_certifications_profile_id_fkey;
ALTER TABLE academy_certifications
  ADD CONSTRAINT academy_certifications_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 2. ai_jobs.created_by
UPDATE ai_jobs SET created_by = NULL
  WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_created_by_fkey;
ALTER TABLE ai_jobs
  ADD CONSTRAINT ai_jobs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 3. appointments.dentist_id
UPDATE appointments SET dentist_id = NULL
  WHERE dentist_id IS NOT NULL AND dentist_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_dentist_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_dentist_id_fkey
  FOREIGN KEY (dentist_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 4. attachments.created_by
UPDATE attachments SET created_by = NULL
  WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_created_by_fkey;
ALTER TABLE attachments
  ADD CONSTRAINT attachments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 5. audit_logs.user_id
UPDATE audit_logs SET user_id = NULL
  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 6. capa_logs.reporter_id
UPDATE capa_logs SET reporter_id = NULL
  WHERE reporter_id IS NOT NULL AND reporter_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE capa_logs DROP CONSTRAINT IF EXISTS capa_logs_reporter_id_fkey;
ALTER TABLE capa_logs
  ADD CONSTRAINT capa_logs_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 7. cases.dentist_id
UPDATE cases SET dentist_id = NULL
  WHERE dentist_id IS NOT NULL AND dentist_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_dentist_id_fkey;
ALTER TABLE cases
  ADD CONSTRAINT cases_dentist_id_fkey
  FOREIGN KEY (dentist_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 8. cs_tickets.reporter_id
UPDATE cs_tickets SET reporter_id = NULL
  WHERE reporter_id IS NOT NULL AND reporter_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE cs_tickets DROP CONSTRAINT IF EXISTS cs_tickets_reporter_id_fkey;
ALTER TABLE cs_tickets
  ADD CONSTRAINT cs_tickets_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 9. device_history_records.operator_id
UPDATE device_history_records SET operator_id = NULL
  WHERE operator_id IS NOT NULL AND operator_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE device_history_records DROP CONSTRAINT IF EXISTS device_history_records_operator_id_fkey;
ALTER TABLE device_history_records
  ADD CONSTRAINT device_history_records_operator_id_fkey
  FOREIGN KEY (operator_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 10. digital_prescriptions.dentist_id
UPDATE digital_prescriptions SET dentist_id = NULL
  WHERE dentist_id IS NOT NULL AND dentist_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE digital_prescriptions DROP CONSTRAINT IF EXISTS digital_prescriptions_dentist_id_fkey;
ALTER TABLE digital_prescriptions
  ADD CONSTRAINT digital_prescriptions_dentist_id_fkey
  FOREIGN KEY (dentist_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 11. exports.created_by
UPDATE exports SET created_by = NULL
  WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_created_by_fkey;
ALTER TABLE exports
  ADD CONSTRAINT exports_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 12. ipr_points.approved_by
UPDATE ipr_points SET approved_by = NULL
  WHERE approved_by IS NOT NULL AND approved_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE ipr_points DROP CONSTRAINT IF EXISTS ipr_points_approved_by_fkey;
ALTER TABLE ipr_points
  ADD CONSTRAINT ipr_points_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 13. manufacture_exports.generated_by
UPDATE manufacture_exports SET generated_by = NULL
  WHERE generated_by IS NOT NULL AND generated_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE manufacture_exports DROP CONSTRAINT IF EXISTS manufacture_exports_generated_by_fkey;
ALTER TABLE manufacture_exports
  ADD CONSTRAINT manufacture_exports_generated_by_fkey
  FOREIGN KEY (generated_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 14. messages.sender_id
UPDATE messages SET sender_id = NULL
  WHERE sender_id IS NOT NULL AND sender_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 15. model_comments.author_id
UPDATE model_comments SET author_id = NULL
  WHERE author_id IS NOT NULL AND author_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE model_comments DROP CONSTRAINT IF EXISTS model_comments_author_id_fkey;
ALTER TABLE model_comments
  ADD CONSTRAINT model_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 16. participants.profile_id
UPDATE participants SET profile_id = NULL
  WHERE profile_id IS NOT NULL AND profile_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_profile_id_fkey;
ALTER TABLE participants
  ADD CONSTRAINT participants_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 17. preexport_qa_reports.approved_by
UPDATE preexport_qa_reports SET approved_by = NULL
  WHERE approved_by IS NOT NULL AND approved_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE preexport_qa_reports DROP CONSTRAINT IF EXISTS preexport_qa_reports_approved_by_fkey;
ALTER TABLE preexport_qa_reports
  ADD CONSTRAINT preexport_qa_reports_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 18. preexport_qa_reports.generated_by
UPDATE preexport_qa_reports SET generated_by = NULL
  WHERE generated_by IS NOT NULL AND generated_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE preexport_qa_reports DROP CONSTRAINT IF EXISTS preexport_qa_reports_generated_by_fkey;
ALTER TABLE preexport_qa_reports
  ADD CONSTRAINT preexport_qa_reports_generated_by_fkey
  FOREIGN KEY (generated_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 19. sso_configurations.created_by
UPDATE sso_configurations SET created_by = NULL
  WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE sso_configurations DROP CONSTRAINT IF EXISTS sso_configurations_created_by_fkey;
ALTER TABLE sso_configurations
  ADD CONSTRAINT sso_configurations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 20. treatment_reports.generated_by
UPDATE treatment_reports SET generated_by = NULL
  WHERE generated_by IS NOT NULL AND generated_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE treatment_reports DROP CONSTRAINT IF EXISTS treatment_reports_generated_by_fkey;
ALTER TABLE treatment_reports
  ADD CONSTRAINT treatment_reports_generated_by_fkey
  FOREIGN KEY (generated_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- 21. treatment_reports.reviewed_by
UPDATE treatment_reports SET reviewed_by = NULL
  WHERE reviewed_by IS NOT NULL AND reviewed_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE treatment_reports DROP CONSTRAINT IF EXISTS treatment_reports_reviewed_by_fkey;
ALTER TABLE treatment_reports
  ADD CONSTRAINT treatment_reports_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL;
