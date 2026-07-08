import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Injectable()
export class MessagingService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async createConversation(orgId: string, caseId: string | null, subject: string | null, participantIds: string[]): Promise<{ id: string }> {
    const { rows: [conv] } = await this.pool.query(
      `INSERT INTO conversations (organization_id, case_id, subject) VALUES ($1, $2, $3) RETURNING id`,
      [orgId, caseId ?? null, subject ?? null],
    );
    if (participantIds.length) {
      const values = participantIds.map((_, i) => `($1, $${i + 2})`).join(',');
      await this.pool.query(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [conv.id, ...participantIds],
      );
    }
    return { id: conv.id as string };
  }

  async getConversationsForUser(orgId: string, userId: string) {
    const { rows } = await this.pool.query(
      `SELECT c.id, c.case_id, c.subject, c.created_at,
              (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND NOT ($2 = ANY(m.read_by))) as unread_count
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.organization_id = $1 AND cp.user_id = $2
       ORDER BY c.created_at DESC`,
      [orgId, userId],
    );
    return rows;
  }

  async getMessages(conversationId: string, userId: string) {
    const { rows: part } = await this.pool.query(
      `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId],
    );
    if (!part.length) throw new NotFoundException('Conversation not found');

    const { rows } = await this.pool.query(
      `SELECT m.id, m.body, m.created_at, m.sender_id,
              au.full_name as sender_name, ($2 = ANY(m.read_by)) as is_read
       FROM messages m LEFT JOIN auth_users au ON au.id = m.sender_id
       WHERE m.conversation_id = $1 ORDER BY m.created_at`,
      [conversationId, userId],
    );
    await this.pool.query(
      `UPDATE messages SET read_by = array_append(read_by, $2)
       WHERE conversation_id = $1 AND NOT ($2 = ANY(read_by)) AND sender_id != $2`,
      [conversationId, userId],
    );
    return rows;
  }

  async sendMessage(conversationId: string, senderId: string, body: string) {
    const { rows: part } = await this.pool.query(
      `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, senderId],
    );
    if (!part.length) throw new NotFoundException('Conversation not found');

    const { rows } = await this.pool.query(
      `INSERT INTO messages (conversation_id, sender_id, body, read_by)
       VALUES ($1, $2, $3, ARRAY[$2]::uuid[]) RETURNING id, body, created_at`,
      [conversationId, senderId, body],
    );
    return rows[0];
  }
}
