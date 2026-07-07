import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface AiScores {
  caseId: string;
  planId: string | null;
  // Duration prediction in months (null when no staging plan exists)
  estimatedDurationMonths: number | null;
  // 0–1 probability that at least one refinement cycle will be needed
  refinementProbability: number;
  // 0–100 composite success confidence derived from quality scoring
  successConfidence: number;
  // 0–100 overall clinical risk (higher = riskier)
  clinicalRiskScore: number;
  // Breakdown components
  qualityGrade: string | null;
  qualityScore: number | null;
  criticalIssueCount: number;
  warningCount: number;
  collisionCount: number;
  unsafeIprCount: number;
  refinementCycleCount: number;
  anchorageLevel: 'low' | 'medium' | 'high';
  computedAt: string;
}

@Injectable()
export class AiScoresService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getScores(caseId: string, orgId: string): Promise<AiScores> {
    // Verify case ownership
    const { rows: caseRows } = await this.pool.query(
      `SELECT c.id FROM cases c JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!caseRows.length) throw new NotFoundException('Case not found');

    // Fetch all required data in parallel to minimize latency
    const [planRow, qualityRow, collisionRow, iprRow, refinementRow, movementRow] =
      await Promise.all([
        // Latest treatment plan with staging info
        this.pool.query<{
          plan_id: string;
          total_active_stages: number | null;
          aligner_change_weeks: number | null;
          estimated_total_weeks: number | null;
        }>(
          `SELECT tp.id AS plan_id,
                  agp.total_active_stages,
                  agp.aligner_change_weeks,
                  agp.estimated_total_weeks
           FROM treatment_plans tp
           LEFT JOIN aligner_generation_plans agp ON agp.plan_id = tp.id
           WHERE tp.case_id = $1
           ORDER BY tp.created_at DESC LIMIT 1`,
          [caseId],
        ),
        // Quality score for latest plan
        this.pool.query<{
          overall_score: string;
          grade: string;
          has_critical_issues: boolean;
          critical_issue_count: number;
          warning_count: number;
          simulation_score: string | null;
        }>(
          `SELECT tqs.overall_score, tqs.grade, tqs.has_critical_issues,
                  tqs.critical_issue_count, tqs.warning_count, tqs.simulation_score
           FROM treatment_quality_scores tqs
           JOIN treatment_plans tp ON tp.id = tqs.plan_id
           WHERE tp.case_id = $1
           ORDER BY tqs.scored_at DESC LIMIT 1`,
          [caseId],
        ),
        // Collision count for latest plan
        this.pool.query<{ total: string; critical: string }>(
          `SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE ac.severity = 'critical') AS critical
           FROM attachment_collisions ac
           JOIN treatment_plans tp ON tp.id = ac.plan_id
           WHERE tp.case_id = $1`,
          [caseId],
        ),
        // Unsafe IPR estimates
        this.pool.query<{ unsafe_count: string }>(
          `SELECT COUNT(*) AS unsafe_count
           FROM ipr_enamel_estimates ie
           JOIN treatment_plans tp ON tp.id = ie.plan_id
           WHERE tp.case_id = $1 AND ie.is_safe = false`,
          [caseId],
        ),
        // Refinement cycles
        this.pool.query<{ cycle_count: string }>(
          `SELECT COUNT(*) AS cycle_count FROM refinement_cycles WHERE case_id = $1`,
          [caseId],
        ),
        // Max bodily movement magnitude across all prescriptions for anchorage demand
        this.pool.query<{
          max_translation: string | null;
          max_torque: string | null;
          tooth_count: string;
        }>(
          `SELECT
             MAX(GREATEST(
               ABS(mp.translation_mesial_mm), ABS(mp.translation_distal_mm),
               ABS(mp.translation_buccal_mm), ABS(mp.translation_lingual_mm)
             )) AS max_translation,
             MAX(ABS(mp.torque_deg)) AS max_torque,
             COUNT(*) AS tooth_count
           FROM movement_prescriptions mp
           JOIN treatment_plans tp ON tp.id = mp.plan_id
           WHERE tp.case_id = $1`,
          [caseId],
        ),
      ]);

    const plan = planRow.rows[0] ?? null;
    const quality = qualityRow.rows[0] ?? null;
    const collision = collisionRow.rows[0];
    const ipr = iprRow.rows[0];
    const refinement = refinementRow.rows[0];
    const movement = movementRow.rows[0];

    // ── Duration prediction ────────────────────────────────────────────────
    let estimatedDurationMonths: number | null = null;
    if (plan?.estimated_total_weeks) {
      estimatedDurationMonths = Math.round((plan.estimated_total_weeks / 4.33) * 10) / 10;
    } else if (plan?.total_active_stages != null && plan.aligner_change_weeks != null) {
      const totalWeeks = plan.total_active_stages * plan.aligner_change_weeks;
      estimatedDurationMonths = Math.round((totalWeeks / 4.33) * 10) / 10;
    }

    // ── Refinement probability ─────────────────────────────────────────────
    // Base probability increases with existing refinement cycles and movement complexity
    const priorCycles = Number(refinement?.cycle_count ?? 0);
    const toothCount = Number(movement?.tooth_count ?? 0);
    const maxTranslation = Number(movement?.max_translation ?? 0);
    // Logistic sigmoid: each prior cycle adds ~20% probability, maxes at 0.9
    let refinementProb = 0.1 + priorCycles * 0.2;
    // Complexity adjustment: >14 teeth with >2mm bodily movement adds up to 0.15
    if (toothCount > 14 && maxTranslation > 2) {
      refinementProb += Math.min(0.15, (maxTranslation - 2) * 0.03);
    }
    refinementProb = Math.min(0.9, Math.max(0.05, refinementProb));

    // ── Success confidence ─────────────────────────────────────────────────
    let successConfidence = 75; // default baseline
    if (quality) {
      const qs = Number(quality.overall_score);
      // Quality score is 0–1; map to 40–100 range
      successConfidence = Math.round(40 + qs * 60);
      // Deduct for critical issues
      successConfidence -= quality.critical_issue_count * 8;
      // Deduct for warnings
      successConfidence -= Math.min(15, quality.warning_count * 2);
      successConfidence = Math.max(0, Math.min(100, successConfidence));
    }

    // ── Clinical risk score ────────────────────────────────────────────────
    const collisionCount = Number(collision?.total ?? 0);
    const criticalCollisions = Number(collision?.critical ?? 0);
    const unsafeIpr = Number(ipr?.unsafe_count ?? 0);
    const criticalIssues = quality?.critical_issue_count ?? 0;
    const warnings = quality?.warning_count ?? 0;

    let riskScore = 10; // baseline low risk
    riskScore += criticalCollisions * 15;
    riskScore += (collisionCount - criticalCollisions) * 5;
    riskScore += unsafeIpr * 10;
    riskScore += criticalIssues * 12;
    riskScore += warnings * 3;
    riskScore += priorCycles * 8;
    riskScore = Math.max(0, Math.min(100, riskScore));

    // ── Anchorage demand ───────────────────────────────────────────────────
    const maxTorque = Number(movement?.max_torque ?? 0);
    let anchorageLevel: 'low' | 'medium' | 'high' = 'low';
    if (maxTranslation > 4 || maxTorque > 20) {
      anchorageLevel = 'high';
    } else if (maxTranslation > 2 || maxTorque > 10) {
      anchorageLevel = 'medium';
    }

    return {
      caseId,
      planId: plan?.plan_id ?? null,
      estimatedDurationMonths,
      refinementProbability: Math.round(refinementProb * 100) / 100,
      successConfidence,
      clinicalRiskScore: riskScore,
      qualityGrade: quality?.grade ?? null,
      qualityScore: quality ? Math.round(Number(quality.overall_score) * 100) : null,
      criticalIssueCount: criticalIssues,
      warningCount: warnings,
      collisionCount,
      unsafeIprCount: unsafeIpr,
      refinementCycleCount: priorCycles,
      anchorageLevel,
      computedAt: new Date().toISOString(),
    };
  }
}
