import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';

export interface KnowledgeChunk {
  id?: string;
  chunkId: string;
  source: string;
  category: string;
  title: string;
  content: string;
  embedding?: number[] | null;
  metadata?: Record<string, unknown>;
  similarity?: number;
}

@Injectable()
export class VectorStoreService {
  private readonly log = new Logger(VectorStoreService.name);
  private vectorEnabled: boolean | null = null;

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  private async checkVectorEnabled(): Promise<boolean> {
    if (this.vectorEnabled !== null) return this.vectorEnabled;
    try {
      await this.db.query(`SELECT 1 FROM pg_extension WHERE extname='vector'`);
      this.vectorEnabled = true;
    } catch {
      this.vectorEnabled = false;
      this.log.warn('pgvector extension not available — semantic search disabled');
    }
    return this.vectorEnabled;
  }

  async searchKnowledge(
    embedding: number[],
    opts: { limit?: number; category?: string } = {},
  ): Promise<KnowledgeChunk[]> {
    if (!(await this.checkVectorEnabled())) return [];
    const limit = opts.limit ?? 5;
    const vecLiteral = `[${embedding.join(',')}]`;
    try {
      const res = opts.category
        ? await this.db.query(
            `SELECT chunk_id, source, category, title, content, metadata,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM copilot_knowledge_chunks
             WHERE category=$2 AND embedding IS NOT NULL
             ORDER BY embedding <=> $1::vector
             LIMIT $3`,
            [vecLiteral, opts.category, limit],
          )
        : await this.db.query(
            `SELECT chunk_id, source, category, title, content, metadata,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM copilot_knowledge_chunks
             WHERE embedding IS NOT NULL
             ORDER BY embedding <=> $1::vector
             LIMIT $2`,
            [vecLiteral, limit],
          );
      return res.rows.map(r => ({
        chunkId: r['chunk_id'] as string,
        source:   r['source'] as string,
        category: r['category'] as string,
        title:    r['title'] as string,
        content:  r['content'] as string,
        metadata: r['metadata'] as Record<string, unknown>,
        similarity: parseFloat(r['similarity'] as string),
      }));
    } catch (err) {
      this.log.error('Vector search failed', (err as Error).message);
      return [];
    }
  }

  async upsertChunk(chunk: KnowledgeChunk): Promise<void> {
    if (!(await this.checkVectorEnabled())) return;
    const vecLiteral = chunk.embedding ? `[${chunk.embedding.join(',')}]` : null;
    try {
      await this.db.query(
        `INSERT INTO copilot_knowledge_chunks
           (chunk_id, source, category, title, content, embedding, metadata, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6::vector,$7,now())
         ON CONFLICT (chunk_id) DO UPDATE
           SET source=$2, category=$3, title=$4, content=$5,
               embedding=$6::vector, metadata=$7, updated_at=now()`,
        [
          chunk.chunkId,
          chunk.source,
          chunk.category,
          chunk.title,
          chunk.content,
          vecLiteral,
          JSON.stringify(chunk.metadata ?? {}),
        ],
      );
    } catch (err) {
      this.log.error(`Failed to upsert knowledge chunk ${chunk.chunkId}`, (err as Error).message);
    }
  }

  async countChunks(): Promise<number> {
    try {
      const res = await this.db.query(`SELECT COUNT(*) AS cnt FROM copilot_knowledge_chunks`);
      return parseInt(res.rows[0]['cnt'] as string, 10);
    } catch {
      return 0;
    }
  }
}
