import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ToothState {
  fdi: number;
  // Translation (mm)
  mesialMm: number;
  distalMm: number;
  buccalMm: number;
  lingualMm: number;
  intrusionMm: number;
  extrusionMm: number;
  // Rotation (degrees)
  mesialRotDeg: number;
  distalRotDeg: number;
  // Angulation (tip, degrees)
  mesialTipDeg: number;
  distalTipDeg: number;
  // Torque (degrees)
  torqueDeg: number;
  // Root movement
  rootTranslationMm: number;
  rootTorqueDeg: number;
  rootTipDeg: number;
  // Metadata
  locked: boolean;
  aiSuggested: boolean;
}

export interface DigitalSetup {
  id: string;
  organizationId: string;
  caseId: string;
  treatmentGoalId: string | null;
  name: string;
  toothPositions: ToothState[];
  initialPositions: ToothState[];
  status: string;
  version: number;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToothMovementRecord {
  id: string;
  organizationId: string;
  digitalSetupId: string;
  toothFdi: number;
  movementType: string;
  axis: string;
  deltaValue: number;
  fromPosition: ToothState;
  toPosition: ToothState;
  createdBy: string;
  createdAt: Date;
}

export type MovementType =
  | 'mesial' | 'distal' | 'buccal' | 'lingual'
  | 'intrusion' | 'extrusion'
  | 'mesial_rot' | 'distal_rot'
  | 'mesial_tip' | 'distal_tip'
  | 'torque'
  | 'root_translation' | 'root_torque' | 'root_tip';

export interface MoveToothDto {
  toothFdi: number;
  movementType: MovementType;
  deltaValue: number;
}

export interface CreateSetupDto {
  treatmentGoalId?: string;
  name?: string;
}

// ─── FDI tooth list ───────────────────────────────────────────────────────────

const ALL_TEETH = [11,12,13,14,15,16,17,21,22,23,24,25,26,27,31,32,33,34,35,36,37,41,42,43,44,45,46,47];

function blankTooth(fdi: number, aiSuggested = false): ToothState {
  return {
    fdi,
    mesialMm: 0, distalMm: 0, buccalMm: 0, lingualMm: 0,
    intrusionMm: 0, extrusionMm: 0,
    mesialRotDeg: 0, distalRotDeg: 0,
    mesialTipDeg: 0, distalTipDeg: 0,
    torqueDeg: 0,
    rootTranslationMm: 0, rootTorqueDeg: 0, rootTipDeg: 0,
    locked: false,
    aiSuggested,
  };
}

// Converts a treatment goal tooth_movements prediction into initial ToothState positions
function goalMovementsToToothStates(
  goalMovements: Array<{
    fdi: number;
    mesialDistal?: number;
    buccalLingual?: number;
    intrusionExtrusion?: number;
    rotation?: number;
    torque?: number;
  }>,
): ToothState[] {
  const byFdi = new Map(goalMovements.map((m) => [m.fdi, m]));
  return ALL_TEETH.map((fdi) => {
    const mv = byFdi.get(fdi);
    if (!mv) return blankTooth(fdi, true);
    const tooth = blankTooth(fdi, true);
    // Map prediction fields to ToothState fields
    if (mv.mesialDistal !== undefined) {
      if (mv.mesialDistal > 0) tooth.mesialMm = Math.abs(mv.mesialDistal);
      else tooth.distalMm = Math.abs(mv.mesialDistal);
    }
    if (mv.buccalLingual !== undefined) {
      if (mv.buccalLingual > 0) tooth.buccalMm = Math.abs(mv.buccalLingual);
      else tooth.lingualMm = Math.abs(mv.buccalLingual);
    }
    if (mv.intrusionExtrusion !== undefined) {
      if (mv.intrusionExtrusion > 0) tooth.intrusionMm = Math.abs(mv.intrusionExtrusion);
      else tooth.extrusionMm = Math.abs(mv.intrusionExtrusion);
    }
    if (mv.rotation !== undefined) {
      if (mv.rotation > 0) tooth.mesialRotDeg = Math.abs(mv.rotation);
      else tooth.distalRotDeg = Math.abs(mv.rotation);
    }
    if (mv.torque !== undefined) tooth.torqueDeg = mv.torque;
    return tooth;
  });
}

// ─── Movement field mapping ───────────────────────────────────────────────────

const MOVEMENT_FIELD_MAP: Record<MovementType, { field: keyof ToothState; axis: string }> = {
  mesial:            { field: 'mesialMm',         axis: 'mesial-distal' },
  distal:            { field: 'distalMm',          axis: 'mesial-distal' },
  buccal:            { field: 'buccalMm',          axis: 'buccal-lingual' },
  lingual:           { field: 'lingualMm',         axis: 'buccal-lingual' },
  intrusion:         { field: 'intrusionMm',       axis: 'vertical' },
  extrusion:         { field: 'extrusionMm',       axis: 'vertical' },
  mesial_rot:        { field: 'mesialRotDeg',      axis: 'rotation' },
  distal_rot:        { field: 'distalRotDeg',      axis: 'rotation' },
  mesial_tip:        { field: 'mesialTipDeg',      axis: 'tip' },
  distal_tip:        { field: 'distalTipDeg',      axis: 'tip' },
  torque:            { field: 'torqueDeg',         axis: 'torque' },
  root_translation:  { field: 'rootTranslationMm', axis: 'root' },
  root_torque:       { field: 'rootTorqueDeg',     axis: 'root' },
  root_tip:          { field: 'rootTipDeg',        axis: 'root' },
};

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapSetupRow(r: Record<string, unknown>): DigitalSetup {
  return {
    id: r['id'] as string,
    organizationId: r['organization_id'] as string,
    caseId: r['case_id'] as string,
    treatmentGoalId: r['treatment_goal_id'] as string | null,
    name: r['name'] as string,
    toothPositions: (r['tooth_positions'] as ToothState[]) ?? [],
    initialPositions: (r['initial_positions'] as ToothState[]) ?? [],
    status: r['status'] as string,
    version: r['version'] as number,
    createdBy: r['created_by'] as string,
    approvedBy: r['approved_by'] as string | null,
    approvedAt: r['approved_at'] as Date | null,
    createdAt: r['created_at'] as Date,
    updatedAt: r['updated_at'] as Date,
  };
}

function mapMovementRow(r: Record<string, unknown>): ToothMovementRecord {
  return {
    id: r['id'] as string,
    organizationId: r['organization_id'] as string,
    digitalSetupId: r['digital_setup_id'] as string,
    toothFdi: r['tooth_fdi'] as number,
    movementType: r['movement_type'] as string,
    axis: r['axis'] as string,
    deltaValue: parseFloat(r['delta_value'] as string),
    fromPosition: r['from_position'] as ToothState,
    toPosition: r['to_position'] as ToothState,
    createdBy: r['created_by'] as string,
    createdAt: r['created_at'] as Date,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DigitalSetupService {
  private readonly logger = new Logger(DigitalSetupService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async createSetup(
    orgId: string,
    caseId: string,
    createdBy: string,
    dto: CreateSetupDto,
  ): Promise<DigitalSetup> {
    let initialPositions: ToothState[] = ALL_TEETH.map((fdi) => blankTooth(fdi, false));
    let treatmentGoalId: string | null = dto.treatmentGoalId ?? null;

    // If a treatment goal is provided, seed positions from it
    if (treatmentGoalId) {
      const { rows: goalRows } = await this.pool.query<Record<string, unknown>>(
        `SELECT tooth_movements FROM treatment_goals
         WHERE id = $1 AND organization_id = $2 AND case_id = $3`,
        [treatmentGoalId, orgId, caseId],
      );
      if (!goalRows[0]) {
        throw new NotFoundException(`Treatment goal ${treatmentGoalId} not found for this case`);
      }
      const goalMovements = (goalRows[0]['tooth_movements'] as Array<{
        fdi: number;
        mesialDistal?: number;
        buccalLingual?: number;
        intrusionExtrusion?: number;
        rotation?: number;
        torque?: number;
      }>) ?? [];
      initialPositions = goalMovementsToToothStates(goalMovements);
    }

    const name =
      dto.name ?? `Setup ${new Date().toISOString().split('T')[0]}`;

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO digital_setups (
         organization_id, case_id, treatment_goal_id, name,
         tooth_positions, initial_positions,
         status, version, created_by,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6,
         'draft', 1, $7,
         now(), now()
       ) RETURNING *`,
      [
        orgId, caseId, treatmentGoalId, name,
        JSON.stringify(initialPositions),
        JSON.stringify(initialPositions),
        createdBy,
      ],
    );

    this.logger.log(`Created digital setup ${rows[0]!['id']} for case ${caseId}`);
    return mapSetupRow(rows[0]!);
  }

  async getSetup(orgId: string, setupId: string): Promise<DigitalSetup> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!rows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);
    return mapSetupRow(rows[0]);
  }

  async listSetups(orgId: string, caseId: string): Promise<DigitalSetup[]> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM digital_setups
       WHERE organization_id = $1 AND case_id = $2
       ORDER BY created_at DESC`,
      [orgId, caseId],
    );
    return rows.map(mapSetupRow);
  }

  async moveTooth(
    orgId: string,
    setupId: string,
    createdBy: string,
    dto: MoveToothDto,
  ): Promise<DigitalSetup> {
    const mapping = MOVEMENT_FIELD_MAP[dto.movementType];
    if (!mapping) {
      throw new BadRequestException(`Unknown movement type: ${dto.movementType}`);
    }

    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the row for update
      const { rows: setupRows } = await client.query<Record<string, unknown>>(
        `SELECT * FROM digital_setups WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [setupId, orgId],
      );
      if (!setupRows[0]) {
        await client.query('ROLLBACK');
        throw new NotFoundException(`Digital setup ${setupId} not found`);
      }

      const setup = mapSetupRow(setupRows[0]);

      if (setup.status === 'approved') {
        await client.query('ROLLBACK');
        throw new BadRequestException('Cannot modify an approved setup');
      }

      const positions: ToothState[] = setup.toothPositions;
      const toothIdx = positions.findIndex((t) => t.fdi === dto.toothFdi);
      if (toothIdx === -1) {
        await client.query('ROLLBACK');
        throw new NotFoundException(`Tooth FDI ${dto.toothFdi} not found in setup`);
      }

      const tooth = positions[toothIdx]!;

      if (tooth.locked) {
        await client.query('ROLLBACK');
        throw new BadRequestException(`Tooth FDI ${dto.toothFdi} is locked`);
      }

      const fromPosition: ToothState = { ...tooth };

      // Apply delta — all values are non-negative offsets; delta can be negative to undo
      const field = mapping.field;
      const currentValue = tooth[field] as number;
      const newValue = parseFloat((currentValue + dto.deltaValue).toFixed(4));
      // Clamp to non-negative (positional offsets stored as absolute magnitudes)
      (tooth as unknown as Record<string, unknown>)[field] = Math.max(0, newValue);
      tooth.aiSuggested = false; // clinician modification

      const toPosition: ToothState = { ...tooth };

      // Update tooth_positions in DB
      const updatedPositions = [...positions];
      updatedPositions[toothIdx] = tooth;

      const { rows: updatedSetup } = await client.query<Record<string, unknown>>(
        `UPDATE digital_setups
         SET tooth_positions = $1, version = version + 1, updated_at = now()
         WHERE id = $2 AND organization_id = $3
         RETURNING *`,
        [JSON.stringify(updatedPositions), setupId, orgId],
      );

      // Insert audit record
      await client.query(
        `INSERT INTO tooth_movement_records (
           organization_id, digital_setup_id, tooth_fdi,
           movement_type, axis, delta_value,
           from_position, to_position, created_by, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
        [
          orgId, setupId, dto.toothFdi,
          dto.movementType, mapping.axis, dto.deltaValue,
          JSON.stringify(fromPosition),
          JSON.stringify(toPosition),
          createdBy,
        ],
      );

      await client.query('COMMIT');

      this.logger.log(
        `Moved tooth FDI ${dto.toothFdi} (${dto.movementType} ${dto.deltaValue}) in setup ${setupId}`,
      );
      return mapSetupRow(updatedSetup[0]!);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async resetTooth(
    orgId: string,
    setupId: string,
    createdBy: string,
    toothFdi: number,
  ): Promise<DigitalSetup> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: setupRows } = await client.query<Record<string, unknown>>(
        `SELECT * FROM digital_setups WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [setupId, orgId],
      );
      if (!setupRows[0]) {
        await client.query('ROLLBACK');
        throw new NotFoundException(`Digital setup ${setupId} not found`);
      }

      const setup = mapSetupRow(setupRows[0]);

      if (setup.status === 'approved') {
        await client.query('ROLLBACK');
        throw new BadRequestException('Cannot modify an approved setup');
      }

      const positions: ToothState[] = setup.toothPositions;
      const initials: ToothState[]  = setup.initialPositions;

      const toothIdx  = positions.findIndex((t) => t.fdi === toothFdi);
      const initIdx   = initials.findIndex((t) => t.fdi === toothFdi);

      if (toothIdx === -1 || initIdx === -1) {
        await client.query('ROLLBACK');
        throw new NotFoundException(`Tooth FDI ${toothFdi} not found in setup`);
      }

      const fromPosition: ToothState = { ...positions[toothIdx]! };
      // Restore to initial AI-suggested position
      const restored: ToothState = { ...initials[initIdx]!, locked: positions[toothIdx]!.locked };

      const updatedPositions = [...positions];
      updatedPositions[toothIdx] = restored;

      const { rows: updatedSetup } = await client.query<Record<string, unknown>>(
        `UPDATE digital_setups
         SET tooth_positions = $1, version = version + 1, updated_at = now()
         WHERE id = $2 AND organization_id = $3
         RETURNING *`,
        [JSON.stringify(updatedPositions), setupId, orgId],
      );

      // Record the reset as a special audit entry
      await client.query(
        `INSERT INTO tooth_movement_records (
           organization_id, digital_setup_id, tooth_fdi,
           movement_type, axis, delta_value,
           from_position, to_position, created_by, created_at
         ) VALUES ($1, $2, $3, 'reset', 'all', 0, $4, $5, $6, now())`,
        [
          orgId, setupId, toothFdi,
          JSON.stringify(fromPosition),
          JSON.stringify(restored),
          createdBy,
        ],
      );

      await client.query('COMMIT');
      this.logger.log(`Reset tooth FDI ${toothFdi} to initial position in setup ${setupId}`);
      return mapSetupRow(updatedSetup[0]!);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getMovementHistory(orgId: string, setupId: string): Promise<ToothMovementRecord[]> {
    // Verify ownership
    await this.getSetup(orgId, setupId);

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM tooth_movement_records
       WHERE digital_setup_id = $1 AND organization_id = $2
       ORDER BY created_at ASC`,
      [setupId, orgId],
    );
    return rows.map(mapMovementRow);
  }

  async lockTooth(
    orgId: string,
    setupId: string,
    toothFdi: number,
    locked: boolean,
  ): Promise<DigitalSetup> {
    const setup = await this.getSetup(orgId, setupId);
    const positions = setup.toothPositions;
    const toothIdx = positions.findIndex((t) => t.fdi === toothFdi);
    if (toothIdx === -1) throw new NotFoundException(`Tooth FDI ${toothFdi} not found`);

    positions[toothIdx]!.locked = locked;

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `UPDATE digital_setups
       SET tooth_positions = $1, updated_at = now()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [JSON.stringify(positions), setupId, orgId],
    );
    return mapSetupRow(rows[0]!);
  }

  async approveSetup(
    orgId: string,
    setupId: string,
    approvedBy: string,
  ): Promise<DigitalSetup> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `UPDATE digital_setups
       SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [approvedBy, setupId, orgId],
    );
    if (!rows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);
    this.logger.log(`Digital setup ${setupId} approved by ${approvedBy}`);
    return mapSetupRow(rows[0]);
  }
}
