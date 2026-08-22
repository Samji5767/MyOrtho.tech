import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// FDI notation: quadrant 1-4, position 1-8.
function isValidFdi(fdi: number): boolean {
  if (!Number.isInteger(fdi)) return false;
  const q = Math.floor(fdi / 10);
  const p = fdi % 10;
  return q >= 1 && q <= 4 && p >= 1 && p <= 8;
}

/** Adjacent teeth in the same arch (positions differ by 1, or the two central
 *  incisors across the midline, e.g. 11-21 / 31-41). */
function areAdjacent(a: number, b: number): boolean {
  const qa = Math.floor(a / 10), qb = Math.floor(b / 10);
  const pa = a % 10, pb = b % 10;
  const sameArch =
    (qa <= 2 && qb <= 2) || (qa >= 3 && qb >= 3);
  if (!sameArch) return false;
  if (qa === qb) return Math.abs(pa - pb) === 1;
  return pa === 1 && pb === 1; // across the midline
}

/**
 * Deterministic IPR review status derived from the planned amount.
 * Guidance thresholds (common clinical practice), not clinical validation:
 * ≤0.25 mm per contact safe; ≤0.5 mm needs review; above that unsafe.
 */
function iprSafetyStatus(amountMm: number): 'safe' | 'warning' | 'unsafe' {
  if (amountMm <= 0.25) return 'safe';
  if (amountMm <= 0.5) return 'warning';
  return 'unsafe';
}

export interface UpsertIprDto {
  toothAFdi: number;
  toothBFdi: number;
  amountMm: number;
  beforeStage?: number;
  notes?: string;
}

export interface UpsertAttachmentDto {
  fdiNumber: number;
  attachmentType: string;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  surface?: 'buccal' | 'lingual' | 'occlusal';
  activationStage?: number;
  deactivationStage?: number;
  notes?: string;
}

const ATTACHMENT_TYPES = [
  'vertical_rectangular', 'horizontal_rectangular', 'optimized',
  'rotation', 'extrusion', 'root_control', 'retention', 'beveled',
] as const;

@Injectable()
export class PlanFeaturesService {
  private readonly logger = new Logger(PlanFeaturesService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ── IPR ─────────────────────────────────────────────────────────────────────

  async listIpr(caseId: string, planId: string, orgId: string) {
    await this.verifyPlan(caseId, planId, orgId);
    const { rows } = await this.pool.query(
      `SELECT id, tooth_a_fdi, tooth_b_fdi, amount_mm, before_stage,
              safety_status, is_auto_recommended, notes, created_at, updated_at
       FROM ipr_plan_items WHERE treatment_plan_id = $1
       ORDER BY tooth_a_fdi`,
      [planId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      toothAFdi: r.tooth_a_fdi as number,
      toothBFdi: r.tooth_b_fdi as number,
      amountMm: Number(r.amount_mm),
      beforeStage: r.before_stage as number,
      safetyStatus: r.safety_status as string,
      isAutoRecommended: r.is_auto_recommended as boolean,
      notes: r.notes as string | null,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
    }));
  }

  async upsertIpr(
    caseId: string, planId: string, orgId: string, userId: string, dto: UpsertIprDto,
  ) {
    const plan = await this.verifyPlan(caseId, planId, orgId);
    this.assertEditable(plan);

    if (!isValidFdi(dto.toothAFdi) || !isValidFdi(dto.toothBFdi)) {
      throw new BadRequestException('IPR teeth must use FDI notation (11-18, 21-28, 31-38, 41-48)');
    }
    if (!areAdjacent(dto.toothAFdi, dto.toothBFdi)) {
      throw new BadRequestException(
        'IPR applies to an interproximal contact — the two teeth must be adjacent in the same arch',
      );
    }
    // Canonical pair order so (a,b) and (b,a) hit the same row
    const [a, b] = [dto.toothAFdi, dto.toothBFdi].sort((x, y) => x - y);
    const safety = iprSafetyStatus(dto.amountMm);

    const { rows } = await this.pool.query(
      `INSERT INTO ipr_plan_items
         (case_id, treatment_plan_id, tooth_a_fdi, tooth_b_fdi, amount_mm,
          before_stage, safety_status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (treatment_plan_id, tooth_a_fdi, tooth_b_fdi) DO UPDATE
         SET amount_mm = EXCLUDED.amount_mm,
             before_stage = EXCLUDED.before_stage,
             safety_status = EXCLUDED.safety_status,
             notes = EXCLUDED.notes,
             updated_at = now()
       RETURNING id, safety_status`,
      [caseId, planId, a, b, dto.amountMm, dto.beforeStage ?? 1, safety, dto.notes ?? null, userId],
    );
    this.logger.log(`IPR ${a}-${b} ${dto.amountMm}mm upserted on plan ${planId}`);
    return {
      id: rows[0].id as string,
      toothAFdi: a,
      toothBFdi: b,
      amountMm: dto.amountMm,
      beforeStage: dto.beforeStage ?? 1,
      safetyStatus: rows[0].safety_status as string,
    };
  }

