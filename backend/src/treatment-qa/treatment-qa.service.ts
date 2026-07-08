import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TreatmentQAReport {
  id: string;
  organizationId: string;
  digitalSetupId: string;
  treatmentQualityScore: number;
  clinicalSafetyScore: number;
  manufacturingScore: number;
  overallScore: number;
  excessiveMovements: unknown[];
  collisionIssues: unknown[];
  pdlWarnings: unknown[];
  attachmentWarnings: unknown[];
  iprWarnings: unknown[];
  stagingIssues: unknown[];
  exportReady: boolean;
  issues: unknown[];
  warnings: unknown[];
  createdAt: Date;
}

// ─── Helper: clamp to [0, 100] ────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): TreatmentQAReport {
  return {
    id: r['id'] as string,
    organizationId: r['organization_id'] as string,
    digitalSetupId: r['digital_setup_id'] as string,
    treatmentQualityScore: r['treatment_quality_score'] as number,
    clinicalSafetyScore: r['clinical_safety_score'] as number,
    manufacturingScore: r['manufacturing_score'] as number,
    overallScore: r['overall_score'] as number,
    excessiveMovements: (r['excessive_movements'] as unknown[]) ?? [],
    collisionIssues: (r['collision_issues'] as unknown[]) ?? [],
    pdlWarnings: (r['pdl_warnings'] as unknown[]) ?? [],
    attachmentWarnings: (r['attachment_warnings'] as unknown[]) ?? [],
    iprWarnings: (r['ipr_warnings'] as unknown[]) ?? [],
    stagingIssues: (r['staging_issues'] as unknown[]) ?? [],
    exportReady: r['export_ready'] as boolean,
    issues: (r['issues'] as unknown[]) ?? [],
    warnings: (r['warnings'] as unknown[]) ?? [],
    createdAt: r['created_at'] as Date,
  };
}

// ─── Types for analysis ───────────────────────────────────────────────────────

interface StageTooth {
  fdi: number;
  mesialMm?: number;
  distalMm?: number;
  buccalMm?: number;
  lingualMm?: number;
  intrusionMm?: number;
  extrusionMm?: number;
  mesialRotDeg?: number;
  distalRotDeg?: number;
  torqueDeg?: number;
}

interface StageAttachment {
  fdi: number;
  action: string;
  type: string;
}

interface Stage {
  id: string;
  stage_number: number;
  stage_type: string;
  tooth_movements: StageTooth[];
  attachments: StageAttachment[];
}

