import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StagingStrategy = 'balanced' | 'anterior_first' | 'posterior_first' | 'arch_coordinated';

export interface GenerateDto {
  stagingStrategy?: StagingStrategy;
  alignerChangeWeeks?: number;
  passiveAlignerCount?: number;
  retentionStageCount?: number;
}

export interface IprScheduleEntry {
  stageNum: number;
  fdiA: number;
  fdiB: number;
  amountMm: number;
}

export interface ElasticScheduleEntry {
  stageNum: number;
  classification: 'class_ii' | 'class_iii' | 'midline';
  notes: string;
}

export interface StageAllocationSummary {
  stageNum: number;
  teethMoved: number;
  maxTranslationMm: number;
  maxRotationDeg: number;
  hasAttachment: boolean;
  hasIpr: boolean;
  isPassive: boolean;
  isRetention: boolean;
}

export interface AlignerGenerationPlan {
  id: string;
  planId: string;
  organizationId: string;
  totalActiveStages: number;
  passiveAlignerCount: number;
  retentionStageCount: number;
  alignerChangeWeeks: number;
  stagingStrategy: StagingStrategy;
  attachmentStartStage: number | null;
  attachmentEndStage: number | null;
  iprStageSchedule: IprScheduleEntry[];
  elasticStageSchedule: ElasticScheduleEntry[];
  stageAllocations: StageAllocationSummary[];
  estimatedTotalWeeks: number | null;
  stlExportReady: boolean;
  status: 'draft' | 'approved' | 'manufacturing' | 'complete';
  notes: string | null;
  generatedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  generatedAt: string;
}

