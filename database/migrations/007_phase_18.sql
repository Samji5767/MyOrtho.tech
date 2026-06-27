-- ============================================================================
-- Migration 007: Phase 18 — Enterprise Audit + Blue Sky Parity
--
-- Adds: notifications, feature_flags, implants (library), implant_placements,
--       tad_plans, surgical_guides, patient_photos, case_reports,
--       webhook_endpoints, conversations, messages.
-- Updates: subscription_plans — Professional → $499/mo unlimited.
--
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO UPDATE.
-- ============================================================================

-- ─── Notifications ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         uuid        REFERENCES auth_users(id) ON DELETE CASCADE,
    type            text        NOT NULL,          -- case_approved | qc_failed | plan_ready | …
    title           text        NOT NULL,
    body            text,
    meta            jsonb       NOT NULL DEFAULT '{}',
    read_at         timestamptz,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org     ON notifications(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id) WHERE read_at IS NULL;

-- ─── Feature Flags ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_flags (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_key            text        UNIQUE NOT NULL,
    enabled             boolean     NOT NULL DEFAULT false,
    description         text,
    rollout_percentage  int         NOT NULL DEFAULT 100
                                    CHECK (rollout_percentage BETWEEN 0 AND 100),
    allowed_org_ids     uuid[]      NOT NULL DEFAULT '{}',
    created_by          uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    updated_at          timestamptz DEFAULT now(),
    created_at          timestamptz DEFAULT now()
);

INSERT INTO feature_flags (flag_key, enabled, description, rollout_percentage)
VALUES
  ('surgical_planning',     false, 'Implant and TAD planning module', 0),
  ('ai_landmark_detection', false, 'AI-based anatomical landmark detection', 0),
  ('patient_portal',        false, 'Patient-facing case progress portal', 0),
  ('pdf_case_reports',      true,  'PDF clinical case report export', 100),
  ('batch_stl_export',      true,  'Batch ZIP export of aligner stages', 100)
ON CONFLICT (flag_key) DO NOTHING;

-- ─── Implant Library ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS implants (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    manufacturer        text        NOT NULL,
    system              text        NOT NULL,
    sku                 text,
    diameter_mm         numeric(5,2) NOT NULL,
    length_mm           numeric(5,2) NOT NULL,
    neck_diameter_mm    numeric(5,2),
    thread_pitch_mm     numeric(5,2),
    material            text        NOT NULL DEFAULT 'titanium grade 4',
    connection_type     text,       -- 'internal hex' | 'conical' | 'external hex' | 'morse taper'
    catalog_year        int,
    is_active           boolean     NOT NULL DEFAULT true,
    created_at          timestamptz DEFAULT now()
);

INSERT INTO implants (manufacturer, system, sku, diameter_mm, length_mm, material, connection_type)
VALUES
  ('Straumann',   'Bone Level Tapered', 'BLT-4.1-10',  4.1, 10.0, 'titanium grade 4', 'internal conical'),
  ('Straumann',   'Bone Level Tapered', 'BLT-3.3-8',   3.3,  8.0, 'titanium grade 4', 'internal conical'),
  ('Nobel Biocare','Replace CC',        'RPLCC-4.3-13', 4.3, 13.0, 'titanium grade 4', 'internal hex'),
  ('Zimmer Biomet','Tapered Screw-Vent','TSV-4.7-11.5', 4.7, 11.5, 'titanium grade 4', 'internal hex'),
  ('BioHorizons', 'Tapered Internal',  'TI-4.0-11',   4.0, 11.0, 'titanium grade 4', 'internal hex'),
  ('Dentsply Sirona','Astra OsseoSpeed','AOS-4.0-9',   4.0,  9.0, 'titanium grade 4', 'conical connection')
ON CONFLICT DO NOTHING;

