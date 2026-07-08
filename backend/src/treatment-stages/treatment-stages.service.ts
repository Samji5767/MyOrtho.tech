import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ToothState {
  fdi: number;
  mesialMm: number;
  distalMm: number;
  buccalMm: number;
  lingualMm: number;
  intrusionMm: number;
  extrusionMm: number;
  mesialRotDeg: number;
  distalRotDeg: number;
  mesialTipDeg: number;
  distalTipDeg: number;
  torqueDeg: number;
  rootTranslationMm: number;
  rootTorqueDeg: number;
  rootTipDeg: number;
  locked: boolean;
  aiSuggested: boolean;
}

export interface StageTooth {
  fdi: number;
  mesialMm: number;
  distalMm: number;
  buccalMm: number;
  lingualMm: number;
  intrusionMm: number;
  extrusionMm: number;
  mesialRotDeg: number;
  distalRotDeg: number;
  torqueDeg: number;
}

export interface StageMovement {
  fdi: number;
  field: string;
  delta: number;
}

export interface StageAttachment {
  fdi: number;
  action: 'place' | 'remove';
  type: string;
}

export interface StageIprPoint {
  mesialTooth: number;
  distalTooth: number;
  reductionMm: number;
}

export interface TreatmentStage {
  id: string;
  organizationId: string;
  digitalSetupId: string;
  stageNumber: number;
  stageType: string;
  toothPositions: StageTooth[];
  toothMovements: StageMovement[];
  attachments: StageAttachment[];
  iprPoints: StageIprPoint[];
  elastics: unknown[];
  notes: string | null;
  createdAt: Date;
}

// ─── Staging constants ────────────────────────────────────────────────────────

const MAX_TRANSLATION_PER_STAGE = 0.25; // mm
const MAX_ROTATION_PER_STAGE    = 1.5;  // degrees
const MAX_TORQUE_PER_STAGE      = 2.0;  // degrees

/**
 * Clinically optimal per-stage movement limits (Kravitz et al. 2009).
 * Intrusion and extrusion are kept slower due to biological response differences.
 */
const PER_STAGE_LIMITS = {
  translation:  0.25, // mm
  rotation:     2.0,  // degrees
  torque:       2.0,  // degrees
  tip:          2.0,  // degrees
  intrusion:    0.08, // mm  — slower biological response
  extrusion:    0.15, // mm
} as const;

// Fields requiring staged movement (excluding locking metadata)
const MOVEMENT_FIELDS: (keyof ToothState)[] = [
  'mesialMm', 'distalMm', 'buccalMm', 'lingualMm',
  'intrusionMm', 'extrusionMm',
  'mesialRotDeg', 'distalRotDeg',
  'mesialTipDeg', 'distalTipDeg',
  'torqueDeg',
  'rootTranslationMm', 'rootTorqueDeg', 'rootTipDeg',
];

function isRotationField(f: keyof ToothState): boolean {
  return f === 'mesialRotDeg' || f === 'distalRotDeg' ||
         f === 'mesialTipDeg' || f === 'distalTipDeg';
}

function isTorqueField(f: keyof ToothState): boolean {
  return f === 'torqueDeg' || f === 'rootTorqueDeg' || f === 'rootTipDeg';
}

function maxPerStageFor(f: keyof ToothState): number {
  if (isRotationField(f)) return MAX_ROTATION_PER_STAGE;
  if (isTorqueField(f))   return MAX_TORQUE_PER_STAGE;
  return MAX_TRANSLATION_PER_STAGE;
}

// ─── Enhanced staging interfaces ─────────────────────────────────────────────

/**
 * Simplified per-tooth movement summary used by the sequencing and
 * isolation helpers. Callers derive these from the ToothState deltas.
 */
export interface ToothMovement {
  fdi: number;
  /** Total rotation magnitude (degrees) */
  rotationDeg: number;
  /** Torque magnitude (degrees) */
  torqueDeg: number;
  /** Tipping magnitude (degrees) */
  tipDeg: number;
  /** Intrusion magnitude (mm) */
  intrusionMm: number;
  /** Extrusion magnitude (mm) */
  extrusionMm: number;
  /** Total translation magnitude (mm) — scalar sum of all translational components */
  translationMm: number;
}

