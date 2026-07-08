-- Migration 051: Migrate all remaining profiles FK constraints → auth_users
-- profiles table is populated by the seed but auth_users is the canonical user table on VPS.
-- For each table: drop old FK, fix data, add new FK to auth_users.
--
-- NOT NULL columns (academy_certifications.profile_id, messages.sender_id,
-- participants.profile_id) cannot be set to NULL. The old FK pointing at profiles
-- must be dropped first so the subsequent UPDATE can remap orphaned values to the
-- platform admin user (whose UUID is in auth_users, not profiles).
-- If auth_users has no rows yet (fresh DB with no data in these tables), the
-- UPDATE is skipped — the empty table satisfies the new FK without changes.
--
-- conversation_participants.user_id is NOT touched: it already references auth_users
-- and user_id is part of a composite PRIMARY KEY — must never be NULLed or altered.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS before every ADD CONSTRAINT.

-- ─── 1. academy_certifications.profile_id (NOT NULL) ─────────────────────────
-- Drop old FK first so the UPDATE can write auth_users UUIDs without profiles rejection.
ALTER TABLE academy_certifications DROP CONSTRAINT IF EXISTS academy_certifications_profile_id_fkey;
DO $$
DECLARE v uuid;
BEGIN
  SELECT id INTO v FROM auth_users
  ORDER BY (CASE role WHEN 'super_admin' THEN 0 ELSE 1 END), created_at
  LIMIT 1;
  IF v IS NOT NULL THEN
    UPDATE academy_certifications SET profile_id = v
      WHERE profile_id NOT IN (SELECT id FROM auth_users);
  END IF;
END $$;
ALTER TABLE academy_certifications
  ADD CONSTRAINT academy_certifications_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES auth_users(id) ON DELETE CASCADE;

-- ─── 2. ai_jobs.created_by (nullable) ────────────────────────────────────────
UPDATE ai_jobs SET created_by = NULL
  WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_created_by_fkey;
ALTER TABLE ai_jobs
  ADD CONSTRAINT ai_jobs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 3. appointments.dentist_id (nullable) ───────────────────────────────────
