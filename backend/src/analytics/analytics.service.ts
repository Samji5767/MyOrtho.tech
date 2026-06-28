import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface AnalyticsSummary {
  totalCases: number;
  totalPatients: number;
  casesByStatus: Record<string, number>;
  monthlyThroughput: { month: string; count: number }[];
  planApprovalRate: number | null;
  avgEstimatedStages: number | null;
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getSummary(orgId: string): Promise<AnalyticsSummary> {
    const [
      totalCasesRes,
      totalPatientsRes,
      statusRes,
      monthlyRes,
      plansRes,
    ] = await Promise.all([
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count
         FROM cases c JOIN patients p ON p.id = c.patient_id
         WHERE p.organization_id = $1`,
        [orgId],
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM patients WHERE organization_id = $1`,
        [orgId],
      ),
      this.pool.query<{ status: string; count: string }>(
        `SELECT c.status, COUNT(*)::int AS count
         FROM cases c JOIN patients p ON p.id = c.patient_id
         WHERE p.organization_id = $1
         GROUP BY c.status`,
        [orgId],
      ),
      this.pool.query<{ month: Date; count: string }>(
        `SELECT DATE_TRUNC('month', c.created_at) AS month, COUNT(*)::int AS count
         FROM cases c JOIN patients p ON p.id = c.patient_id
         WHERE p.organization_id = $1
           AND c.created_at >= NOW() - INTERVAL '6 months'
         GROUP BY month ORDER BY month`,
        [orgId],
      ),
      this.pool.query<{ total: string; approved: string; avg_stages: string }>(
        `SELECT COUNT(*)::int AS total,
                SUM(CASE WHEN tp.doctor_approval THEN 1 ELSE 0 END)::int AS approved,
                AVG(tp.estimated_stages)::numeric(6,1) AS avg_stages
         FROM treatment_plans tp
         JOIN cases c ON c.id = tp.case_id
         JOIN patients p ON p.id = c.patient_id
         WHERE p.organization_id = $1`,
        [orgId],
      ),
    ]);

    const totalCases = totalCasesRes.rows[0]?.count ?? 0;
    const totalPatients = totalPatientsRes.rows[0]?.count ?? 0;

    const casesByStatus: Record<string, number> = {};
    for (const row of statusRes.rows) {
      casesByStatus[row.status] = Number(row.count);
    }

    const monthlyThroughput = monthlyRes.rows.map((r) => ({
      month: new Date(r.month).toISOString().slice(0, 7), // "2026-01"
      count: Number(r.count),
    }));

    const plansRow = plansRes.rows[0];
    const totalPlans = Number(plansRow?.total ?? 0);
    const approvedPlans = Number(plansRow?.approved ?? 0);
    const planApprovalRate = totalPlans > 0
      ? Math.round((approvedPlans / totalPlans) * 100)
      : null;
    const avgEstimatedStages = plansRow?.avg_stages != null
      ? Number(plansRow.avg_stages)
      : null;

    return {
      totalCases: Number(totalCases),
      totalPatients: Number(totalPatients),
      casesByStatus,
      monthlyThroughput,
      planApprovalRate,
      avgEstimatedStages,
    };
  }
}
