import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Injectable()
export class ReportsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async getPracticeSummary(orgId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [cases, patients, locations] = await Promise.all([
      this.db.query(
        `SELECT status, created_at FROM cases WHERE organization_id=$1`,
        [orgId],
      ),
      this.db.query(
        `SELECT id, created_at FROM patients WHERE organization_id=$1`,
        [orgId],
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS count FROM org_locations WHERE organization_id=$1 AND active=true`,
        [orgId],
      ),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of cases.rows) {
      byStatus[row.status as string] = (byStatus[row.status as string] ?? 0) + 1;
    }

    const completedThisMonth = cases.rows.filter(
      (r) => (r.status as string) === 'completed' && new Date(r.created_at as string) >= new Date(since),
    ).length;

    const newThisMonth = cases.rows.filter(
      (r) => new Date(r.created_at as string) >= new Date(since),
    ).length;

    const newPatients = patients.rows.filter(
      (r) => new Date(r.created_at as string) >= new Date(since),
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      period: { from: since, to: new Date().toISOString() },
      cases: { total: cases.rows.length, byStatus, completedThisMonth, newThisMonth },
      patients: { total: patients.rows.length, newThisMonth: newPatients },
      locations: (locations.rows[0]?.count as number) ?? 0,
    };
  }

  async getCasesCSV(orgId: string, days?: number): Promise<string> {
    const since = days
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { rows } = await this.db.query(
      `SELECT c.id, c.status, c.chief_complaint, c.created_at, c.updated_at,
              p.first_name, p.last_name, u.email AS assigned_to
       FROM cases c
       LEFT JOIN patients p ON p.id = c.patient_id
       LEFT JOIN auth_users u ON u.id = c.assigned_to
       WHERE c.organization_id=$1 ${since ? 'AND c.created_at >= $2' : ''}
       ORDER BY c.created_at DESC`,
      since ? [orgId, since] : [orgId],
    );

    const headers = ['Case ID', 'Status', 'Chief Complaint', 'Patient Name', 'Assigned To', 'Created At', 'Updated At'];

    const csvRows = rows.map((r) =>
      [
        r.id as string,
        r.status as string,
        ((r.chief_complaint as string) ?? '').replace(/,/g, ';'),
        `${(r.first_name as string) ?? ''} ${(r.last_name as string) ?? ''}`.trim(),
        (r.assigned_to as string) ?? '',
        r.created_at as string,
        r.updated_at as string,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    return [headers.join(','), ...csvRows].join('\n');
  }
}
