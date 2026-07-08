import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface AuditEventInput {
  organizationId?: string | null;
  actorId?: string | null;
  actorEmail?: string;
  resourceType: string;
  resourceId?: string | null;
  action: string;
  details?: object;
  ipAddress?: string;
}

export interface AuditSummary {
  recentCount: number;
  windowHours: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async log(event: AuditEventInput): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO audit_events
           (organization_id, actor_id, actor_email, resource_type, resource_id,
            action, details, ip_address)
         VALUES ($1, $2, $3, $4, $5::uuid, $6, $7::jsonb, $8)`,
        [
          event.organizationId ?? null,
          event.actorId ?? null,
          event.actorEmail ?? null,
          event.resourceType,
          event.resourceId ?? null,
          event.action,
          JSON.stringify(event.details ?? {}),
          event.ipAddress ?? null,
        ],
      );
    } catch (err) {
      // Audit failures must never crash the main request
      this.logger.error('Failed to write audit event (non-fatal):', err);
    }
  }

  async findByOrg(
    orgId: string,
    opts: { limit?: number; offset?: number } = {},
  ) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const { rows } = await this.pool.query(
      `SELECT * FROM audit_events
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [orgId, limit, offset],
    );
    return rows;
  }

  async findByResource(resourceType: string, resourceId: string, orgId: string): Promise<AuditEventInput[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM audit_events WHERE organization_id=$1 AND resource_type=$2 AND resource_id=$3::uuid ORDER BY created_at DESC LIMIT 100`,
      [orgId, resourceType, resourceId],
    );
    return rows as AuditEventInput[];
  }

  async findByActor(actorId: string, orgId: string, limit: number): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM audit_events WHERE organization_id=$1 AND actor_id=$2 ORDER BY created_at DESC LIMIT $3`,
      [orgId, actorId, limit],
    );
    return rows;
  }

  async getRecentCount(orgId: string, hours: number): Promise<number> {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*) as cnt FROM audit_events WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '1 hour' * $2::int`,
      [orgId, hours],
    );
    return parseInt((rows[0] as { cnt: string }).cnt, 10);
  }
}
