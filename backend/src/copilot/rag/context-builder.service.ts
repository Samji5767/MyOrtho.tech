import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService, KnowledgeChunk } from './vector-store.service';
import type { LlmMessage } from './llm.service';

export interface BuiltContext {
  systemContext: string;
  history: LlmMessage[];
  sources: KnowledgeChunk[];
}

const MAX_HISTORY = 12;   // last 6 exchanges (12 messages)
const MAX_KNOWLEDGE = 5;  // top-5 knowledge chunks

@Injectable()
export class ContextBuilderService {
  constructor(
    @Inject(PG_POOL) private readonly db: Pool,
    private readonly embedder: EmbeddingService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  async build(
    conversationId: string,
    orgId: string,
    userMessage: string,
    agentCategory: string,
  ): Promise<BuiltContext> {
    const [conv, recentMessages, caseData] = await Promise.all([
      this.loadConversation(conversationId, orgId),
      this.loadRecentMessages(conversationId, orgId),
      this.loadCaseData(conversationId, orgId),
    ]);

    // Retrieve relevant knowledge chunks via semantic search
    const sources = await this.retrieveKnowledge(userMessage, agentCategory);

    // Build system context block
    const parts: string[] = [];

    if (caseData) {
      parts.push('=== PATIENT & CASE CONTEXT ===');
      parts.push(caseData);
    }

    if (conv?.contextSnapshot) {
      const snap = conv.contextSnapshot as Record<string, unknown>;
      const snapLines: string[] = [];
      if (snap['totalStages']) snapLines.push(`Aligner stages: ${snap['totalStages']}`);
      if (snap['overjetFinal'] != null) snapLines.push(`Final overjet: ${snap['overjetFinal']}mm`);
      if (snap['overbiteFirst'] != null) snapLines.push(`Final overbite: ${snap['overbiteFirst']}mm`);
      if (snap['archCoordination'] != null) snapLines.push(`Arch coordination score: ${snap['archCoordination']}`);
      if (snap['prescriptionCount'] != null) snapLines.push(`Movement prescriptions: ${snap['prescriptionCount']}`);
      if (snapLines.length > 0) {
        parts.push('\n=== TREATMENT PLAN SNAPSHOT ===');
        parts.push(snapLines.join('\n'));
      }
    }

    if (sources.length > 0) {
      parts.push('\n=== RETRIEVED CLINICAL KNOWLEDGE ===');
      for (const chunk of sources) {
        parts.push(`[${chunk.source}] ${chunk.title}\n${chunk.content}`);
      }
    }

    const systemContext = parts.join('\n').trim();

    // Build history for LLM (last N messages)
    const history: LlmMessage[] = recentMessages
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    return { systemContext, history, sources };
  }

  private async loadConversation(
    conversationId: string,
    orgId: string,
  ): Promise<{ contextSnapshot: unknown } | null> {
    try {
      const res = await this.db.query(
        `SELECT context_snapshot FROM copilot_conversations WHERE id=$1 AND organization_id=$2`,
        [conversationId, orgId],
      );
      if (!res.rowCount) return null;
      return { contextSnapshot: res.rows[0]['context_snapshot'] };
    } catch {
      return null;
    }
  }

  private async loadRecentMessages(
    conversationId: string,
    orgId: string,
  ): Promise<Array<{ role: string; content: string }>> {
    try {
      const res = await this.db.query(
        `SELECT role, content FROM copilot_messages
         WHERE conversation_id=$1 AND organization_id=$2
         ORDER BY created_at DESC LIMIT $3`,
        [conversationId, orgId, MAX_HISTORY],
      );
      return res.rows.reverse();
    } catch {
      return [];
    }
  }

  private async loadCaseData(conversationId: string, orgId: string): Promise<string | null> {
    try {
      const res = await this.db.query(
        `SELECT p.first_name, p.last_name, p.date_of_birth,
                c.status, c.notes
         FROM copilot_conversations cv
         JOIN cases c ON c.id = cv.case_id
         JOIN patients p ON p.id = c.patient_id
         WHERE cv.id=$1 AND cv.organization_id=$2`,
        [conversationId, orgId],
      );
      if (!res.rowCount) return null;
      const r = res.rows[0];
      const lines = [
        `Patient: ${r['first_name']} ${r['last_name']}`,
        `Case status: ${r['status']}`,
      ];
      if (r['notes']) lines.push(`Notes: ${r['notes']}`);
      return lines.join('\n');
    } catch {
      return null;
    }
  }

  private async retrieveKnowledge(query: string, category: string): Promise<KnowledgeChunk[]> {
    if (!this.embedder.isConfigured()) return [];
    const embedding = await this.embedder.embed(query);
    if (!embedding) return [];
    return this.vectorStore.searchKnowledge(embedding, {
      limit: MAX_KNOWLEDGE,
      category: category !== 'support' ? category : undefined,
    });
  }
}
