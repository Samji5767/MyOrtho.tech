-- MyOrtho.tech Database Schema
-- Production PostgreSQL / Supabase Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Local Docker Postgres compatibility shim for Supabase's auth.uid().
-- On Supabase the `auth` schema and auth.uid() are provided natively, so the
-- RLS policies below resolve fine. On a vanilla PostgreSQL instance (e.g. the
-- local Docker container used for VPS deployment) they do not exist and schema
-- init would fail. Create a no-op stub ONLY when it is missing, so this file
-- stays a no-op on real Supabase and runs cleanly on plain Postgres.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'auth' AND p.proname = 'uid'
    ) THEN
        EXECUTE $fn$
            CREATE FUNCTION auth.uid() RETURNS uuid
            LANGUAGE sql STABLE
            AS 'SELECT NULLIF(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
        $fn$;
    END IF;
END
$$;

-- Define Custom Enum Types
CREATE TYPE user_role AS ENUM ('enterprise_admin', 'clinic_admin', 'dentist', 'lab_technician', 'operator', 'patient');
CREATE TYPE case_status AS ENUM (
  'draft', 
  'scan_uploaded', 
  'segmenting', 
  'planning', 
  'pending_approval', 
  'approved', 
  'staging', 
  'manufacturing', 
  'completed', 
  'canceled'
);
CREATE TYPE job_status AS ENUM (
  'queued', 
  'nesting', 
  'printing', 
  'cleaning', 
  'curing', 
  'qc_pending', 
  'completed', 
  'failed'
);

-- =========================================================================
-- 1. TENANCY AND USERS
-- =========================================================================

-- Organizations (Clinics, Labs, Enterprise Groups)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('clinic', 'lab', 'enterprise')),
    parent_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    settings JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY, -- references auth.users(id) in Supabase
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'dentist',
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 2. PATIENTS AND CLINICAL DATA
-- =========================================================================

-- Patients
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    gender VARCHAR(50),
    clinical_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Cases
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    dentist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status case_status NOT NULL DEFAULT 'draft',
    current_stage_id UUID, -- self-referencing to aligner_stages down below
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Scans (3D mesh data or DICOM paths)
CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    jaw_type VARCHAR(20) NOT NULL CHECK (jaw_type IN ('maxillary', 'mandibular', 'both')),
    file_path VARCHAR(512) NOT NULL, -- Object storage path
    file_format VARCHAR(20) NOT NULL CHECK (file_format IN ('stl', 'obj', 'ply', 'dicom', 'cbct')),
    file_size_bytes BIGINT NOT NULL,
    mesh_validation_metrics JSONB DEFAULT '{}'::jsonb NOT NULL, -- thin wall alerts, hole count, triangle count
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 3. AI SEGMENTATION AND INTERMEDIATE STAGES
-- =========================================================================

-- Segmentation Results
CREATE TABLE segmentation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    scan_id UUID REFERENCES scans(id) ON DELETE CASCADE NOT NULL,
    teeth_confidence_scores JSONB DEFAULT '{}'::jsonb NOT NULL, -- confidence per FDI tooth number (11-48)
    segmented_mesh_path VARCHAR(512), -- Multi-object mesh file or directory
    missing_teeth INT[] DEFAULT '{}'::int[] NOT NULL,
    gingiva_mesh_path VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Treatment Plans
CREATE TABLE treatment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    doctor_approval BOOLEAN DEFAULT false NOT NULL,
    doctor_signature TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    estimated_stages INT DEFAULT 0 NOT NULL,
    ai_recommendation_notes TEXT,
    ipr_details JSONB DEFAULT '{}'::jsonb NOT NULL, -- Interproximal Reduction notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Aligner Stages
CREATE TABLE aligner_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES treatment_plans(id) ON DELETE CASCADE NOT NULL,
    stage_number INT NOT NULL,
    maxillary_mesh_path VARCHAR(512), -- staged STL for printing
    mandibular_mesh_path VARCHAR(512),
    movements JSONB DEFAULT '{}'::jsonb NOT NULL, -- Transformation matrices or staging params per tooth
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (plan_id, stage_number)
);

-- Add foreign key constraint to cases now that aligner_stages is defined
ALTER TABLE cases ADD CONSTRAINT fk_cases_current_stage 
    FOREIGN KEY (current_stage_id) REFERENCES aligner_stages(id) ON DELETE SET NULL;

-- =========================================================================
-- 4. 3D PRINTING AND MANUFACTURING
-- =========================================================================

