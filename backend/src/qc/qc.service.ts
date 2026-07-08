import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export type QCCheckType =
  | 'print_quality' | 'model_integrity' | 'thickness_verification'
  | 'fit_verification' | 'surface_finish' | 'dimensional_accuracy' | 'material_compliance';

export type QCCheckStatus = 'pending' | 'pass' | 'fail' | 'warning';

export interface QCCheck {
  id: string;
  printJobId: string;
  checkType: QCCheckType;
  status: QCCheckStatus;
  measuredValue: number | null;
  expectedMin: number | null;
  expectedMax: number | null;
  unit: string | null;
  notes: string | null;
  checkedByEmail: string | null;
  checkedAt: string | null;
  createdAt: string;
}

export interface QCJobSummary {
  id: string;
  caseId: string | null;
  status: string;
  qualityScore: number | null;
  qcNotes: string | null;
  printerName: string | null;
  checks: QCCheck[];
  passCount: number;
  failCount: number;
  pendingCount: number;
  createdAt: string;
}

const DEFAULT_CHECKS: { checkType: QCCheckType; expectedMin: number; expectedMax: number; unit: string }[] = [
  { checkType: 'print_quality',         expectedMin: 70,  expectedMax: 100, unit: '%' },
  { checkType: 'model_integrity',       expectedMin: 0,   expectedMax: 0,   unit: 'defects' },
  { checkType: 'thickness_verification',expectedMin: 0.6, expectedMax: 0.8, unit: 'mm' },
  { checkType: 'fit_verification',      expectedMin: 0,   expectedMax: 0.1, unit: 'mm' },
  { checkType: 'surface_finish',        expectedMin: 80,  expectedMax: 100, unit: '%' },
  { checkType: 'dimensional_accuracy',  expectedMin: 0,   expectedMax: 0.2, unit: 'mm' },
  { checkType: 'material_compliance',   expectedMin: 1,   expectedMax: 1,   unit: 'pass' },
];

@Injectable()
export class QcService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async verifyOrgJob(jobId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT pj.id FROM print_jobs pj
       JOIN printers p ON p.id = pj.printer_id
       WHERE pj.id = $1 AND p.organization_id = $2`,
      [jobId, orgId],
    );
    if (!rows.length) throw new ForbiddenException('Print job not found or access denied');
  }

  async listJobs(orgId: string, limit = 50): Promise<QCJobSummary[]> {
    const { rows: jobs } = await this.pool.query(
      `SELECT pj.id, pj.case_id, pj.status, pj.quality_score, pj.qc_notes, pj.created_at,
              p.name AS printer_name
       FROM print_jobs pj
       LEFT JOIN printers p ON p.id = pj.printer_id
       WHERE p.organization_id = $1
       ORDER BY pj.created_at DESC LIMIT $2`,
      [orgId, limit],
    );

    if (!jobs.length) return [];

    const jobIds = jobs.map(j => j.id);
    const { rows: checks } = await this.pool.query(
      `SELECT qc.*, u.email AS checked_by_email
       FROM qc_checks qc
       LEFT JOIN auth_users u ON u.id = qc.checked_by
       WHERE qc.print_job_id = ANY($1::uuid[])
       ORDER BY qc.created_at ASC`,
      [jobIds],
    );

    return jobs.map(j => {
      const jobChecks = checks.filter(c => c.print_job_id === j.id).map(this.formatCheck);
      return {
        id: j.id,
        caseId: j.case_id ?? null,
        status: j.status,
        qualityScore: j.quality_score ?? null,
        qcNotes: j.qc_notes ?? null,
        printerName: j.printer_name ?? null,
        checks: jobChecks,
        passCount: jobChecks.filter(c => c.status === 'pass').length,
        failCount: jobChecks.filter(c => c.status === 'fail').length,
        pendingCount: jobChecks.filter(c => c.status === 'pending').length,
        createdAt: j.created_at,
      };
    });
  }

  async initChecks(jobId: string, orgId: string): Promise<QCCheck[]> {
    await this.verifyOrgJob(jobId, orgId);

    // Idempotent: delete existing pending checks first
    await this.pool.query(`DELETE FROM qc_checks WHERE print_job_id = $1 AND status = 'pending'`, [jobId]);

    const values: unknown[] = [];
    const rows: string[] = [];
    DEFAULT_CHECKS.forEach((c, i) => {
      const base = i * 4;
      rows.push(`($1, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
      values.push(c.checkType, c.expectedMin, c.expectedMax, c.unit);
    });

    const { rows: inserted } = await this.pool.query(
      `INSERT INTO qc_checks (print_job_id, check_type, expected_min, expected_max, unit)
       VALUES ${rows.join(', ')}
       RETURNING *, NULL AS checked_by_email`,
      [jobId, ...values],
    );
    return inserted.map(this.formatCheck);
  }

  async updateCheck(
    jobId: string,
    checkId: string,
    orgId: string,
    dto: { status: QCCheckStatus; measuredValue?: number; notes?: string; checkedBy: string },
  ): Promise<QCCheck> {
    await this.verifyOrgJob(jobId, orgId);
    const { rows } = await this.pool.query(
      `UPDATE qc_checks
       SET status         = $1,
           measured_value = COALESCE($2, measured_value),
           notes          = COALESCE($3, notes),
           checked_by     = (SELECT id FROM auth_users WHERE id::text=$4 OR email=$4 LIMIT 1),
           checked_at     = now()
       WHERE id = $5 AND print_job_id = $6
       RETURNING *, (SELECT email FROM auth_users WHERE id = checked_by) AS checked_by_email`,
      [dto.status, dto.measuredValue ?? null, dto.notes ?? null, dto.checkedBy, checkId, jobId],
    );
    if (!rows.length) throw new NotFoundException('QC check not found');

    // Update job quality_score if all checks complete
    await this.pool.query(
      `UPDATE print_jobs
       SET quality_score = (
         SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'pass') / NULLIF(COUNT(*), 0))
         FROM qc_checks WHERE print_job_id = $1
       )
       WHERE id = $1`,
      [jobId],
    );

    return this.formatCheck(rows[0]);
  }

  private formatCheck(r: any): QCCheck {
    return {
      id: r.id,
      printJobId: r.print_job_id,
      checkType: r.check_type,
      status: r.status,
      measuredValue: r.measured_value ?? null,
      expectedMin: r.expected_min ?? null,
      expectedMax: r.expected_max ?? null,
      unit: r.unit ?? null,
      notes: r.notes ?? null,
      checkedByEmail: r.checked_by_email ?? null,
      checkedAt: r.checked_at ?? null,
      createdAt: r.created_at,
    };
  }
}