export interface StageSequence {
  anteriorStages: number;
  posteriorStages: number;
  refinementStages: number;
  totalActiveStages: number;
  sequencedTeeth: Array<{
    fdi: number;
    startStage: number;
    endStage: number;
    priority: 'anterior' | 'posterior' | 'refinement';
  }>;
}

export interface CoordinatedStagePlan {
  upperStageCount: number;
  lowerStageCount: number;
  totalStages: number;
  /** Which arch needs passive fill stages added to match the longer arch */
  paddingRequired: 'upper' | 'lower' | 'none';
  mismatchWarnings: Array<{ stageNumber: number; description: string }>;
}

// All adjacent FDI pairs (upper and lower arches) — shared by the helpers below
const ARCH_ADJACENT_PAIRS: [number, number][] = [
  [17,16],[16,15],[15,14],[14,13],[13,12],[12,11],[11,21],[21,22],[22,23],[23,24],[24,25],[25,26],[26,27],
  [47,46],[46,45],[45,44],[44,43],[43,42],[42,41],[41,31],[31,32],[32,33],[33,34],[34,35],[35,36],[36,37],
];

// ─── Staging algorithm ────────────────────────────────────────────────────────

interface TeethDelta {
  fdi: number;
  deltas: Partial<Record<keyof ToothState, number>>;
}

function computeDeltas(initial: ToothState[], final: ToothState[]): TeethDelta[] {
  const initialMap = new Map<number, ToothState>(initial.map((t) => [t.fdi, t]));
  return final.map((finalTooth) => {
    const initTooth = initialMap.get(finalTooth.fdi);
    if (!initTooth) return { fdi: finalTooth.fdi, deltas: {} };
    const deltas: Partial<Record<keyof ToothState, number>> = {};
    for (const field of MOVEMENT_FIELDS) {
      const diff = (finalTooth[field] as number) - (initTooth[field] as number);
      if (Math.abs(diff) > 0.001) deltas[field] = diff;
    }
    return { fdi: finalTooth.fdi, deltas };
  });
}

function stagesNeededForDelta(delta: Partial<Record<keyof ToothState, number>>): number {
  let maxStages = 1;
  for (const [field, value] of Object.entries(delta)) {
    const perStage = maxPerStageFor(field as keyof ToothState);
    const needed = Math.ceil(Math.abs(value) / perStage);
    if (needed > maxStages) maxStages = needed;
  }
  return maxStages;
}

function interpolateToothAtStage(
  initial: ToothState,
  deltas: Partial<Record<keyof ToothState, number>>,
  stageIndex: number,
  totalStages: number,
): StageTooth {
  const progress = totalStages > 0 ? stageIndex / totalStages : 1;
  return {
    fdi: initial.fdi,
    mesialMm:    parseFloat(((initial.mesialMm    + (deltas['mesialMm']    ?? 0) * progress)).toFixed(4)),
    distalMm:    parseFloat(((initial.distalMm    + (deltas['distalMm']    ?? 0) * progress)).toFixed(4)),
    buccalMm:    parseFloat(((initial.buccalMm    + (deltas['buccalMm']    ?? 0) * progress)).toFixed(4)),
    lingualMm:   parseFloat(((initial.lingualMm   + (deltas['lingualMm']   ?? 0) * progress)).toFixed(4)),
    intrusionMm: parseFloat(((initial.intrusionMm + (deltas['intrusionMm'] ?? 0) * progress)).toFixed(4)),
    extrusionMm: parseFloat(((initial.extrusionMm + (deltas['extrusionMm'] ?? 0) * progress)).toFixed(4)),
    mesialRotDeg:parseFloat(((initial.mesialRotDeg+ (deltas['mesialRotDeg']?? 0) * progress)).toFixed(4)),
    distalRotDeg:parseFloat(((initial.distalRotDeg+ (deltas['distalRotDeg']?? 0) * progress)).toFixed(4)),
    torqueDeg:   parseFloat(((initial.torqueDeg   + (deltas['torqueDeg']   ?? 0) * progress)).toFixed(4)),
  };
}