-- Printers
CREATE TABLE printers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL, -- Formlabs, SprintRay, Asiga, Ackuretta, NextDent
    model VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'printing', 'offline', 'error', 'maintenance')),
    ip_address VARCHAR(45),
    firmware_version VARCHAR(50),
    material_type VARCHAR(100), -- Model resin type, brand
    material_volume_ml FLOAT DEFAULT 0.0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Print Jobs
CREATE TABLE print_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    stage_id UUID REFERENCES aligner_stages(id) ON DELETE SET NULL,
    status job_status NOT NULL DEFAULT 'queued',
    gcode_path VARCHAR(512),
    quality_score FLOAT CHECK (quality_score >= 0.0 AND quality_score <= 1.0), -- AI QC Printability score
    qc_notes TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 5. ENTERPRISE AND LOGGING
-- =========================================================================

-- Audit Logs for compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- Indexes for Performance
-- =========================================================================
CREATE INDEX idx_profiles_org ON profiles(organization_id);
CREATE INDEX idx_patients_org ON patients(organization_id);
CREATE INDEX idx_cases_patient ON cases(patient_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_scans_case ON scans(case_id);
CREATE INDEX idx_plans_case ON treatment_plans(case_id);
CREATE INDEX idx_stages_plan ON aligner_stages(plan_id);
CREATE INDEX idx_printers_org ON printers(organization_id);
CREATE INDEX idx_jobs_printer ON print_jobs(printer_id);
CREATE INDEX idx_jobs_org ON print_jobs(organization_id);
CREATE INDEX idx_audit_org ON audit_logs(organization_id);

-- Additional missing indexes for foreign keys moved to the end of the file to prevent table-not-exist errors.

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE aligner_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE segmentation_results ENABLE ROW LEVEL SECURITY;

-- 1. Organizations policies (access own org or children orgs)
CREATE POLICY org_access_policy ON organizations
    FOR ALL
    USING (
        id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        ) OR parent_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- 2. Profiles policies
CREATE POLICY profile_access_policy ON profiles
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 3. Patients policies
CREATE POLICY patient_access_policy ON patients
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 4. Cases policies (cascade from patient check)
CREATE POLICY case_access_policy ON cases
    FOR ALL
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 5. Scans policies
CREATE POLICY scan_access_policy ON scans
    FOR ALL
    USING (
        case_id IN (
            SELECT id FROM cases WHERE patient_id IN (
                SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
            )
        )
    );

-- 5b. Segmentation Results policies
CREATE POLICY segmentation_access_policy ON segmentation_results
    FOR ALL
    USING (
        case_id IN (
            SELECT id FROM cases WHERE patient_id IN (
                SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
            )
        )
    );

-- 6. Printers policies
CREATE POLICY printer_access_policy ON printers
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 7. Print Jobs policies
CREATE POLICY job_access_policy ON print_jobs
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- =========================================================================
-- 6. MEDICAL DEVICE & REGULATORY (ISO 13485 / FDA CFR)
-- =========================================================================

-- Device History Records (DHR)
CREATE TABLE device_history_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    manufactured_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    operator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    qc_passed BOOLEAN DEFAULT true NOT NULL,
    dhr_hash VARCHAR(255) NOT NULL -- SHA-256 hash of design files, prints logs and validation outcomes
);

-- CAPA Logs (Corrective and Preventive Actions)
CREATE TABLE capa_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    root_cause TEXT,
    corrective_action TEXT,
    preventive_action TEXT,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 7. DIGITAL PRESCRIPTION & CLINICAL RX
-- =========================================================================

-- Clinician Prescriptions
CREATE TABLE digital_prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    dentist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    instructions TEXT NOT NULL, -- structured staging directions
    esign_signature TEXT NOT NULL, -- cryptographically bound clinician name
    esign_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    revision_number INT DEFAULT 1 NOT NULL,
    approved_for_manufacturing BOOLEAN DEFAULT false NOT NULL
);

-- Appointment Schedules
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    dentist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    visit_reason VARCHAR(150) NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 8. SCANNER INTEGRATIONS & MYORTHO ACADEMY
-- =========================================================================

-- Scanner Device Connections
CREATE TABLE scanner_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    vendor VARCHAR(50) NOT NULL CHECK (vendor IN ('3Shape', 'Medit', 'iTero', 'Shining3D')),
    api_endpoint VARCHAR(512),
    auth_credentials JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Academy Course Certifications
CREATE TABLE academy_certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    course_name VARCHAR(150) NOT NULL,
    score_percentage FLOAT NOT NULL,
    passed BOOLEAN DEFAULT false NOT NULL,
    certified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for new tables