export interface QualityIssue {
  stageNum?: number;
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface ManufacturingReadinessCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface StageQualityReport {
  planId: string;
  generatedAt: string;
  overallQualityScore: number;
  issues: QualityIssue[];
  manufacturingReadiness: ManufacturingReadinessCheck[];
  isManufacturingReady: boolean;
}

// Per-stage movement limits (Kravitz)
const PER_STAGE = {
  translation_mm:  0.25,
  rotation_deg:    2.0,
  torque_deg:      2.5,
  tip_deg:         3.0,
  vertical_mm:     0.30,
  arch_mm:         0.25,
};

// FDI helpers
const ANTERIOR_FDI = [11,12,13,21,22,23,31,32,33,41,42,43];
const POSTERIOR_FDI = [14,15,16,17,18,24,25,26,27,28,34,35,36,37,38,44,45,46,47,48];

function isAnterior(fdi: number): boolean { return ANTERIOR_FDI.includes(fdi); }

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToPlan(r: Record<string, unknown>): AlignerGenerationPlan {
  return {
    id:                   r['id'] as string,
    planId:               r['plan_id'] as string,
    organizationId:       r['organization_id'] as string,
    totalActiveStages:    r['total_active_stages'] as number,
    passiveAlignerCount:  r['passive_aligner_count'] as number,
    retentionStageCount:  r['retention_stage_count'] as number,
    alignerChangeWeeks:   r['aligner_change_weeks'] as number,
    stagingStrategy:      r['staging_strategy'] as StagingStrategy,
    attachmentStartStage: r['attachment_start_stage'] as number | null,
    attachmentEndStage:   r['attachment_end_stage'] as number | null,
    iprStageSchedule:     (r['ipr_stage_schedule'] as IprScheduleEntry[]) ?? [],
    elasticStageSchedule: (r['elastic_stage_schedule'] as ElasticScheduleEntry[]) ?? [],
    stageAllocations:     (r['stage_allocations'] as StageAllocationSummary[]) ?? [],
    estimatedTotalWeeks:  r['estimated_total_weeks'] as number | null,
    stlExportReady:       r['stl_export_ready'] as boolean,
    status:               r['status'] as AlignerGenerationPlan['status'],
    notes:                r['notes'] as string | null,
    generatedBy:          r['generated_by'] as string | null,
    approvedBy:           r['approved_by'] as string | null,
    approvedAt:           r['approved_at'] as string | null,
    generatedAt:          r['generated_at'] as string,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AlignerGenerationService {
  private readonly log = new Logger(AlignerGenerationService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  // ── Generate ───────────────────────────────────────────────────────────────

  async generate(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
    dto: GenerateDto,
  ): Promise<AlignerGenerationPlan> {
    await this.verifyPlan(planId, caseId, orgId);

    const strategy   = dto.stagingStrategy      ?? 'balanced';
    const changeWeeks = dto.alignerChangeWeeks  ?? 2;
    const passive    = dto.passiveAlignerCount  ?? 2;
    const retention  = dto.retentionStageCount  ?? 3;

    // Load movement prescriptions
    const prescRes = await this.db.query(
      `SELECT * FROM movement_prescriptions WHERE plan_id=$1 ORDER BY tooth_number`,
      [planId],
    );
    const prescriptions: Record<string, unknown>[] = prescRes.rows;

    if (prescriptions.length === 0) {
      throw new NotFoundException('No movement prescriptions found — add prescriptions first');
    }

    // Compute required stages per tooth
    const stagesPerTooth = this.computeStagesPerTooth(prescriptions, strategy);
    const totalActiveStages = Math.max(...Object.values(stagesPerTooth), 10);

    // Build per-stage allocations
    const allocations = this.buildAllocations(prescriptions, stagesPerTooth, totalActiveStages, strategy);

    // Attachment timing: start at stage 3, end at stage totalActiveStages - 2
    const attachmentStart = Math.min(3, totalActiveStages);
    const attachmentEnd   = Math.max(attachmentStart, totalActiveStages - 2);

    // IPR schedule: plan IPR at stages where mesiodistal movement peaks
    const iprSchedule = this.buildIprSchedule(prescriptions, totalActiveStages);

    // Elastic schedule: detect class correction needs from movement prescriptions
    const elasticSchedule = this.buildElasticSchedule(prescriptions, totalActiveStages);

    // Total weeks = (activeStages + passive + retention) * changeWeeks
    const totalWeeks = (totalActiveStages + passive + retention) * changeWeeks;

    // Stage summary for storage
    const stageSummaries = this.buildStageSummaries(allocations, attachmentStart, attachmentEnd, iprSchedule, totalActiveStages, passive, retention);

    // Clear old allocation rows
    const existingPlan = await this.db.query(
      `SELECT id FROM aligner_generation_plans WHERE plan_id=$1`,
      [planId],
    );
    if (existingPlan.rowCount && existingPlan.rowCount > 0) {
      await this.db.query(
        `DELETE FROM aligner_stage_allocations WHERE generation_plan_id=$1`,
        [existingPlan.rows[0]['id']],
      );
    }

    // Upsert generation plan
    const planRes = await this.db.query(
      `INSERT INTO aligner_generation_plans
         (plan_id, organization_id, total_active_stages, passive_aligner_count,
          retention_stage_count, aligner_change_weeks, staging_strategy,
          attachment_start_stage, attachment_end_stage, ipr_stage_schedule,
          elastic_stage_schedule, stage_allocations, estimated_total_weeks,
          generated_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft')
       ON CONFLICT (plan_id) DO UPDATE SET
         total_active_stages    = EXCLUDED.total_active_stages,
         passive_aligner_count  = EXCLUDED.passive_aligner_count,
         retention_stage_count  = EXCLUDED.retention_stage_count,
         aligner_change_weeks   = EXCLUDED.aligner_change_weeks,
         staging_strategy       = EXCLUDED.staging_strategy,
         attachment_start_stage = EXCLUDED.attachment_start_stage,
         attachment_end_stage   = EXCLUDED.attachment_end_stage,
         ipr_stage_schedule     = EXCLUDED.ipr_stage_schedule,
         elastic_stage_schedule = EXCLUDED.elastic_stage_schedule,
         stage_allocations      = EXCLUDED.stage_allocations,
         estimated_total_weeks  = EXCLUDED.estimated_total_weeks,
         generated_by           = EXCLUDED.generated_by,
         status                 = 'draft',
         generated_at           = now()
       RETURNING *`,
      [
        planId, orgId,
        totalActiveStages, passive, retention, changeWeeks, strategy,
        attachmentStart, attachmentEnd,
        JSON.stringify(iprSchedule),
        JSON.stringify(elasticSchedule),
        JSON.stringify(stageSummaries),
        totalWeeks,
        userId,
      ],
    );

    const genPlanId = planRes.rows[0]['id'] as string;

    // Insert per-tooth per-stage allocation rows
    for (const alloc of allocations) {
      await this.db.query(
        `INSERT INTO aligner_stage_allocations
           (generation_plan_id, stage_num, tooth_number,
            translation_mm, rotation_deg, torque_deg, tip_deg,
            vertical_mm, arch_mm, has_attachment, has_ipr, is_passive, is_retention)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,false)
         ON CONFLICT (generation_plan_id, stage_num, tooth_number) DO UPDATE SET
           translation_mm=EXCLUDED.translation_mm, rotation_deg=EXCLUDED.rotation_deg,
           torque_deg=EXCLUDED.torque_deg, tip_deg=EXCLUDED.tip_deg,
           vertical_mm=EXCLUDED.vertical_mm, arch_mm=EXCLUDED.arch_mm,
           has_attachment=EXCLUDED.has_attachment, has_ipr=EXCLUDED.has_ipr`,
        [
          genPlanId, alloc.stageNum, alloc.toothNumber,
          alloc.translationMm, alloc.rotationDeg, alloc.torqueDeg, alloc.tipDeg,
          alloc.verticalMm, alloc.archMm,
          alloc.stageNum >= attachmentStart && alloc.stageNum <= attachmentEnd,
          iprSchedule.some(i => i.stageNum === alloc.stageNum && (i.fdiA === alloc.toothNumber || i.fdiB === alloc.toothNumber)),
        ],
      );
    }

    this.log.log(`Phase 27 generation: plan ${planId} → ${totalActiveStages} active stages, ${totalWeeks} weeks`);
    return rowToPlan(planRes.rows[0]);
  }

  async getPlan(caseId: string, orgId: string, planId: string): Promise<AlignerGenerationPlan> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM aligner_generation_plans WHERE plan_id=$1`,
      [planId],
    );
    if (res.rowCount === 0) throw new NotFoundException('No generation plan found — run /generate first');
    return rowToPlan(res.rows[0]);
  }

  async getStageAllocations(
    caseId: string,
    orgId: string,
    planId: string,
    stageNum: number,
  ): Promise<Record<string, unknown>[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const planRes = await this.db.query(
      `SELECT id FROM aligner_generation_plans WHERE plan_id=$1`,
      [planId],
    );
    if (planRes.rowCount === 0) throw new NotFoundException('No generation plan found');
    const genPlanId = planRes.rows[0]['id'] as string;

    const res = await this.db.query(
      `SELECT * FROM aligner_stage_allocations
       WHERE generation_plan_id=$1 AND stage_num=$2
       ORDER BY tooth_number`,
      [genPlanId, stageNum],
    );
    return res.rows;
  }

  async approvePlan(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
    notes?: string,
  ): Promise<AlignerGenerationPlan> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `UPDATE aligner_generation_plans
       SET status='approved', approved_by=$1, approved_at=now(), notes=COALESCE($2, notes)
       WHERE plan_id=$3 RETURNING *`,
      [userId, notes ?? null, planId],
    );
    if (res.rowCount === 0) throw new NotFoundException('No generation plan found');
    return rowToPlan(res.rows[0]);
  }

  async markStlReady(
    caseId: string,
    orgId: string,
    planId: string,
    exportPath: string,
  ): Promise<AlignerGenerationPlan> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `UPDATE aligner_generation_plans
       SET stl_export_ready=true, stl_export_path=$1, status='manufacturing'
       WHERE plan_id=$2 RETURNING *`,
      [exportPath, planId],
    );
    if (res.rowCount === 0) throw new NotFoundException('No generation plan found');
    return rowToPlan(res.rows[0]);
  }

  async validatePlan(planId: string, orgId: string): Promise<StageQualityReport> {
    const res = await this.db.query(
      `SELECT * FROM aligner_generation_plans WHERE plan_id=$1 AND organization_id=$2`,
      [planId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('No generation plan found — run /generate first');
    const plan = rowToPlan(res.rows[0]);

    const issues: QualityIssue[] = [];
    const TRANSLATION_LIMIT = PER_STAGE.translation_mm; // 0.25
    const ROTATION_LIMIT    = PER_STAGE.rotation_deg;   // 2.0
    const NEAR_FACTOR       = 0.9;

    // ── Stage allocation movement limit checks ────────────────────────────────
    let movementLimitsValid = true;
    for (const stage of plan.stageAllocations) {
      if (stage.maxTranslationMm > TRANSLATION_LIMIT) {
        movementLimitsValid = false;
        issues.push({
          stageNum: stage.stageNum,
          severity: 'error',
          code: 'EXCESSIVE_TRANSLATION',
          message: `Stage ${stage.stageNum}: translation ${stage.maxTranslationMm.toFixed(3)} mm exceeds ${TRANSLATION_LIMIT} mm limit`,
        });
      } else if (stage.maxTranslationMm >= TRANSLATION_LIMIT * NEAR_FACTOR) {
        issues.push({
          stageNum: stage.stageNum,
          severity: 'warning',
          code: 'NEAR_LIMIT_TRANSLATION',
          message: `Stage ${stage.stageNum}: translation ${stage.maxTranslationMm.toFixed(3)} mm is within 10% of ${TRANSLATION_LIMIT} mm limit`,
        });
      }

      if (stage.maxRotationDeg > ROTATION_LIMIT) {
        movementLimitsValid = false;
        issues.push({
          stageNum: stage.stageNum,
          severity: 'error',
          code: 'EXCESSIVE_ROTATION',
          message: `Stage ${stage.stageNum}: rotation ${stage.maxRotationDeg.toFixed(3)}° exceeds ${ROTATION_LIMIT}° limit`,
        });
      } else if (stage.maxRotationDeg >= ROTATION_LIMIT * NEAR_FACTOR) {
        issues.push({
          stageNum: stage.stageNum,
          severity: 'warning',
          code: 'NEAR_LIMIT_ROTATION',
          message: `Stage ${stage.stageNum}: rotation ${stage.maxRotationDeg.toFixed(3)}° is within 10% of ${ROTATION_LIMIT}° limit`,
        });
      }
    }

    // ── IPR schedule validation ───────────────────────────────────────────────
    let iprValid = true;
    for (const entry of plan.iprStageSchedule) {
      if (entry.amountMm > 0.5) {
        iprValid = false;
        issues.push({
          stageNum: entry.stageNum,
          severity: 'error',
          code: 'EXCESSIVE_IPR',
          message: `Stage ${entry.stageNum}: IPR amount ${entry.amountMm} mm between teeth ${entry.fdiA}–${entry.fdiB} exceeds 0.5 mm limit`,
        });
      }
    }

    // ── Manufacturing readiness checks ────────────────────────────────────────
    const stageCountValid = plan.totalActiveStages >= 5 && plan.totalActiveStages <= 120;

    const manufacturingReadiness: ManufacturingReadinessCheck[] = [
      {
        name: 'Plan Approved',
        passed: plan.status === 'approved',
        details: plan.status === 'approved'
          ? 'Plan has been approved'
          : `Plan status is '${plan.status}'; must be approved before manufacturing`,
      },
      {
        name: 'Movement Limits',
        passed: movementLimitsValid,
        details: movementLimitsValid
          ? 'All stage movement values are within clinical limits'
          : 'One or more stages exceed per-stage movement limits',
      },
      {
        name: 'IPR Valid',
        passed: iprValid,
        details: iprValid
          ? 'All IPR amounts are within 0.5 mm limit'
          : 'One or more IPR entries exceed the 0.5 mm per-contact limit',
      },
      {
        name: 'Retention Protocol',
        passed: plan.retentionStageCount > 0,
        details: plan.retentionStageCount > 0
          ? `${plan.retentionStageCount} retention stage(s) scheduled`
          : 'No retention stages defined; a retention protocol is required',
      },
      {
        name: 'STL Availability',
        passed: plan.stlExportReady,
        details: plan.stlExportReady
          ? 'STL files are ready for manufacturing'
          : 'Per-tooth mesh extraction is not yet implemented. Aligner shells cannot be generated until the segmentation pipeline produces individual tooth mesh files.',
      },
      {
        name: 'Stage Count',
        passed: stageCountValid,
        details: stageCountValid
          ? `${plan.totalActiveStages} active stages is within acceptable range (5–120)`
          : `${plan.totalActiveStages} active stages is outside acceptable range (5–120)`,
      },
    ];

    // ── Quality score ─────────────────────────────────────────────────────────
    const errorCount   = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const overallQualityScore = Math.max(0, Math.min(100, 100 - (errorCount * 15 + warningCount * 5)));

    const isManufacturingReady = manufacturingReadiness.every(c => c.passed);

    this.log.log(`Quality validation: plan ${planId} → score ${overallQualityScore}, ${errorCount} error(s), ${warningCount} warning(s)`);

    return {
      planId,
      generatedAt: new Date().toISOString(),
      overallQualityScore,
      issues,
      manufacturingReadiness,
      isManufacturingReady,
    };
  }

  // ── Staging algorithms ─────────────────────────────────────────────────────

  private computeStagesPerTooth(
    prescriptions: Record<string, unknown>[],
    strategy: StagingStrategy,
  ): Record<number, number> {
    const result: Record<number, number> = {};

    for (const p of prescriptions) {
      const fdi = p['tooth_number'] as number;
      const anterior = isAnterior(fdi);

      // Stage penalty factors by strategy
      const penalty =
        strategy === 'anterior_first' ? (anterior ? 1.0 : 1.25) :
        strategy === 'posterior_first' ? (anterior ? 1.25 : 1.0) :
        1.0; // balanced / arch_coordinated

      const translationStages = (
        ((p['translation_mesial_mm'] as number) + (p['translation_distal_mm'] as number)) /
        PER_STAGE.translation_mm +
        ((p['translation_buccal_mm'] as number) + (p['translation_lingual_mm'] as number)) /
        PER_STAGE.translation_mm
      ) * penalty;

      const rotationStages = Math.abs(p['rotation_deg'] as number) / PER_STAGE.rotation_deg * penalty;
      const torqueStages   = Math.abs(p['torque_deg'] as number) / PER_STAGE.torque_deg * penalty;
      const tipStages      = (Math.abs(p['tip_mesial_deg'] as number) + Math.abs(p['tip_distal_deg'] as number)) / PER_STAGE.tip_deg * penalty;

      const verticalStages = (
        (p['intrusion_mm'] as number) + (p['extrusion_mm'] as number)
      ) / PER_STAGE.vertical_mm * penalty;

      const archStages = (
        (p['mesialization_mm'] as number) + (p['distalization_mm'] as number) +
        (p['expansion_mm'] as number) + (p['constriction_mm'] as number)
      ) / PER_STAGE.arch_mm * penalty;

      result[fdi] = Math.max(1, Math.ceil(
        Math.max(translationStages, rotationStages, torqueStages, tipStages, verticalStages, archStages),
      ));
    }

    return result;
  }

  private buildAllocations(
    prescriptions: Record<string, unknown>[],
    stagesPerTooth: Record<number, number>,
    totalStages: number,
    strategy: StagingStrategy,
  ): Array<{
    stageNum: number; toothNumber: number;
    translationMm: number; rotationDeg: number; torqueDeg: number;
    tipDeg: number; verticalMm: number; archMm: number;
  }> {
    const result: ReturnType<typeof this.buildAllocations> = [];

    for (const p of prescriptions) {
      const fdi = p['tooth_number'] as number;
      const stages = stagesPerTooth[fdi] ?? 1;
      const anterior = isAnterior(fdi);

      // Determine start stage based on strategy
      let startStage = 1;
      if (strategy === 'anterior_first' && !anterior) {
        startStage = Math.min(Math.floor(totalStages * 0.25) + 1, totalStages);
      } else if (strategy === 'posterior_first' && anterior) {
        startStage = Math.min(Math.floor(totalStages * 0.25) + 1, totalStages);
      }

      const totalTranslation = (p['translation_mesial_mm'] as number) + (p['translation_distal_mm'] as number) +
        (p['translation_buccal_mm'] as number) + (p['translation_lingual_mm'] as number);
      const totalRotation = Math.abs(p['rotation_deg'] as number);
      const totalTorque   = Math.abs(p['torque_deg'] as number);
      const totalTip      = Math.abs(p['tip_mesial_deg'] as number) + Math.abs(p['tip_distal_deg'] as number);
      const totalVertical = (p['intrusion_mm'] as number) + (p['extrusion_mm'] as number);
      const totalArch     = (p['mesialization_mm'] as number) + (p['distalization_mm'] as number) +
        (p['expansion_mm'] as number) + (p['constriction_mm'] as number);

      // Distribute linearly across active stages for this tooth
      for (let s = 0; s < stages; s++) {
        const stageNum = startStage + s;
        if (stageNum > totalStages) break;

        result.push({
          stageNum,
          toothNumber: fdi,
          translationMm: parseFloat((totalTranslation / stages).toFixed(4)),
          rotationDeg:   parseFloat((totalRotation / stages).toFixed(4)),
          torqueDeg:     parseFloat((totalTorque / stages).toFixed(4)),
          tipDeg:        parseFloat((totalTip / stages).toFixed(4)),
          verticalMm:    parseFloat((totalVertical / stages).toFixed(4)),
          archMm:        parseFloat((totalArch / stages).toFixed(4)),
        });
      }
    }

    return result;
  }

  private buildIprSchedule(
    prescriptions: Record<string, unknown>[],
    totalStages: number,
  ): IprScheduleEntry[] {
    const schedule: IprScheduleEntry[] = [];

    // IPR adjacent pairs where both teeth have mesiodistal movement
    const byFdi = new Map(prescriptions.map(p => [p['tooth_number'] as number, p]));
    const ADJACENT: [number, number][] = [
      [11,12],[12,13],[13,14],[14,15],
      [21,22],[22,23],[23,24],[24,25],
      [31,32],[32,33],[33,34],[34,35],
      [41,42],[42,43],[43,44],[44,45],
    ];

    for (const [a, b] of ADJACENT) {
      const pA = byFdi.get(a);
      const pB = byFdi.get(b);
      if (!pA || !pB) continue;

      const combinedMesio = ((pA['mesialization_mm'] as number) ?? 0) + ((pB['mesialization_mm'] as number) ?? 0);
      if (combinedMesio > 0.3) {
        // Schedule IPR at 30% through treatment
        const stageNum = Math.max(1, Math.round(totalStages * 0.3));
        schedule.push({
          stageNum,
          fdiA: a,
          fdiB: b,
          amountMm: parseFloat(Math.min(combinedMesio * 0.5, 0.5).toFixed(2)),
        });
      }
    }

    return schedule;
  }

  private buildElasticSchedule(
    prescriptions: Record<string, unknown>[],
    totalStages: number,
  ): ElasticScheduleEntry[] {
    const schedule: ElasticScheduleEntry[] = [];

    // Detect Class II/III need from large distalization (upper) or mesialization (lower)
    const upperPrescriptions = prescriptions.filter(p => {
      const fdi = p['tooth_number'] as number;
      return fdi >= 11 && fdi <= 28;
    });
    const lowerPrescriptions = prescriptions.filter(p => {
      const fdi = p['tooth_number'] as number;
      return fdi >= 31 && fdi <= 48;
    });

    const upperDistalization = upperPrescriptions.reduce((s, p) => s + (p['distalization_mm'] as number ?? 0), 0);
    const lowerMesialization = lowerPrescriptions.reduce((s, p) => s + (p['mesialization_mm'] as number ?? 0), 0);

    if (upperDistalization + lowerMesialization > 2.0) {
      const startStage = Math.max(1, Math.round(totalStages * 0.2));
      const endStage   = Math.round(totalStages * 0.8);
      for (let s = startStage; s <= endStage; s += 4) {
        schedule.push({ stageNum: s, classification: 'class_ii', notes: 'Class II elastic — use 3/16" medium force' });
      }
    }

    const upperMesialization = upperPrescriptions.reduce((s, p) => s + (p['mesialization_mm'] as number ?? 0), 0);
    const lowerDistalization = lowerPrescriptions.reduce((s, p) => s + (p['distalization_mm'] as number ?? 0), 0);

    if (upperMesialization + lowerDistalization > 2.0) {
      const startStage = Math.max(1, Math.round(totalStages * 0.2));
      const endStage   = Math.round(totalStages * 0.8);
      for (let s = startStage; s <= endStage; s += 4) {
        schedule.push({ stageNum: s, classification: 'class_iii', notes: 'Class III elastic — use 3/16" medium force' });
      }
    }

    return schedule;
  }

  private buildStageSummaries(
    allocations: Array<{ stageNum: number; toothNumber: number; translationMm: number; rotationDeg: number; torqueDeg: number; tipDeg: number; verticalMm: number; archMm: number }>,
    attachmentStart: number,
    attachmentEnd: number,
    iprSchedule: IprScheduleEntry[],
    totalActiveStages: number,
    passive: number,
    retention: number,
  ): StageAllocationSummary[] {
    const byStage = new Map<number, typeof allocations>();
    for (const a of allocations) {
      if (!byStage.has(a.stageNum)) byStage.set(a.stageNum, []);
      byStage.get(a.stageNum)!.push(a);
    }

    const summaries: StageAllocationSummary[] = [];
    const totalStages = totalActiveStages + passive + retention;

    for (let s = 1; s <= totalStages; s++) {
      const stageAllocs = byStage.get(s) ?? [];
      const isPassive   = s > totalActiveStages && s <= totalActiveStages + passive;
      const isRetention = s > totalActiveStages + passive;

      summaries.push({
        stageNum:        s,
        teethMoved:      stageAllocs.filter(a => a.translationMm > 0 || a.rotationDeg > 0 || a.archMm > 0).length,
        maxTranslationMm: Math.max(0, ...stageAllocs.map(a => a.translationMm)),
        maxRotationDeg:   Math.max(0, ...stageAllocs.map(a => a.rotationDeg)),
        hasAttachment:    s >= attachmentStart && s <= attachmentEnd && !isPassive && !isRetention,
        hasIpr:           iprSchedule.some(i => i.stageNum === s),
        isPassive,
        isRetention,
      });
    }

    return summaries;
  }

  // ── Guard ──────────────────────────────────────────────────────────────────

  private async verifyPlan(planId: string, caseId: string, orgId: string): Promise<void> {
    const res = await this.db.query(
      `SELECT tp.id FROM treatment_plans tp
       JOIN cases c ON c.id = tp.case_id
       WHERE tp.id=$1 AND tp.case_id=$2 AND c.organization_id=$3`,
      [planId, caseId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Treatment plan not found');
  }
}
