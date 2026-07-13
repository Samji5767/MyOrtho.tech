import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface QaInspection {
  id: string;
  organizationId: string;
  batchId: string | null;
  printJobId: string | null;
  stlValid: boolean | null;
  meshIntegrityOk: boolean | null;
  wallThicknessOk: boolean | null;
  printabilityScore: number | null;
  orientationOk: boolean | null;
  supportOk: boolean | null;
  surfaceQualityScore: number | null;
  dimensionalVarianceMm: number | null;
  operatorNotes: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  isSimulated: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  simulatedNote?: string;
}

export type CreateQaInspectionDto = {
  batchId?: string;
  printJobId?: string;
  isSimulated?: boolean;
  stlValid?: boolean;
  meshIntegrityOk?: boolean;
  wallThicknessOk?: boolean;
  printabilityScore?: number;
  orientationOk?: boolean;
  supportOk?: boolean;
  surfaceQualityScore?: number;
  dimensionalVarianceMm?: number;
  operatorNotes?: string;
};

export type UpdateQaInspectionDto = Partial<{
  stlValid: boolean;
  meshIntegrityOk: boolean;
  wallThicknessOk: boolean;
  printabilityScore: number;
  orientationOk: boolean;
  supportOk: boolean;
  surfaceQualityScore: number;
  dimensionalVarianceMm: number;
  operatorNotes: string;
  status: string;
}>;

const SIMULATED_NOTE =
  'QA results are simulated — operator validation required before production approval';

// Mapping from DTO camelCase keys to DB snake_case column names
const UPDATABLE_COLUMNS: Record<keyof UpdateQaInspectionDto, string> = {
  stlValid: 'stl_valid',
  meshIntegrityOk: 'mesh_integrity_ok',
  wallThicknessOk: 'wall_thickness_ok',
  printabilityScore: 'printability_score',
  orientationOk: 'orientation_ok',
  supportOk: 'support_ok',
  surfaceQualityScore: 'surface_quality_score',
  dimensionalVarianceMm: 'dimensional_variance_mm',
  operatorNotes: 'operator_notes',
  status: 'status',
};

@Injectable()
export class QaInspectionService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, status?: string): Promise<QaInspection[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM qa_inspections
       WHERE organization_id = $1
       ${status ? 'AND status = $2' : ''}
       ORDER BY created_at DESC`,
      status ? [orgId, status] : [orgId],
    );
    return rows.map(this.map);
  }

  async create(
    orgId: string,
    createdBy: string,
    dto: CreateQaInspectionDto,
  ): Promise<QaInspection> {
    const { rows } = await this.db.query(
      `INSERT INTO qa_inspections (
         organization_id, batch_id, print_job_id, is_simulated,
         stl_valid, mesh_integrity_ok, wall_thickness_ok, printability_score,
         orientation_ok, support_ok, surface_quality_score, dimensional_variance_mm,
         operator_notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        orgId,
        dto.batchId ?? null,
        dto.printJobId ?? null,
        dto.isSimulated ?? false,
        dto.stlValid ?? null,
        dto.meshIntegrityOk ?? null,
        dto.wallThicknessOk ?? null,
        dto.printabilityScore ?? null,
        dto.orientationOk ?? null,
        dto.supportOk ?? null,
        dto.surfaceQualityScore ?? null,
        dto.dimensionalVarianceMm ?? null,
        dto.operatorNotes ?? null,
        createdBy,
      ],
    );
    return this.map(rows[0]);
  }

  async update(
    id: string,
    orgId: string,
    dto: UpdateQaInspectionDto,
  ): Promise<QaInspection> {
    const params: unknown[] = [id, orgId];
    const sets: string[] = [];

    for (const [key, col] of Object.entries(UPDATABLE_COLUMNS) as [keyof UpdateQaInspectionDto, string][]) {
      if (key in dto && dto[key] !== undefined) {
        params.push(dto[key]);
        sets.push(`${col} = $${params.length}`);
      }
    }

    if (sets.length === 0) {
      // No fields to update — return current record
      const { rows } = await this.db.query(
        `SELECT * FROM qa_inspections WHERE id = $1 AND organization_id = $2`,
        [id, orgId],
      );
      if (!rows[0]) throw new NotFoundException('QA inspection not found');
      return this.map(rows[0]);
    }

    sets.push(`updated_at = NOW()`);

    const { rows } = await this.db.query(
      `UPDATE qa_inspections
       SET ${sets.join(', ')}
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('QA inspection not found');
    return this.map(rows[0]);
  }

  async approve(id: string, orgId: string, approvedById: string): Promise<QaInspection> {
    const { rows } = await this.db.query(
      `UPDATE qa_inspections
       SET status = 'passed', approved_by = $3, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, orgId, approvedById],
    );
    if (!rows[0]) throw new NotFoundException('QA inspection not found');
    return this.map(rows[0]);
  }

  async reject(id: string, orgId: string, notes?: string): Promise<QaInspection> {
    const { rows } = await this.db.query(
      `UPDATE qa_inspections
       SET status = 'failed',
           operator_notes = COALESCE($3, operator_notes),
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, orgId, notes ?? null],
    );
    if (!rows[0]) throw new NotFoundException('QA inspection not found');
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): QaInspection {
    const isSimulated = Boolean(r['is_simulated']);
    const result: QaInspection = {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      batchId: (r['batch_id'] as string | null) ?? null,
      printJobId: (r['print_job_id'] as string | null) ?? null,
      stlValid: r['stl_valid'] != null ? Boolean(r['stl_valid']) : null,
      meshIntegrityOk: r['mesh_integrity_ok'] != null ? Boolean(r['mesh_integrity_ok']) : null,
      wallThicknessOk: r['wall_thickness_ok'] != null ? Boolean(r['wall_thickness_ok']) : null,
      printabilityScore: r['printability_score'] != null ? Number(r['printability_score']) : null,
      orientationOk: r['orientation_ok'] != null ? Boolean(r['orientation_ok']) : null,
      supportOk: r['support_ok'] != null ? Boolean(r['support_ok']) : null,
      surfaceQualityScore: r['surface_quality_score'] != null ? Number(r['surface_quality_score']) : null,
      dimensionalVarianceMm: r['dimensional_variance_mm'] != null ? Number(r['dimensional_variance_mm']) : null,
      operatorNotes: (r['operator_notes'] as string | null) ?? null,
      status: r['status'] as string,
      approvedBy: (r['approved_by'] as string | null) ?? null,
      approvedAt: r['approved_at'] ? String(r['approved_at']) : null,
      isSimulated,
      createdBy: r['created_by'] as string,
      createdAt: String(r['created_at']),
      updatedAt: String(r['updated_at']),
    };

    if (isSimulated) {
      result.simulatedNote = SIMULATED_NOTE;
    }

    return result;
  }
}
