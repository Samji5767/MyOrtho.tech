-- Demo seed for pilot clinic training
-- Run: psql -U postgres myortho_dev -f database/seed-demo.sql
-- All patients/cases are marked is_demo=true and contain NO real PHI.
-- Re-runnable: uses DO $$ BEGIN ... EXCEPTION WHEN ... END $$ blocks.
-- Cleanup: DELETE FROM patients WHERE is_demo = true;

-- ── Demo organization ─────────────────────────────────────────────────────────
DO $$
DECLARE
  org_id   UUID;
  user_id  UUID;
  doc_id   UUID;
  tech_id  UUID;
BEGIN

-- Idempotent org
SELECT id INTO org_id FROM organizations WHERE name = 'DEMO Pilot Clinic' LIMIT 1;
IF org_id IS NULL THEN
  INSERT INTO organizations (id, name, plan, status)
  VALUES (gen_random_uuid(), 'DEMO Pilot Clinic', 'enterprise', 'active')
  RETURNING id INTO org_id;
END IF;

-- Demo admin user
SELECT id INTO user_id FROM auth_users WHERE email = 'demo-admin@myortho.test' LIMIT 1;
IF user_id IS NULL THEN
  INSERT INTO auth_users (id, email, password_hash, role, organization_id, name, active)
  VALUES (gen_random_uuid(), 'demo-admin@myortho.test',
          '$2b$10$demo.hash.not.real.do.not.use.in.prod',
          'admin', org_id, 'Demo Admin', true)
  RETURNING id INTO user_id;
END IF;

-- Demo orthodontist
SELECT id INTO doc_id FROM auth_users WHERE email = 'demo-doctor@myortho.test' LIMIT 1;
IF doc_id IS NULL THEN
  INSERT INTO auth_users (id, email, password_hash, role, organization_id, name, active)
  VALUES (gen_random_uuid(), 'demo-doctor@myortho.test',
          '$2b$10$demo.hash.not.real.do.not.use.in.prod',
          'doctor', org_id, 'Dr Demo Ortho', true)
  RETURNING id INTO doc_id;
END IF;

-- Demo technician
SELECT id INTO tech_id FROM auth_users WHERE email = 'demo-tech@myortho.test' LIMIT 1;
IF tech_id IS NULL THEN
  INSERT INTO auth_users (id, email, password_hash, role, organization_id, name, active)
  VALUES (gen_random_uuid(), 'demo-tech@myortho.test',
          '$2b$10$demo.hash.not.real.do.not.use.in.prod',
          'technician', org_id, 'Demo Technician', true)
  RETURNING id INTO tech_id;
END IF;

-- ── Demo patients ─────────────────────────────────────────────────────────────
-- Patient 1: Simple aligner case (active_treatment)
IF NOT EXISTS (SELECT 1 FROM patients WHERE organization_id = org_id AND is_demo = true AND clinical_notes = 'demo:simple-aligner') THEN
  WITH p AS (
    INSERT INTO patients (organization_id, first_name, last_name, gender, clinical_notes, is_demo, created_by)
    VALUES (org_id, 'Alex', 'Demo', 'unspecified',
            'demo:simple-aligner', true, user_id)
    RETURNING id
  )
  INSERT INTO cases (patient_id, organization_id, status, chief_complaint, created_by, assigned_to, is_demo)
  SELECT id, org_id, 'active_treatment', 'Mild crowding — demo case', user_id, doc_id, true FROM p;
END IF;

-- Patient 2: Moderate crowding (planning stage)
IF NOT EXISTS (SELECT 1 FROM patients WHERE organization_id = org_id AND is_demo = true AND clinical_notes = 'demo:moderate-crowding') THEN
  WITH p AS (
    INSERT INTO patients (organization_id, first_name, last_name, gender, clinical_notes, is_demo, created_by)
    VALUES (org_id, 'Jordan', 'Demo', 'unspecified',
            'demo:moderate-crowding', true, user_id)
    RETURNING id
  )
  INSERT INTO cases (patient_id, organization_id, status, chief_complaint, created_by, assigned_to, is_demo)
  SELECT id, org_id, 'planning', 'Moderate crowding — demo case', user_id, doc_id, true FROM p;
END IF;

-- Patient 3: Incomplete scan (scan_review)
IF NOT EXISTS (SELECT 1 FROM patients WHERE organization_id = org_id AND is_demo = true AND clinical_notes = 'demo:incomplete-scan') THEN
  WITH p AS (
    INSERT INTO patients (organization_id, first_name, last_name, gender, clinical_notes, is_demo, created_by)
    VALUES (org_id, 'Riley', 'Demo', 'unspecified',
            'demo:incomplete-scan', true, user_id)
    RETURNING id
  )
  INSERT INTO cases (patient_id, organization_id, status, chief_complaint, created_by, assigned_to, is_demo)
  SELECT id, org_id, 'scan_review', 'Spacing — incomplete scan — demo case', user_id, doc_id, true FROM p;
END IF;

-- Patient 4: Clinical review (clinical_review)
IF NOT EXISTS (SELECT 1 FROM patients WHERE organization_id = org_id AND is_demo = true AND clinical_notes = 'demo:clinical-review') THEN
  WITH p AS (
    INSERT INTO patients (organization_id, first_name, last_name, gender, clinical_notes, is_demo, created_by)
    VALUES (org_id, 'Morgan', 'Demo', 'unspecified',
            'demo:clinical-review', true, user_id)
    RETURNING id
  )
  INSERT INTO cases (patient_id, organization_id, status, chief_complaint, created_by, assigned_to, is_demo)
  SELECT id, org_id, 'clinical_review', 'Class II — demo case', user_id, doc_id, true FROM p;
END IF;

-- Patient 5: Refinement (monitoring)
IF NOT EXISTS (SELECT 1 FROM patients WHERE organization_id = org_id AND is_demo = true AND clinical_notes = 'demo:refinement') THEN
  WITH p AS (
    INSERT INTO patients (organization_id, first_name, last_name, gender, clinical_notes, is_demo, created_by)
    VALUES (org_id, 'Sam', 'Demo', 'unspecified',
            'demo:refinement', true, user_id)
    RETURNING id
  )
  INSERT INTO cases (patient_id, organization_id, status, chief_complaint, created_by, assigned_to, is_demo)
  SELECT id, org_id, 'monitoring', 'Refinement stage — demo case', user_id, doc_id, true FROM p;
END IF;

-- Patient 6: Completed retention
IF NOT EXISTS (SELECT 1 FROM patients WHERE organization_id = org_id AND is_demo = true AND clinical_notes = 'demo:completed') THEN
  WITH p AS (
    INSERT INTO patients (organization_id, first_name, last_name, gender, clinical_notes, is_demo, created_by)
    VALUES (org_id, 'Casey', 'Demo', 'unspecified',
            'demo:completed', true, user_id)
    RETURNING id
  )
  INSERT INTO cases (patient_id, organization_id, status, chief_complaint, created_by, assigned_to, is_demo)
  SELECT id, org_id, 'completed', 'Completed treatment — demo case', user_id, doc_id, true FROM p;
END IF;

RAISE NOTICE 'Demo seed complete for org_id=%', org_id;
END $$;
