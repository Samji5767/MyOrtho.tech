import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export type NotificationType =
  | 'case_approved' | 'case_submitted' | 'case_rejected'
  | 'plan_ready' | 'plan_approved'
  | 'qc_passed' | 'qc_failed'
  | 'print_completed' | 'print_failed'
  | 'segmentation_done' | 'segmentation_failed'
  | 'analysis_saved' | 'system';

export interface CreateNotificationDto {
  userId: string;
  orgId: string;
  type: NotificationType;
  title: string;
  body?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(dto: CreateNotificationDto): Promise<void> {
    await this.pool.query(
      `INSERT INTO notifications (organization_id, user_id, type, title, body, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [dto.orgId, dto.userId, dto.type, dto.title, dto.body ?? null, JSON.stringify(dto.meta ?? {})],
    );
  }

  async listForUser(userId: string, orgId: string, limit = 50) {
    const { rows } = await this.pool.query(
      `SELECT id, type, title, body, meta, read_at, created_at
       FROM notifications
       WHERE user_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [userId, orgId, limit],
    );
    return rows.map((r) => ({
      id: r.id as string,
      type: r.type as string,
      title: r.title as string,
      body: r.body as string | null,
      meta: r.meta as Record<string, unknown>,
      readAt: r.read_at ? (r.read_at as Date).toISOString() : null,
      isRead: r.read_at != null,
      createdAt: (r.created_at as Date).toISOString(),
    }));
  }

  async unreadCount(userId: string, orgId: string): Promise<number> {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND organization_id = $2 AND read_at IS NULL`,
      [userId, orgId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async markRead(ids: string[], userId: string, orgId: string): Promise<void> {
    if (!ids.length) return;
    const placeholders = ids.map((_, i) => `$${i + 3}`).join(',');
    await this.pool.query(
      `UPDATE notifications SET read_at = now()
       WHERE user_id = $1 AND organization_id = $2 AND read_at IS NULL AND id IN (${placeholders})`,
      [userId, orgId, ...ids],
    );
  }

  async markAllRead(userId: string, orgId: string): Promise<void> {
    await this.pool.query(
      `UPDATE notifications SET read_at = now()
       WHERE user_id = $1 AND organization_id = $2 AND read_at IS NULL`,
      [userId, orgId],
    );
  }

  async dismiss(id: string, userId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
  }
}