function computeStageMovements(
  prev: StageTooth[],
  curr: StageTooth[],
): StageMovement[] {
  const prevMap = new Map<number, StageTooth>(prev.map((t) => [t.fdi, t]));
  const moves: StageMovement[] = [];
  const stageFields: (keyof StageTooth)[] = [
    'mesialMm','distalMm','buccalMm','lingualMm',
    'intrusionMm','extrusionMm','mesialRotDeg','distalRotDeg','torqueDeg',
  ];
  for (const tooth of curr) {
    const p = prevMap.get(tooth.fdi);
    if (!p) continue;
    for (const field of stageFields) {
      const delta = (tooth[field] as number) - (p[field] as number);
      if (Math.abs(delta) > 0.0001) {
        moves.push({ fdi: tooth.fdi, field, delta: parseFloat(delta.toFixed(4)) });
      }
    }
  }
  return moves;
}

// Teeth needing attachments based on their total movement
function computeAttachmentPlacements(
  teethDeltas: TeethDelta[],
  initial: ToothState[],
  totalStages: number,
): Map<number, StageAttachment> {
  const placements = new Map<number, StageAttachment>();
  for (const td of teethDeltas) {
    const rotation = Math.abs((td.deltas['mesialRotDeg'] ?? 0) + (td.deltas['distalRotDeg'] ?? 0));
    const torque   = Math.abs(td.deltas['torqueDeg'] ?? 0);
    if (rotation > 10) {
      placements.set(td.fdi, {
        fdi: td.fdi, action: 'place',
        type: 'Rectangular horizontal attachment',
      });
    } else if (torque > 15) {
      placements.set(td.fdi, {
        fdi: td.fdi, action: 'place',
        type: 'Beveled rectangular attachment',
      });
    }
  }
  return placements;
}