-- ─── Implant Placements (per-case) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS implant_placements (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id         uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    implant_id      uuid        REFERENCES implants(id) ON DELETE SET NULL,
    tooth_number    text        NOT NULL,
    position_x      numeric(8,4),
    position_y      numeric(8,4),
    position_z      numeric(8,4),
    pitch_deg       numeric(6,3),
    roll_deg        numeric(6,3),
    yaw_deg         numeric(6,3),
    bone_density    text        CHECK (bone_density IN ('D1','D2','D3','D4')),
    safety_status   text        NOT NULL DEFAULT 'safe'
                                CHECK (safety_status IN ('safe','warning','collision')),
    notes           text,
    planned_by      uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_implant_placements_case ON implant_placements(case_id);

-- ─── TAD Plans (per-case) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tad_plans (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    insertion_site      text        NOT NULL,
    tooth_a             text        NOT NULL,
    tooth_b             text,
    angulation_deg      numeric(6,3),
    depth_mm            numeric(5,2),
    bone_thickness_mm   numeric(5,2),
    safe_corridor       jsonb       NOT NULL DEFAULT '{}',
    root_collision_risk text        NOT NULL DEFAULT 'low'
                                    CHECK (root_collision_risk IN ('low','moderate','high')),
    purpose             text,
    notes               text,
    planned_by          uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tad_plans_case ON tad_plans(case_id);

-- ─── Surgical Guides ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS surgical_guides (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    guide_type          text        NOT NULL CHECK (guide_type IN ('implant','tad','osteotomy')),
    sleeve_diameter_mm  numeric(5,2),
    guide_thickness_mm  numeric(5,2) NOT NULL DEFAULT 2.0,
    vent_holes          boolean     NOT NULL DEFAULT false,
    offset_mm           numeric(5,2) NOT NULL DEFAULT 0.0,
    stl_path            text,
    export_status       text        NOT NULL DEFAULT 'pending'
                                    CHECK (export_status IN ('pending','ready','exported')),
    exported_at         timestamptz,
    designed_by         uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_surgical_guides_case ON surgical_guides(case_id);

-- ─── Patient Photos ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_photos (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id         uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    photo_type      text        NOT NULL CHECK (photo_type IN (
                                    'frontal_smile','frontal_repose','lateral_right',
                                    'lateral_left','upper_occlusal','lower_occlusal',
                                    'right_buccal','left_buccal','frontal_occlusion',
                                    'retracted_frontal','cbct_axial','cbct_coronal',
                                    'cbct_sagittal','panoramic','cephalometric'
                                )),
    file_path       text        NOT NULL,
    file_size_bytes int,
    taken_at        timestamptz,
    uploaded_by     uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_photos_case ON patient_photos(case_id, photo_type);

-- ─── Case Reports (PDF export log) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS case_reports (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id         uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    report_type     text        NOT NULL CHECK (report_type IN (
                                    'clinical_summary','treatment_plan','surgical','progress'
                                )),
    file_path       text,
    status          text        NOT NULL DEFAULT 'generating'
                                CHECK (status IN ('generating','ready','failed')),
    error_message   text,
    generated_by    uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    generated_at    timestamptz,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_reports_case ON case_reports(case_id, created_at DESC);

-- ─── Webhook Endpoints ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id         uuid        REFERENCES organizations(id) ON DELETE CASCADE,
    url                     text        NOT NULL,
    events                  text[]      NOT NULL DEFAULT '{}',
    secret_hash             text,
    is_active               boolean     NOT NULL DEFAULT true,
    last_delivery_at        timestamptz,
    last_delivery_status    text        CHECK (last_delivery_status IN ('success','failure')),
    last_delivery_http_code int,
    created_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(organization_id);

-- ─── Messaging ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE,
    case_id         uuid        REFERENCES cases(id) ON DELETE SET NULL,
    subject         text,
    created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id uuid        REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         uuid        REFERENCES auth_users(id) ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    body            text        NOT NULL,
    read_by         uuid[]      NOT NULL DEFAULT '{}',
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversation_id, created_at DESC);

-- ─── Subscription Plan Updates ───────────────────────────────────────────────
-- Professional plan → $499/mo unlimited (no per-export charges while active)

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS is_unlimited boolean NOT NULL DEFAULT false;

UPDATE subscription_plans
SET name                = 'Professional',
    max_cases_per_month = 9999,
    price_usd_cents     = 49900,
    credits_included    = 9999,
    is_unlimited        = true,
    features            = '[
      "Unlimited STL imports",
      "Unlimited treatment planning",
      "Unlimited aligner exports",
      "Unlimited manufacturing exports",
      "Unlimited AI usage (fair-use policy applies)",
      "PDF case reports",
      "Surgical planning module",
      "Priority support"
    ]'::jsonb
WHERE slug = 'pro';

-- Ensure PAYG cost constant is stored for reference
INSERT INTO feature_flags (flag_key, enabled, description)
VALUES ('payg_export_cost_usd_cents', true, '199')
ON CONFLICT (flag_key) DO NOTHING;
