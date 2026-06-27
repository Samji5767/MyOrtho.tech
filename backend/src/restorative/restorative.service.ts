import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Injectable()
export class RestorativeService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT c.id FROM cases c JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows[0]) throw new ForbiddenException('Case not found or access denied');
  }

  async createDesign(orgId: string, dto: { caseId: string; toothNumber: string; restorationType: string; minimumThickness?: number }) {
    await this.verifyCase(dto.caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT id, case_id, tooth_number, restoration_type, minimum_thickness_mm, created_at
       FROM treatment_plans WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [dto.caseId],
    );
    return {
      id: `design-${dto.caseId}-${dto.toothNumber}`,
      caseId: dto.caseId,
      toothNumber: dto.toothNumber,
      restorationType: dto.restorationType,
      minimumThicknessMm: dto.minimumThickness ?? 0.8,
      status: 'draft',
      linkedPlanId: rows[0]?.id ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  async findOne(id: string, orgId: string) {
    if (!id || !orgId) throw new NotFoundException('Restoration design not found');
    throw new NotFoundException('Restoration design not found');
  }
}
