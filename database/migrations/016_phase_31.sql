-- Phase 31: AI Copilot 2.0
-- Conversation history, proactive suggestions, clinician interaction tracking

CREATE TABLE IF NOT EXISTS copilot_conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL,
  case_id             UUID NOT NULL,
  plan_id             UUID,
  created_by          UUID NOT NULL,
  title               TEXT,
  context_snapshot    JSONB NOT NULL DEFAULT '{}',  -- case summary at conversation start
  message_count       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_conversations_case   ON copilot_conversations(case_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_org    ON copilot_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_plan   ON copilot_conversations(plan_id) WHERE plan_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS copilot_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content             TEXT NOT NULL,
  intent              TEXT,   -- classified: 'question', 'command', 'feedback', 'acknowledgement'
  referenced_module   TEXT,   -- 'prescriptions', 'ipr', 'attachments', 'simulation', 'segmentation', 'aligner', 'pdl'
  suggestions         JSONB NOT NULL DEFAULT '[]',   -- inline proactive suggestions in this message
  tokens_used         INTEGER,
  latency_ms          INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_messages_conv  ON copilot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_org   ON copilot_messages(organization_id);

CREATE TABLE IF NOT EXISTS copilot_suggestions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL,
  case_id             UUID NOT NULL,
  plan_id             UUID,
  conversation_id     UUID REFERENCES copilot_conversations(id) ON DELETE SET NULL,
  message_id          UUID REFERENCES copilot_messages(id) ON DELETE SET NULL,
  suggestion_type     TEXT NOT NULL,  -- 'kravitz_violation', 'ipr_warning', 'anchorage_risk', 'arch_imbalance', 'pdl_stress', 'collision', 'attachment_mfg', 'missing_prescription', 'bolton_discrepancy'
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  severity            TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  module              TEXT NOT NULL,
  data                JSONB NOT NULL DEFAULT '{}',   -- supporting data for the suggestion
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'dismissed', 'applied')),
  clinician_note      TEXT,
  resolved_by         UUID,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_suggestions_case    ON copilot_suggestions(case_id);
CREATE INDEX IF NOT EXISTS idx_copilot_suggestions_plan    ON copilot_suggestions(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_copilot_suggestions_org     ON copilot_suggestions(organization_id);
CREATE INDEX IF NOT EXISTS idx_copilot_suggestions_status  ON copilot_suggestions(status) WHERE status = 'open';
