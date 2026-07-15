-- Migration 063: Worker Runtime Extensions & AI Audit Lifecycle
-- Idempotent: uses ADD COLUMN IF NOT EXISTS throughout

-- ── background_jobs: worker claiming fields ───────────────────────────────────
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS worker_id          TEXT;
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS claimed_at         TIMESTAMPTZ;
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS lease_expires_at   TIMESTAMPTZ;
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS heartbeat_at       TIMESTAMPTZ;
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS last_error_code    TEXT;
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS idempotency_key    TEXT;
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS retry_delay_ms     INTEGER DEFAULT 0;
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS retry_scheduled_at TIMESTAMPTZ;

-- ── ai_inference_audit: extended lifecycle fields ─────────────────────────────
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS correlation_id        TEXT;
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS inference_type        TEXT;
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS checkpoint_checksum   TEXT;
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS fallback_used         BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS manual_review_required BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS error_code            TEXT;
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS input_metadata        JSONB;
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS output_metadata       JSONB;
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS confidence_score      NUMERIC(5,4);
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS audit_status          TEXT DEFAULT 'completed';
ALTER TABLE ai_inference_audit ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ;

-- ── ai_model_registry: governance fields ─────────────────────────────────────
ALTER TABLE ai_model_registry ADD COLUMN IF NOT EXISTS checkpoint_checksum TEXT;
ALTER TABLE ai_model_registry ADD COLUMN IF NOT EXISTS is_research_only    BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_model_registry ADD COLUMN IF NOT EXISTS intended_use        TEXT;
ALTER TABLE ai_model_registry ADD COLUMN IF NOT EXISTS disclaimer_policy   TEXT;

-- ── clinical_protocols: usage tracking ───────────────────────────────────────
ALTER TABLE clinical_protocols ADD COLUMN IF NOT EXISTS last_used_at  TIMESTAMPTZ;
ALTER TABLE clinical_protocols ADD COLUMN IF NOT EXISTS usage_count   INTEGER DEFAULT 0;

-- ── material_libraries: usage tracking ───────────────────────────────────────
ALTER TABLE material_libraries ADD COLUMN IF NOT EXISTS last_used_at  TIMESTAMPTZ;
ALTER TABLE material_libraries ADD COLUMN IF NOT EXISTS usage_count   INTEGER DEFAULT 0;

-- ── manufacturing_profiles: usage tracking ────────────────────────────────────
ALTER TABLE manufacturing_profiles ADD COLUMN IF NOT EXISTS last_used_at  TIMESTAMPTZ;
ALTER TABLE manufacturing_profiles ADD COLUMN IF NOT EXISTS usage_count   INTEGER DEFAULT 0;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_background_jobs_worker_id
  ON background_jobs(worker_id) WHERE worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_background_jobs_lease_expires
  ON background_jobs(lease_expires_at) WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_background_jobs_retry_scheduled
  ON background_jobs(retry_scheduled_at) WHERE status = 'retry_scheduled';

CREATE UNIQUE INDEX IF NOT EXISTS idx_background_jobs_idempotency
  ON background_jobs(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_inference_correlation
  ON ai_inference_audit(correlation_id) WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_inference_audit_status
  ON ai_inference_audit(audit_status);
