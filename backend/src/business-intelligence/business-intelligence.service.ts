import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface BiMetric { metricName: string; metricValue: number; snapshotDate: string; dimensions: Record<string, unknown> }

@Injectable()
export class BusinessIntelligenceService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async getDashboardMetrics(orgId: string): Promise<Record<string, unknown>> {
    const { rows } = await this.db.query(
      `SELECT
         (SELECT count(*) FROM cases WHERE organization_id=$1)::int AS total_cases,
         (SELECT count(*) FROM cases WHERE organization_id=$1 AND status='active')::int AS active_cases,
         (SELECT count(*) FROM patients WHERE organization_id=$1)::int AS total_patients,
         (SELECT count(*) FROM scans WHERE organization_id=$1 AND created_at >= now() - interval '30 days')::int AS scans_30d,
         (SELECT count(*) FROM cases WHERE organization_id=$1 AND created_at >= now() - interval '30 days')::int AS new_cases_30d,
         (SELECT count(*) FROM cases WHERE organization_id=$1 AND status='completed')::int AS completed_cases,
         (SELECT COALESCE(SUM(quantity_delta),0) FROM inventory_transactions WHERE organization_id=$1 AND transaction_type='usage' AND created_at >= now() - interval '30 days')::int AS material_usage_30d`,
      [orgId],
    );
    return rows[0];
  }

  async getCaseTrend(orgId: string, days = 90): Promise<{ date: string; newCases: number; completedCases: number }[]> {
    const { rows } = await this.db.query(
      `SELECT
         date_trunc('week', created_at)::date AS week_start,
         COUNT(*)::int AS new_cases,
         COUNT(CASE WHEN status='completed' THEN 1 END)::int AS completed_cases
       FROM cases WHERE organization_id=$1 AND created_at >= now() - ($2 || ' days')::interval
       GROUP BY 1 ORDER BY 1`,
      [orgId, days],
    );
    return rows.map(r => ({ date: String(r['week_start']), newCases: r['new_cases'] as number, completedCases: r['completed_cases'] as number }));
  }

  async recordSnapshot(orgId: string, dto: { metricName: string; metricValue: number; snapshotDate?: string; dimensions?: Record<string, unknown> }): Promise<BiMetric> {
    const date = dto.snapshotDate ?? new Date().toISOString().slice(0, 10);
    const dims = JSON.stringify(dto.dimensions ?? {});
    await this.db.query(
      `INSERT INTO bi_snapshots (organization_id, snapshot_date, metric_name, metric_value, dimensions)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id, snapshot_date, metric_name, (dimensions::text)) DO UPDATE SET metric_value=$4`,
      [orgId, date, dto.metricName, dto.metricValue, dims],
    );
    return { metricName: dto.metricName, metricValue: dto.metricValue, snapshotDate: date, dimensions: dto.dimensions ?? {} };
  }

  async getHistoricalMetric(orgId: string, metricName: string, days = 90): Promise<BiMetric[]> {
    const { rows } = await this.db.query(
      `SELECT metric_name, metric_value, snapshot_date, dimensions FROM bi_snapshots
       WHERE organization_id=$1 AND metric_name=$2 AND snapshot_date >= CURRENT_DATE - ($3 || ' days')::interval
       ORDER BY snapshot_date`,
      [orgId, metricName, days],
    );
    return rows.map(r => ({
      metricName: r['metric_name'] as string,
      metricValue: Number(r['metric_value']),
      snapshotDate: String(r['snapshot_date']),
      dimensions: r['dimensions'] as Record<string, unknown>,
    }));
  }
}
