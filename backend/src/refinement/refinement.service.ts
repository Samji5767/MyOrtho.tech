import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface CreateRefinementDto {
  restartFromStage: number;
  newScanId?: string | null;
  notes?: string | null;
}

@Injectable()
export class RefinementService {
  private readonly logger = new Logger(RefinementService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listCycles(planId: string, caseId: string, orgId: string) {
    await this.verifyOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT * FROM refinement_cycles
       WHERE treatment_plan_id = $1 ORDER BY cycle_number DESC`,
      [planId],
    );
    return rows.map(this.format);
  }

  async createCycle(planId: string, caseId: string, orgId: string, dto: CreateRefinementDto, userId: string) {
    await this.verifyOwnership(caseId, orgId);

    // Get current max cycle_number for this plan
    const { rows: maxRows } = await this.pool.query(
      `SELECT COALESCE(MAX(cycle_number), 0) AS max_cycle
       FROM refinement_cycles WHERE treatment_plan_id = $1`,
      [planId],
    );
    const nextCycle = (Number(maxRows[0]?.['max_cycle'] ?? 0)) + 1;

    const { rows } = await this.pool.query(
      `INSERT INTO refinement_cycles
         (case_id, treatment_plan_id, cycle_number, restart_from_stage,
          new_scan_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        caseId, planId, nextCycle,
        dto.restartFromStage,
        dto.newScanId ?? null,
        dto.notes ?? null,
        userId,
      ],
    );
    this.logger.log(`Refinement cycle ${nextCycle} created for plan ${planId}`);
    return this.format(rows[0]);
  }

  async updateCycleStatus(
    cycleId: string,
    planId: string,
    caseId: string,
    orgId: string,
    status: 'pending' | 'planning' | 'stages_generated' | 'approved',
    newStagesGenerated?: number,
  ) {
    await this.verifyOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `UPDATE refinement_cycles
       SET status = $2,
           new_stages_generated = COALESCE($3, new_stages_generated),
           updated_at = now()
       WHERE id = $1 AND treatment_plan_id = $4
       RETURNING *`,
      [cycleId, status, newStagesGenerated ?? null, planId],
    );
    if (!rows[0]) throw new NotFoundException('Refinement cycle not found');
    return this.format(rows[0]);
  }

  async deleteCycle(cycleId: string, planId: string, caseId: string, orgId: string) {
    await this.verifyOwnership(caseId, orgId);
    const { rowCount } = await this.pool.query(
      `DELETE FROM refinement_cycles WHERE id = $1 AND treatment_plan_id = $2`,
      [cycleId, planId],
    );
    if (!rowCount) throw new NotFoundException('Refinement cycle not found');
    return { deleted: true };
  }

  private async verifyOwnership(caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT c.id FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private format(r: Record<string, unknown>) {
    return {
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      planId: r['treatment_plan_id'] as string,
      cycleNumber: r['cycle_number'] as number,
      restartFromStage: r['restart_from_stage'] as number,
      newScanId: r['new_scan_id'] as string | null,
      status: r['status'] as string,
      newStagesGenerated: r['new_stages_generated'] as number,
      notes: r['notes'] as string | null,
      createdAt: r['created_at'] as Date,
      updatedAt: r['updated_at'] as Date,
    };
  }
}
