-- 054_copilot_confidence_explainability.sql
-- Idempotent: adds confidence_level and explainability_data to copilot_messages
ALTER TABLE copilot_messages ADD COLUMN IF NOT EXISTS confidence_level VARCHAR(20);
ALTER TABLE copilot_messages ADD COLUMN IF NOT EXISTS explainability_data JSONB;
