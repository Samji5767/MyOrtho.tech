import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface BackgroundJob {
  id: string;
  organizationId: string | null;
  jobType: string;
  status: string;
  priority: number;
  payloadJson: Record<string, unknown>;
  resultJson: Record<string, unknown> | null;
  error: string | null;
  lastErrorCode: string | null;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  startedAt: string | null;
  completedAt: string | null;
  workerId: string | null;
  claimedAt: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  idempotencyKey: string | null;
  retryDelayMs: number;
  retryScheduledAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const VALID_STATUSES = [
  'pending', 'running', 'completed', 'failed',
  'cancelled', 'dead_letter', 'retry_scheduled',
];

@Injectable()
export class BackgroundJobsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(
    orgId: string,
    opts: { status?: string; jobType?: string; limit?: number },
  ): Promise<BackgroundJob[]> {
    const conditions: string[] = ['(organization_id = $1 OR organization_id IS NULL)'];
    const params: unknown[] = [orgId];

    if (opts.status) {
      params.push(opts.status);
      conditions.push(`status = $${params.length}`);
    }
    if (opts.jobType) {
      params.push(opts.jobType);
      conditions.push(`job_type = $${params.length}`);
    }

    params.push(opts.limit ?? 100);
    const { rows } = await this.db.query(
      `SELECT * FROM background_jobs
       WHERE ${conditions.join(' AND ')}
       ORDER BY priority ASC, run_at ASC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map(this.map);
  }

  async get(id: string, orgId: string): Promise<BackgroundJob> {
    const { rows } = await this.db.query(
      `SELECT * FROM background_jobs WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Job not found');
    return this.map(rows[0]);
  }

  async enqueue(
    orgId: string | null,
    createdBy: string | null,
    dto: {
      jobType: string;
      payloadJson?: Record<string, unknown>;
      priority?: number;
      maxAttempts?: number;
      runAt?: string;
      idempotencyKey?: string;
    },
  ): Promise<BackgroundJob> {
    const { rows } = await this.db.query(
      `INSERT INTO background_jobs
         (organization_id, job_type, payload_json, priority, max_attempts, run_at, created_by, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7, $8)
       ON CONFLICT (organization_id, idempotency_key)
         WHERE idempotency_key IS NOT NULL
         DO UPDATE SET updated_at = background_jobs.updated_at
       RETURNING *`,
      [
        orgId,
        dto.jobType,
        JSON.stringify(dto.payloadJson ?? {}),
        dto.priority ?? 5,
        dto.maxAttempts ?? 3,
        dto.runAt ?? null,
        createdBy,
        dto.idempotencyKey ?? null,
      ],
    );
    return this.map(rows[0]);
  }

  async cancel(id: string, orgId: string): Promise<BackgroundJob> {
    const { rows } = await this.db.query(
      `UPDATE background_jobs
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)
         AND status IN ('pending')
       RETURNING *`,
      [id, orgId],
    );
    if (!rows[0]) {
      throw new BadRequestException('Job not found or cannot be cancelled (only pending jobs can be cancelled)');
    }
    return this.map(rows[0]);
  }

  async getStats(orgId: string): Promise<Record<string, number>> {
    const { rows } = await this.db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM background_jobs
       WHERE organization_id = $1 OR organization_id IS NULL
       GROUP BY status`,
      [orgId],
    );
    const stats: Record<string, number> = {};
    for (const row of rows) {
      stats[row['status'] as string] = row['count'] as number;
    }
    return stats;
  }

  private map(r: Record<string, unknown>): BackgroundJob {
    return {
      id: r['id'] as string,
      organizationId: (r['organization_id'] as string | null) ?? null,
      jobType: r['job_type'] as string,
      status: r['status'] as string,
      priority: Number(r['priority']),
      payloadJson: (r['payload_json'] as Record<string, unknown>) ?? {},
      resultJson: (r['result_json'] as Record<string, unknown> | null) ?? null,
      error: (r['error'] as string | null) ?? null,
      lastErrorCode: (r['last_error_code'] as string | null) ?? null,
      attempts: Number(r['attempts']),
      maxAttempts: Number(r['max_attempts']),
      runAt: String(r['run_at']),
      startedAt: r['started_at'] ? String(r['started_at']) : null,
      completedAt: r['completed_at'] ? String(r['completed_at']) : null,
      workerId: (r['worker_id'] as string | null) ?? null,
      claimedAt: r['claimed_at'] ? String(r['claimed_at']) : null,
      leaseExpiresAt: r['lease_expires_at'] ? String(r['lease_expires_at']) : null,
      heartbeatAt: r['heartbeat_at'] ? String(r['heartbeat_at']) : null,
      idempotencyKey: (r['idempotency_key'] as string | null) ?? null,
      retryDelayMs: Number(r['retry_delay_ms'] ?? 0),
      retryScheduledAt: r['retry_scheduled_at'] ? String(r['retry_scheduled_at']) : null,
      createdBy: (r['created_by'] as string | null) ?? null,
      createdAt: String(r['created_at']),
      updatedAt: String(r['updated_at']),
    };
  }
}