// IPR stage estimation: place IPR points at ~1/3 of the way through treatment
function computeIprPoints(
  teethDeltas: TeethDelta[],
): StageIprPoint[] {
  const UPPER_ADJACENT: [number, number][] = [
    [17,16],[16,15],[15,14],[14,13],[13,12],[12,11],[11,21],[21,22],[22,23],[23,24],[24,25],[25,26],[26,27],
  ];
  const LOWER_ADJACENT: [number, number][] = [
    [47,46],[46,45],[45,44],[44,43],[43,42],[42,41],[41,31],[31,32],[32,33],[33,34],[34,35],[35,36],[36,37],
  ];
  const deltaMap = new Map<number, Partial<Record<keyof ToothState, number>>>(
    teethDeltas.map((td) => [td.fdi, td.deltas]),
  );
  const iprPoints: StageIprPoint[] = [];
  for (const [fdiA, fdiB] of [...UPPER_ADJACENT, ...LOWER_ADJACENT]) {
    const dA = deltaMap.get(fdiA);
    const dB = deltaMap.get(fdiB);
    if (!dA || !dB) continue;
    const crowdingContrib = (dA['mesialMm'] ?? 0) + (dB['distalMm'] ?? 0);
    if (crowdingContrib > 0.1) {
      iprPoints.push({
        mesialTooth: fdiA,
        distalTooth: fdiB,
        reductionMm: parseFloat(Math.min(crowdingContrib * 0.4, 0.5).toFixed(2)),
      });
    }
  }
  return iprPoints;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapStageRow(r: Record<string, unknown>): TreatmentStage {
  return {
    id: r['id'] as string,
    organizationId: r['organization_id'] as string,
    digitalSetupId: r['digital_setup_id'] as string,
    stageNumber: r['stage_number'] as number,
    stageType: r['stage_type'] as string,
    toothPositions: (r['tooth_positions'] as StageTooth[]) ?? [],
    toothMovements: (r['tooth_movements'] as StageMovement[]) ?? [],
    attachments: (r['attachments'] as StageAttachment[]) ?? [],
    iprPoints: (r['ipr_points'] as StageIprPoint[]) ?? [],
    elastics: (r['elastics'] as unknown[]) ?? [],
    notes: r['notes'] as string | null,
    createdAt: r['created_at'] as Date,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TreatmentStagesService {
  private readonly logger = new Logger(TreatmentStagesService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async generateStages(orgId: string, setupId: string): Promise<TreatmentStage[]> {
    // Fetch digital setup
    const { rows: setupRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!setupRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    const setup = setupRows[0];
    if ((setup['status'] as string) !== 'approved') {
      throw new BadRequestException('Digital setup must be approved before generating stages');
    }

    const finalPositions  = (setup['tooth_positions']  as ToothState[]) ?? [];
    const initialPositions = (setup['initial_positions'] as ToothState[]) ?? [];

    // Compute per-tooth deltas
    const teethDeltas = computeDeltas(initialPositions, finalPositions);

    // Determine total active stages needed
    let maxStages = 1;
    for (const td of teethDeltas) {
      const needed = stagesNeededForDelta(td.deltas);
      if (needed > maxStages) maxStages = needed;
    }

    // Compute attachment placements and IPR
    const attachmentMap = computeAttachmentPlacements(teethDeltas, initialPositions, maxStages);
    const iprPoints = computeIprPoints(teethDeltas);

    const initialMap = new Map<number, ToothState>(initialPositions.map((t) => [t.fdi, t]));
    const stageRows: Array<{
      stageNumber: number;
      stageType: string;
      toothPositions: StageTooth[];
      toothMovements: StageMovement[];
      attachments: StageAttachment[];
      iprPoints: StageIprPoint[];
      elastics: unknown[];
      notes: string | null;
    }> = [];

    let prevPositions: StageTooth[] = initialPositions.map((t) => ({
      fdi: t.fdi,
      mesialMm: t.mesialMm, distalMm: t.distalMm,
      buccalMm: t.buccalMm, lingualMm: t.lingualMm,
      intrusionMm: t.intrusionMm, extrusionMm: t.extrusionMm,
      mesialRotDeg: t.mesialRotDeg, distalRotDeg: t.distalRotDeg,
      torqueDeg: t.torqueDeg,
    }));

    // ── Active movement stages ──────────────────────────────────────────────
    for (let s = 1; s <= maxStages; s++) {
      const currPositions: StageTooth[] = teethDeltas.map((td) => {
        const init = initialMap.get(td.fdi);
        if (!init) return prevPositions.find((p) => p.fdi === td.fdi)!;
        return interpolateToothAtStage(init, td.deltas, s, maxStages);
      });

      const movements = computeStageMovements(prevPositions, currPositions);

      // Attachments placed at stage 1 for teeth needing them (before significant movement)
      const stageAttachments: StageAttachment[] = [];
      if (s === 1) {
        for (const [, att] of attachmentMap) {
          stageAttachments.push(att);
        }
      }

      // IPR at stage ~1/3 of total
      const iprStageNum = Math.max(1, Math.round(maxStages / 3));
      const stageIpr: StageIprPoint[] = s === iprStageNum ? iprPoints : [];

      stageRows.push({
        stageNumber: s,
        stageType: 'active',
        toothPositions: currPositions,
        toothMovements: movements,
        attachments: stageAttachments,
        iprPoints: stageIpr,
        elastics: [],
        notes: null,
      });

      prevPositions = currPositions;
    }

    // ── Passive occlusal settling stages (2-4) ──────────────────────────────
    const settlingCount = maxStages > 20 ? 4 : 2;
    const finalPosStageTooth: StageTooth[] = finalPositions.map((t) => ({
      fdi: t.fdi,
      mesialMm: t.mesialMm, distalMm: t.distalMm,
      buccalMm: t.buccalMm, lingualMm: t.lingualMm,
      intrusionMm: t.intrusionMm, extrusionMm: t.extrusionMm,
      mesialRotDeg: t.mesialRotDeg, distalRotDeg: t.distalRotDeg,
      torqueDeg: t.torqueDeg,
    }));

    for (let s = 1; s <= settlingCount; s++) {
      stageRows.push({
        stageNumber: maxStages + s,
        stageType: 'passive_settling',
        toothPositions: finalPosStageTooth,
        toothMovements: [],
        attachments: [],
        iprPoints: [],
        elastics: [],
        notes: 'Occlusal settling — no tooth movement. Maintain wear compliance.',
      });
    }

    // ── Remove attachments at first retention stage ─────────────────────────
    const retentionAttachmentRemoval: StageAttachment[] = [];
    for (const [fdi] of attachmentMap) {
      retentionAttachmentRemoval.push({ fdi, action: 'remove', type: 'All attachments' });
    }

    // ── Retention stages (2) ────────────────────────────────────────────────
    for (let s = 1; s <= 2; s++) {
      const retentionStageNum = maxStages + settlingCount + s;
      stageRows.push({
        stageNumber: retentionStageNum,
        stageType: 'retention',
        toothPositions: finalPosStageTooth,
        toothMovements: [],
        attachments: s === 1 ? retentionAttachmentRemoval : [],
        iprPoints: [],
        elastics: [],
        notes: s === 1
          ? 'Final aligner — begin retainer fabrication. Remove attachments.'
          : 'Retainer delivery. Begin full-time Essix retainer wear.',
      });
    }

    // ── Atomic DELETE + bulk INSERT ────────────────────────────────────────
    const client = await this.pool.connect();
    const insertedStages: TreatmentStage[] = [];
    try {
      await client.query('BEGIN');

      await client.query(
        `DELETE FROM treatment_stages WHERE digital_setup_id = $1 AND organization_id = $2`,
        [setupId, orgId],
      );

      for (const row of stageRows) {
        const { rows: inserted } = await client.query<Record<string, unknown>>(
          `INSERT INTO treatment_stages (
             organization_id, digital_setup_id,
             stage_number, stage_type,
             tooth_positions, tooth_movements,
             attachments, ipr_points, elastics, notes,
             created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
           RETURNING *`,
          [
            orgId, setupId,
            row.stageNumber, row.stageType,
            JSON.stringify(row.toothPositions),
            JSON.stringify(row.toothMovements),
            JSON.stringify(row.attachments),
            JSON.stringify(row.iprPoints),
            JSON.stringify(row.elastics),
            row.notes,
          ],
        );
        insertedStages.push(mapStageRow(inserted[0]!));
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    this.logger.log(
      `Generated ${insertedStages.length} stages for setup ${setupId} ` +
      `(${maxStages} active + ${settlingCount} settling + 2 retention)`,
    );
    return insertedStages;
  }

  async listStages(orgId: string, setupId: string): Promise<TreatmentStage[]> {
    // Verify ownership
    const { rows: ownerRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT id FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!ownerRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM treatment_stages
       WHERE digital_setup_id = $1 AND organization_id = $2
       ORDER BY stage_number ASC`,
      [setupId, orgId],
    );
    return rows.map(mapStageRow);
  }

  async getStage(orgId: string, stageId: string): Promise<TreatmentStage> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM treatment_stages WHERE id = $1 AND organization_id = $2`,
      [stageId, orgId],
    );
    if (!rows[0]) throw new NotFoundException(`Treatment stage ${stageId} not found`);
    return mapStageRow(rows[0]);
  }

  async updateStageNotes(orgId: string, stageId: string, notes: string): Promise<TreatmentStage> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `UPDATE treatment_stages SET notes = $1
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [notes, stageId, orgId],
    );
    if (!rows[0]) throw new NotFoundException(`Treatment stage ${stageId} not found`);
    return mapStageRow(rows[0]);
  }

  // ── Enhanced movement analysis helpers ─────────────────────────────────────

  /**
   * Identifies teeth with complex movements and checks whether adjacent teeth
   * have simultaneous difficult movements (which raises over-correction risk).
   *
   * Complex-movement thresholds:
   *   rotation  > 15°,  torque > 10°,  intrusion > 1.0mm
   *
   * Best called before generateStages to inform staging decisions.
   */
  isolateDifficultMovements(movements: ToothMovement[]): {
    difficultTeeth: number[];
    adjacencyConflicts: Array<{ fdiA: number; fdiB: number; reason: string }>;
    schedulingRecommendations: Array<{ fdi: number; preferEarlyStage: boolean; reason: string }>;
  } {
    const COMPLEX_ROT_DEG  = 15;
    const COMPLEX_TORQ_DEG = 10;
    const COMPLEX_INT_MM   = 1.0;

    const difficultTeeth: number[] = [];
    const schedulingRecommendations: Array<{
      fdi: number; preferEarlyStage: boolean; reason: string;
    }> = [];

    for (const mv of movements) {
      const isDifficult =
        mv.rotationDeg  > COMPLEX_ROT_DEG  ||
        mv.torqueDeg    > COMPLEX_TORQ_DEG ||
        mv.intrusionMm  > COMPLEX_INT_MM;

      if (isDifficult) {
        difficultTeeth.push(mv.fdi);
        const reasons: string[] = [];
        if (mv.rotationDeg  > COMPLEX_ROT_DEG)
          reasons.push(`rotation ${mv.rotationDeg.toFixed(1)}° > ${COMPLEX_ROT_DEG}°`);
        if (mv.torqueDeg    > COMPLEX_TORQ_DEG)
          reasons.push(`torque ${mv.torqueDeg.toFixed(1)}° > ${COMPLEX_TORQ_DEG}°`);
        if (mv.intrusionMm  > COMPLEX_INT_MM)
          reasons.push(`intrusion ${mv.intrusionMm.toFixed(2)}mm > ${COMPLEX_INT_MM}mm`);

        schedulingRecommendations.push({
          fdi: mv.fdi,
          preferEarlyStage: true,
          reason: `Complex movement (${reasons.join('; ')}) — schedule in early stages when anchorage is strongest`,
        });
      }
    }

    // Flag adjacent difficult teeth — simultaneous movement raises over-correction risk
    const difficultSet = new Set(difficultTeeth);
    const adjacencyConflicts: Array<{ fdiA: number; fdiB: number; reason: string }> = [];
    for (const [a, b] of ARCH_ADJACENT_PAIRS) {
      if (difficultSet.has(a) && difficultSet.has(b)) {
        adjacencyConflicts.push({
          fdiA: a, fdiB: b,
          reason:
            `Adjacent teeth ${a} and ${b} both have complex movements — ` +
            `stage them sequentially (offset by ≥1 stage) to reduce over-correction risk`,
        });
      }
    }

    return { difficultTeeth, adjacencyConflicts, schedulingRecommendations };
  }

  /**
   * Produces an optimised movement sequence plan:
   *   1. Anterior teeth move first (easier biomechanics; sets up arch form)
   *   2. Posterior movements follow after anterior space is created
   *   3. Final refinement stages (~10 % of total) for finishing touches
   *   4. Upper/lower arches remain within ±1 stage of each other
   */
  optimizeMovementSequence(movements: ToothMovement[]): StageSequence {
    const isAnterior = (fdi: number): boolean => (fdi % 10) >= 1 && (fdi % 10) <= 3;

    const anteriorMvs  = movements.filter((m) => isAnterior(m.fdi));
    const posteriorMvs = movements.filter((m) => !isAnterior(m.fdi));

    const stagesNeeded = (mv: ToothMovement): number =>
      Math.max(
        mv.translationMm > 0 ? Math.ceil(mv.translationMm / PER_STAGE_LIMITS.translation) : 1,
        mv.rotationDeg   > 0 ? Math.ceil(mv.rotationDeg   / PER_STAGE_LIMITS.rotation)    : 1,
        mv.torqueDeg     > 0 ? Math.ceil(mv.torqueDeg     / PER_STAGE_LIMITS.torque)       : 1,
        mv.tipDeg        > 0 ? Math.ceil(mv.tipDeg        / PER_STAGE_LIMITS.tip)          : 1,
        mv.intrusionMm   > 0 ? Math.ceil(mv.intrusionMm   / PER_STAGE_LIMITS.intrusion)    : 1,
        mv.extrusionMm   > 0 ? Math.ceil(mv.extrusionMm   / PER_STAGE_LIMITS.extrusion)    : 1,
      );

    let anteriorStages = 1;
    for (const mv of anteriorMvs) {
      const n = stagesNeeded(mv);
      if (n > anteriorStages) anteriorStages = n;
    }

    let posteriorStages = 1;
    for (const mv of posteriorMvs) {
      const n = stagesNeeded(mv);
      if (n > posteriorStages) posteriorStages = n;
    }

    // Posterior movements begin at the halfway mark of anterior staging
    const posteriorOffset  = Math.floor(anteriorStages / 2);
    const totalActive      = Math.max(anteriorStages, posteriorOffset + posteriorStages);
    const refinementStages = Math.max(2, Math.floor(totalActive * 0.1));

    const sequencedTeeth: StageSequence['sequencedTeeth'] = [];
    for (const mv of anteriorMvs) {
      sequencedTeeth.push({
        fdi: mv.fdi,
        startStage: 1,
        endStage: Math.min(stagesNeeded(mv), anteriorStages),
        priority: 'anterior',
      });
    }
    for (const mv of posteriorMvs) {
      sequencedTeeth.push({
        fdi: mv.fdi,
        startStage: posteriorOffset + 1,
        endStage: posteriorOffset + Math.min(stagesNeeded(mv), posteriorStages),
        priority: 'posterior',
      });
    }

    return {
      anteriorStages,
      posteriorStages,
      refinementStages,
      totalActiveStages: totalActive,
      sequencedTeeth,
    };
  }

  /**
   * Synchronises upper and lower arch stage counts.
   * The shorter arch is flagged to receive passive fill stages.
   * Stages where the interdigitation difference exceeds 1 stage are flagged
   * as occlusal mismatch warnings.
   *
   * @param upperStages  All stages for the upper arch (any stageType).
   * @param lowerStages  All stages for the lower arch (any stageType).
   */
  coordinateArches(
    upperStages: TreatmentStage[],
    lowerStages: TreatmentStage[],
  ): CoordinatedStagePlan {
    const upperActive = upperStages.filter((s) => s.stageType === 'active').length;
    const lowerActive = lowerStages.filter((s) => s.stageType === 'active').length;
    const totalStages = Math.max(upperActive, lowerActive);
    const diff        = Math.abs(upperActive - lowerActive);

    const paddingRequired: CoordinatedStagePlan['paddingRequired'] =
      upperActive < lowerActive ? 'upper'
      : lowerActive < upperActive ? 'lower'
      : 'none';

    const mismatchWarnings: Array<{ stageNumber: number; description: string }> = [];
    if (diff > 1) {
      // Flag the stage where the shorter arch finishes active movement
      const splitStage = Math.min(upperActive, lowerActive) + 1;
      mismatchWarnings.push({
        stageNumber: splitStage,
        description:
          `Upper arch has ${upperActive} active stages; lower has ${lowerActive}. ` +
          `From stage ${splitStage} onward, ${upperActive < lowerActive ? 'upper' : 'lower'} ` +
          `arch is passive — potential occlusal discordance over ${diff} stages. ` +
          `Consider adding passive fill aligners for the shorter arch.`,
      });
    }

    return {
      upperStageCount: upperActive,
      lowerStageCount: lowerActive,
      totalStages,
      paddingRequired,
      mismatchWarnings,
    };
  }

  async deleteStages(orgId: string, setupId: string): Promise<void> {
    // Verify ownership
    const { rows: ownerRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT id FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!ownerRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    await this.pool.query(
      `DELETE FROM treatment_stages WHERE digital_setup_id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    this.logger.log(`Deleted all stages for setup ${setupId}`);
  }
}
