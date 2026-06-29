import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface PrintJob {
  id: string; organizationId: string; printerId: string | null; caseId: string | null;
  jobName: string; material: string; layerHeightUm: number; status: string;
  startedAt: string | null; completedAt: string | null; printDurationMinutes: number | null;
  notes: string | null; createdBy: string; createdAt: string; updatedAt: string;
}

const NEXT_STATUS: Record<string, string> = {
  queued: 'printing', printing: 'post_processing',
  post_processing: 'qc', qc: 'completed',
};

@Injectable()
export class PrintFarmService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listJobs(orgId: string, status?: string): Promise<PrintJob[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM print_jobs WHERE organization_id=$1 ${status ? 'AND status=$2' : ''} ORDER BY created_at DESC`,
      status ? [orgId, status] : [orgId],
    );
    return rows.map(this.map);
  }

  async createJob(orgId: string, createdBy: string, dto: {
    caseId?: string; printerId?: string; jobName: string; material?: string; layerHeightUm?: number; notes?: string;
  }): Promise<PrintJob> {
    const { rows } = await this.db.query(
      `INSERT INTO print_jobs (organization_id, printer_id, case_id, job_name, material, layer_height_um, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, dto.printerId ?? null, dto.caseId ?? null, dto.jobName,
       dto.material ?? 'ortho_resin', dto.layerHeightUm ?? 50, dto.notes ?? null, createdBy],
    );
    return this.map(rows[0]);
  }

  async advanceStatus(id: string, orgId: string, dto: { printDurationMinutes?: number; notes?: string }): Promise<PrintJob> {
    const { rows: current } = await this.db.query(
      `SELECT * FROM print_jobs WHERE id=$1 AND organization_id=$2`, [id, orgId],
    );
    if (!current[0]) throw new NotFoundException('Print job not found');
    const currentStatus = current[0]['status'] as string;
    const next = NEXT_STATUS[currentStatus];
    if (!next) throw new BadRequestException(`Cannot advance from status: ${currentStatus}`);
    const setStarted = currentStatus === 'queued' ? ', started_at=now()' : '';
    const setCompleted = next === 'completed' ? ', completed_at=now()' : '';
    const { rows } = await this.db.query(
      `UPDATE print_jobs SET status=$3, notes=COALESCE($4,notes),
         print_duration_minutes=COALESCE($5,print_duration_minutes),
         updated_at=now()${setStarted}${setCompleted}
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, next, dto.notes ?? null, dto.printDurationMinutes ?? null],
    );
    return this.map(rows[0]);
  }

  async failJob(id: string, orgId: string, notes?: string): Promise<PrintJob> {
    const { rows } = await this.db.query(
      `UPDATE print_jobs SET status='failed', notes=COALESCE($3,notes), updated_at=now()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, notes ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Print job not found');
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): PrintJob {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      printerId: r['printer_id'] as string | null, caseId: r['case_id'] as string | null,
      jobName: r['job_name'] as string, material: r['material'] as string,
      layerHeightUm: r['layer_height_um'] as number, status: r['status'] as string,
      startedAt: r['started_at'] ? String(r['started_at']) : null,
      completedAt: r['completed_at'] ? String(r['completed_at']) : null,
      printDurationMinutes: r['print_duration_minutes'] as number | null,
      notes: r['notes'] as string | null, createdBy: r['created_by'] as string,
      createdAt: String(r['created_at']), updatedAt: String(r['updated_at']),
    };
  }
}
