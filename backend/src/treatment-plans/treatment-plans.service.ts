import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

const AI_DISCLAIMER =
  'AI treatment planning recommendations are research-stage only. ' +
  'Not clinically validated. All plans require clinical review and doctor approval.';

export interface CreatePlanDto {
  estimatedStages?: number;
  aiRecommendationNotes?: string;
  iprDetails?: Record<string, unknown>;
}

export interface CreateStageDto {
  stageNumber: number;
  maxillaryMeshPath?: string;
  mandibularMeshPath?: string;
  movements?: Record<string, unknown>;
}

@Injectable()
export class TreatmentPlansService {
  private readonly logger = new Logger(TreatmentPlansService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listPlans(caseId: string, orgId: string) {
    await this.verifyCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT id, case_id, doctor_approval, approved_at, estimated_stages,
              ai_recommendation_notes, ipr_details, created_at, updated_at
       FROM treatment_plans WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId],
    );
    return rows.map((r) => ({ ...this.formatPlan(r), disclaimer: AI_DISCLAIMER }));
  }

  async createPlan(caseId: string, orgId: string, createdBy: string, dto: CreatePlanDto) {
    await this.verifyCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `INSERT INTO treatment_plans
         (case_id, created_by, estimated_stages, ai_recommendation_notes, ipr_details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        caseId,
        createdBy,
        dto.estimatedStages ?? 0,
        dto.aiRecommendationNotes ?? null,
        JSON.stringify(dto.iprDetails ?? {}),
      ],
    );
    this.logger.log(`Treatment plan ${rows[0].id as string} created for case ${caseId}`);
    return { id: rows[0].id as string, caseId, createdAt: rows[0].created_at as Date, disclaimer: AI_DISCLAIMER };
  }

  async getPlan(planId: string, caseId: string, orgId: string) {
    await this.verifyCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT id, case_id, doctor_approval, doctor_signature, approved_at,
              estimated_stages, ai_recommendation_notes, ipr_details, created_at, updated_at
       FROM treatment_plans WHERE id = $1 AND case_id = $2`,
      [planId, caseId],
    );
    if (!rows[0]) throw new NotFoundException('Treatment plan not found');
    return { ...this.formatPlan(rows[0]), disclaimer: AI_DISCLAIMER };
  }

  async approvePlan(planId: string, caseId: string, orgId: string, doctorId: string, signature: string) {
    await this.verifyCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `UPDATE treatment_plans
       SET doctor_approval = true, doctor_signature = $1, approved_at = now(), updated_at = now()
       WHERE id = $2 AND case_id = $3
       RETURNING id, doctor_approval, approved_at`,
      [signature, planId, caseId],
    );
    if (!rows[0]) throw new NotFoundException('Treatment plan not found');
    await this.pool.query(
      `UPDATE cases SET status = 'pending_approval', updated_at = now()
       WHERE id = $1 AND status = 'planning'`,
      [caseId],
    );
    this.logger.log(`Plan ${planId} approved by ${doctorId} for case ${caseId}`);
    return {
      id: rows[0].id as string,
      doctorApproval: rows[0].doctor_approval as boolean,
      approvedAt: rows[0].approved_at as Date,
    };
  }

  // ── Aligner Stages ───────────────────────────────────────────────────────────

  async listStages(planId: string, caseId: string, orgId: string) {
    await this.verifyCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT id, plan_id, stage_number, maxillary_mesh_path, mandibular_mesh_path, movements, created_at
       FROM aligner_stages WHERE plan_id = $1 ORDER BY stage_number`,
      [planId],
    );
    return rows.map((r) => ({
      id: r['id'] as string,
      planId: r['plan_id'] as string,
      stageNumber: r['stage_number'] as number,
      maxillaryMeshPath: r['maxillary_mesh_path'] as string | null,
      mandibularMeshPath: r['mandibular_mesh_path'] as string | null,
      movements: r['movements'] as Record<string, unknown>,
      createdAt: r['created_at'] as Date,
    }));
  }

  async createStage(planId: string, caseId: string, orgId: string, dto: CreateStageDto) {
    await this.verifyCaseOwnership(caseId, orgId);
    // verify plan belongs to case
    const { rows: planRows } = await this.pool.query(
      `SELECT id FROM treatment_plans WHERE id = $1 AND case_id = $2`,
      [planId, caseId],
    );
    if (!planRows[0]) throw new ForbiddenException('Plan not found in this case');

    const { rows } = await this.pool.query(
      `INSERT INTO aligner_stages
         (plan_id, stage_number, maxillary_mesh_path, mandibular_mesh_path, movements)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (plan_id, stage_number) DO UPDATE
         SET maxillary_mesh_path = EXCLUDED.maxillary_mesh_path,
             mandibular_mesh_path = EXCLUDED.mandibular_mesh_path,
             movements = EXCLUDED.movements
       RETURNING id, stage_number, created_at`,
      [
        planId,
        dto.stageNumber,
        dto.maxillaryMeshPath ?? null,
        dto.mandibularMeshPath ?? null,
        JSON.stringify(dto.movements ?? {}),
      ],
    );
    return {
      id: rows[0].id as string,
      planId,
      stageNumber: rows[0].stage_number as number,
      createdAt: rows[0].created_at as Date,
    };
  }

  private async verifyCaseOwnership(caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT c.id FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private formatPlan(r: Record<string, unknown>) {
    return {
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      doctorApproval: r['doctor_approval'] as boolean,
      approvedAt: r['approved_at'] as Date | null,
      estimatedStages: r['estimated_stages'] as number,
      aiRecommendationNotes: r['ai_recommendation_notes'] as string | null,
      iprDetails: r['ipr_details'] as Record<string, unknown>,
      createdAt: r['created_at'] as Date,
      updatedAt: r['updated_at'] as Date,
    };
  }
}