ALTER TABLE device_history_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE capa_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanner_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_certifications ENABLE ROW LEVEL SECURITY;

-- 8. Device History Records policies (via case -> patient -> org check)
CREATE POLICY dhr_access_policy ON device_history_records
    FOR ALL
    USING (
        case_id IN (
            SELECT id FROM cases WHERE patient_id IN (
                SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
            )
        )
    );

-- 9. CAPA Logs policies
CREATE POLICY capa_access_policy ON capa_logs
    FOR ALL
    USING (
        reporter_id IN (
            SELECT id FROM profiles WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 10. Digital Prescriptions policies (via case -> patient -> org check)
CREATE POLICY prescription_access_policy ON digital_prescriptions
    FOR ALL
    USING (
        case_id IN (
            SELECT id FROM cases WHERE patient_id IN (
                SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
            )
        )
    );

-- 11. Appointments policies (via patient -> org check)
CREATE POLICY appointment_access_policy ON appointments
    FOR ALL
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 12. Scanner Integrations policies
CREATE POLICY scanner_access_policy ON scanner_integrations
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 13. Academy Certifications policies (own record or manager review within same org)
CREATE POLICY certification_access_policy ON academy_certifications
    FOR ALL
    USING (
        profile_id = auth.uid() OR profile_id IN (
            SELECT id FROM profiles WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- =========================================================================
-- 9. MOAT CAPABILITIES & ADVANCED ENTERPRISE EXPANSIONS
-- =========================================================================

-- Model Comments
CREATE TABLE model_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    fdi_tooth_number INT, -- optional mapping to specific tooth
    coordinate_x FLOAT NOT NULL, -- 3D annotation coordinate
    coordinate_y FLOAT NOT NULL,
    coordinate_z FLOAT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Legal Consent Records
CREATE TABLE legal_consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    template_jurisdiction VARCHAR(10) NOT NULL, -- 'US-CA', 'EU-FR', etc.
    esign_signature TEXT NOT NULL,
    esign_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    document_hash VARCHAR(64) NOT NULL, -- SHA-256 of consent parameters
    record_retention_until DATE NOT NULL
);

-- Insurance Claims
CREATE TABLE insurance_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    insurance_provider VARCHAR(100) NOT NULL,
    policy_number VARCHAR(100) NOT NULL,
    prior_auth_code VARCHAR(100),
    claim_amount FLOAT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Financing Plans
CREATE TABLE financing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    total_financed_amount FLOAT NOT NULL,
    interest_rate FLOAT DEFAULT 0.0 NOT NULL,
    term_months INT NOT NULL,
    monthly_installment FLOAT NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'defaulted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Supply Inventory
CREATE TABLE supply_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('resin', 'aligner_sheets', 'packaging', 'accessories')),
    stock_quantity FLOAT NOT NULL,
    reorder_level FLOAT NOT NULL,
    unit VARCHAR(20) NOT NULL,
    vendor_name VARCHAR(100) NOT NULL
);

-- CRM Leads
CREATE TABLE crm_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    clinic_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    pipeline_stage VARCHAR(50) DEFAULT 'discovery' CHECK (pipeline_stage IN ('discovery', 'demo_scheduled', 'negotiation', 'partnered')),
    expected_value FLOAT DEFAULT 0.0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Competitive Intelligence Logs
CREATE TABLE competitive_intel_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_url VARCHAR(512),
    intel_category VARCHAR(100) NOT NULL, -- e.g., 'Regulatory', 'Competitor Move', 'New Printer'
    summary TEXT NOT NULL,
    confidence_score FLOAT CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Privacy Settings
CREATE TABLE privacy_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    allow_ai_training BOOLEAN DEFAULT false NOT NULL,
    allow_third_party_sharing BOOLEAN DEFAULT false NOT NULL,
    data_portability_requested BOOLEAN DEFAULT false NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE model_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitive_intel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 14. Model Comments policies (via case check)
CREATE POLICY comment_access_policy ON model_comments
    FOR ALL
    USING (
        case_id IN (
            SELECT id FROM cases WHERE patient_id IN (
                SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
            )
        )
    );

-- 15. Legal Consent policies (via patient check)
CREATE POLICY consent_access_policy ON legal_consent_records
    FOR ALL
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 16. Insurance Claims policies (via case check)
CREATE POLICY insurance_access_policy ON insurance_claims
    FOR ALL
    USING (
        case_id IN (
            SELECT id FROM cases WHERE patient_id IN (
                SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
            )
        )
    );

-- 17. Financing Plans policies (via patient check)
CREATE POLICY financing_access_policy ON financing_plans
    FOR ALL
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 18. Supply Inventory policies
CREATE POLICY inventory_access_policy ON supply_inventory
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 19. CRM Leads policies
CREATE POLICY crm_access_policy ON crm_leads
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 20. Competitive Intel read policy (open to authenticated users)
CREATE POLICY competitive_intel_read_policy ON competitive_intel_logs
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- 21. Privacy Settings policies (via patient check)
CREATE POLICY privacy_access_policy ON privacy_settings
    FOR ALL
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- =========================================================================
-- 10. MANUFACTURING ERP & PROCUREMENT
-- =========================================================================

CREATE TABLE erp_vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    rating FLOAT DEFAULT 5.0 NOT NULL
);

