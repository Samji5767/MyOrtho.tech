-- Phase 29: Enterprise Clinical AI Copilot — RAG knowledge base
-- Requires pgvector extension (postgresql-xx-pgvector on PostgreSQL host).
-- If vector extension is unavailable the copilot falls back to the rule engine.
-- This entire migration is idempotent and safe to re-run.

DO $$
BEGIN
  -- Check pg_available_extensions BEFORE attempting install — CREATE EXTENSION raises
  -- a hard error (not catchable via EXCEPTION) when the .control file is missing.
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
  ELSE
    RAISE NOTICE 'pgvector extension not available on this host — copilot RAG tables will be skipped';
  END IF;
END $$;

-- Only create RAG tables if the vector type is available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN

    -- Clinical knowledge base for Retrieval-Augmented Generation.
    -- Each chunk is one retrievable unit (a paragraph, a table, a clinical rule).
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS copilot_knowledge_chunks (
        id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
        chunk_id    TEXT  NOT NULL UNIQUE,
        source      TEXT  NOT NULL,
        category    TEXT  NOT NULL,
        title       TEXT  NOT NULL,
        content     TEXT  NOT NULL,
        embedding   vector(1536),
        metadata    JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    $sql$;

    -- IVFFlat approximate nearest-neighbour index (cosine distance).
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
        ON copilot_knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 50)
    $sql$;

    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_category
        ON copilot_knowledge_chunks (category)
    $sql$;

    -- Per-message embeddings: only create if copilot_messages table exists.
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'copilot_messages' AND table_schema = 'public') THEN
      EXECUTE $sql$
        CREATE TABLE IF NOT EXISTS copilot_message_embeddings (
          message_id  UUID  PRIMARY KEY REFERENCES copilot_messages(id) ON DELETE CASCADE,
          embedding   vector(1536),
          model       TEXT  NOT NULL,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $sql$;
    END IF;

  END IF;
END $$;