  async deleteIpr(caseId: string, planId: string, orgId: string, a: number, b: number) {
    const plan = await this.verifyPlan(caseId, planId, orgId);
    this.assertEditable(plan);
    const [lo, hi] = [a, b].sort((x, y) => x - y);
    const { rowCount } = await this.pool.query(
      `DELETE FROM ipr_plan_items
       WHERE treatment_plan_id = $1 AND tooth_a_fdi = $2 AND tooth_b_fdi = $3`,
      [planId, lo, hi],
    );
    if (!rowCount) throw new NotFoundException(`No IPR planned for contact ${lo}-${hi}`);
    return { deleted: true, toothAFdi: lo, toothBFdi: hi };
  }

  // ── Attachments ─────────────────────────────────────────────────────────────

  async listAttachments(caseId: string, planId: string, orgId: string) {
    await this.verifyPlan(caseId, planId, orgId);
    const { rows } = await this.pool.query(
      `SELECT id, fdi_number, attachment_type, width_mm, height_mm, depth_mm,
              surface, activation_stage, deactivation_stage, is_auto_recommended,
              notes, created_at, updated_at
       FROM treatment_attachments WHERE treatment_plan_id = $1
       ORDER BY fdi_number`,
      [planId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      fdiNumber: r.fdi_number as number,
      attachmentType: r.attachment_type as string,
      widthMm: Number(r.width_mm),
      heightMm: Number(r.height_mm),
      depthMm: Number(r.depth_mm),
      surface: r.surface as string,
      activationStage: r.activation_stage as number,
      deactivationStage: r.deactivation_stage as number | null,
      isAutoRecommended: r.is_auto_recommended as boolean,
      notes: r.notes as string | null,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
    }));
  }

  async upsertAttachment(
    caseId: string, planId: string, orgId: string, userId: string, dto: UpsertAttachmentDto,
  ) {
    const plan = await this.verifyPlan(caseId, planId, orgId);
    this.assertEditable(plan);

    if (!isValidFdi(dto.fdiNumber)) {
      throw new BadRequestException('fdiNumber must use FDI notation (11-18, 21-28, 31-38, 41-48)');
    }
    if (!ATTACHMENT_TYPES.includes(dto.attachmentType as (typeof ATTACHMENT_TYPES)[number])) {
      throw new BadRequestException(`attachmentType must be one of: ${ATTACHMENT_TYPES.join(', ')}`);
    }
    if (
      dto.deactivationStage !== undefined &&
      dto.activationStage !== undefined &&
      dto.deactivationStage < dto.activationStage
    ) {
      throw new BadRequestException('deactivationStage cannot precede activationStage');
    }

    const { rows } = await this.pool.query(
      `INSERT INTO treatment_attachments
         (case_id, treatment_plan_id, fdi_number, attachment_type,
          width_mm, height_mm, depth_mm, surface,
          activation_stage, deactivation_stage, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (treatment_plan_id, fdi_number, attachment_type) DO UPDATE
         SET width_mm = EXCLUDED.width_mm,
             height_mm = EXCLUDED.height_mm,
             depth_mm = EXCLUDED.depth_mm,
             surface = EXCLUDED.surface,
             activation_stage = EXCLUDED.activation_stage,
             deactivation_stage = EXCLUDED.deactivation_stage,
             notes = EXCLUDED.notes,
             updated_at = now()
       RETURNING id`,
      [
        caseId, planId, dto.fdiNumber, dto.attachmentType,
        dto.widthMm ?? 3.0, dto.heightMm ?? 2.0, dto.depthMm ?? 0.5,
        dto.surface ?? 'buccal',
        dto.activationStage ?? 1, dto.deactivationStage ?? null,
        dto.notes ?? null, userId,
      ],
    );
    this.logger.log(
      `Attachment ${dto.attachmentType} on FDI ${dto.fdiNumber} upserted (plan ${planId})`,
    );
    return { id: rows[0].id as string, fdiNumber: dto.fdiNumber, attachmentType: dto.attachmentType };
  }

  async deleteAttachment(
    caseId: string, planId: string, orgId: string, fdiNumber: number, attachmentType: string,
  ) {
    const plan = await this.verifyPlan(caseId, planId, orgId);
    this.assertEditable(plan);
    const { rowCount } = await this.pool.query(
      `DELETE FROM treatment_attachments
       WHERE treatment_plan_id = $1 AND fdi_number = $2 AND attachment_type = $3`,
      [planId, fdiNumber, attachmentType],
    );
    if (!rowCount) {
      throw new NotFoundException(`No ${attachmentType} attachment on FDI ${fdiNumber}`);
    }
    return { deleted: true, fdiNumber, attachmentType };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private assertEditable(plan: { doctorApproval: boolean }) {
    if (plan.doctorApproval) {
      throw new BadRequestException(
        'Treatment plan is approved; IPR and attachments are locked. Create a new plan to make changes.',
      );
    }
  }

  private async verifyPlan(
    caseId: string, planId: string, orgId: string,
  ): Promise<{ id: string; doctorApproval: boolean }> {
    const { rows } = await this.pool.query(
      `SELECT tp.id, tp.doctor_approval
       FROM treatment_plans tp
       JOIN cases c ON c.id = tp.case_id
       JOIN patients p ON p.id = c.patient_id
       WHERE tp.id = $1 AND tp.case_id = $2 AND p.organization_id = $3`,
      [planId, caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Treatment plan not found');
    return { id: rows[0].id as string, doctorApproval: rows[0].doctor_approval as boolean };
  }
}
