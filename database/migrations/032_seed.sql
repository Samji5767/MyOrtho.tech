-- Seed Data for MyOrtho.tech

-- 1. Create default organization
INSERT INTO organizations (id, name, type, settings)
VALUES (
    'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
    'Smile Orthodontics Group',
    'clinic',
    '{"theme": "dark", "ssoEnabled": true, "mfaEnforced": true, "domain": "https://portal.myortho.tech"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create auth user for Dr. Sarah Jenkins
-- On Supabase: insert into auth.users (managed auth schema).
-- On VPS: insert into auth_users (migration 001); password_hash is a seed placeholder
--         and must be changed before the account is used in production.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth')
  AND EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'auth' AND table_name = 'users') THEN
    EXECUTE $q$
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES (
        'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        'sarah.jenkins@myortho.tech',
        '{"role": "dentist", "organizationId": "d0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c"}'::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    $q$;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'auth_users') THEN
    INSERT INTO auth_users (id, email, password_hash, full_name, role, organization_id)
    VALUES (
      'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
      'sarah.jenkins@myortho.tech',
      '$2b$12$SEED.DATA.ONLY.CHANGE.BEFORE.PRODUCTION.USE.XXXXXX',
      'Dr. Sarah Jenkins',
      'orthodontist',
      'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 3. Create profile for Dr. Sarah Jenkins
INSERT INTO profiles (id, email, full_name, role, organization_id, is_active)
VALUES (
    'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    'sarah.jenkins@myortho.tech',
    'Dr. Sarah Jenkins',
    'dentist',
    'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 4. Create Patients
INSERT INTO patients (id, organization_id, first_name, last_name, dob, gender, clinical_notes)
VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
    'Eleanor',
    'Vance',
    '1994-08-12',
    'Female',
    'Class II Malocclusion, crowding in mandibular anterior sector.'
),
(
    '22222222-2222-2222-2222-222222222222',
    'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
    'Julian',
    'Kerr',
    '1988-11-23',
    'Male',
    'Diastema between upper central incisors, minor deep bite.'
),
(
    '33333333-3333-3333-3333-333333333333',
    'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
    'Amara',
    'Sato',
    '2001-03-04',
    'Female',
    'Open bite, requires segmentation and 24 aligner stages.'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Create Cases
-- VPS (migration 002) cases has no dentist_id; use assigned_to instead.
-- Supabase schema.sql cases has dentist_id.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'cases' AND column_name = 'dentist_id'
             AND table_schema = 'public') THEN
    INSERT INTO cases (id, patient_id, dentist_id, status, notes)
    VALUES
    (
        'c1111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111',
        'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        'planning',
        'Requires upper/lower clear aligners. 18 maxillary stages.'
    ),
    (
        'c2222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222222',
        'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        'pending_approval',
        'Awaiting approval for stage layout. IPR required at tooth 11/21.'
    ),
    (
        'c3333333-3333-3333-3333-333333333333',
        '33333333-3333-3333-3333-333333333333',
        'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        'manufacturing',
        'Aligner model generation complete. Print jobs in queue.'
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- VPS path: no dentist_id column; use assigned_to if available
    INSERT INTO cases (id, patient_id, status, notes)
    VALUES
    (
        'c1111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111',
        'planning',
        'Requires upper/lower clear aligners. 18 maxillary stages.'
    ),
    (
        'c2222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222222',
        'pending_approval',
        'Awaiting approval for stage layout. IPR required at tooth 11/21.'
    ),
    (
        'c3333333-3333-3333-3333-333333333333',
        '33333333-3333-3333-3333-333333333333',
        'manufacturing',
        'Aligner model generation complete. Print jobs in queue.'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 6. Create Scans
INSERT INTO scans (id, case_id, uploaded_by, jaw_type, file_path, file_format, file_size_bytes)
VALUES
('55555555-5555-5555-5555-555555555555', 'c1111111-1111-1111-1111-111111111111', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'both', 'models/eleanor_dual.stl', 'stl', 45000000),
('66666666-6666-6666-6666-666666666666', 'c2222222-2222-2222-2222-222222222222', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'both', 'models/julian_dual.stl', 'stl', 48000000),
('77777777-7777-7777-7777-777777777777', 'c3333333-3333-3333-3333-333333333333', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'both', 'models/amara_dual.stl', 'stl', 52000000)
ON CONFLICT (id) DO NOTHING;

-- 7. Create Treatment Plans
INSERT INTO treatment_plans (id, case_id, created_by, doctor_approval, estimated_stages)
VALUES
('88888888-8888-8888-8888-888888888888', 'c1111111-1111-1111-1111-111111111111', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', false, 18),
('99999999-9999-9999-9999-999999999999', 'c2222222-2222-2222-2222-222222222222', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', false, 12),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', true, 24)
ON CONFLICT (id) DO NOTHING;

-- 8. Create Aligner Stages
-- Use plan_id on VPS (original schema); treatment_plan_id on fresh databases (migration 008 schema)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'aligner_stages' AND column_name = 'plan_id') THEN
    INSERT INTO aligner_stages (id, plan_id, stage_number, maxillary_mesh_path, mandibular_mesh_path)
    VALUES
      ('b1111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', 4, 'staging/eleanor_max_s4.stl', 'staging/eleanor_man_s4.stl'),
      ('b2222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 8, 'staging/julian_max_s8.stl', 'staging/julian_man_s8.stl'),
      ('b3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 12, 'staging/amara_max_s12.stl', 'staging/amara_man_s12.stl')
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO aligner_stages (id, treatment_plan_id, stage_number, maxillary_mesh_path, mandibular_mesh_path)
    VALUES
      ('b1111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', 4, 'staging/eleanor_max_s4.stl', 'staging/eleanor_man_s4.stl'),
      ('b2222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 8, 'staging/julian_max_s8.stl', 'staging/julian_man_s8.stl'),
      ('b3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 12, 'staging/amara_max_s12.stl', 'staging/amara_man_s12.stl')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Link Current Stages to Cases (only if column exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'cases' AND column_name = 'current_stage_id'
             AND table_schema = 'public') THEN
    UPDATE cases SET current_stage_id = 'b1111111-1111-1111-1111-111111111111' WHERE id = 'c1111111-1111-1111-1111-111111111111';
    UPDATE cases SET current_stage_id = 'b2222222-2222-2222-2222-222222222222' WHERE id = 'c2222222-2222-2222-2222-222222222222';
    UPDATE cases SET current_stage_id = 'b3333333-3333-3333-3333-333333333333' WHERE id = 'c3333333-3333-3333-3333-333333333333';
  END IF;
END $$;

-- 9. Create Printers
INSERT INTO printers (id, organization_id, name, brand, model, status, ip_address, material_type, material_volume_ml)
VALUES
('f1111111-1111-1111-1111-111111111111', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'Formlabs 3B+ (Lab A)', 'Formlabs', 'Form 3B+', 'printing', '192.168.1.45', 'Draft Resin V2', 850),
('f2222222-2222-2222-2222-222222222222', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'SprintRay Pro 95S', 'SprintRay', 'Pro 95S', 'idle', '192.168.1.48', 'Model Gray', 1200),
('f3333333-3333-3333-3333-333333333333', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'Asiga Max UV', 'Asiga', 'Max UV', 'offline', '192.168.1.52', 'Ortho Model', 400)
ON CONFLICT (id) DO NOTHING;

-- 10. Create Print Jobs
-- Supabase schema.sql: has stage_id, quality_score, qc_notes; no job_name, no created_by
-- VPS migration 026: has job_name NOT NULL, created_by NOT NULL, case_id; no stage_id
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'print_jobs' AND column_name = 'stage_id'
             AND table_schema = 'public') THEN
    INSERT INTO print_jobs (id, printer_id, organization_id, stage_id, status, quality_score, qc_notes, created_at)
    VALUES
    ('d1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'b1111111-1111-1111-1111-111111111111', 'printing', 0.98, NULL, '2026-06-14 10:00:00+00'),
    ('d2222222-2222-2222-2222-222222222222', 'f2222222-2222-2222-2222-222222222222', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'b2222222-2222-2222-2222-222222222222', 'queued', 0.95, NULL, '2026-06-14 11:30:00+00'),
    ('d3333333-3333-3333-3333-333333333333', 'f1111111-1111-1111-1111-111111111111', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'b3333333-3333-3333-3333-333333333333', 'completed', 0.99, NULL, '2026-06-14 08:15:00+00'),
    ('d4444444-4444-4444-4444-444444444444', 'f3333333-3333-3333-3333-333333333333', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', NULL, 'failed', 0.74, 'Thin wall risk failed at buccal shell', '2026-06-13 14:20:00+00')
    ON CONFLICT (id) DO NOTHING;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'print_jobs' AND column_name = 'job_name'
                AND table_schema = 'public') THEN
    -- VPS path: job_name NOT NULL, created_by NOT NULL, optional case_id
    INSERT INTO print_jobs (id, printer_id, organization_id, case_id, job_name, status, created_by, created_at)
    VALUES
    ('d1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'c3333333-3333-3333-3333-333333333333', 'Eleanor Stage 4 Print', 'printing', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', '2026-06-14 10:00:00+00'),
    ('d2222222-2222-2222-2222-222222222222', 'f2222222-2222-2222-2222-222222222222', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'c3333333-3333-3333-3333-333333333333', 'Julian Stage 8 Print', 'queued', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', '2026-06-14 11:30:00+00'),
    ('d3333333-3333-3333-3333-333333333333', 'f1111111-1111-1111-1111-111111111111', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'c3333333-3333-3333-3333-333333333333', 'Amara Stage 12 Print', 'completed', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', '2026-06-14 08:15:00+00'),
    ('d4444444-4444-4444-4444-444444444444', 'f3333333-3333-3333-3333-333333333333', 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', NULL, 'Failed Print Job', 'failed', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', '2026-06-13 14:20:00+00')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 11. Appointments
-- Guard on patient_id column: VPS old schema has patient_id/dentist_id/visit_reason
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'appointments' AND column_name = 'patient_id'
             AND table_schema = 'public') THEN
    INSERT INTO appointments (id, patient_id, dentist_id, scheduled_at, visit_reason, status)
    VALUES (
        'a1111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111',
        'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        '2026-06-23 10:30:00+00',
        'Orthodontic Staging Progress Check',
        'scheduled'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 12. Billing Subscriptions & usage meters
INSERT INTO billing_subscriptions (id, organization_id, plan_tier, monthly_price, status)
VALUES (
    '91111111-1111-1111-1111-111111111111',
    'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
    'premium',
    599.00,
    'active'
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM billing_usage_meters
    WHERE organization_id = 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c'
    LIMIT 1
  ) THEN
    INSERT INTO billing_usage_meters (organization_id, case_id, metric_type, quantity)
    VALUES
    ('d0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'c1111111-1111-1111-1111-111111111111', 'case_export', 12),
    ('d0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'c2222222-2222-2222-2222-222222222222', 'api_call', 1245),
    ('d0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'c3333333-3333-3333-3333-333333333333', 'resin_print_ml', 450),
    ('d0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', NULL, 'storage_gb', 48);
  END IF;
END $$;

-- 13. Audit logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit_logs
    WHERE organization_id = 'd0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c'
      AND action = 'Approved Case #c1 Staging Plan'
    LIMIT 1
  ) THEN
    INSERT INTO audit_logs (organization_id, user_id, action, details, ip_address, created_at)
    VALUES
    ('d0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'Approved Case #c1 Staging Plan', '{"caseId": "c1111111-1111-1111-1111-111111111111"}'::jsonb, '192.168.1.104', '2026-06-14 21:12:05+00'),
    ('d0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', NULL, 'AI Scan Segmentation Completed', '{"caseId": "c1111111-1111-1111-1111-111111111111"}'::jsonb, '10.0.4.88', '2026-06-14 20:45:12+00'),
    ('d0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'Resin Low Warning: Formlabs Printer 1', '{"printerId": "f1111111-1111-1111-1111-111111111111"}'::jsonb, '192.168.1.45', '2026-06-14 18:22:30+00'),
    ('d0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', NULL, 'Failed Login Attempt: Tenant Portal', '{"inputEmail": "unknown-admin"}'::jsonb, '203.0.113.19', '2026-06-14 15:10:04+00');
  END IF;
END $$;

-- 14. Communication and Messaging
INSERT INTO conversations (id, case_id)
VALUES ('92222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- participants table (Supabase schema.sql) vs conversation_participants (VPS migration 007)
-- schema.sql participants has: id, conversation_id, profile_id
-- VPS conversation_participants has: conversation_id, user_id (composite PK, no id column)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'participants') THEN
    INSERT INTO participants (id, conversation_id, profile_id)
    VALUES
    ('93333333-3333-3333-3333-333333333333', '92222222-2222-2222-2222-222222222222', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d')
    ON CONFLICT (id) DO NOTHING;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'conversation_participants') THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES ('92222222-2222-2222-2222-222222222222', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- messages: Supabase schema.sql uses 'text' column; VPS migration 007 uses 'body' column
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'messages' AND column_name = 'text'
             AND table_schema = 'public') THEN
    INSERT INTO messages (id, conversation_id, sender_id, text)
    VALUES
    ('95555555-5555-5555-5555-555555555555', '92222222-2222-2222-2222-222222222222', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'Let us know if you feel minor tightness on aligner #4. That is normal for the first 48 hours.')
    ON CONFLICT (id) DO NOTHING;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'messages' AND column_name = 'body'
                AND table_schema = 'public') THEN
    INSERT INTO messages (id, conversation_id, sender_id, body)
    VALUES
    ('95555555-5555-5555-5555-555555555555', '92222222-2222-2222-2222-222222222222', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'Let us know if you feel minor tightness on aligner #4. That is normal for the first 48 hours.')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 15. Clinician comments (model annotations)
-- model_comments only exists in schema.sql; not in any migration file
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'model_comments') THEN
    INSERT INTO model_comments (id, case_id, author_id, comment_text, coordinate_x, coordinate_y, coordinate_z)
    VALUES
    ('96666666-6666-6666-6666-666666666666', 'c1111111-1111-1111-1111-111111111111', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'Dr. Sam: Posterior crossbite alignment looks good. Attachment on tooth 13 is crucial.', 0, 0, 0),
    ('96666666-6666-6666-6666-666666666667', 'c1111111-1111-1111-1111-111111111111', 'e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'Lab Tech: Watertight STL staging models sliced and validated.', 0, 0, 0)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 16. Legal Consent Records
-- legal_consent_records only exists in schema.sql; not in any migration file
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'legal_consent_records') THEN
    INSERT INTO legal_consent_records (id, patient_id, case_id, template_jurisdiction, esign_signature, ip_address, document_hash, record_retention_until)
    VALUES
    (
        '97777777-7777-7777-7777-777777777777',
        '11111111-1111-1111-1111-111111111111',
        'c1111111-1111-1111-1111-111111111111',
        'US-CA',
        'HIPAA Data Sharing Consent',
        '192.168.1.104',
        'SHA-256: 4f18e9a...',
        '2036-06-12'
    ),
    (
        '97777777-7777-7777-7777-777777777778',
        '11111111-1111-1111-1111-111111111111',
        'c1111111-1111-1111-1111-111111111111',
        'US-CA',
        'Aligner Treatment Informed Consent',
        '192.168.1.104',
        'SHA-256: 9b2d8e...',
        '2036-06-12'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
