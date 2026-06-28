import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Clinical movement limits (per stage) ─────────────────────────────────────
// Based on accepted aligner biomechanics literature (Kravitz et al.).

interface MovementLimits {
  safe: number;
  warning: number;
  unsafe: number;
}

const LIMITS: Record<string, MovementLimits> = {
  mesialMm:    { safe: 0.20, warning: 0.25, unsafe: 0.30 },
  distalMm:    { safe: 0.20, warning: 0.25, unsafe: 0.30 },
  buccalMm:    { safe: 0.20, warning: 0.25, unsafe: 0.30 },
  lingualMm:   { safe: 0.20, warning: 0.25, unsafe: 0.30 },
  intrusionMm: { safe: 0.20, warning: 0.30, unsafe: 0.40 },
  extrusionMm: { safe: 0.50, warning: 0.65, unsafe: 0.75 },
  torqueDeg:   { safe: 1.50, warning: 2.50, unsafe: 3.50 },
  tipDeg:      { safe: 2.00, warning: 3.00, unsafe: 4.00 },
  rotationDeg: { safe: 1.50, warning: 2.00, unsafe: 3.00 },
};

// FDI crown widths (mm) — for adjacent-tooth clearance check
const CROWN_WIDTH: Record<number, number> = {
  11: 8.5, 12: 6.8, 13: 7.5, 14: 7.0, 15: 7.0, 16: 10.2, 17: 9.9, 18: 9.0,
  21: 8.5, 22: 6.8, 23: 7.5, 24: 7.0, 25: 7.0, 26: 10.2, 27: 9.9, 28: 9.0,
  31: 5.4, 32: 6.0, 33: 6.8, 34: 7.0, 35: 7.0, 36: 10.9, 37: 10.4, 38: 9.8,
  41: 5.4, 42: 6.0, 43: 6.8, 44: 7.0, 45: 7.0, 46: 10.9, 47: 10.4, 48: 9.8,
};

// Tooth difficulty multipliers for anchorage scoring
const DIFFICULTY: Record<number, number> = {};
for (const fdi of [11,12,21,22,31,32,41,42]) DIFFICULTY[fdi] = 1.0; // incisors
for (const fdi of [13,23,33,43])              DIFFICULTY[fdi] = 1.3; // canines
for (const fdi of [14,15,24,25,34,35,44,45]) DIFFICULTY[fdi] = 1.5; // premolars
for (const fdi of [16,17,18,26,27,28,36,37,38,46,47,48]) DIFFICULTY[fdi] = 2.5; // molars

type MovementStatus = 'safe' | 'warning' | 'unsafe';

export interface StageFinding {
  stageNumber: number;
  fdi: number;
  field: string;
  value: number;
  status: MovementStatus;
  limit: number;
  explanation: string;
}

function classifyField(field: string, absValue: number): { status: MovementStatus; limit: number } {
  const lim = LIMITS[field];
  if (!lim) return { status: 'safe', limit: 0 };
  if (absValue > lim.unsafe) return { status: 'unsafe', limit: lim.unsafe };
  if (absValue > lim.warning) return { status: 'warning', limit: lim.warning };
  return { status: 'safe', limit: lim.safe };
}