interface BiomechanicalAnalysis {
  has_collisions: boolean;
  collision_pairs: Array<{ fdiA: number; fdiB: number; overlapMm?: number }>;
  max_pdl_stress_percentage: number | null;
  pdl_overload_teeth: string[];
  excessive_movements: Array<{ fdi: number; field: string; value: number }>;
  root_collision_risk: string[];
  biomechanical_score: number | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TreatmentQAService {
  private readonly logger = new Logger(TreatmentQAService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async runQACheck(orgId: string, setupId: string): Promise<TreatmentQAReport> {
    // Verify digital setup ownership
    const { rows: setupRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT id FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!setupRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    // Load treatment stages
    const { rows: stageRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT id, stage_number, stage_type, tooth_movements, attachments
       FROM treatment_stages
       WHERE digital_setup_id = $1 AND organization_id = $2
       ORDER BY stage_number ASC`,
      [setupId, orgId],
    );
    const stages: Stage[] = stageRows.map((r) => ({
      id: r['id'] as string,
      stage_number: r['stage_number'] as number,
      stage_type: r['stage_type'] as string,
      tooth_movements: (r['tooth_movements'] as StageTooth[]) ?? [],
      attachments: (r['attachments'] as StageAttachment[]) ?? [],
    }));

    // Load latest biomechanical analysis for this setup (if any)
    const { rows: bioRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT has_collisions, collision_pairs, max_pdl_stress_percentage,
              pdl_overload_teeth, excessive_movements, root_collision_risk,
              biomechanical_score
       FROM biomechanical_analyses
       WHERE digital_setup_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [setupId, orgId],
    );
    const bio: BiomechanicalAnalysis | null = bioRows[0]
      ? {
          has_collisions: bioRows[0]['has_collisions'] as boolean,
          collision_pairs: (bioRows[0]['collision_pairs'] as Array<{ fdiA: number; fdiB: number; overlapMm?: number }>) ?? [],
          max_pdl_stress_percentage: bioRows[0]['max_pdl_stress_percentage'] !== null
            ? Number(bioRows[0]['max_pdl_stress_percentage'])
            : null,
          pdl_overload_teeth: (bioRows[0]['pdl_overload_teeth'] as string[]) ?? [],
          excessive_movements: (bioRows[0]['excessive_movements'] as Array<{ fdi: number; field: string; value: number }>) ?? [],
          root_collision_risk: (bioRows[0]['root_collision_risk'] as string[]) ?? [],
          biomechanical_score: bioRows[0]['biomechanical_score'] !== null
            ? Number(bioRows[0]['biomechanical_score'])
            : null,
        }
      : null;

    // ─── Treatment Quality Score ──────────────────────────────────────────────
    // Start at 100
    // -5 per excessive movement (>5mm translation, >45° rotation)
    // -10 per PDL overload tooth
    // -3 per collision pair
    let treatmentQuality = 100;
    const excessiveMovements: unknown[] = [];

    const excessiveMoves = bio?.excessive_movements ?? [];
    for (const em of excessiveMoves) {
      const isTrans = ['mesialMm','distalMm','buccalMm','lingualMm','intrusionMm','extrusionMm'].includes(em.field);
      const isRot   = ['mesialRotDeg','distalRotDeg','torqueDeg'].includes(em.field);
      if ((isTrans && Math.abs(em.value) > 5) || (isRot && Math.abs(em.value) > 45)) {
        treatmentQuality -= 5;
        excessiveMovements.push({
          fdi: em.fdi,
          field: em.field,
          value: em.value,
          reason: isTrans ? '>5mm translation' : '>45° rotation',
        });
      }
    }

    // Also scan stages directly for very large cumulative movements
    for (const stage of stages) {
      for (const mv of stage.tooth_movements) {
        const mesial = Math.abs(mv.mesialMm ?? 0);
        const distal = Math.abs(mv.distalMm ?? 0);
        const rotation = Math.abs((mv.mesialRotDeg ?? 0) + (mv.distalRotDeg ?? 0));
        if (mesial > 5 || distal > 5) {
          treatmentQuality -= 5;
          excessiveMovements.push({ stage: stage.stage_number, fdi: mv.fdi, reason: '>5mm translation in stage' });
        }
        if (rotation > 45) {
          treatmentQuality -= 5;
          excessiveMovements.push({ stage: stage.stage_number, fdi: mv.fdi, reason: '>45° rotation in stage' });
        }
      }
    }

    const pdlOverloadTeeth = bio?.pdl_overload_teeth ?? [];
    treatmentQuality -= pdlOverloadTeeth.length * 10;

    const collisionPairs = bio?.collision_pairs ?? [];
    treatmentQuality -= collisionPairs.length * 3;

    treatmentQuality = clamp(treatmentQuality);

    // ─── Clinical Safety Score ────────────────────────────────────────────────
    // Start at 100
    // -15 if any root collision risk
    // -10 if PDL stress > 150% on any tooth
    // -5 per insufficient attachment (rotation > 15° but no attachment planned)
    let clinicalSafety = 100;
    const pdlWarnings: unknown[] = [];
    const attachmentWarnings: unknown[] = [];

    if ((bio?.root_collision_risk ?? []).length > 0) {
      clinicalSafety -= 15;
    }

    const maxPdl = bio?.max_pdl_stress_percentage ?? 0;
    if (maxPdl > 150) {
      clinicalSafety -= 10;
      pdlWarnings.push({
        tooth: 'multiple',
        pdlStressPercent: maxPdl,
        warning: 'PDL stress exceeds 150% — risk of root resorption',
      });
    }

    for (const tooth of pdlOverloadTeeth) {
      pdlWarnings.push({
        tooth,
        warning: 'PDL overload detected — consider staging refinement',
      });
    }

    // Check for teeth with large rotation but no attachment stage 1
    const toothRotationMap = new Map<number, number>();
    for (const stage of stages) {
      for (const mv of stage.tooth_movements) {
        const rot = Math.abs((mv.mesialRotDeg ?? 0) + (mv.distalRotDeg ?? 0));
        const cur = toothRotationMap.get(mv.fdi) ?? 0;
        toothRotationMap.set(mv.fdi, cur + rot);
      }
    }

    const teethWithAttachments = new Set<number>();
    for (const stage of stages) {
      for (const att of stage.attachments) {
        if (att.action === 'place') {
          teethWithAttachments.add(att.fdi);
        }
      }
    }

    for (const [fdi, totalRot] of toothRotationMap) {
      if (totalRot > 15 && !teethWithAttachments.has(fdi)) {
        clinicalSafety -= 5;
        attachmentWarnings.push({
          fdi,
          totalRotationDeg: parseFloat(totalRot.toFixed(2)),
          warning: `Tooth ${fdi} has ${totalRot.toFixed(1)}° rotation but no attachment planned`,
        });
      }
    }

    clinicalSafety = clamp(clinicalSafety);

    // ─── Manufacturing Score ──────────────────────────────────────────────────
    // Start at 100
    // -10 if no stages generated
    // -5 if any stage has >8 active tooth movements
    // -3 per stage with missing attachment windows
    let manufacturingScore = 100;
    const stagingIssues: unknown[] = [];

    if (stages.length === 0) {
      manufacturingScore -= 10;
      stagingIssues.push({ issue: 'No stages generated for this setup' });
    } else {
      for (const stage of stages) {
        if (stage.stage_type === 'active' && stage.tooth_movements.length > 8) {
          manufacturingScore -= 5;
          stagingIssues.push({
            stage: stage.stage_number,
            activeMoves: stage.tooth_movements.length,
            issue: `Stage ${stage.stage_number} has ${stage.tooth_movements.length} active movements (>8) — may exceed aligner force capacity`,
          });
        }

        // Check if stage has teeth needing attachment windows in aligner_designs
        // (penalize only if biomechanical analysis flagged attachment requirements)
        if (stage.stage_type === 'active' && stage.attachments.length > 0) {
          const missingWindows = stage.attachments.filter((a) => a.action === 'place').length;
          if (missingWindows > 0) {
            const { rows: designRows } = await this.pool.query<{ count: string }>(
              `SELECT COUNT(*) as count FROM aligner_designs
               WHERE stage_id = $1 AND organization_id = $2
               AND attachment_windows @> '[]'::jsonb`,
              [stage.id, orgId],
            );
            const designsWithEmptyWindows = parseInt(designRows[0]?.count ?? '0', 10);
            if (designsWithEmptyWindows > 0) {
              manufacturingScore -= 3;
              stagingIssues.push({
                stage: stage.stage_number,
                issue: `Stage ${stage.stage_number} aligner designs have empty attachment windows`,
              });
            }
          }
        }
      }
    }

    manufacturingScore = clamp(manufacturingScore);

    // issues / warnings are populated after IPR scoring below
    const issues: unknown[] = [];
    const warnings: unknown[] = [];

    const collisionIssues: unknown[] = collisionPairs.map((cp) => ({
      fdiA: cp.fdiA,
      fdiB: cp.fdiB,
      overlapMm: cp.overlapMm ?? null,
    }));

    // ─── IPR Warnings ─────────────────────────────────────────────────────────
    // Query ipr_plan_items via digital_setups → treatment_plans linkage.
    const { rows: iprItemRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT i.tooth_a_fdi, i.tooth_b_fdi, i.amount_mm,
              i.remaining_enamel_a, i.remaining_enamel_b,
              i.safety_status, i.before_stage
       FROM ipr_plan_items i
       JOIN treatment_plans tp ON tp.id = i.treatment_plan_id
       JOIN digital_setups ds ON ds.case_id = tp.case_id
       WHERE ds.id = $1 AND ds.organization_id = $2
         AND i.safety_status IN ('warning', 'unsafe')
       ORDER BY i.safety_status DESC, i.tooth_a_fdi`,
      [setupId, orgId],
    );
    const iprWarnings: unknown[] = iprItemRows.map((r) => ({
      toothAFdi: r['tooth_a_fdi'] as number,
      toothBFdi: r['tooth_b_fdi'] as number,
      amountMm: Number(r['amount_mm']),
      remainingEnamelA: r['remaining_enamel_a'] !== null ? Number(r['remaining_enamel_a']) : null,
      remainingEnamelB: r['remaining_enamel_b'] !== null ? Number(r['remaining_enamel_b']) : null,
      safetyStatus: r['safety_status'] as string,
      beforeStage: r['before_stage'] as number,
    }));

    const unsafeIpr = iprItemRows.filter((r) => r['safety_status'] === 'unsafe').length;
    const warningIpr = iprItemRows.filter((r) => r['safety_status'] === 'warning').length;
    clinicalSafety -= unsafeIpr * 8 + warningIpr * 3;
    clinicalSafety = clamp(clinicalSafety);

    // ─── Overall Score & Export Readiness ────────────────────────────────────
    const overallScore = clamp(
      Math.round((treatmentQuality + clinicalSafety + manufacturingScore) / 3),
    );
    const exportReady =
      treatmentQuality >= 70 && clinicalSafety >= 70 && manufacturingScore >= 70;

    // ─── Build issues / warnings lists ────────────────────────────────────────
    if (!exportReady) {
      if (treatmentQuality < 70)
        issues.push({ category: 'treatment_quality', score: treatmentQuality, message: 'Treatment quality score below 70 — review excessive movements and PDL overload' });
      if (clinicalSafety < 70)
        issues.push({ category: 'clinical_safety', score: clinicalSafety, message: 'Clinical safety score below 70 — address root collisions, PDL stress, missing attachments, and unsafe IPR' });
      if (manufacturingScore < 70)
        issues.push({ category: 'manufacturing', score: manufacturingScore, message: 'Manufacturing score below 70 — simplify staging or add attachment window data' });
    }

    if (attachmentWarnings.length > 0) {
      warnings.push({ category: 'attachment', count: attachmentWarnings.length, message: `${attachmentWarnings.length} teeth with rotation >15° lack attachments` });
    }
    if (pdlWarnings.length > 0) {
      warnings.push({ category: 'pdl', count: pdlWarnings.length, message: 'PDL overload or stress warnings present' });
    }
    if (collisionPairs.length > 0) {
      warnings.push({ category: 'collision', count: collisionPairs.length, message: `${collisionPairs.length} tooth collision pair(s) detected` });
    }
    if (unsafeIpr > 0) {
      warnings.push({ category: 'ipr', count: unsafeIpr, message: `${unsafeIpr} IPR contact(s) violate minimum enamel safety (0.5 mm remaining)` });
    } else if (warningIpr > 0) {
      warnings.push({ category: 'ipr', count: warningIpr, message: `${warningIpr} IPR contact(s) leave <0.5 mm enamel — review before export` });
    }

    // ─── Persist the QA report ────────────────────────────────────────────────
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO treatment_qa_reports
         (organization_id, digital_setup_id,
          treatment_quality_score, clinical_safety_score, manufacturing_score, overall_score,
          excessive_movements, collision_issues, pdl_warnings, attachment_warnings,
          ipr_warnings, staging_issues, export_ready, issues, warnings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        orgId,
        setupId,
        treatmentQuality,
        clinicalSafety,
        manufacturingScore,
        overallScore,
        JSON.stringify(excessiveMovements),
        JSON.stringify(collisionIssues),
        JSON.stringify(pdlWarnings),
        JSON.stringify(attachmentWarnings),
        JSON.stringify(iprWarnings),
        JSON.stringify(stagingIssues),
        exportReady,
        JSON.stringify(issues),
        JSON.stringify(warnings),
      ],
    );

    this.logger.log(
      `QA check for setup ${setupId}: overall=${overallScore} ` +
      `(tq=${treatmentQuality}, cs=${clinicalSafety}, mfg=${manufacturingScore}) ` +
      `exportReady=${exportReady}`,
    );

    return mapRow(rows[0]!);
  }

  async getLatestQA(
    orgId: string,
    setupId: string,
  ): Promise<TreatmentQAReport | null> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT r.* FROM treatment_qa_reports r
       JOIN digital_setups ds ON ds.id = r.digital_setup_id
       WHERE r.digital_setup_id = $1
         AND ds.organization_id = $2
       ORDER BY r.created_at DESC
       LIMIT 1`,
      [setupId, orgId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
}
