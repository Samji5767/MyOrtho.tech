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
    const teeth = dto.teethToMove ?? ['11','12','13','21','22','23','31','32','33','41','42','43'];

    const stages: AlignerStage[] = [];
    for (let n = 1; n <= dto.count; n++) {
      const progress = n / dto.count;
      const movementData: Record<string, ToothMovement> = {};
      for (const tooth of teeth) {
        movementData[tooth] = {
          tx: parseFloat((progress * 0.5 * Math.sin(parseInt(tooth) * 0.3)).toFixed(3)),
          ty: parseFloat((progress * 0.2).toFixed(3)),
          tz: 0,
          rx: 0, ry: 0, rz: 0,
        };
      }
      const iprData: IprEvent[] = n === Math.floor(dto.count / 3) ? [
        { toothA: '12', toothB: '11', amountMm: 0.2 },
        { toothA: '21', toothB: '22', amountMm: 0.2 },
      ] : [];
      const attachmentData: AttachmentEvent[] = n === 1 ? teeth.slice(0, 4).map(t => ({
        tooth: t,
        type: 'optimized' as const,
      })) : [];

      const stage = await this.create(planId, caseId, orgId, {
        stageNumber: n,
        movementData,
        attachmentData,
        iprData,
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
