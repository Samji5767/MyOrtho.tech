import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── FDI utilities ────────────────────────────────────────────────────────────

function archOf(fdi: number): 'upper' | 'lower' {
  return fdi >= 11 && fdi <= 28 ? 'upper' : 'lower';
}

type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar';

function toothTypeOf(fdi: number): ToothType {
  const n = fdi % 10;
  if (n === 1 || n === 2) return 'incisor';
  if (n === 3) return 'canine';
  if (n === 4 || n === 5) return 'premolar';
  return 'molar';
}

// PDL area (mm²) by tooth type — Melsen 2001, approximated
function pdlArea(fdi: number): number {
  switch (toothTypeOf(fdi)) {
    case 'incisor':  return 165;
    case 'canine':   return 240;
    case 'premolar': return 210;
    case 'molar':    return fdi % 10 === 6 ? 445 : 438; // first vs second molar
  }
}

// Anchorage units — Proffit classification
function anchorageUnits(fdi: number): number {
  const n = fdi % 10;
  if (n === 7 || n === 8) return 3; // molars
  if (n === 6)            return 3; // first molar
  if (n === 4 || n === 5) return 2; // premolars
  return 1;                          // canine + incisors
}

// ─── Movement limits (Kravitz, per stage) ────────────────────────────────────

const LIMITS = {
  translation_mm:  0.30,
  rotation_deg:    3.0,
  torque_deg:      3.5,
  tip_deg:         4.0,
  intrusion_mm:    0.40,
  extrusion_mm:    0.75,
  mesiodistal_mm:  0.30,
  expansion_mm:    0.30,
};

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface MovementPrescriptionDto {
  toothNumber: number;
  translationMesialMm?: number;
  translationDistalMm?: number;
  translationBuccalMm?: number;
  translationLingualMm?: number;
  intrusionMm?: number;
  extrusionMm?: number;
  rotationDeg?: number;
  torqueDeg?: number;
  tipMesialDeg?: number;
  tipDistalDeg?: number;
  mesializationMm?: number;
  distalizationMm?: number;
  expansionMm?: number;
  constrictionMm?: number;
  rootMovementMm?: number;
  rootDirection?: { x: number; y: number; z: number };
  notes?: string;
}

