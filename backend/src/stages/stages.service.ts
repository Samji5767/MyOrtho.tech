import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ToothMovement {
  tx?: number; ty?: number; tz?: number;
  rx?: number; ry?: number; rz?: number;
}

export interface AttachmentEvent {
  tooth: string;
  type: 'rectangular' | 'beveled' | 'optimized' | 'power_ridge';
  shape?: string;
}

export interface IprEvent {
  toothA: string;
  toothB: string;
  amountMm: number;
}

export interface AlignerStage {
  id: string;
  treatmentPlanId: string;
  caseId: string;
  stageNumber: number;
  movementData: Record<string, ToothMovement>;
  attachmentData: AttachmentEvent[];
  iprData: IprEvent[];
  maxillaryMeshPath: string | null;
  mandibularMeshPath: string | null;
  velocityMmPerWeek: number | null;
  isApproved: boolean;
  approvedByEmail: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface CreateStageDto {
  stageNumber: number;
  movementData?: Record<string, ToothMovement>;
  attachmentData?: AttachmentEvent[];
  iprData?: IprEvent[];
  maxillaryMeshPath?: string;
  mandibularMeshPath?: string;
  velocityMmPerWeek?: number;
}

export interface GenerateStagesDto {
  count: number;
  baseVelocityMmPerWeek?: number;
  teethToMove?: string[];
}

@Injectable()
export class StagesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async verifyPlan(planId: string, caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT tp.id FROM treatment_plans tp
       JOIN cases c ON c.id = tp.case_id
       WHERE tp.id = $1 AND tp.case_id = $2 AND c.organization_id = $3`,
      [planId, caseId, orgId],
    );
    if (!rows.length) throw new ForbiddenException('Treatment plan not found or access denied');
  }

  async list(planId: string, caseId: string, orgId: string): Promise<AlignerStage[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT s.*, u.email AS approved_by_email
       FROM aligner_stages s
       LEFT JOIN auth_users u ON u.id = s.approved_by
       WHERE s.treatment_plan_id = $1
       ORDER BY s.stage_number ASC`,
      [planId],
    );
    return rows.map(this.format);
  }

  async create(
    planId: string,
    caseId: string,
    orgId: string,
    dto: CreateStageDto,
  ): Promise<AlignerStage> {
    await this.verifyPlan(planId, caseId, orgId);
    const { rows } = await this.pool.query(
      `INSERT INTO aligner_stages
         (treatment_plan_id, case_id, stage_number, movement_data,
          attachment_data, ipr_data, maxillary_mesh_path, mandibular_mesh_path,
          velocity_mm_per_week)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (treatment_plan_id, stage_number)
       DO UPDATE SET
         movement_data = EXCLUDED.movement_data,
         attachment_data = EXCLUDED.attachment_data,
         ipr_data = EXCLUDED.ipr_data,
         maxillary_mesh_path = COALESCE(EXCLUDED.maxillary_mesh_path, aligner_stages.maxillary_mesh_path),
         mandibular_mesh_path = COALESCE(EXCLUDED.mandibular_mesh_path, aligner_stages.mandibular_mesh_path),
         velocity_mm_per_week = COALESCE(EXCLUDED.velocity_mm_per_week, aligner_stages.velocity_mm_per_week)
       RETURNING *, NULL AS approved_by_email`,
      [
        planId, caseId, dto.stageNumber,
        JSON.stringify(dto.movementData ?? {}),
        JSON.stringify(dto.attachmentData ?? []),
        JSON.stringify(dto.iprData ?? []),
        dto.maxillaryMeshPath ?? null,
        dto.mandibularMeshPath ?? null,
        dto.velocityMmPerWeek ?? null,
      ],
    );
    return this.format(rows[0]);
  }

  async generate(
    planId: string,
    caseId: string,
    orgId: string,
    dto: GenerateStagesDto,
  ): Promise<AlignerStage[]> {
    await this.verifyPlan(planId, caseId, orgId);
    if (dto.count < 1 || dto.count > 60) {
      throw new BadRequestException('Stage count must be between 1 and 60');
    }

    const velocity = dto.baseVelocityMmPerWeek ?? 0.25;

    // Load movement prescriptions for this plan (6-DOF per tooth)
    const { rows: prescriptions } = await this.pool.query(
      `SELECT tooth_number,
              translation_mesial_mm, translation_distal_mm,
              translation_buccal_mm, translation_lingual_mm,
              intrusion_mm, extrusion_mm,
              rotation_deg, torque_deg,
              tip_mesial_deg, tip_distal_deg,
              mesialization_mm, distalization_mm,
              expansion_mm, constriction_mm
       FROM movement_prescriptions WHERE plan_id = $1`,
      [planId],
    );

    // Map FDI → net total movement (tx/ty/tz/rx/ry/rz)
    // Opposing axes are resolved to a single signed net value so that linear
    // interpolation across stages yields the correct cumulative position.
    const prescriptionMap: Record<string, ToothMovement> = {};
    for (const p of prescriptions) {
      const key = String(p.tooth_number as number);
      prescriptionMap[key] = {
        tx: (p.translation_mesial_mm ?? 0) - (p.translation_distal_mm ?? 0)
          + (p.mesialization_mm ?? 0) - (p.distalization_mm ?? 0),
        ty: (p.extrusion_mm ?? 0) - (p.intrusion_mm ?? 0),
        tz: (p.translation_buccal_mm ?? 0) - (p.translation_lingual_mm ?? 0)
          + (p.expansion_mm ?? 0) - (p.constriction_mm ?? 0),
        rx: p.torque_deg ?? 0,
        ry: p.rotation_deg ?? 0,
        rz: (p.tip_mesial_deg ?? 0) - (p.tip_distal_deg ?? 0),
      };
    }

    // Determine which teeth to move: explicit list > prescribed teeth > default anteriors
    const teeth: string[] = dto.teethToMove?.length
      ? dto.teethToMove
      : Object.keys(prescriptionMap).length
      ? Object.keys(prescriptionMap)
      : ['11','12','13','21','22','23','31','32','33','41','42','43'];

    // Load attachment placements from treatment_attachments (placed at stage 1)
    const { rows: attachmentRows } = await this.pool.query(
      `SELECT fdi_number, attachment_type
       FROM treatment_attachments WHERE treatment_plan_id = $1`,
      [planId],
    );

    // Map treatment_attachments types to the AttachmentEvent union
    const typeMap: Record<string, AttachmentEvent['type']> = {
      vertical_rectangular: 'rectangular',
      horizontal_rectangular: 'rectangular',
      optimized: 'optimized',
      rotation: 'rectangular',
      extrusion: 'rectangular',
      root_control: 'optimized',
      retention: 'beveled',
      beveled: 'beveled',
    };
    const stageOneAttachments: AttachmentEvent[] = attachmentRows.map(r => ({
      tooth: String(r.fdi_number as number),
      type: typeMap[r.attachment_type as string] ?? 'optimized',
    }));

    const stages: AlignerStage[] = [];
    for (let n = 1; n <= dto.count; n++) {
      const fraction = n / dto.count;
      const movementData: Record<string, ToothMovement> = {};

      for (const tooth of teeth) {
        const total = prescriptionMap[tooth];
        if (total) {
          // Linear interpolation: cumulative position at stage n
          movementData[tooth] = {
            tx: parseFloat(((total.tx ?? 0) * fraction).toFixed(3)),
            ty: parseFloat(((total.ty ?? 0) * fraction).toFixed(3)),
            tz: parseFloat(((total.tz ?? 0) * fraction).toFixed(3)),
            rx: parseFloat(((total.rx ?? 0) * fraction).toFixed(3)),
            ry: parseFloat(((total.ry ?? 0) * fraction).toFixed(3)),
            rz: parseFloat(((total.rz ?? 0) * fraction).toFixed(3)),
          };
        } else {
          // Passive tooth — no prescribed movement
          movementData[tooth] = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 };
        }
      }

      const stage = await this.create(planId, caseId, orgId, {
        stageNumber: n,
        movementData,
        attachmentData: n === 1 ? stageOneAttachments : [],
        iprData: [],
        velocityMmPerWeek: velocity,
      });
      stages.push(stage);
    }
    return stages;
  }

  async approve(
    planId: string,
    caseId: string,
    orgId: string,
    stageId: string,
    userId: string,
  ): Promise<AlignerStage> {
    await this.verifyPlan(planId, caseId, orgId);
    const { rows } = await this.pool.query(
      `UPDATE aligner_stages
       SET is_approved = true, approved_by = $1, approved_at = now()
       WHERE id = $2 AND treatment_plan_id = $3
       RETURNING *, (SELECT email FROM auth_users WHERE id = approved_by) AS approved_by_email`,
      [userId, stageId, planId],
    );
    if (!rows.length) throw new NotFoundException('Stage not found');
    return this.format(rows[0]);
  }

  async delete(planId: string, caseId: string, orgId: string, stageId: string): Promise<void> {
    await this.verifyPlan(planId, caseId, orgId);
    const { rowCount } = await this.pool.query(
      `DELETE FROM aligner_stages WHERE id = $1 AND treatment_plan_id = $2`,
      [stageId, planId],
    );
    if (!rowCount) throw new NotFoundException('Stage not found');
  }

  private format(row: any): AlignerStage {
    return {
      id: row.id,
      treatmentPlanId: row.treatment_plan_id,
      caseId: row.case_id,
      stageNumber: row.stage_number,
      movementData: row.movement_data ?? {},
      attachmentData: row.attachment_data ?? [],
      iprData: row.ipr_data ?? [],
      maxillaryMeshPath: row.maxillary_mesh_path ?? null,
      mandibularMeshPath: row.mandibular_mesh_path ?? null,
      velocityMmPerWeek: row.velocity_mm_per_week ?? null,
      isApproved: row.is_approved ?? false,
      approvedByEmail: row.approved_by_email ?? null,
      approvedAt: row.approved_at ?? null,
      createdAt: row.created_at,
    };
  }
}
