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
}
