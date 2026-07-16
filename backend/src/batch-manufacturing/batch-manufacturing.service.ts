import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ManufacturingBatch {
  id: string; organizationId: string; batchNumber: string; status: string;
  caseIds: string[]; scheduledDate: string | null; shippedAt: string | null;
  resinType: string | null; priority: number;
  notes: string | null; createdBy: string; createdAt: string; updatedAt: string;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  staging: ['printing', 'cancelled'],
  printing: ['post_processing', 'cancelled'],
  post_processing: ['qc'],
  qc: ['shipped'],
};

@Injectable()
export class BatchManufacturingService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, status?: string): Promise<ManufacturingBatch[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM manufacturing_batches WHERE organization_id=$1 ${status ? 'AND status=$2' : ''} ORDER BY scheduled_date DESC NULLS LAST, created_at DESC`,
      status ? [orgId, status] : [orgId],
    );
    return rows.map(this.map);
  }

  async create(orgId: string, createdBy: string, dto: {
    caseIds?: string[]; scheduledDate?: string; notes?: string;
    resinType?: string; priority?: number;
  }): Promise<ManufacturingBatch> {
    // Verify all provided cases have an approved treatment plan.
    const caseIds = dto.caseIds ?? [];
    if (caseIds.length > 0) {
      const { rows: unapproved } = await this.db.query(
        `SELECT c.id
         FROM unnest($1::uuid[]) AS c(id)
         WHERE NOT EXISTS (
           SELECT 1 FROM treatment_plans tp
           JOIN cases cas ON cas.id = tp.case_id
           JOIN patients p ON p.id = cas.patient_id
           WHERE tp.case_id = c.id
             AND tp.doctor_approval = true
             AND p.organization_id = $2
         )`,
        [caseIds, orgId],
      );
      if (unapproved.length > 0) {
        const ids = unapproved.map((r: Record<string, unknown>) => r['id'] as string).join(', ');
        throw new BadRequestException(
          `The following cases do not have an approved treatment plan and cannot be batched: ${ids}`,
        );
      }
    }

    // Derive next batch number atomically from DB to survive restarts and concurrent requests
    const { rows } = await this.db.query(
      `WITH next_seq AS (
         SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number FROM 7) AS INTEGER)), 0) + 1 AS seq
         FROM manufacturing_batches
       )
       INSERT INTO manufacturing_batches (organization_id, batch_number, case_ids, scheduled_date, notes, resin_type, priority, created_by)
       SELECT $1, 'BATCH-' || LPAD(next_seq.seq::text, 5, '0'), $2, $3, $4, $5, $6, $7
       FROM next_seq
       RETURNING *`,
      [orgId, dto.caseIds ?? [], dto.scheduledDate ?? null, dto.notes ?? null,
       dto.resinType ?? null, dto.priority ?? 5, createdBy],
    );
    return this.map(rows[0]);
  }

  async updateStatus(id: string, orgId: string, newStatus: string): Promise<ManufacturingBatch> {
    const { rows: current } = await this.db.query(
      `SELECT * FROM manufacturing_batches WHERE id=$1 AND organization_id=$2`, [id, orgId],
    );
    if (!current[0]) throw new NotFoundException('Batch not found');
    const currentStatus = current[0]['status'] as string;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Cannot transition from ${currentStatus} to ${newStatus}`);
    }
    const setShipped = newStatus === 'shipped' ? ', shipped_at=now()' : '';
    const { rows } = await this.db.query(
      `UPDATE manufacturing_batches SET status=$3, updated_at=now()${setShipped}
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, newStatus],
    );
    return this.map(rows[0]);
  }

  async addCases(id: string, orgId: string, caseIds: string[]): Promise<ManufacturingBatch> {
    const { rows } = await this.db.query(
      `UPDATE manufacturing_batches SET case_ids=array(SELECT DISTINCT unnest(case_ids || $3)), updated_at=now()
       WHERE id=$1 AND organization_id=$2 AND status='staging' RETURNING *`,
      [id, orgId, caseIds],
    );
    if (!rows[0]) throw new NotFoundException('Batch not found or not in staging status');
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): ManufacturingBatch {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      batchNumber: r['batch_number'] as string, status: r['status'] as string,
      caseIds: (r['case_ids'] as string[]) ?? [],
      scheduledDate: r['scheduled_date'] ? String(r['scheduled_date']) : null,
      shippedAt: r['shipped_at'] ? String(r['shipped_at']) : null,
      resinType: (r['resin_type'] as string | null) ?? null,
      priority: (r['priority'] as number) ?? 5,
      notes: r['notes'] as string | null, createdBy: r['created_by'] as string,
      createdAt: String(r['created_at']), updatedAt: String(r['updated_at']),
    };
  }
}