@Injectable()
export class BiomechanicsService {
  private readonly logger = new Logger(BiomechanicsService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async assessPlan(planId: string, caseId: string, orgId: string) {
    // Verify case ownership
    const { rows: ownerRows } = await this.pool.query(
      `SELECT c.id FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!ownerRows[0]) throw new NotFoundException('Case not found');

    const { rows: planRows } = await this.pool.query(
      `SELECT id FROM treatment_plans WHERE id = $1 AND case_id = $2`,
      [planId, caseId],
    );
    if (!planRows[0]) throw new NotFoundException('Treatment plan not found');

    // Load all stages
    const { rows: stages } = await this.pool.query(
      `SELECT id, stage_number, movement_data
       FROM aligner_stages WHERE treatment_plan_id = $1 ORDER BY stage_number`,
      [planId],
    );

    const findings: StageFinding[] = [];
    let safeCount = 0;
    let warnCount = 0;
    let unsafeCount = 0;
    let totalDifficulty = 0;
    let rootControlScore = 0;
    let collisionPairs = 0;

    for (const stage of stages) {
      const md = (stage['movement_data'] as Record<string, Record<string, number>>) ?? {};
      const stageNum = stage['stage_number'] as number;
      let stageWorst: MovementStatus = 'safe';

      for (const [fdiStr, mv] of Object.entries(md)) {
        const fdi = Number(fdiStr);
        for (const [field, value] of Object.entries(mv)) {
          if (value === 0) continue;
          const absVal = Math.abs(value);
          const { status, limit } = classifyField(field, absVal);
          if (status !== 'safe') {
            const diff = DIFFICULTY[fdi] ?? 1.0;
            totalDifficulty += diff * absVal;
            if (field === 'torqueDeg' || field === 'tipDeg') rootControlScore += absVal;
            findings.push({
              stageNumber: stageNum,
              fdi,
              field,
              value,
              status,
              limit,
              explanation: `${field} = ${value.toFixed(3)} exceeds ${status} threshold ${limit} for FDI ${fdi}`,
            });
            if (status === 'unsafe') stageWorst = 'unsafe';
            else if (status === 'warning' && stageWorst !== 'unsafe') stageWorst = 'warning';
          }
        }
      }

      // Adjacent tooth collision check: mesial movement of FDI + distal of neighbour
      const fdis = Object.keys(md).map(Number).sort((a, b) => a - b);
      for (let i = 0; i < fdis.length - 1; i++) {
        const a = fdis[i], b = fdis[i + 1];
        // only check within-quadrant adjacent pairs
        if (Math.floor(a / 10) !== Math.floor(b / 10)) continue;
        const mvA = md[String(a)] ?? {};
        const mvB = md[String(b)] ?? {};
        const clearance = (CROWN_WIDTH[a] ?? 7) * 0.1; // 10% of crown width as minimum gap
        const netDisp = Math.abs((mvA['mesialMm'] ?? 0) - (mvB['distalMm'] ?? 0));
        if (netDisp > clearance) {
          collisionPairs++;
          findings.push({
            stageNumber: stageNum,
            fdi: a,
            field: 'collision',
            value: netDisp,
            status: 'warning',
            limit: clearance,
            explanation: `Potential contact risk between FDI ${a}–${b}: net displacement ${netDisp.toFixed(2)} mm > clearance ${clearance.toFixed(2)} mm`,
          });
        }
      }

      if (stageWorst === 'unsafe') unsafeCount++;
      else if (stageWorst === 'warning') warnCount++;
      else safeCount++;
    }

    const n = stages.length;
    const overallStatus: MovementStatus = unsafeCount > 0 ? 'unsafe' : warnCount > 0 ? 'warning' : 'safe';
    const anchorageScore = Math.min(100, Math.round(totalDifficulty * 5));
    const rcScore = Math.min(100, Math.round(rootControlScore * 10));
    const diffScore = Math.min(100, Math.round((anchorageScore * 0.6 + rcScore * 0.4)));

    // Upsert biomechanics assessment
    const { rows: saved } = await this.pool.query(
      `INSERT INTO biomechanics_assessments
         (case_id, treatment_plan_id, overall_status, stage_count,
          safe_stage_count, warning_stage_count, unsafe_stage_count,
          anchorage_score, root_control_score, difficulty_score,
          collision_pairs, findings, assessed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        caseId, planId, overallStatus, n,
        safeCount, warnCount, unsafeCount,
        anchorageScore, rcScore, diffScore,
        collisionPairs, JSON.stringify(findings),
      ],
    );

    // If conflict (already exists), update instead
    if (!saved[0]) {
      await this.pool.query(
        `UPDATE biomechanics_assessments
         SET overall_status = $3, stage_count = $4,
             safe_stage_count = $5, warning_stage_count = $6, unsafe_stage_count = $7,
             anchorage_score = $8, root_control_score = $9, difficulty_score = $10,
             collision_pairs = $11, findings = $12, assessed_at = now()
         WHERE case_id = $1 AND treatment_plan_id = $2`,
        [
          caseId, planId, overallStatus, n,
          safeCount, warnCount, unsafeCount,
          anchorageScore, rcScore, diffScore,
          collisionPairs, JSON.stringify(findings),
        ],
      );
    }

    this.logger.log(`Biomechanics assessment for plan ${planId}: ${overallStatus} (${n} stages, ${findings.length} findings)`);
    return {
      planId, caseId, overallStatus, stageCount: n,
      safeStageCount: safeCount, warningStageCount: warnCount, unsafeStageCount: unsafeCount,
      anchorageScore, rootControlScore: rcScore, difficultyScore: diffScore,
      collisionPairs, findings,
      disclaimer: 'Biomechanics assessment is a clinical decision-support tool. Clinician review required before treatment.',
    };
  }

  async getAssessment(planId: string, caseId: string, orgId: string) {
    const { rows: ownerRows } = await this.pool.query(
      `SELECT c.id FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!ownerRows[0]) throw new NotFoundException('Case not found');

    const { rows } = await this.pool.query(
      `SELECT * FROM biomechanics_assessments
       WHERE treatment_plan_id = $1 AND case_id = $2
       ORDER BY assessed_at DESC LIMIT 1`,
      [planId, caseId],
    );
    if (!rows[0]) return null;
    return this.formatAssessment(rows[0]);
  }

  private formatAssessment(r: Record<string, unknown>) {
    return {
      id: r['id'] as string,
      planId: r['treatment_plan_id'] as string,
      caseId: r['case_id'] as string,
      overallStatus: r['overall_status'] as string,
      stageCount: r['stage_count'] as number,
      safeStageCount: r['safe_stage_count'] as number,
      warningStageCount: r['warning_stage_count'] as number,
      unsafeStageCount: r['unsafe_stage_count'] as number,
      anchorageScore: r['anchorage_score'] as number | null,
      rootControlScore: r['root_control_score'] as number | null,
      difficultyScore: r['difficulty_score'] as number | null,
      collisionPairs: r['collision_pairs'] as number,
      findings: r['findings'] as unknown[],
      assessedAt: r['assessed_at'] as Date,
    };
  }
}
