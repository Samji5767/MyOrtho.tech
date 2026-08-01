import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// FDI notation: quadrant digit 1-4 (UR, UL, LL, LR), position digit 1-8.
function isValidFdi(fdi: number): boolean {
  if (!Number.isInteger(fdi)) return false;
  const quadrant = Math.floor(fdi / 10);
  const position = fdi % 10;
  return quadrant >= 1 && quadrant <= 4 && position >= 1 && position <= 8;
}

/**
 * Canonical per-tooth movement: signed anatomical components (migration 075).
 * Values are cumulative at the stage they are attached to.
 */
export interface ToothMovementValues {
  mesiodistalMm: number; //  mesial + / distal −
  buccolingualMm: number; //  buccal + / lingual −
  occlusogingivalMm: number; //  extrusion + / intrusion −
  rotationDeg: number; //  about tooth long axis, mesial-in +
  tipDeg: number; //  crown angulation, mesial tip +
  torqueDeg: number; //  root torque, buccal +
}

export interface UpsertToothMovementDto extends Partial<ToothMovementValues> {
  fdiNumber: number;
  isLocked?: boolean;
  notes?: string;
}

export interface CreateMeasurementDto {
  measurementLabel?: string;
  overjetMm?: number;
  overbiteMm?: number;
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
              mesiodistal_mm, buccolingual_mm, occlusogingival_mm,
              rotation_deg, tip_deg, torque_deg,
              is_locked, notes, created_at, updated_at
       FROM tooth_movements WHERE stage_id = $1 ORDER BY fdi_number`,
      [stageId],
    );
    return rows.map((r) => this.formatMovement(r));
  }

  /**
   * Upsert a movement and mirror it into aligner_stages.movement_data so the
   * 3D viewer (which renders from stage JSON) reflects the stored row. The
   * tooth_movements row is the source of truth; the JSON is a render cache.
   * Both writes share one transaction.
   */
  async upsert(
    caseId: string,
    planId: string,
    stageId: string,
    orgId: string,
    dto: UpsertToothMovementDto,
    actorEmail: string,
  ) {
    const stage = await this.verifyStageOwnership(stageId, planId, caseId, orgId);
    this.assertPlanEditable(stage);

    if (!isValidFdi(dto.fdiNumber)) {
      throw new BadRequestException(
        'fdiNumber must use FDI notation: quadrant 1-4, position 1-8 (e.g. 11-18, 21-28, 31-38, 41-48)',
      );
    }

    const values: ToothMovementValues = {
      mesiodistalMm: dto.mesiodistalMm ?? 0,
      buccolingualMm: dto.buccolingualMm ?? 0,
      occlusogingivalMm: dto.occlusogingivalMm ?? 0,
      rotationDeg: dto.rotationDeg ?? 0,
      tipDeg: dto.tipDeg ?? 0,
      torqueDeg: dto.torqueDeg ?? 0,
    };

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO tooth_movements
           (stage_id, fdi_number,
            mesiodistal_mm, buccolingual_mm, occlusogingival_mm,
            rotation_deg, tip_deg, torque_deg,
            is_locked, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (stage_id, fdi_number) DO UPDATE
           SET mesiodistal_mm     = EXCLUDED.mesiodistal_mm,
               buccolingual_mm    = EXCLUDED.buccolingual_mm,
               occlusogingival_mm = EXCLUDED.occlusogingival_mm,
               rotation_deg       = EXCLUDED.rotation_deg,
               tip_deg            = EXCLUDED.tip_deg,
               torque_deg         = EXCLUDED.torque_deg,
               is_locked          = EXCLUDED.is_locked,
               notes              = EXCLUDED.notes,
               updated_at         = now()
         RETURNING *`,
        [
          stageId,
          dto.fdiNumber,
          values.mesiodistalMm,
          values.buccolingualMm,
          values.occlusogingivalMm,
          values.rotationDeg,
          values.tipDeg,
          values.torqueDeg,
          dto.isLocked ?? false,
          dto.notes ?? null,
        ],
      );
      await client.query(
        `UPDATE aligner_stages
         SET movement_data = jsonb_set(
               COALESCE(movement_data::jsonb, '{}'::jsonb),
               ARRAY[$2::text], $3::jsonb)
         WHERE id = $1`,
        [stageId, String(dto.fdiNumber), JSON.stringify(values)],
      );
      await client.query('COMMIT');
      this.logger.log(
        `Tooth movement FDI ${dto.fdiNumber} upserted in stage ${stageId} by ${actorEmail}`,
      );
      return this.formatMovement(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async delete(
    caseId: string,
    planId: string,
    stageId: string,
    fdiNumber: number,
    orgId: string,
    actorEmail: string,
  ) {
    const stage = await this.verifyStageOwnership(stageId, planId, caseId, orgId);
    this.assertPlanEditable(stage);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rowCount } = await client.query(
        `DELETE FROM tooth_movements WHERE stage_id = $1 AND fdi_number = $2`,
        [stageId, fdiNumber],
      );
      if (!rowCount) {
        throw new NotFoundException(`No movement found for FDI ${fdiNumber} in this stage`);
      }
      await client.query(
        `UPDATE aligner_stages
         SET movement_data = COALESCE(movement_data::jsonb, '{}'::jsonb) - $2::text
         WHERE id = $1`,
        [stageId, String(fdiNumber)],
      );
      await client.query('COMMIT');
      this.logger.log(`Tooth movement FDI ${fdiNumber} deleted from stage ${stageId} by ${actorEmail}`);
      return { deleted: true, fdiNumber };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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
      overbiteMm: r['overbite_mm'] as number | null,
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
        dto.overbiteMm ?? null,
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
      mesiodistalMm: Number(r['mesiodistal_mm']),
      buccolingualMm: Number(r['buccolingual_mm']),
      occlusogingivalMm: Number(r['occlusogingival_mm']),
      rotationDeg: Number(r['rotation_deg']),
      tipDeg: Number(r['tip_deg']),
      torqueDeg: Number(r['torque_deg']),
      isLocked: r['is_locked'] as boolean,
      notes: r['notes'] as string | null,
      createdAt: r['created_at'] as Date,
      updatedAt: r['updated_at'] as Date,
    };
  }

  private assertPlanEditable(stage: { doctorApproval: boolean }) {
    if (stage.doctorApproval) {
      throw new BadRequestException(
        'Treatment plan is approved; tooth movements are locked. Create a new plan to make changes.',
      );
    }
  }

  private async verifyStageOwnership(
    stageId: string,
    planId: string,
    caseId: string,
    orgId: string,
  ): Promise<{ id: string; doctorApproval: boolean }> {
    const { rows } = await this.pool.query(
      `SELECT ast.id, tp.doctor_approval
       FROM aligner_stages ast
       JOIN treatment_plans tp ON tp.id = ast.treatment_plan_id
       JOIN cases c ON c.id = tp.case_id
       JOIN patients p ON p.id = c.patient_id
       WHERE ast.id = $1 AND tp.id = $2 AND c.id = $3 AND p.organization_id = $4`,
      [stageId, planId, caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Stage not found');
    return {
      id: rows[0]['id'] as string,
      doctorApproval: rows[0]['doctor_approval'] as boolean,
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
}
