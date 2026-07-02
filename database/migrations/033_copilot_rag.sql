-- Phase 29: Enterprise Clinical AI Copilot — RAG knowledge base
-- Requires pgvector extension (postgresql-xx-pgvector on PostgreSQL host).
-- If vector extension is unavailable the copilot falls back to the rule engine.

CREATE EXTENSION IF NOT EXISTS vector;

-- Clinical knowledge base for Retrieval-Augmented Generation.
-- Each chunk is one retrievable unit (a paragraph, a table, a clinical rule).
CREATE TABLE IF NOT EXISTS copilot_knowledge_chunks (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id    TEXT  NOT NULL UNIQUE,   -- deterministic key for idempotent re-indexing
  source      TEXT  NOT NULL,          -- e.g. 'kravitz_2011', 'sheridan_1985', 'proffit_2018'
  category    TEXT  NOT NULL,          -- agent category: 'clinical','planning','cad','manufacturing','practice','support'
  title       TEXT  NOT NULL,
  content     TEXT  NOT NULL,
  embedding   vector(1536),            -- OpenAI text-embedding-3-small (1536 dims)
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IVFFlat approximate nearest-neighbour index (cosine distance).
-- lists=50 is appropriate for a small knowledge base (< 100k chunks).
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON copilot_knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_category
  ON copilot_knowledge_chunks (category);

-- Per-message embeddings for conversation-level semantic memory.
-- Enables "find messages like this one" across conversation history.
CREATE TABLE IF NOT EXISTS copilot_message_embeddings (
  message_id  UUID  PRIMARY KEY REFERENCES copilot_messages(id) ON DELETE CASCADE,
  embedding   vector(1536),
  model       TEXT  NOT NULL,   -- embedding model name used
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