CREATE TABLE erp_purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    vendor_id UUID REFERENCES erp_vendors(id) ON DELETE CASCADE NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    quantity FLOAT NOT NULL,
    unit_price FLOAT NOT NULL,
    total_cost FLOAT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'billed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 11. CUSTOMER SUCCESS & TICKETS
-- =========================================================================

CREATE TABLE cs_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    sla_status VARCHAR(50) DEFAULT 'within_sla' CHECK (sla_status IN ('within_sla', 'warning', 'breached')),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 12. METERING & SUBSCRIPTION BILLING
-- =========================================================================

CREATE TABLE billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    plan_tier VARCHAR(50) DEFAULT 'standard' CHECK (plan_tier IN ('standard', 'premium', 'enterprise')),
    monthly_price FLOAT NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
    billing_cycle_anchor TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE billing_usage_meters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('case_export', 'api_call', 'resin_print_ml', 'storage_gb')),
    quantity FLOAT NOT NULL,
    metered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE erp_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_meters ENABLE ROW LEVEL SECURITY;

-- 22. ERP Vendors access
CREATE POLICY vendor_access_policy ON erp_vendors
    FOR ALL
    USING (auth.uid() IS NOT NULL);

-- 23. ERP Purchase Orders access
CREATE POLICY erp_po_access_policy ON erp_purchase_orders
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 24. CS Tickets access
CREATE POLICY cs_ticket_access_policy ON cs_tickets
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 25. Billing Subscriptions access
CREATE POLICY subscription_access_policy ON billing_subscriptions
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 26. Billing Usage Meters access
CREATE POLICY billing_usage_access_policy ON billing_usage_meters
    FOR ALL
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- =========================================================================
-- 13. COMMUNICATION AND MESSAGING PLATFORM
-- =========================================================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    UNIQUE (conversation_id, profile_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
    text TEXT NOT NULL,
    attachment_url VARCHAR(512),
    read_status BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for communication tables
CREATE INDEX idx_conversations_case ON conversations(case_id);
CREATE INDEX idx_participants_conv ON participants(conversation_id);
CREATE INDEX idx_participants_profile ON participants(profile_id);
CREATE INDEX idx_messages_conv ON messages(conversation_id);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Conversations RLS Policy (participants must belong to the conversation)
CREATE POLICY conversation_access_policy ON conversations
    FOR ALL
    USING (
        id IN (
            SELECT conversation_id FROM participants WHERE profile_id = auth.uid()
        )
    );

-- Participants RLS Policy
CREATE POLICY participant_access_policy ON participants
    FOR ALL
    USING (
        profile_id = auth.uid() OR conversation_id IN (
            SELECT conversation_id FROM participants WHERE profile_id = auth.uid()
        )
    );

-- Messages RLS Policy
CREATE POLICY message_access_policy ON messages
    FOR ALL
    USING (
        conversation_id IN (
            SELECT conversation_id FROM participants WHERE profile_id = auth.uid()
        )
    );

-- Additional missing indexes for foreign keys
CREATE INDEX idx_model_comments_case ON model_comments(case_id);
CREATE INDEX idx_legal_consent_case ON legal_consent_records(case_id);
CREATE INDEX idx_insurance_claims_case ON insurance_claims(case_id);
CREATE INDEX idx_financing_plans_patient ON financing_plans(patient_id);
CREATE INDEX idx_supply_inventory_org ON supply_inventory(organization_id);
CREATE INDEX idx_crm_leads_org ON crm_leads(organization_id);
CREATE INDEX idx_erp_po_org ON erp_purchase_orders(organization_id);
CREATE INDEX idx_cs_tickets_org ON cs_tickets(organization_id);
CREATE INDEX idx_billing_subs_org ON billing_subscriptions(organization_id);
CREATE INDEX idx_billing_usage_org ON billing_usage_meters(organization_id);

