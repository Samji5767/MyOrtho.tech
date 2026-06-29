import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface QualityMetric {
  id: string; metricName: string; periodStart: string; periodEnd: string;
  targetValue: number | null; actualValue: number | null; unit: string | null;
  notes: string | null; variance: number | null; createdAt: string;
}

const STANDARD_METRICS = [
  { name: 'treatment_completion_rate',  unit: '%',  description: 'Percentage of cases reaching completed status' },
  { name: 'patient_satisfaction_score', unit: 'pts', description: 'Average patient satisfaction (1-5 scale)' },
  { name: 'refinement_rate',            unit: '%',  description: 'Percentage of cases requiring refinement aligners' },
  { name: 'avg_treatment_duration_days',unit: 'days',description: 'Average days from case creation to completion' },
  { name: 'scan_to_plan_days',          unit: 'days',description: 'Average days from scan upload to plan approval' },
  { name: 'no_show_rate',               unit: '%',  description: 'Appointment no-show percentage' },
  { name: 'consent_turnaround_hours',   unit: 'h',  description: 'Average hours from consent creation to signature' },
];

@Injectable()
export class QualityMetricsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  listStandardMetrics() { return STANDARD_METRICS; }

  async listMetrics(orgId: string, metricName?: string): Promise<QualityMetric[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM quality_metrics WHERE organization_id=$1 ${metricName ? 'AND metric_name=$2' : ''} ORDER BY period_start DESC LIMIT 200`,
      metricName ? [orgId, metricName] : [orgId],
    );
    return rows.map(this.map);
  }

  async recordMetric(orgId: string, dto: {
    metricName: string; periodStart: string; periodEnd: string;
    targetValue?: number; actualValue?: number; unit?: string; notes?: string;
  }): Promise<QualityMetric> {
    const { rows } = await this.db.query(
      `INSERT INTO quality_metrics (organization_id, metric_name, period_start, period_end, target_value, actual_value, unit, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (organization_id, metric_name, period_start) DO UPDATE SET
         target_value=COALESCE($5, quality_metrics.target_value),
         actual_value=COALESCE($6, quality_metrics.actual_value),
         unit=COALESCE($7, quality_metrics.unit), notes=COALESCE($8, quality_metrics.notes)
       RETURNING *`,
      [orgId, dto.metricName, dto.periodStart, dto.periodEnd,
       dto.targetValue ?? null, dto.actualValue ?? null, dto.unit ?? null, dto.notes ?? null],
    );
    return this.map(rows[0]);
  }

  async computeMetrics(orgId: string, periodStart: string, periodEnd: string): Promise<QualityMetric[]> {
    const results: QualityMetric[] = [];

    const { rows: cr } = await this.db.query(
      `SELECT
         COUNT(CASE WHEN status='completed' THEN 1 END)::numeric / NULLIF(COUNT(*),0) * 100 AS rate
       FROM cases WHERE organization_id=$1 AND created_at BETWEEN $2 AND $3`,
      [orgId, periodStart, periodEnd],
    );
    if (cr[0]?.rate != null) {
      results.push(await this.recordMetric(orgId, {
        metricName: 'treatment_completion_rate', periodStart, periodEnd,
        actualValue: Math.round(Number(cr[0].rate) * 10) / 10, unit: '%',
      }));
    }

    const { rows: sat } = await this.db.query(
      `SELECT AVG(patient_satisfaction)::numeric(4,2) AS avg FROM treatment_outcomes
       WHERE organization_id=$1 AND outcome_date BETWEEN $2 AND $3`,
      [orgId, periodStart, periodEnd],
    );
    if (sat[0]?.avg != null) {
      results.push(await this.recordMetric(orgId, {
        metricName: 'patient_satisfaction_score', periodStart, periodEnd,
        actualValue: Number(sat[0].avg), unit: 'pts',
      }));
    }

    return results;
  }

  private map(r: Record<string, unknown>): QualityMetric {
    const target = r['target_value'] != null ? Number(r['target_value']) : null;
    const actual = r['actual_value'] != null ? Number(r['actual_value']) : null;
    return {
      id: r['id'] as string, metricName: r['metric_name'] as string,
      periodStart: String(r['period_start']), periodEnd: String(r['period_end']),
      targetValue: target, actualValue: actual,
      unit: r['unit'] as string | null, notes: r['notes'] as string | null,
      variance: target != null && actual != null ? Math.round((actual - target) * 10) / 10 : null,
      createdAt: String(r['created_at']),
    };
  }
}
