-- Migration 061: Lab Manufacturing V2
-- Extends existing lab/manufacturing tables and adds QA inspections + shipments.
-- All changes are idempotent.

-- ============================================================
-- 1. EXTEND printers
-- ============================================================

ALTER TABLE printers
  ADD COLUMN IF NOT EXISTS connector_status TEXT NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS api_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS build_volume_x_mm INTEGER DEFAULT 192,
  ADD COLUMN IF NOT EXISTS build_volume_y_mm INTEGER DEFAULT 108,
  ADD COLUMN IF NOT EXISTS build_volume_z_mm INTEGER DEFAULT 245,
  ADD COLUMN IF NOT EXISTS supported_resins TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_layer_height_um INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS last_calibrated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_maintenance_due DATE;

-- ============================================================
-- 2. EXTEND manufacturing_batches
-- ============================================================

ALTER TABLE manufacturing_batches
  ADD COLUMN IF NOT EXISTS printer_id UUID,
  ADD COLUMN IF NOT EXISTS resin_type TEXT,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS total_aligners INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_print_hours NUMERIC(6,2);

-- ============================================================
-- 3. EXTEND inventory_items
-- ============================================================

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS quantity_on_hand INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 4. CREATE TABLE qa_inspections
-- ============================================================

CREATE TABLE IF NOT EXISTS qa_inspections (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_id                 UUID        REFERENCES manufacturing_batches(id),
  print_job_id             UUID,
  stl_valid                BOOLEAN,
  mesh_integrity_ok        BOOLEAN,
  wall_thickness_ok        BOOLEAN,
  printability_score       NUMERIC(4,2) CHECK (printability_score >= 0 AND printability_score <= 10),
  orientation_ok           BOOLEAN,
  support_ok               BOOLEAN,
  surface_quality_score    NUMERIC(4,2),
  dimensional_variance_mm  NUMERIC(6,3),
  operator_notes           TEXT,
  status                   TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','in_progress','passed','failed','requires_reprint')),
  approved_by              UUID,
  approved_at              TIMESTAMPTZ,
  is_simulated             BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by               UUID        NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_org_status ON qa_inspections(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_batch      ON qa_inspections(batch_id);

-- ============================================================
-- 5. CREATE TABLE shipments
-- ============================================================

CREATE TABLE IF NOT EXISTS shipments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_id            UUID        REFERENCES manufacturing_batches(id),
  courier             TEXT,
  tracking_number     TEXT,
  carrier_service     TEXT,
  shipped_at          TIMESTAMPTZ,
  estimated_delivery  DATE,
  delivered_at        TIMESTAMPTZ,
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','label_printed','in_transit','out_for_delivery','delivered','exception','returned')),
  recipient_name      TEXT,
  recipient_address   JSONB,
  notes               TEXT,
  created_by          UUID        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_org_status ON shipments(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking   ON shipments(tracking_number) WHERE tracking_number IS NOT NULL;
