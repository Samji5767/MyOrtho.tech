import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// Minimum sample sizes for each prediction to show a meaningful estimate
const MIN_SAMPLE_COMPLETION = 10;
const MIN_SAMPLE_REFINEMENT = 8;
const MIN_SAMPLE_DURATION = 12;

export interface CasePredictions {
  caseId: string;
  completionProbability: { value: number; confidence: 'low' | 'medium' | 'high'; sampleSize: number } | null;
  refinementLikelihood: { value: number; confidence: 'low' | 'medium' | 'high'; sampleSize: number } | null;
  estimatedDurationWeeks: { value: number; rangeMin: number; rangeMax: number; sampleSize: number } | null;
  insufficientData: boolean;
  insufficientDataReasons: string[];
}

export interface PracticeAnalytics {
  period: string;
  totalNewPatients: number;
  totalNewCases: number;
  completedCases: number;
  averageCaseDurationWeeks: number | null;
  refinementRate: number | null;
  completionRate: number | null;
  casesByStatus: Record<string, number>;
  sampleSizes: Record<string, number>;
}

@Injectable()
export class PredictionsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getCasePredictions(caseId: string, orgId: string): Promise<CasePredictions> {
    const insufficientDataReasons: string[] = [];

    // Gather org-level historical statistics for predictions
    const [orgStatsRes, caseInfoRes] = await Promise.all([
      this.pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('completed', 'archived')) AS completed_count,
           COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
           COUNT(*) FILTER (WHERE status NOT IN ('draft', 'cancelled')) AS active_or_done,
           AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 604800.0)
             FILTER (WHERE status = 'completed') AS avg_duration_weeks,
           STDDEV(EXTRACT(EPOCH FROM (updated_at - created_at)) / 604800.0)
             FILTER (WHERE status = 'completed') AS stddev_duration_weeks
         FROM cases WHERE organization_id = $1`,
        [orgId],
      ),
      this.pool.query(
        `SELECT id, status, created_at, updated_at, chief_complaint
         FROM cases WHERE id = $1 AND organization_id = $2`,
        [caseId, orgId],
      ),
    ]);

    if (!caseInfoRes.rows[0]) {
      return {
        caseId,
        completionProbability: null,
        refinementLikelihood: null,
        estimatedDurationWeeks: null,
        insufficientData: true,
        insufficientDataReasons: ['Case not found'],
      };
    }

    const orgStats = orgStatsRes.rows[0];
    const completedCount = parseInt(String(orgStats['completed_count'] ?? '0'), 10);
    const cancelledCount = parseInt(String(orgStats['cancelled_count'] ?? '0'), 10);
    const activeOrDone = parseInt(String(orgStats['active_or_done'] ?? '0'), 10);
    const avgDurationWeeks = orgStats['avg_duration_weeks'] ? parseFloat(String(orgStats['avg_duration_weeks'])) : null;
    const stddevDurationWeeks = orgStats['stddev_duration_weeks'] ? parseFloat(String(orgStats['stddev_duration_weeks'])) : null;

    // Completion probability
    let completionProbability: CasePredictions['completionProbability'] = null;
    if (activeOrDone < MIN_SAMPLE_COMPLETION) {
      insufficientDataReasons.push(`Completion probability requires ${MIN_SAMPLE_COMPLETION} historical cases (${activeOrDone} available)`);
    } else {
      const pComplete = completedCount / (completedCount + cancelledCount || 1);
      const confidence = activeOrDone >= 50 ? 'high' : activeOrDone >= 20 ? 'medium' : 'low';
      completionProbability = { value: Math.round(pComplete * 100) / 100, confidence, sampleSize: activeOrDone };
    }

    // Refinement likelihood — based on org refinement rate
    let refinementLikelihood: CasePredictions['refinementLikelihood'] = null;
    const refinementRes = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE r.id IS NOT NULL) AS cases_with_refinements,
         COUNT(c.id) AS total_cases
       FROM cases c
       LEFT JOIN (
         SELECT DISTINCT case_id FROM scans WHERE jaw_type = 'refinement'
       ) r ON r.case_id = c.id
       WHERE c.organization_id = $1 AND c.status NOT IN ('draft')`,
      [orgId],
    ).catch(() => ({ rows: [{ cases_with_refinements: '0', total_cases: '0' }] }));

    const refinementSample = parseInt(String(refinementRes.rows[0]?.['total_cases'] ?? '0'), 10);
    if (refinementSample < MIN_SAMPLE_REFINEMENT) {
      insufficientDataReasons.push(`Refinement likelihood requires ${MIN_SAMPLE_REFINEMENT} historical cases (${refinementSample} available)`);
    } else {
      const withRefinements = parseInt(String(refinementRes.rows[0]?.['cases_with_refinements'] ?? '0'), 10);
      const rate = withRefinements / (refinementSample || 1);
      const confidence = refinementSample >= 40 ? 'high' : refinementSample >= 15 ? 'medium' : 'low';
      refinementLikelihood = { value: Math.round(rate * 100) / 100, confidence, sampleSize: refinementSample };
    }

    // Estimated duration
    let estimatedDurationWeeks: CasePredictions['estimatedDurationWeeks'] = null;
    if (completedCount < MIN_SAMPLE_DURATION || avgDurationWeeks === null) {
      insufficientDataReasons.push(`Duration estimate requires ${MIN_SAMPLE_DURATION} completed cases (${completedCount} available)`);
    } else {
      const std = stddevDurationWeeks ?? avgDurationWeeks * 0.2;
      const rangeMin = Math.max(1, Math.round((avgDurationWeeks - std) * 10) / 10);
      const rangeMax = Math.round((avgDurationWeeks + std) * 10) / 10;
      estimatedDurationWeeks = {
        value: Math.round(avgDurationWeeks * 10) / 10,
        rangeMin,
        rangeMax,
        sampleSize: completedCount,
      };
    }

    return {
      caseId,
      completionProbability,
      refinementLikelihood,
      estimatedDurationWeeks,
      insufficientData: insufficientDataReasons.length === 3,
      insufficientDataReasons,
    };
  }

  async getPracticeAnalytics(orgId: string, periodDays = 30): Promise<PracticeAnalytics> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    const [patientsRes, casesRes, statusRes, durationRes, refinementRes] = await Promise.all([
      this.pool.query(
        `SELECT COUNT(*) AS count FROM patients WHERE organization_id = $1 AND created_at >= $2`,
        [orgId, since],
      ),
      this.pool.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed
         FROM cases WHERE organization_id = $1 AND created_at >= $2`,
        [orgId, since],
      ),
      this.pool.query(
        `SELECT status, COUNT(*) AS count FROM cases
         WHERE organization_id = $1
         GROUP BY status`,
        [orgId],
      ),
      this.pool.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 604800.0) AS avg_weeks,
                COUNT(*) AS sample
         FROM cases WHERE organization_id = $1 AND status = 'completed'`,
        [orgId],
      ),
      this.pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE r.id IS NOT NULL)::float / NULLIF(COUNT(c.id), 0) AS rate,
           COUNT(c.id) AS sample
         FROM cases c
         LEFT JOIN (
           SELECT DISTINCT case_id FROM scans WHERE jaw_type = 'refinement'
         ) r ON r.case_id = c.id
         WHERE c.organization_id = $1`,
        [orgId],
      ).catch(() => ({ rows: [{ rate: null, sample: '0' }] })),
    ]);

    const casesByStatus: Record<string, number> = {};
    for (const row of statusRes.rows) {
      casesByStatus[row['status'] as string] = parseInt(String(row['count']), 10);
    }

    const durationRow = durationRes.rows[0];
    const avgDuration = durationRow?.['avg_weeks'] ? parseFloat(String(durationRow['avg_weeks'])) : null;
    const durationSample = parseInt(String(durationRow?.['sample'] ?? '0'), 10);

    const refinementRow = refinementRes.rows[0];
    const refinementRate = refinementRow?.['rate'] ? parseFloat(String(refinementRow['rate'])) : null;
    const refinementSample = parseInt(String(refinementRow?.['sample'] ?? '0'), 10);

    const totalCases = parseInt(String(casesRes.rows[0]?.['total'] ?? '0'), 10);
    const completedCases = parseInt(String(casesRes.rows[0]?.['completed'] ?? '0'), 10);

    return {
      period: `${periodDays}d`,
      totalNewPatients: parseInt(String(patientsRes.rows[0]?.['count'] ?? '0'), 10),
      totalNewCases: totalCases,
      completedCases,
      averageCaseDurationWeeks: avgDuration !== null ? Math.round(avgDuration * 10) / 10 : null,
      refinementRate: refinementRate !== null ? Math.round(refinementRate * 1000) / 1000 : null,
      completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 1000) / 1000 : null,
      casesByStatus,
      sampleSizes: {
        duration: durationSample,
        refinement: refinementSample,
        cases: totalCases,
      },
    };
  }
}
