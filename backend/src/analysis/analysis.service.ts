import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface SaveAnalysisDto {
  boltonOverall?: number;
  boltonAnterior?: number;
  toothMeasurements?: Record<string, number>;
  angleClass?: string;
  overjetMm?: number;
  overbiteM?: number;
  upperCrowdingMm?: number;
  lowerCrowdingMm?: number;
  iprSchedule?: IprEntry[];
  complexityScore?: number;
  notes?: string;
}

export interface IprEntry {
  stage: number;
  toothA: string;
  toothB: string;
  amountMm: number;
}

@Injectable()
export class AnalysisService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getLatest(caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT ca.*, u.email AS created_by_email
         FROM case_analyses ca
         LEFT JOIN auth_users u ON u.id = ca.created_by
         WHERE ca.case_id = $1
         ORDER BY ca.created_at DESC
         LIMIT 1`,
      [caseId],
    );
    return rows[0] ? this.format(rows[0]) : null;
  }

  async list(caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT ca.id, ca.case_id, ca.bolton_overall, ca.bolton_anterior,
              ca.angle_class, ca.overjet_mm, ca.overbite_mm,
              ca.upper_crowding_mm, ca.lower_crowding_mm,
              ca.complexity_score, ca.notes, ca.created_at,
              u.email AS created_by_email
         FROM case_analyses ca
         LEFT JOIN auth_users u ON u.id = ca.created_by
         WHERE ca.case_id = $1
         ORDER BY ca.created_at DESC`,
      [caseId],
    );
    return rows.map(this.format);
  }

  async create(caseId: string, orgId: string, userId: string, dto: SaveAnalysisDto) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `INSERT INTO case_analyses
         (case_id, created_by, bolton_overall, bolton_anterior, tooth_measurements,
          angle_class, overjet_mm, overbite_mm, upper_crowding_mm, lower_crowding_mm,
          ipr_schedule, complexity_score, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        caseId, userId,
        dto.boltonOverall ?? null,
        dto.boltonAnterior ?? null,
        JSON.stringify(dto.toothMeasurements ?? {}),
        dto.angleClass ?? null,
        dto.overjetMm ?? null,
        dto.overbiteM ?? null,
        dto.upperCrowdingMm ?? null,
        dto.lowerCrowdingMm ?? null,
        JSON.stringify(dto.iprSchedule ?? []),
        dto.complexityScore ?? null,
        dto.notes ?? null,
      ],
    );
    return this.format(rows[0]);
  }

  async update(id: string, caseId: string, orgId: string, dto: SaveAnalysisDto) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `UPDATE case_analyses SET
         bolton_overall   = COALESCE($1, bolton_overall),
         bolton_anterior  = COALESCE($2, bolton_anterior),
         tooth_measurements = COALESCE($3::jsonb, tooth_measurements),
         angle_class      = COALESCE($4, angle_class),
         overjet_mm       = COALESCE($5, overjet_mm),
         overbite_mm      = COALESCE($6, overbite_mm),
         upper_crowding_mm= COALESCE($7, upper_crowding_mm),
         lower_crowding_mm= COALESCE($8, lower_crowding_mm),
         ipr_schedule     = COALESCE($9::jsonb, ipr_schedule),
         complexity_score = COALESCE($10, complexity_score),
         notes            = COALESCE($11, notes),
         updated_at       = now()
       WHERE id = $12 AND case_id = $13
       RETURNING *`,
      [
        dto.boltonOverall ?? null,
        dto.boltonAnterior ?? null,
        dto.toothMeasurements ? JSON.stringify(dto.toothMeasurements) : null,
        dto.angleClass ?? null,
        dto.overjetMm ?? null,
        dto.overbiteM ?? null,
        dto.upperCrowdingMm ?? null,
        dto.lowerCrowdingMm ?? null,
        dto.iprSchedule ? JSON.stringify(dto.iprSchedule) : null,
        dto.complexityScore ?? null,
        dto.notes ?? null,
        id,
        caseId,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Analysis record not found');
    return this.format(rows[0]);
  }

  private async verifyCase(caseId: string, orgId: string) {
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
      id: r['id'],
      caseId: r['case_id'],
      boltonOverall: r['bolton_overall'] != null ? parseFloat(String(r['bolton_overall'])) : null,
      boltonAnterior: r['bolton_anterior'] != null ? parseFloat(String(r['bolton_anterior'])) : null,
      toothMeasurements: r['tooth_measurements'] as Record<string, number>,
      angleClass: r['angle_class'],
      overjetMm: r['overjet_mm'] != null ? parseFloat(String(r['overjet_mm'])) : null,
      overbiteM: r['overbite_mm'] != null ? parseFloat(String(r['overbite_mm'])) : null,
      upperCrowdingMm: r['upper_crowding_mm'] != null ? parseFloat(String(r['upper_crowding_mm'])) : null,
      lowerCrowdingMm: r['lower_crowding_mm'] != null ? parseFloat(String(r['lower_crowding_mm'])) : null,
      iprSchedule: r['ipr_schedule'] as IprEntry[],
      complexityScore: r['complexity_score'],
      createdByEmail: r['created_by_email'],
      notes: r['notes'],
      createdAt: r['created_at'],
      updatedAt: r['updated_at'],
    };
  }
}