export interface MovementPrescription extends Required<MovementPrescriptionDto> {
  id: string;
  planId: string;
  arch: 'upper' | 'lower';
  prescribedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollisionPair {
  fdiA: number;
  fdiB: number;
  overlapMm: number;
}

export interface ConstraintViolation {
  fdi: number;
  movement: string;
  value: number;
  limit: number;
  severity: 'warning' | 'critical';
}

export interface MovementSimulation {
  id: string;
  planId: string;
  totalTeethMoved: number;
  maxSingleMovementMm: number | null;
  estimatedStages: number | null;
  collisionPairs: CollisionPair[];
  constraintViolations: ConstraintViolation[];
  anchorageClass: 'maximum' | 'moderate' | 'minimum' | null;
  anchorageUnitsRequired: number | null;
  anchorageUnitsAvailable: number | null;
  boneRemodelingIndex: number | null;
  simulationDurationMs: number | null;
  simulatedAt: string;
}

export interface PdlResult {
  toothNumber: number;
  stressMpa: number;
  strainPct: number;
  forceN: number;
  momentNcm: number;
  mobilityRisk: 'none' | 'low' | 'moderate' | 'high';
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToPrescrip(r: Record<string, unknown>): MovementPrescription {
  return {
    id:                   r['id'] as string,
    planId:               r['plan_id'] as string,
    toothNumber:          r['tooth_number'] as number,
    arch:                 r['arch'] as 'upper' | 'lower',
    translationMesialMm:  r['translation_mesial_mm'] as number,
    translationDistalMm:  r['translation_distal_mm'] as number,
    translationBuccalMm:  r['translation_buccal_mm'] as number,
    translationLingualMm: r['translation_lingual_mm'] as number,
    intrusionMm:          r['intrusion_mm'] as number,
    extrusionMm:          r['extrusion_mm'] as number,
    rotationDeg:          r['rotation_deg'] as number,
    torqueDeg:            r['torque_deg'] as number,
    tipMesialDeg:         r['tip_mesial_deg'] as number,
    tipDistalDeg:         r['tip_distal_deg'] as number,
    mesializationMm:      r['mesialization_mm'] as number,
    distalizationMm:      r['distalization_mm'] as number,
    expansionMm:          r['expansion_mm'] as number,
    constrictionMm:       r['constriction_mm'] as number,
    rootMovementMm:       r['root_movement_mm'] as number,
    rootDirection:        (r['root_direction'] as { x: number; y: number; z: number }) ?? { x: 0, y: 0, z: 1 },
    notes:                r['notes'] as string,
    prescribedBy:         r['prescribed_by'] as string | null,
    approvedBy:           r['approved_by'] as string | null,
    approvedAt:           r['approved_at'] as string | null,
    createdAt:            r['created_at'] as string,
    updatedAt:            r['updated_at'] as string,
  };
}

function rowToSimulation(r: Record<string, unknown>): MovementSimulation {
  return {
    id:                       r['id'] as string,
    planId:                   r['plan_id'] as string,
    totalTeethMoved:          r['total_teeth_moved'] as number,
    maxSingleMovementMm:      r['max_single_movement_mm'] as number | null,
    estimatedStages:          r['estimated_stages'] as number | null,
    collisionPairs:           (r['collision_pairs'] as CollisionPair[]) ?? [],
    constraintViolations:     (r['constraint_violations'] as ConstraintViolation[]) ?? [],
    anchorageClass:           r['anchorage_class'] as MovementSimulation['anchorageClass'],
    anchorageUnitsRequired:   r['anchorage_units_required'] as number | null,
    anchorageUnitsAvailable:  r['anchorage_units_available'] as number | null,
    boneRemodelingIndex:      r['bone_remodeling_index'] as number | null,
    simulationDurationMs:     r['simulation_duration_ms'] as number | null,
    simulatedAt:              r['simulated_at'] as string,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ToothMovementService {
  private readonly log = new Logger(ToothMovementService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  // ── Prescriptions ──────────────────────────────────────────────────────────

  async upsertPrescription(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
    dto: MovementPrescriptionDto,
  ): Promise<MovementPrescription> {
    await this.verifyPlan(planId, caseId, orgId);
    const fdi = dto.toothNumber;
    const res = await this.db.query(
      `INSERT INTO movement_prescriptions
         (plan_id, tooth_number, arch,
          translation_mesial_mm, translation_distal_mm,
          translation_buccal_mm, translation_lingual_mm,
          intrusion_mm, extrusion_mm,
          rotation_deg, torque_deg, tip_mesial_deg, tip_distal_deg,
          mesialization_mm, distalization_mm, expansion_mm, constriction_mm,
          root_movement_mm, root_direction, notes, prescribed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (plan_id, tooth_number) DO UPDATE SET
         translation_mesial_mm  = EXCLUDED.translation_mesial_mm,
         translation_distal_mm  = EXCLUDED.translation_distal_mm,
         translation_buccal_mm  = EXCLUDED.translation_buccal_mm,
         translation_lingual_mm = EXCLUDED.translation_lingual_mm,
         intrusion_mm           = EXCLUDED.intrusion_mm,
         extrusion_mm           = EXCLUDED.extrusion_mm,
         rotation_deg           = EXCLUDED.rotation_deg,
         torque_deg             = EXCLUDED.torque_deg,
         tip_mesial_deg         = EXCLUDED.tip_mesial_deg,
         tip_distal_deg         = EXCLUDED.tip_distal_deg,
         mesialization_mm       = EXCLUDED.mesialization_mm,
         distalization_mm       = EXCLUDED.distalization_mm,
         expansion_mm           = EXCLUDED.expansion_mm,
         constriction_mm        = EXCLUDED.constriction_mm,
         root_movement_mm       = EXCLUDED.root_movement_mm,
         root_direction         = EXCLUDED.root_direction,
         notes                  = EXCLUDED.notes,
         prescribed_by          = EXCLUDED.prescribed_by,
         updated_at             = now()
       RETURNING *`,
      [
        planId, fdi, archOf(fdi),
        dto.translationMesialMm  ?? 0, dto.translationDistalMm  ?? 0,
        dto.translationBuccalMm  ?? 0, dto.translationLingualMm ?? 0,
        dto.intrusionMm  ?? 0, dto.extrusionMm  ?? 0,
        dto.rotationDeg  ?? 0, dto.torqueDeg    ?? 0,
        dto.tipMesialDeg ?? 0, dto.tipDistalDeg ?? 0,
        dto.mesializationMm ?? 0, dto.distalizationMm ?? 0,
        dto.expansionMm     ?? 0, dto.constrictionMm  ?? 0,
        dto.rootMovementMm  ?? 0,
        JSON.stringify(dto.rootDirection ?? { x: 0, y: 0, z: 1 }),
        dto.notes ?? null,
        userId,
      ],
    );
    return rowToPrescrip(res.rows[0]);
  }

  async listPrescriptions(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<MovementPrescription[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM movement_prescriptions WHERE plan_id=$1 ORDER BY tooth_number`,
      [planId],
    );
    return res.rows.map(rowToPrescrip);
  }

  async deletePrescription(
    caseId: string,
    orgId: string,
    planId: string,
    fdi: number,
  ): Promise<{ deleted: boolean }> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `DELETE FROM movement_prescriptions WHERE plan_id=$1 AND tooth_number=$2`,
      [planId, fdi],
    );
    return { deleted: (res.rowCount ?? 0) > 0 };
  }

  async approvePrescriptions(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
  ): Promise<{ approvedCount: number }> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `UPDATE movement_prescriptions
       SET approved_by=$1, approved_at=now(), updated_at=now()
       WHERE plan_id=$2 AND approved_at IS NULL`,
      [userId, planId],
    );
    return { approvedCount: res.rowCount ?? 0 };
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  async simulate(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
  ): Promise<MovementSimulation> {
    const startMs = Date.now();
    await this.verifyPlan(planId, caseId, orgId);

    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);
    if (prescriptions.length === 0) {
      throw new NotFoundException('No movement prescriptions found for this plan');
    }

    const violations = this.detectViolations(prescriptions);
    const collisions = this.detectCollisions(prescriptions);
    const anchorage  = this.computeAnchorage(prescriptions);
    const maxMove    = this.computeMaxMovement(prescriptions);
    const stages     = this.estimateStages(prescriptions);
    const bri        = this.boneRemodelingIndex(prescriptions, stages);

    const durationMs = Date.now() - startMs;

    // Delete old PDL results for this plan then regenerate
    await this.db.query(`DELETE FROM pdl_simulation_results WHERE plan_id=$1`, [planId]);
    await this.generatePdlResults(planId, prescriptions, stages);

    const res = await this.db.query(
      `INSERT INTO movement_simulations
         (plan_id, organization_id, total_teeth_moved, max_single_movement_mm,
          estimated_stages, collision_pairs, constraint_violations,
          anchorage_class, anchorage_units_required, anchorage_units_available,
          bone_remodeling_index, simulation_duration_ms, simulated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (plan_id) DO UPDATE SET
         total_teeth_moved         = EXCLUDED.total_teeth_moved,
         max_single_movement_mm    = EXCLUDED.max_single_movement_mm,
         estimated_stages          = EXCLUDED.estimated_stages,
         collision_pairs           = EXCLUDED.collision_pairs,
         constraint_violations     = EXCLUDED.constraint_violations,
         anchorage_class           = EXCLUDED.anchorage_class,
         anchorage_units_required  = EXCLUDED.anchorage_units_required,
         anchorage_units_available = EXCLUDED.anchorage_units_available,
         bone_remodeling_index     = EXCLUDED.bone_remodeling_index,
         simulation_duration_ms    = EXCLUDED.simulation_duration_ms,
         simulated_by              = EXCLUDED.simulated_by,
         simulated_at              = now()
       RETURNING *`,
      [
        planId, orgId,
        prescriptions.length,
        maxMove,
        stages,
        JSON.stringify(collisions),
        JSON.stringify(violations),
        anchorage.class,
        anchorage.required,
        anchorage.available,
        bri,
        durationMs,
        userId,
      ],
    );

    this.log.log(`Phase 26 simulation: plan ${planId} — ${prescriptions.length} teeth, ${stages} stages, ${durationMs}ms`);
    return rowToSimulation(res.rows[0]);
  }

  async getSimulation(caseId: string, orgId: string, planId: string): Promise<MovementSimulation> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM movement_simulations WHERE plan_id=$1`,
      [planId],
    );
    if (res.rowCount === 0) throw new NotFoundException('No simulation found — run /simulate first');
    return rowToSimulation(res.rows[0]);
  }

  async getPdlResults(
    caseId: string,
    orgId: string,
    planId: string,
    stageNum: number,
  ): Promise<PdlResult[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM pdl_simulation_results WHERE plan_id=$1 AND stage_num=$2 ORDER BY tooth_number`,
      [planId, stageNum],
    );
    return res.rows.map(r => ({
      toothNumber:  r['tooth_number'] as number,
      stressMpa:    r['stress_mpa'] as number,
      strainPct:    r['strain_pct'] as number,
      forceN:       r['force_n'] as number,
      momentNcm:    r['moment_ncm'] as number,
      mobilityRisk: r['mobility_risk'] as PdlResult['mobilityRisk'],
    }));
  }

  async getConstraintViolations(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<{ violations: ConstraintViolation[]; stagesNeeded: number }> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);
    const violations = this.detectViolations(prescriptions);
    const stages = this.estimateStages(prescriptions);
    return { violations, stagesNeeded: stages };
  }

  // ── Biomechanics engines ──────────────────────────────────────────────────

  private detectViolations(prescriptions: MovementPrescription[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const p of prescriptions) {
      const checks: Array<{ movement: string; value: number; limit: number }> = [
        { movement: 'translation_mesial',  value: p.translationMesialMm,  limit: LIMITS.translation_mm },
        { movement: 'translation_distal',  value: p.translationDistalMm,  limit: LIMITS.translation_mm },
        { movement: 'translation_buccal',  value: p.translationBuccalMm,  limit: LIMITS.translation_mm },
        { movement: 'translation_lingual', value: p.translationLingualMm, limit: LIMITS.translation_mm },
        { movement: 'intrusion',           value: p.intrusionMm,           limit: LIMITS.intrusion_mm  },
        { movement: 'extrusion',           value: p.extrusionMm,           limit: LIMITS.extrusion_mm  },
        { movement: 'rotation',            value: Math.abs(p.rotationDeg),  limit: LIMITS.rotation_deg  },
        { movement: 'torque',              value: Math.abs(p.torqueDeg),    limit: LIMITS.torque_deg    },
        { movement: 'tip_mesial',          value: Math.abs(p.tipMesialDeg), limit: LIMITS.tip_deg       },
        { movement: 'tip_distal',          value: Math.abs(p.tipDistalDeg), limit: LIMITS.tip_deg       },
        { movement: 'mesialization',       value: p.mesializationMm,        limit: LIMITS.mesiodistal_mm },
        { movement: 'distalization',       value: p.distalizationMm,        limit: LIMITS.mesiodistal_mm },
        { movement: 'expansion',           value: p.expansionMm,            limit: LIMITS.expansion_mm   },
        { movement: 'constriction',        value: p.constrictionMm,         limit: LIMITS.expansion_mm   },
      ];

      for (const c of checks) {
        if (c.value > c.limit) {
          violations.push({
            fdi:      p.toothNumber,
            movement: c.movement,
            value:    c.value,
            limit:    c.limit,
            severity: c.value > c.limit * 2 ? 'critical' : 'warning',
          });
        }
      }
    }

    return violations;
  }

  private detectCollisions(prescriptions: MovementPrescription[]): CollisionPair[] {
    // Proxy: adjacent teeth with large opposing translations are at collision risk
    const pairs: CollisionPair[] = [];
    const byFdi = new Map(prescriptions.map(p => [p.toothNumber, p]));

    const ADJACENT: [number, number][] = [
      [11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],
      [21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],
      [31,32],[32,33],[33,34],[34,35],[35,36],[36,37],[37,38],
      [41,42],[42,43],[43,44],[44,45],[45,46],[46,47],[47,48],
    ];

    for (const [a, b] of ADJACENT) {
      const pA = byFdi.get(a);
      const pB = byFdi.get(b);
      if (!pA || !pB) continue;

      // Teeth moving toward each other: A mesial + B distal, or A buccal + B lingual
      const mesialConflict = pA.translationMesialMm + pB.translationDistalMm;
      const distalConflict = pA.translationDistalMm + pB.translationMesialMm;
      const worstConflict = Math.max(mesialConflict, distalConflict);

      if (worstConflict > 0.40) {
        pairs.push({ fdiA: a, fdiB: b, overlapMm: parseFloat(worstConflict.toFixed(2)) });
      }
    }

    return pairs;
  }

  private computeAnchorage(prescriptions: MovementPrescription[]): {
    class: 'maximum' | 'moderate' | 'minimum';
    required: number;
    available: number;
  } {
    // Moving teeth contribute required units; non-moving posterior teeth are anchors
    const moving = new Set(prescriptions.map(p => p.toothNumber));
    const ALL_FDI = [
      11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,
      31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,
    ];

    let required = 0;
    let available = 0;

    for (const fdi of ALL_FDI) {
      const units = anchorageUnits(fdi);
      if (moving.has(fdi)) {
        required += units;
      } else {
        available += units;
      }
    }

    const ratio = required / Math.max(required + available, 1);
    const cls: 'maximum' | 'moderate' | 'minimum' =
      ratio > 0.75 ? 'maximum' :
      ratio > 0.50 ? 'moderate' :
      'minimum';

    return { class: cls, required, available };
  }

  private computeMaxMovement(prescriptions: MovementPrescription[]): number {
    let max = 0;
    for (const p of prescriptions) {
      const vals = [
        p.translationMesialMm, p.translationDistalMm,
        p.translationBuccalMm, p.translationLingualMm,
        p.intrusionMm, p.extrusionMm,
        p.mesializationMm, p.distalizationMm,
        p.expansionMm, p.constrictionMm,
        p.rootMovementMm,
        // Angular movements scaled to mm equivalent (1° ≈ 0.12mm at 7mm crown height)
        Math.abs(p.rotationDeg)  * 0.12,
        Math.abs(p.torqueDeg)    * 0.12,
        Math.abs(p.tipMesialDeg) * 0.12,
        Math.abs(p.tipDistalDeg) * 0.12,
      ];
      max = Math.max(max, ...vals);
    }
    return parseFloat(max.toFixed(3));
  }

  private estimateStages(prescriptions: MovementPrescription[]): number {
    // Stages = max(totalMovement / perStageLimit) rounded up, minimum 10
    let maxStages = 0;
    for (const p of prescriptions) {
      const requirements = [
        (p.translationMesialMm  + p.translationDistalMm)  / LIMITS.translation_mm,
        (p.translationBuccalMm  + p.translationLingualMm) / LIMITS.translation_mm,
        p.intrusionMm  / LIMITS.intrusion_mm,
        p.extrusionMm  / LIMITS.extrusion_mm,
        Math.abs(p.rotationDeg)  / LIMITS.rotation_deg,
        Math.abs(p.torqueDeg)    / LIMITS.torque_deg,
        Math.abs(p.tipMesialDeg) / LIMITS.tip_deg,
        Math.abs(p.tipDistalDeg) / LIMITS.tip_deg,
        p.mesializationMm / LIMITS.mesiodistal_mm,
        p.distalizationMm / LIMITS.mesiodistal_mm,
        p.expansionMm     / LIMITS.expansion_mm,
        p.constrictionMm  / LIMITS.expansion_mm,
      ];
      maxStages = Math.max(maxStages, ...requirements);
    }
    return Math.max(10, Math.ceil(maxStages));
  }

  private boneRemodelingIndex(prescriptions: MovementPrescription[], stages: number): number {
    // BRI = totalMovementMm / (1mm/month * stageDurationWeeks/4)
    // Assume 2-week aligner cycle → stages * 2 weeks / 4 = stages/2 months
    const totalMovement = prescriptions.reduce((sum, p) => {
      return sum + p.translationMesialMm + p.translationDistalMm +
        p.translationBuccalMm + p.translationLingualMm +
        p.intrusionMm + p.extrusionMm + p.mesializationMm +
        p.distalizationMm + p.expansionMm + p.constrictionMm;
    }, 0);
    const treatmentMonths = stages / 2;
    const boneCapacityMm = treatmentMonths * 1.0 * prescriptions.length;
    return parseFloat((totalMovement / Math.max(boneCapacityMm, 1)).toFixed(3));
  }

  // ── PDL simulation ─────────────────────────────────────────────────────────

  private async generatePdlResults(
    planId: string,
    prescriptions: MovementPrescription[],
    stages: number,
  ): Promise<void> {
    // Compute per-tooth per-stage PDL stress
    // Force is interpolated linearly across stages; stress = force / PDL_area
    for (const p of prescriptions) {
      const area = pdlArea(p.toothNumber);
      const totalTranslation = p.translationMesialMm + p.translationDistalMm +
        p.translationBuccalMm + p.translationLingualMm +
        p.intrusionMm + p.extrusionMm;

      // Force per stage (grams-force): 50–150g for translation, scaled by distance
      const forcePerStageG = 50 + Math.min(totalTranslation / (LIMITS.translation_mm * stages), 1) * 100;
      const forceN = forcePerStageG * 0.00981; // gf to N

      // Moment from rotation/torque (g·mm → N·cm)
      const totalAngular = Math.abs(p.rotationDeg) + Math.abs(p.torqueDeg) +
        Math.abs(p.tipMesialDeg) + Math.abs(p.tipDistalDeg);
      const momentNcm = (totalAngular / stages) * 0.5 * 0.0981; // scaled

      const stressMpa = forceN / area; // Pa → MPa via 1e-6 → but area in mm² gives MPa directly
      const strainPct = Math.min(stressMpa * 5, 25); // empirical: 5% strain per MPa, capped at 25%

      const mobilityRisk: PdlResult['mobilityRisk'] =
        stressMpa > 0.015 ? 'high' :
        stressMpa > 0.010 ? 'moderate' :
        stressMpa > 0.005 ? 'low' : 'none';

      // Only store every 5th stage to limit rows; stages 1 and final always stored
      const stagesToStore = new Set([1, stages]);
      for (let s = 5; s < stages; s += 5) stagesToStore.add(s);

      for (const stageNum of stagesToStore) {
        // Stress decreases linearly as the tooth approaches its target
        const stageProgress = stageNum / stages;
        const stageStress = stressMpa * (1 - stageProgress * 0.3); // taper by 30% at end

        await this.db.query(
          `INSERT INTO pdl_simulation_results
             (plan_id, stage_num, tooth_number, stress_mpa, strain_pct, force_n, moment_ncm, mobility_risk)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (plan_id, stage_num, tooth_number) DO UPDATE SET
             stress_mpa=EXCLUDED.stress_mpa, strain_pct=EXCLUDED.strain_pct,
             force_n=EXCLUDED.force_n, moment_ncm=EXCLUDED.moment_ncm,
             mobility_risk=EXCLUDED.mobility_risk`,
          [
            planId, stageNum, p.toothNumber,
            parseFloat(stageStress.toFixed(6)),
            parseFloat(strainPct.toFixed(2)),
            parseFloat(forceN.toFixed(4)),
            parseFloat(momentNcm.toFixed(4)),
            mobilityRisk,
          ],
        );
      }
    }
  }

  // ── Plan ownership guard ───────────────────────────────────────────────────

  private async verifyPlan(planId: string, caseId: string, orgId: string): Promise<void> {
    const res = await this.db.query(
      `SELECT tp.id FROM treatment_plans tp
       JOIN cases c ON c.id = tp.case_id
       WHERE tp.id=$1 AND tp.case_id=$2 AND c.organization_id=$3`,
      [planId, caseId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Treatment plan not found');
  }
}
