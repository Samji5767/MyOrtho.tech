import { Injectable, Inject, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { hasPermission } from '../auth/permissions';

// Valid case status values — must exactly match the case_status enum in schema.sql
export const CASE_STATUSES = [
  'draft',
  'scan_review',
  'segmentation',
  'planning',
  'clinical_review',
  'approved',
  'active_treatment',
  'monitoring',
  'retention',
  'completed',
  'archived',
  'cancelled',
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

// Allowed transitions: from → allowed next statuses.
// 'archived' and 'cancelled' are allowed from every active state so clinicians
// can retire a case at any point without being blocked by workflow step order.
const TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  draft:            ['scan_review', 'cancelled', 'archived'],
  scan_review:      ['segmentation', 'draft', 'cancelled', 'archived'],
  segmentation:     ['planning', 'scan_review', 'cancelled', 'archived'],
  planning:         ['clinical_review', 'segmentation', 'cancelled', 'archived'],
  clinical_review:  ['approved', 'planning', 'archived'],
  approved:         ['active_treatment', 'clinical_review', 'archived'],
  active_treatment: ['monitoring', 'retention', 'completed', 'archived'],
  monitoring:       ['retention', 'active_treatment', 'completed', 'archived'],
  retention:        ['completed', 'archived'],
  completed:        ['archived'],
  archived:         [],
  cancelled:        [],
};

export interface TransitionInput {
  caseId: string;
  toStatus: CaseStatus;
  actorId: string;
  actorRole: string;
  orgId: string;
  actorEmail?: string;
  notes?: string;
  ipAddress?: string;
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

  async transition(input: TransitionInput): Promise<{ fromStatus: string; toStatus: string }> {
    const client = await this.pool.connect();
    let committed = false;
    let fromStatus: CaseStatus | undefined;
    try {
      await client.query('BEGIN');

      // Lock the row to prevent concurrent transitions on the same case (TOCTOU guard).
      const { rows } = await client.query<{ status: string }>(
        'SELECT status FROM cases WHERE id = $1 FOR UPDATE',
        [input.caseId],
      );
      fromStatus = rows[0]?.status as CaseStatus | undefined;
      if (!fromStatus) {
        throw new BadRequestException(`Case ${input.caseId} not found`);
      }

      const allowed = TRANSITIONS[fromStatus] ?? [];
      if (!allowed.includes(input.toStatus)) {
        throw new BadRequestException(
          `Transition from '${fromStatus}' to '${input.toStatus}' is not permitted`,
        );
      }

      // Privileged statuses require additional permissions beyond cases:write
      const APPROVE_STATUSES: CaseStatus[] = ['approved'];
      if (APPROVE_STATUSES.includes(input.toStatus) && !hasPermission(input.actorRole, 'cases:approve')) {
        throw new ForbiddenException(
          `Role '${input.actorRole}' does not have permission to approve cases`,
        );
      }

      // Update case status and write workflow event atomically.
      await client.query(
        'UPDATE cases SET status = $1, updated_at = now() WHERE id = $2 AND organization_id = $3',
        [input.toStatus, input.caseId, input.orgId],
      );

      await client.query(
        `INSERT INTO workflow_events
           (case_id, from_status, to_status, actor_id, actor_role, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [input.caseId, fromStatus, input.toStatus, input.actorId, input.actorRole, input.notes ?? null],
      );

      await client.query('COMMIT');
      committed = true;
    } catch (err) {
      if (!committed) {
        try { await client.query('ROLLBACK'); } catch { /* ignore rollback errors */ }
      }
      throw err;
    } finally {
      client.release();
    }

    // Audit outside the transaction — failures must never roll back a completed transition.
    await this.auditService.log({
      organizationId: input.orgId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      resourceType: 'case',
      resourceId: input.caseId,
      action: `case.status.${input.toStatus}`,
      details: { fromStatus, toStatus: input.toStatus, notes: input.notes },
      ipAddress: input.ipAddress,
    });

    return { fromStatus, toStatus: input.toStatus };
  }

  async getHistory(caseId: string) {
    const { rows } = await this.pool.query(
      `SELECT
         we.id,
         we.from_status   AS "fromStatus",
         we.to_status     AS "toStatus",
         we.actor_id      AS "actorId",
         we.actor_role    AS "actorRole",
         we.notes,
         we.created_at    AS "createdAt",
         au.full_name     AS "actorName",
         au.email         AS "actorEmail"
       FROM workflow_events we
       LEFT JOIN auth_users au ON au.id = we.actor_id
       WHERE we.case_id = $1
       ORDER BY we.created_at ASC
       LIMIT 200`,
      [caseId],
    );
    return rows;
  }

  allowedTransitions(status: CaseStatus): CaseStatus[] {
    return TRANSITIONS[status] ?? [];
  }
}
