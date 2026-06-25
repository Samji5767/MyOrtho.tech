import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// FDI notation: upper right 11-18, upper left 21-28, lower left 31-38, lower right 41-48
const FDI_MIN = 11;
const FDI_MAX = 48;

export interface UpsertToothMovementDto {
  fdiNumber: number;
  translateX?: number;
  translateY?: number;
  translateZ?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  tip?: number;
  torque?: number;
  intrusion?: number;
  extrusion?: number;
  isLocked?: boolean;
  notes?: string;
}

export interface CreateMeasurementDto {
  measurementLabel?: string;
  overjetMm?: number;
  overbitemm?: number;
  angleClass?: string;
  distanceMm?: number;
  notes?: string;
}

@Injectable()
export class ToothMovementsService {
  private readonly logger = new Logger(ToothMovementsService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ── Tooth Movements ─────────────────────────────────────────────────────────

  async listForStage(caseId: string, planId: string, stageId: string, orgId: string) {
    await this.verifyStageOwnership(stageId, planId, caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT id, stage_id, fdi_number,
              translate_x, translate_y, translate_z,
              rotate_x, rotate_y, rotate_z,
              tip, torque, intrusion, extrusion,
              is_locked, notes, created_at, updated_at
       FROM tooth_movements WHERE stage_id = $1 ORDER BY fdi_number`,
      [stageId],
    );
    return rows.map((r) => this.formatMovement(r));
  }

  async upsert(
    caseId: string,
    planId: string,
    stageId: string,
    orgId: string,
    dto: UpsertToothMovementDto,
    actorEmail: string,
  ) {
    await this.verifyStageOwnership(stageId, planId, caseId, orgId);

    if (!Number.isInteger(dto.fdiNumber) || dto.fdiNumber < FDI_MIN || dto.fdiNumber > FDI_MAX) {
      throw new BadRequestException(`fdiNumber must be an integer between ${FDI_MIN} and ${FDI_MAX}`);
    }

    const { rows } = await this.pool.query(
      `INSERT INTO tooth_movements
         (stage_id, fdi_number,
          translate_x, translate_y, translate_z,
          rotate_x, rotate_y, rotate_z,
          tip, torque, intrusion, extrusion,
          is_locked, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (stage_id, fdi_number) DO UPDATE
         SET translate_x  = EXCLUDED.translate_x,
             translate_y  = EXCLUDED.translate_y,
             translate_z  = EXCLUDED.translate_z,
             rotate_x     = EXCLUDED.rotate_x,
             rotate_y     = EXCLUDED.rotate_y,
             rotate_z     = EXCLUDED.rotate_z,
             tip          = EXCLUDED.tip,
             torque       = EXCLUDED.torque,
             intrusion    = EXCLUDED.intrusion,
             extrusion    = EXCLUDED.extrusion,
             is_locked    = EXCLUDED.is_locked,
             notes        = EXCLUDED.notes,
             updated_at   = now()
       RETURNING *`,
      [
        stageId,
        dto.fdiNumber,
        dto.translateX ?? 0,
        dto.translateY ?? 0,
        dto.translateZ ?? 0,
        dto.rotateX ?? 0,
        dto.rotateY ?? 0,
        dto.rotateZ ?? 0,
        dto.tip ?? 0,
        dto.torque ?? 0,
        dto.intrusion ?? 0,
        dto.extrusion ?? 0,
        dto.isLocked ?? false,
        dto.notes ?? null,
      ],
    );
    this.logger.log(`Tooth movement FDI ${dto.fdiNumber} upserted in stage ${stageId} by ${actorEmail}`);
    return this.formatMovement(rows[0]);
  }

  async delete(
    caseId: string,
    planId: string,
    stageId: string,
    fdiNumber: number,
    orgId: string,
    actorEmail: string,
  ) {
    await this.verifyStageOwnership(stageId, planId, caseId, orgId);
    const { rowCount } = await this.pool.query(
      `DELETE FROM tooth_movements WHERE stage_id = $1 AND fdi_number = $2`,
      [stageId, fdiNumber],
    );
    if (!rowCount) throw new NotFoundException(`No movement found for FDI ${fdiNumber} in this stage`);
    this.logger.log(`Tooth movement FDI ${fdiNumber} deleted from stage ${stageId} by ${actorEmail}`);
    return { deleted: true, fdiNumber };
  }

  // ── Clinical Measurements ────────────────────────────────────────────────────

  async listMeasurements(caseId: string, orgId: string) {
    await this.verifyCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT cm.id, cm.case_id, cm.measured_by, au.email AS measured_by_email,
              cm.measurement_label, cm.overjet_mm, cm.overbite_mm, cm.angle_class,
              cm.distance_mm, cm.notes, cm.created_at
       FROM clinical_measurements cm
       LEFT JOIN auth_users au ON au.id = cm.measured_by
       WHERE cm.case_id = $1
       ORDER BY cm.created_at DESC`,
      [caseId],
    );
    return rows.map((r) => ({
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      measuredBy: r['measured_by'] as string | null,
      measuredByEmail: r['measured_by_email'] as string | null,
      measurementLabel: r['measurement_label'] as string | null,
      overjetMm: r['overjet_mm'] as number | null,
      overbitemm: r['overbite_mm'] as number | null,
      angleClass: r['angle_class'] as string | null,
      distanceMm: r['distance_mm'] as number | null,
      notes: r['notes'] as string | null,
      createdAt: r['created_at'] as Date,
    }));
  }

  async createMeasurement(
    caseId: string,
    orgId: string,
    userId: string,
    dto: CreateMeasurementDto,
    actorEmail: string,
  ) {
    await this.verifyCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `INSERT INTO clinical_measurements
         (case_id, measured_by, measurement_label, overjet_mm, overbite_mm,
          angle_class, distance_mm, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [
        caseId,
        userId,
        dto.measurementLabel ?? null,
        dto.overjetMm ?? null,
        dto.overbitemm ?? null,
        dto.angleClass ?? null,
        dto.distanceMm ?? null,
        dto.notes ?? null,
      ],
    );
    this.logger.log(`Clinical measurement created for case ${caseId} by ${actorEmail}`);
    return { id: rows[0].id as string, caseId, createdAt: rows[0].created_at as Date };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private formatMovement(r: Record<string, unknown>) {
    return {
      id: r['id'] as string,
      stageId: r['stage_id'] as string,
      fdiNumber: r['fdi_number'] as number,
      translateX: r['translate_x'] as number,
      translateY: r['translate_y'] as number,
      translateZ: r['translate_z'] as number,
      rotateX: r['rotate_x'] as number,
      rotateY: r['rotate_y'] as number,
      rotateZ: r['rotate_z'] as number,
      tip: r['tip'] as number,
      torque: r['torque'] as number,
      intrusion: r['intrusion'] as number,
      extrusion: r['extrusion'] as number,
      isLocked: r['is_locked'] as boolean,
      notes: r['notes'] as string | null,
      createdAt: r['created_at'] as Date,
      updatedAt: r['updated_at'] as Date,
    };
  }

  private async verifyStageOwnership(stageId: string, planId: string, caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT ast.id
       FROM aligner_stages ast
       JOIN treatment_plans tp ON tp.id = ast.plan_id
       JOIN cases c ON c.id = tp.case_id
       JOIN patients p ON p.id = c.patient_id
       WHERE ast.id = $1 AND tp.id = $2 AND c.id = $3 AND p.organization_id = $4`,
      [stageId, planId, caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Stage not found');
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
}