UPDATE appointments SET dentist_id = NULL
  WHERE dentist_id IS NOT NULL AND dentist_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_dentist_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_dentist_id_fkey
  FOREIGN KEY (dentist_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 4. attachments.created_by (nullable) ────────────────────────────────────
UPDATE attachments SET created_by = NULL
  WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_created_by_fkey;
ALTER TABLE attachments
  ADD CONSTRAINT attachments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 5. audit_logs.user_id (nullable) ────────────────────────────────────────
UPDATE audit_logs SET user_id = NULL
  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 6. capa_logs.reporter_id (nullable) ─────────────────────────────────────
UPDATE capa_logs SET reporter_id = NULL
  WHERE reporter_id IS NOT NULL AND reporter_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE capa_logs DROP CONSTRAINT IF EXISTS capa_logs_reporter_id_fkey;
ALTER TABLE capa_logs
  ADD CONSTRAINT capa_logs_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 7. cases.dentist_id (nullable) ──────────────────────────────────────────
UPDATE cases SET dentist_id = NULL
  WHERE dentist_id IS NOT NULL AND dentist_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_dentist_id_fkey;
ALTER TABLE cases
  ADD CONSTRAINT cases_dentist_id_fkey
  FOREIGN KEY (dentist_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 8. cs_tickets.reporter_id (nullable) ────────────────────────────────────
UPDATE cs_tickets SET reporter_id = NULL
  WHERE reporter_id IS NOT NULL AND reporter_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE cs_tickets DROP CONSTRAINT IF EXISTS cs_tickets_reporter_id_fkey;
ALTER TABLE cs_tickets
  ADD CONSTRAINT cs_tickets_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 9. device_history_records.operator_id (nullable) ────────────────────────
UPDATE device_history_records SET operator_id = NULL
  WHERE operator_id IS NOT NULL AND operator_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE device_history_records DROP CONSTRAINT IF EXISTS device_history_records_operator_id_fkey;
ALTER TABLE device_history_records
  ADD CONSTRAINT device_history_records_operator_id_fkey
  FOREIGN KEY (operator_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 10. digital_prescriptions.dentist_id (nullable) ─────────────────────────
UPDATE digital_prescriptions SET dentist_id = NULL
  WHERE dentist_id IS NOT NULL AND dentist_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE digital_prescriptions DROP CONSTRAINT IF EXISTS digital_prescriptions_dentist_id_fkey;
ALTER TABLE digital_prescriptions
  ADD CONSTRAINT digital_prescriptions_dentist_id_fkey
  FOREIGN KEY (dentist_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 11. exports.created_by (nullable) ───────────────────────────────────────
UPDATE exports SET created_by = NULL
  WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_created_by_fkey;
ALTER TABLE exports
  ADD CONSTRAINT exports_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 12. ipr_points.approved_by (nullable) ───────────────────────────────────
UPDATE ipr_points SET approved_by = NULL
  WHERE approved_by IS NOT NULL AND approved_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE ipr_points DROP CONSTRAINT IF EXISTS ipr_points_approved_by_fkey;
ALTER TABLE ipr_points
  ADD CONSTRAINT ipr_points_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 13. manufacture_exports.generated_by (nullable) ─────────────────────────
UPDATE manufacture_exports SET generated_by = NULL
  WHERE manufacture_exports.generated_by IS NOT NULL
  AND manufacture_exports.generated_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE manufacture_exports DROP CONSTRAINT IF EXISTS manufacture_exports_generated_by_fkey;
ALTER TABLE manufacture_exports
  ADD CONSTRAINT manufacture_exports_generated_by_fkey
  FOREIGN KEY (generated_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 14. messages.sender_id (NOT NULL) ───────────────────────────────────────
-- Drop old FK first so the UPDATE can remap orphaned sender_ids to admin without
-- the profiles FK rejecting the new auth_users UUID.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
DO $$
DECLARE v uuid;
BEGIN
  SELECT id INTO v FROM auth_users
  ORDER BY (CASE role WHEN 'super_admin' THEN 0 ELSE 1 END), created_at
  LIMIT 1;
  IF v IS NOT NULL THEN
    UPDATE messages SET sender_id = v
      WHERE sender_id NOT IN (SELECT id FROM auth_users);
  END IF;
END $$;
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 15. model_comments.author_id (nullable) ─────────────────────────────────
UPDATE model_comments SET author_id = NULL
  WHERE author_id IS NOT NULL AND author_id NOT IN (SELECT id FROM auth_users);
ALTER TABLE model_comments DROP CONSTRAINT IF EXISTS model_comments_author_id_fkey;
ALTER TABLE model_comments
  ADD CONSTRAINT model_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 16. participants.profile_id (NOT NULL) ───────────────────────────────────
-- participants has UNIQUE(conversation_id, profile_id). Drop old FK first, then:
-- delete orphaned rows that would create a duplicate key after remapping, then
-- remap remaining orphaned rows to the platform admin user.
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_profile_id_fkey;
DO $$
DECLARE v uuid;
BEGIN
  SELECT id INTO v FROM auth_users
  ORDER BY (CASE role WHEN 'super_admin' THEN 0 ELSE 1 END), created_at
  LIMIT 1;
  IF v IS NOT NULL THEN
    -- Remove orphaned participants where (conversation_id, admin) already exists
    DELETE FROM participants p
      WHERE p.profile_id NOT IN (SELECT id FROM auth_users)
        AND EXISTS (
          SELECT 1 FROM participants p2
          WHERE p2.conversation_id = p.conversation_id
            AND p2.profile_id = v
        );
    -- Remap remaining orphaned participants to admin user
    UPDATE participants SET profile_id = v
      WHERE profile_id NOT IN (SELECT id FROM auth_users);
  END IF;
END $$;
ALTER TABLE participants
  ADD CONSTRAINT participants_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES auth_users(id) ON DELETE CASCADE;

-- ─── 17. preexport_qa_reports.approved_by (nullable) ─────────────────────────
UPDATE preexport_qa_reports SET approved_by = NULL
  WHERE approved_by IS NOT NULL AND approved_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE preexport_qa_reports DROP CONSTRAINT IF EXISTS preexport_qa_reports_approved_by_fkey;
ALTER TABLE preexport_qa_reports
  ADD CONSTRAINT preexport_qa_reports_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 18. preexport_qa_reports.generated_by (nullable) ────────────────────────
UPDATE preexport_qa_reports SET generated_by = NULL
  WHERE generated_by IS NOT NULL AND generated_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE preexport_qa_reports DROP CONSTRAINT IF EXISTS preexport_qa_reports_generated_by_fkey;
ALTER TABLE preexport_qa_reports
  ADD CONSTRAINT preexport_qa_reports_generated_by_fkey
  FOREIGN KEY (generated_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 19. sso_configurations.created_by (nullable) ────────────────────────────
UPDATE sso_configurations SET created_by = NULL
  WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE sso_configurations DROP CONSTRAINT IF EXISTS sso_configurations_created_by_fkey;
ALTER TABLE sso_configurations
  ADD CONSTRAINT sso_configurations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 20. treatment_reports.generated_by (nullable) ───────────────────────────
UPDATE treatment_reports SET generated_by = NULL
  WHERE generated_by IS NOT NULL AND generated_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE treatment_reports DROP CONSTRAINT IF EXISTS treatment_reports_generated_by_fkey;
ALTER TABLE treatment_reports
  ADD CONSTRAINT treatment_reports_generated_by_fkey
  FOREIGN KEY (generated_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- ─── 21. treatment_reports.reviewed_by (nullable) ────────────────────────────
UPDATE treatment_reports SET reviewed_by = NULL
  WHERE reviewed_by IS NOT NULL AND reviewed_by NOT IN (SELECT id FROM auth_users);
ALTER TABLE treatment_reports DROP CONSTRAINT IF EXISTS treatment_reports_reviewed_by_fkey;
ALTER TABLE treatment_reports
  ADD CONSTRAINT treatment_reports_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL;
