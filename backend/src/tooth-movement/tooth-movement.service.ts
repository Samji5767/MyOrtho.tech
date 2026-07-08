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

// Per-course (total treatment) safe movement limits — Kravitz/Proffit evidence-based
const SAFE_MOVEMENT_LIMITS = {
  translation:   { safe: 2.0,  warn: 3.0,  max: 4.0  }, // mm per course
  rotation:      { safe: 20.0, warn: 35.0, max: 50.0  }, // degrees
  torque:        { safe: 10.0, warn: 20.0, max: 30.0  }, // degrees
  tip:           { safe: 10.0, warn: 20.0, max: 30.0  }, // degrees
  intrusion:     { safe: 1.0,  warn: 2.0,  max: 3.0   }, // mm
  extrusion:     { safe: 1.5,  warn: 2.5,  max: 3.5   }, // mm
  expansion:     { safe: 3.0,  warn: 5.0,  max: 7.0   }, // mm per arch
  distalization: { safe: 3.0,  warn: 5.0,  max: 7.0   }, // mm
} as const;

// Crown width mesio-distal (mm) — for rotation-adjusted collision clearance
const CROWN_WIDTH_MD: Record<number, number> = {
  11: 8.5, 12: 6.8, 13: 7.5, 14: 7.0, 15: 7.0, 16: 10.2, 17: 9.9, 18: 9.0,
  21: 8.5, 22: 6.8, 23: 7.5, 24: 7.0, 25: 7.0, 26: 10.2, 27: 9.9, 28: 9.0,
  31: 5.4, 32: 6.0, 33: 6.8, 34: 7.0, 35: 7.0, 36: 10.9, 37: 10.4, 38: 9.8,
  41: 5.4, 42: 6.0, 43: 6.8, 44: 7.0, 45: 7.0, 46: 10.9, 47: 10.4, 48: 9.8,
};

// Average root lengths (mm) by FDI — used for apical displacement estimation
const ROOT_LENGTH: Record<number, number> = {
  11: 13.0, 12: 13.0, 13: 17.0, 14: 14.0, 15: 14.0, 16: 14.0, 17: 13.0, 18: 12.0,
  21: 13.0, 22: 13.0, 23: 17.0, 24: 14.0, 25: 14.0, 26: 14.0, 27: 13.0, 28: 12.0,
  31: 12.5, 32: 13.0, 33: 16.0, 34: 14.0, 35: 14.0, 36: 14.0, 37: 13.0, 38: 12.0,
  41: 12.5, 42: 13.0, 43: 16.0, 44: 14.0, 45: 14.0, 46: 14.0, 47: 13.0, 48: 12.0,
};

// Primary occlusal antagonist contacts — for inter-arch conflict detection
const ANTAGONISTS: [number, number][] = [
  [11, 41], [11, 42], [12, 41], [21, 31], [21, 32], [22, 31],
  [13, 43], [23, 33],
  [14, 44], [15, 45], [24, 34], [25, 35],
  [16, 46], [17, 47], [26, 36], [27, 37],
];

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

// ─── Clinical Analysis Interfaces ────────────────────────────────────────────

export interface EnhancedCollisionPair {
  fdiA: number;
  fdiB: number;
  rawConvergenceMm: number;
  rotationContributionMm: number;
  totalEstimatedOverlapMm: number;
  clearanceThresholdMm: number;
  severity: 'contact_risk' | 'mild_overlap' | 'significant_overlap';
  recommendation: string;
}

export interface RootSafetyResult {
  fdi: number;
  rootMovementMm: number;
  totalAngularMovementDeg: number;
  estimatedApicalDisplacementMm: number;
  corticalRisk: 'safe' | 'caution' | 'critical';
  riskFactors: string[];
  recommendation: string | null;
}

export interface DifficultyScoreBreakdown {
  score: number;
  level: 'simple' | 'moderate' | 'complex' | 'very_complex';
  totalTeethMoved: number;
  estimatedStages: number;
  anchorageClass: string;
  boneRemodelingIndex: number;
  criticalViolations: number;
  warningViolations: number;
  collisionPairs: number;
  scoreComponents: {
    volumeScore: number;
    movementTypeScore: number;
    biomechanicsScore: number;
    anchorageScore: number;
  };
}

export interface ToothForceData {
  fdi: number;
  arch: 'upper' | 'lower';
  forceGrams: number;
  normalizedForce: number;
  dominantMovement: string;
  mobilityRisk: 'none' | 'low' | 'moderate' | 'high';
  stressMpa: number | null;
}

export interface MovementConflict {
  type: 'intra_tooth' | 'inter_arch' | 'anchorage' | 'staging';
  fdi?: number;
  fdiA?: number;
  fdiB?: number;
  description: string;
  severity: 'advisory' | 'warning' | 'critical';
  suggestion: string;
}

export interface OvercorrectionSuggestion {
  fdi: number;
  movement: string;
  prescribedValue: number;
  suggestedCorrectedValue: number;
  overcorrectionFactor: number;
  rationale: string;
}

export interface RefinementRecommendation {
  refinementLikelyNeeded: boolean;
  estimatedRefinementProbability: number;
  rationale: string[];
  expectedUnderexpressions: Array<{
    fdi: number;
    movement: string;
    underexpressionPct: number;
    notes: string;
  }>;
  recommendedApproach: string;
}

export interface ApprovalValidation {
  canApprove: boolean;
  score: number;
  blockers: Array<{ code: string; description: string; affectedTeeth?: number[] }>;
  warnings: Array<{ code: string; description: string; affectedTeeth?: number[] }>;
  summary: string;
}

// ─── Enhanced Movement Engine Interfaces ─────────────────────────────────────

/** Alias for MovementPrescription used in new validation APIs */
export type ToothMovement = MovementPrescription;

export interface ImpossibleMovement {
  fdi: number;
  type: 'anatomical_limit' | 'conflicting_movements' | 'arch_length_violation' | 'extraction_space_conflict';
  description: string;
  severity: 'warning' | 'critical';
  affectedAxis: string;
  prescribedValue: number;
  anatomicalMax: number;
}

export interface CollisionV2 {
  fdiA: number;
  fdiB: number;
  overlapMm: number;
  severity: 'none' | 'minimal' | 'moderate' | 'severe';
  firstAppearanceStage: number;
  recommendedCorrections: string[];
}

export interface CollisionV2Report {
  collisions: CollisionV2[];
  summary: string;
  attachmentConflicts: Array<{ fdi: number; adjacentFdi: number; description: string }>;
}

export interface RootSafetyAssessment {
  overallRisk: 'low' | 'moderate' | 'high' | 'critical';
  perToothRisk: Record<number, {
    fdiNumber: number;
    apicalDisplacementEstMm: number;
    corticalProximityEstMm: number;
    maxSafeTorqueDeg: number;
    maxSafeIntrusionMm: number;
    riskLevel: 'low' | 'moderate' | 'high' | 'critical';
    clinicalExplanation: string;
    colorCode: 'green' | 'yellow' | 'orange' | 'red';
  }>;
  highRiskTeeth: number[];
  clinicalSummary: string;
  confidence: 'low' | 'moderate' | 'high';
  disclaimer: string;
}

export interface RefinementEstimate {
  probability: number; // 0.0–1.0
  confidenceLevel: 'low' | 'moderate' | 'high';
  primaryRiskFactors: string[];
  expectedAdditionalAligners: number;
  treatmentSuccessProbability: number;
  explanation: string;
  disclaimer: string;
}

export interface AnchorageAnalysisEnhanced {
  class: 'maximum' | 'moderate' | 'minimum';
  unitCount: number;
  demandEstimate: number;
  deficit: number;
  anchorageProtectionStrategy: string;
  riskOfAnchorageLoss: 'low' | 'moderate' | 'high';
  required: number;
  available: number;
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

// ─── Root safety helpers ──────────────────────────────────────────────────────

function buildRootSafetyExplanation(
  fdi: number,
  riskLevel: 'low' | 'moderate' | 'high' | 'critical',
  apicalDisp: number,
  torque: number,
): string {
  const type = toothTypeOf(fdi);
  switch (riskLevel) {
    case 'critical':
      return (
        `Tooth ${fdi} (${type}) has ${apicalDisp.toFixed(1)}mm estimated apical displacement — ` +
        `exceeds safe cortical proximity threshold. Recommend CBCT evaluation before proceeding.`
      );
    case 'high':
      return (
        `Tooth ${fdi} (${type}) has ${apicalDisp.toFixed(1)}mm estimated apical displacement ` +
        `with ${torque.toFixed(1)}° torque — monitor root position at mid-treatment scan.`
      );
    case 'moderate':
      return (
        `Tooth ${fdi} (${type}): root movement is within caution range (${apicalDisp.toFixed(1)}mm apical). ` +
        `Ensure attachment plan provides adequate root control.`
      );
    default:
      return `Tooth ${fdi} (${type}): root displacement (${apicalDisp.toFixed(1)}mm) within safe limits.`;
  }
}

/** Estimated remaining cortical clearance in mm (negative = cortical violation) */
function corticalProximityEstMm(fdi: number, apicalDisp: number): number {
  const safeApicalClearance = toothTypeOf(fdi) === 'incisor' ? 1.5 : 2.0;
  return parseFloat((safeApicalClearance - apicalDisp).toFixed(2));
}

function maxSafeTorqueForTooth(fdi: number): number {
  switch (toothTypeOf(fdi)) {
    case 'incisor':  return 10;
    case 'canine':   return 12;
    case 'premolar': return 14;
    case 'molar':    return 8; // multi-rooted; less torque leverage
  }
}

function maxSafeIntrusionForTooth(fdi: number): number {
  switch (toothTypeOf(fdi)) {
    case 'incisor':  return 2.0;
    case 'canine':   return 1.5;
    case 'premolar': return 1.5;
    case 'molar':    return 1.0; // PDL fibers resist intrusion most for multi-rooted teeth
  }
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

  // ── Clinical Analysis ─────────────────────────────────────────────────────

  // Feature 1: Smart collision detection with rotation-adjusted clearance
  async getEnhancedCollisions(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<{ collisions: EnhancedCollisionPair[]; summary: string }> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);
    const byFdi = new Map(prescriptions.map((p) => [p.toothNumber, p]));

    const ADJACENT: [number, number][] = [
      [11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],
      [21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],
      [31,32],[32,33],[33,34],[34,35],[35,36],[36,37],[37,38],
      [41,42],[42,43],[43,44],[44,45],[45,46],[46,47],[47,48],
    ];

    const collisions: EnhancedCollisionPair[] = [];
    for (const [a, b] of ADJACENT) {
      const pA = byFdi.get(a);
      const pB = byFdi.get(b);
      if (!pA || !pB) continue;

      const mesialConflict = pA.translationMesialMm + pB.translationDistalMm;
      const distalConflict = pA.translationDistalMm + pB.translationMesialMm;
      const rawConvergence = Math.max(mesialConflict, distalConflict, 0);

      // Rotating tooth expands its effective mesiodistal footprint at the contact point
      const rotContrib = Math.abs(pA.rotationDeg) * 0.035 + Math.abs(pB.rotationDeg) * 0.035;
      const totalOverlap = rawConvergence + rotContrib;

      const crownWidth = CROWN_WIDTH_MD[a] ?? 7.0;
      const clearanceThreshold = crownWidth * 0.05; // 5% of crown width is minimum biologic clearance

      if (totalOverlap < clearanceThreshold && rawConvergence <= 0.05) continue;

      const severity: EnhancedCollisionPair['severity'] =
        totalOverlap >= 0.30 ? 'significant_overlap' :
        totalOverlap >= 0.10 ? 'mild_overlap' :
        'contact_risk';

      const recommendation =
        severity === 'significant_overlap'
          ? `IPR of ${(totalOverlap * 0.8).toFixed(2)}mm at ${a}-${b} contact, or stage these teeth sequentially`
          : severity === 'mild_overlap'
          ? `Consider 0.1–0.2mm IPR at ${a}-${b} contact`
          : `Monitor ${a}-${b} contact; consider staging overlap to avoid interproximal binding`;

      collisions.push({
        fdiA: a, fdiB: b,
        rawConvergenceMm: parseFloat(rawConvergence.toFixed(3)),
        rotationContributionMm: parseFloat(rotContrib.toFixed(3)),
        totalEstimatedOverlapMm: parseFloat(totalOverlap.toFixed(3)),
        clearanceThresholdMm: parseFloat(clearanceThreshold.toFixed(3)),
        severity,
        recommendation,
      });
    }

    const significant = collisions.filter((c) => c.severity === 'significant_overlap').length;
    const summary = collisions.length === 0
      ? 'No inter-tooth collision risk detected'
      : `${collisions.length} contact risk(s) detected (${significant} significant)`;

    return { collisions, summary };
  }

  // Feature 2: Root movement safety visualization
  async getRootSafetyAnalysis(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<{ results: RootSafetyResult[]; criticalCount: number; cautionCount: number }> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);

    const results: RootSafetyResult[] = prescriptions
      .map((p) => {
        const rootLen = ROOT_LENGTH[p.toothNumber] ?? 14.0;
        const totalAngular = Math.abs(p.torqueDeg) + Math.abs(p.tipMesialDeg) + Math.abs(p.tipDistalDeg);

        // Arc displacement at root apex from angular movement
        const angularApicalMm = Math.sin(totalAngular * Math.PI / 180) * rootLen;
        const totalApicalMm = angularApicalMm + Math.abs(p.rootMovementMm ?? 0);

        const riskFactors: string[] = [];
        if (Math.abs(p.torqueDeg) > 5)   riskFactors.push(`Torque ${p.torqueDeg.toFixed(1)}°`);
        if (Math.abs(p.tipMesialDeg) > 3) riskFactors.push(`Mesial tip ${p.tipMesialDeg.toFixed(1)}°`);
        if (Math.abs(p.tipDistalDeg) > 3) riskFactors.push(`Distal tip ${p.tipDistalDeg.toFixed(1)}°`);
        if ((p.rootMovementMm ?? 0) > 0.5) riskFactors.push(`Root translation ${p.rootMovementMm.toFixed(2)}mm`);

        const corticalRisk: RootSafetyResult['corticalRisk'] =
          totalApicalMm >= 4.0 ? 'critical' :
          totalApicalMm >= 2.0 ? 'caution' :
          'safe';

        const recommendation =
          corticalRisk === 'critical'
            ? `Reduce angular movement on FDI ${p.toothNumber} or add root-control attachment — cortical plate contact risk`
            : corticalRisk === 'caution'
            ? `Consider CBCT evaluation for FDI ${p.toothNumber}; root apex may approach cortical boundary`
            : null;

        return {
          fdi: p.toothNumber,
          rootMovementMm: p.rootMovementMm ?? 0,
          totalAngularMovementDeg: parseFloat(totalAngular.toFixed(2)),
          estimatedApicalDisplacementMm: parseFloat(totalApicalMm.toFixed(3)),
          corticalRisk,
          riskFactors,
          recommendation,
        };
      })
      .filter((r) => r.riskFactors.length > 0 || r.rootMovementMm > 0);

    return {
      results,
      criticalCount: results.filter((r) => r.corticalRisk === 'critical').length,
      cautionCount:  results.filter((r) => r.corticalRisk === 'caution').length,
    };
  }

  // Feature 5: Real-time treatment difficulty score
  async getDifficultyScore(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<DifficultyScoreBreakdown> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);
    if (!prescriptions.length) {
      return {
        score: 0, level: 'simple', totalTeethMoved: 0, estimatedStages: 0,
        anchorageClass: 'minimum', boneRemodelingIndex: 0,
        criticalViolations: 0, warningViolations: 0, collisionPairs: 0,
        scoreComponents: { volumeScore: 0, movementTypeScore: 0, biomechanicsScore: 0, anchorageScore: 0 },
      };
    }

    const violations = this.detectViolations(prescriptions);
    const collisions  = this.detectCollisions(prescriptions);
    const anchorage   = this.computeAnchorage(prescriptions);
    const stages      = this.estimateStages(prescriptions);
    const bri         = this.boneRemodelingIndex(prescriptions, stages);

    const criticalViolations = violations.filter((v) => v.severity === 'critical').length;
    const warningViolations  = violations.filter((v) => v.severity === 'warning').length;

    // Score component 1: how many teeth are moving (max 25 pts)
    const volumeScore = Math.min(25, Math.round((prescriptions.length / 28) * 25));

    // Score component 2: movement type diversity (max 25 pts)
    const activeTypes = new Set<string>();
    for (const p of prescriptions) {
      if (p.translationMesialMm > 0.05 || p.translationDistalMm > 0.05) activeTypes.add('mesiodistal');
      if (p.translationBuccalMm > 0.05 || p.translationLingualMm > 0.05) activeTypes.add('buccolingual');
      if (Math.abs(p.rotationDeg) > 2)  activeTypes.add('rotation');
      if (Math.abs(p.torqueDeg)   > 2)  activeTypes.add('torque');
      if (Math.abs(p.tipMesialDeg) > 1 || Math.abs(p.tipDistalDeg) > 1) activeTypes.add('tip');
      if (p.intrusionMm > 0.1)   activeTypes.add('intrusion');
      if (p.extrusionMm > 0.1)   activeTypes.add('extrusion');
      if (p.mesializationMm > 0.1 || p.distalizationMm > 0.1) activeTypes.add('bodily');
      if (p.expansionMm > 0.1 || p.constrictionMm > 0.1)      activeTypes.add('arch_form');
      if ((p.rootMovementMm ?? 0) > 0.1) activeTypes.add('root_movement');
    }
    const movementTypeScore = Math.min(25, activeTypes.size * 3);

    // Score component 3: biomechanical complexity (max 25 pts)
    const biomechanicsScore = Math.min(25,
      criticalViolations * 5 + warningViolations * 2 + collisions.length * 4);

    // Score component 4: anchorage class (max 25 pts)
    const anchorageScore =
      anchorage.class === 'maximum' ? 25 :
      anchorage.class === 'moderate' ? 13 :
      0;

    const score = Math.min(100, volumeScore + movementTypeScore + biomechanicsScore + anchorageScore);
    const level: DifficultyScoreBreakdown['level'] =
      score >= 76 ? 'very_complex' :
      score >= 51 ? 'complex' :
      score >= 26 ? 'moderate' :
      'simple';

    return {
      score, level,
      totalTeethMoved: prescriptions.length,
      estimatedStages: stages,
      anchorageClass: anchorage.class,
      boneRemodelingIndex: bri,
      criticalViolations, warningViolations,
      collisionPairs: collisions.length,
      scoreComponents: { volumeScore, movementTypeScore, biomechanicsScore, anchorageScore },
    };
  }

  // Feature 6: Force distribution heatmap
  async getForceHeatmap(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<{ teeth: ToothForceData[]; maxForceGrams: number; highLoadTeeth: number[] }> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);

    // Use stage-1 PDL results when available (richer biomechanical data)
    const { rows: pdlRows } = await this.db.query(
      `SELECT tooth_number, stress_mpa, force_n, mobility_risk
       FROM pdl_simulation_results WHERE plan_id = $1 AND stage_num = 1 ORDER BY tooth_number`,
      [planId],
    );
    const pdlByFdi = new Map(
      pdlRows.map((r) => [r['tooth_number'] as number, r as Record<string, unknown>]),
    );

    const teeth: ToothForceData[] = prescriptions.map((p) => {
      const pdl = pdlByFdi.get(p.toothNumber);

      const movements = [
        { name: 'translation', value: p.translationMesialMm + p.translationDistalMm + p.translationBuccalMm + p.translationLingualMm },
        { name: 'rotation',    value: Math.abs(p.rotationDeg) * 0.12 },
        { name: 'torque',      value: Math.abs(p.torqueDeg)   * 0.12 },
        { name: 'intrusion',   value: p.intrusionMm },
        { name: 'extrusion',   value: p.extrusionMm },
      ];
      const dominant = movements.reduce((a, b) => (a.value >= b.value ? a : b));

      let forceGrams: number;
      let mobilityRisk: ToothForceData['mobilityRisk'] = 'none';
      let stressMpa: number | null = null;

      if (pdl) {
        forceGrams = Math.round((pdl['force_n'] as number) / 0.00981);
        mobilityRisk = pdl['mobility_risk'] as ToothForceData['mobilityRisk'];
        stressMpa = pdl['stress_mpa'] as number;
      } else {
        const totalTranslation = p.translationMesialMm + p.translationDistalMm +
          p.translationBuccalMm + p.translationLingualMm + p.intrusionMm + p.extrusionMm;
        const totalAngular = Math.abs(p.rotationDeg) + Math.abs(p.torqueDeg) +
          Math.abs(p.tipMesialDeg) + Math.abs(p.tipDistalDeg);
        forceGrams = Math.round(totalTranslation * 200 + totalAngular * 20);
        const stressProxy = (forceGrams * 0.00981) / pdlArea(p.toothNumber);
        mobilityRisk = stressProxy > 0.015 ? 'high' : stressProxy > 0.010 ? 'moderate' : stressProxy > 0.005 ? 'low' : 'none';
      }

      return {
        fdi: p.toothNumber,
        arch: archOf(p.toothNumber),
        forceGrams,
        normalizedForce: 0,
        dominantMovement: dominant.value > 0 ? dominant.name : 'none',
        mobilityRisk,
        stressMpa,
      };
    });

    const maxForceGrams = teeth.reduce((max, t) => Math.max(max, t.forceGrams), 1);
    for (const t of teeth) {
      t.normalizedForce = parseFloat((t.forceGrams / maxForceGrams).toFixed(3));
    }

    return {
      teeth,
      maxForceGrams,
      highLoadTeeth: teeth.filter((t) => t.normalizedForce > 0.7).map((t) => t.fdi),
    };
  }

  // Feature 7: Tooth movement conflict detection
  async getMovementConflicts(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<{ conflicts: MovementConflict[]; hasBlockers: boolean }> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);
    const byFdi = new Map(prescriptions.map((p) => [p.toothNumber, p]));
    const conflicts: MovementConflict[] = [];

    // 1. Intra-tooth: contradictory movements on same tooth
    for (const p of prescriptions) {
      if (p.expansionMm > 0.1 && p.constrictionMm > 0.1) {
        conflicts.push({
          type: 'intra_tooth', fdi: p.toothNumber,
          description: `FDI ${p.toothNumber}: simultaneous expansion (${p.expansionMm.toFixed(2)}mm) and constriction (${p.constrictionMm.toFixed(2)}mm)`,
          severity: 'critical',
          suggestion: 'Prescribe only one arch-form direction per tooth per treatment phase',
        });
      }
      if (p.intrusionMm > 0.1 && p.extrusionMm > 0.1) {
        conflicts.push({
          type: 'intra_tooth', fdi: p.toothNumber,
          description: `FDI ${p.toothNumber}: simultaneous intrusion (${p.intrusionMm.toFixed(2)}mm) and extrusion (${p.extrusionMm.toFixed(2)}mm)`,
          severity: 'critical',
          suggestion: 'Remove one vertical movement — intrusion and extrusion cannot coexist on the same tooth',
        });
      }
      if (p.translationMesialMm > 0.05 && p.translationDistalMm > 0.05) {
        conflicts.push({
          type: 'intra_tooth', fdi: p.toothNumber,
          description: `FDI ${p.toothNumber}: simultaneous mesial (${p.translationMesialMm.toFixed(2)}mm) and distal (${p.translationDistalMm.toFixed(2)}mm) translation`,
          severity: 'warning',
          suggestion: 'Net mesiodistal force will be near-zero; use a single direction to avoid wasted aligner load',
        });
      }
    }

    // 2. Inter-arch: antagonist teeth creating vertical dimension issues
    for (const [upper, lower] of ANTAGONISTS) {
      const pU = byFdi.get(upper);
      const pL = byFdi.get(lower);
      if (!pU || !pL) continue;

      if (pU.extrusionMm > 0.5 && pL.extrusionMm > 0.5) {
        conflicts.push({
          type: 'inter_arch', fdiA: upper, fdiB: lower,
          description: `FDI ${upper} and antagonist ${lower} both extruded (+${pU.extrusionMm.toFixed(2)}mm / +${pL.extrusionMm.toFixed(2)}mm) — deepens overbite`,
          severity: 'warning',
          suggestion: 'Extrude one arch only, or intrude the opposing arch to control vertical dimension',
        });
      }
      if (pU.intrusionMm > 0.5 && pL.intrusionMm > 0.5) {
        conflicts.push({
          type: 'inter_arch', fdiA: upper, fdiB: lower,
          description: `FDI ${upper} and antagonist ${lower} both intruded — may create excessive bite opening`,
          severity: 'advisory',
          suggestion: 'Verify bite opening target; dual-arch simultaneous intrusion is unusual for standard cases',
        });
      }
    }

    // 3. Anchorage: majority of arch moving in one direction → reciprocal anchor loss
    const upperPrescs = prescriptions.filter((p) => archOf(p.toothNumber) === 'upper');
    const lowerPrescs = prescriptions.filter((p) => archOf(p.toothNumber) === 'lower');

    const checkReciprocal = (prescs: typeof prescriptions, arch: string) => {
      if (!prescs.length) return;
      const mesialMovers = prescs.filter((p) => p.translationMesialMm > 0.1).length;
      if (mesialMovers / prescs.length > 0.7) {
        conflicts.push({
          type: 'anchorage',
          description: `${mesialMovers}/${prescs.length} ${arch} teeth moving mesially — risk of bilateral reciprocal anchorage loss`,
          severity: 'warning',
          suggestion: 'Review anchorage plan; consider TAD anchorage or staging posterior teeth separately',
        });
      }
    };
    checkReciprocal(upperPrescs, 'upper');
    checkReciprocal(lowerPrescs, 'lower');

    // 4. Staging: adjacent teeth with large rotations both active simultaneously
    const ADJACENT_PAIRS: [number, number][] = [
      [11,12],[12,13],[21,22],[22,23],[31,32],[32,33],[41,42],[42,43],
      [13,14],[14,15],[23,24],[24,25],[33,34],[34,35],[43,44],[44,45],
    ];
    for (const [a, b] of ADJACENT_PAIRS) {
      const pA = byFdi.get(a);
      const pB = byFdi.get(b);
      if (!pA || !pB) continue;
      if (Math.abs(pA.rotationDeg) > 20 && Math.abs(pB.rotationDeg) > 20) {
        conflicts.push({
          type: 'staging', fdiA: a, fdiB: b,
          description: `Adjacent FDI ${a} (${pA.rotationDeg.toFixed(1)}°) and ${b} (${pB.rotationDeg.toFixed(1)}°) both require large rotations`,
          severity: 'advisory',
          suggestion: 'Stage rotations sequentially — complete ~60% of one tooth before initiating the adjacent tooth',
        });
      }
    }

    return { conflicts, hasBlockers: conflicts.some((c) => c.severity === 'critical') };
  }

  // Feature 8: Overcorrection suggestions based on clinical relapse evidence
  async getOvercorrectionSuggestions(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<{ suggestions: OvercorrectionSuggestion[]; totalAffectedTeeth: number }> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);
    const suggestions: OvercorrectionSuggestion[] = [];

    for (const p of prescriptions) {
      if (Math.abs(p.rotationDeg) > 10) {
        suggestions.push({
          fdi: p.toothNumber, movement: 'rotation',
          prescribedValue: parseFloat(p.rotationDeg.toFixed(2)),
          suggestedCorrectedValue: parseFloat((p.rotationDeg * 1.15).toFixed(2)),
          overcorrectionFactor: 1.15,
          rationale: 'Rotational spring-back ~15% expected from aligner flex; build into final 2 stages',
        });
      }
      if (p.extrusionMm > 1.0) {
        suggestions.push({
          fdi: p.toothNumber, movement: 'extrusion',
          prescribedValue: parseFloat(p.extrusionMm.toFixed(2)),
          suggestedCorrectedValue: parseFloat((p.extrusionMm * 1.20).toFixed(2)),
          overcorrectionFactor: 1.20,
          rationale: 'Extrusion subject to 15–20% vertical relapse from resting muscle and ligament recoil',
        });
      }
      if (Math.abs(p.torqueDeg) > 5) {
        suggestions.push({
          fdi: p.toothNumber, movement: 'torque',
          prescribedValue: parseFloat(p.torqueDeg.toFixed(2)),
          suggestedCorrectedValue: parseFloat((p.torqueDeg * 1.10).toFixed(2)),
          overcorrectionFactor: 1.10,
          rationale: 'Torque expression in aligners averages 60–80% of prescription; minimum 10% overcorrection',
        });
      }
      const maxTip = Math.max(Math.abs(p.tipMesialDeg), Math.abs(p.tipDistalDeg));
      if (maxTip > 5) {
        const tipField = Math.abs(p.tipMesialDeg) >= Math.abs(p.tipDistalDeg) ? 'tipMesialDeg' : 'tipDistalDeg';
        const tipValue = tipField === 'tipMesialDeg' ? p.tipMesialDeg : p.tipDistalDeg;
        suggestions.push({
          fdi: p.toothNumber, movement: tipField,
          prescribedValue: parseFloat(tipValue.toFixed(2)),
          suggestedCorrectedValue: parseFloat((tipValue * 1.10).toFixed(2)),
          overcorrectionFactor: 1.10,
          rationale: 'Tip spring-back ~10% from periapical fiber recoil; build into final stages',
        });
      }
      if (p.expansionMm > 3.0) {
        suggestions.push({
          fdi: p.toothNumber, movement: 'expansion',
          prescribedValue: parseFloat(p.expansionMm.toFixed(2)),
          suggestedCorrectedValue: parseFloat((p.expansionMm * 1.05).toFixed(2)),
          overcorrectionFactor: 1.05,
          rationale: 'Transverse expansion relapse from tongue pressure and transseptal fibers; 5% overcorrection',
        });
      }
    }

    const affectedFdis = new Set(suggestions.map((s) => s.fdi));
    return { suggestions, totalAffectedTeeth: affectedFdis.size };
  }

  // Feature 9: Automatic refinement recommendations
  async getRefinementRecommendations(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<RefinementRecommendation> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);
    if (!prescriptions.length) {
      return {
        refinementLikelyNeeded: false,
        estimatedRefinementProbability: 0,
        rationale: ['No prescriptions found'],
        expectedUnderexpressions: [],
        recommendedApproach: 'Add movement prescriptions before assessing refinement need',
      };
    }

    const violations = this.detectViolations(prescriptions);
    const collisions  = this.detectCollisions(prescriptions);
    const anchorage   = this.computeAnchorage(prescriptions);
    const stages      = this.estimateStages(prescriptions);
    const bri         = this.boneRemodelingIndex(prescriptions, stages);

    const { rows: pdlRows } = await this.db.query(
      `SELECT COUNT(*) AS cnt FROM pdl_simulation_results
       WHERE plan_id = $1 AND mobility_risk IN ('moderate','high')`,
      [planId],
    );
    const highMobilityTeeth = Number(pdlRows[0]?.['cnt'] ?? 0);

    let probability = 0;
    const rationale: string[] = [];

    if (bri > 1.0) {
      probability += 30;
      rationale.push(`Bone remodeling index ${bri.toFixed(2)} > 1.0 — movement exceeds bone remodeling capacity, partial expression expected`);
    } else if (bri > 0.7) {
      probability += 15;
      rationale.push(`Bone remodeling index ${bri.toFixed(2)} is borderline — monitor at midpoint`);
    }

    const criticalViolations = violations.filter((v) => v.severity === 'critical').length;
    if (criticalViolations > 0) {
      probability += 20;
      rationale.push(`${criticalViolations} critical Kravitz violation(s) — aligners cannot fully deliver these movements; staging will be required`);
    }

    if (anchorage.class === 'maximum') {
      probability += 15;
      rationale.push(`Maximum anchorage demand (${anchorage.required} units required) — anchor loss may leave residual movements`);
    }

    if (prescriptions.length > 20) {
      probability += 10;
      rationale.push(`${prescriptions.length} teeth in treatment — complex multi-tooth cases have higher refinement rates`);
    }

    if (collisions.length > 2) {
      probability += 10;
      rationale.push(`${collisions.length} collision pairs detected — contact management may require refinement staging`);
    }

    if (highMobilityTeeth > 3) {
      probability += 15;
      rationale.push(`${highMobilityTeeth} teeth with elevated PDL mobility risk — root resorption risk may slow treatment progression`);
    }

    probability = Math.min(100, probability);

    const expectedUnderexpressions: RefinementRecommendation['expectedUnderexpressions'] = [];
    for (const p of prescriptions) {
      if (Math.abs(p.torqueDeg) > 5) {
        expectedUnderexpressions.push({
          fdi: p.toothNumber, movement: 'torque',
          underexpressionPct: 35,
          notes: 'Torque expression averages 60–70% in aligners; expect ~35% residual torque at end of treatment',
        });
      }
      if (Math.abs(p.rotationDeg) > 15) {
        expectedUnderexpressions.push({
          fdi: p.toothNumber, movement: 'rotation',
          underexpressionPct: 20,
          notes: 'Rotation spring-back 15–20%, especially for premolars and molars',
        });
      }
      if (p.intrusionMm > 0.5) {
        expectedUnderexpressions.push({
          fdi: p.toothNumber, movement: 'intrusion',
          underexpressionPct: 30,
          notes: 'Intrusion achieves ~70% of prescription; PDL fibers resist vertical movement',
        });
      }
    }

    const recommendedApproach =
      probability >= 60
        ? 'Plan a mandatory refinement course at 80% of initial aligner count; re-scan and re-treat residual movements'
        : probability >= 35
        ? 'Schedule mid-treatment progress check at stage 60–70%; refinement may be indicated based on clinical progress'
        : 'Continue as planned; schedule standard retention and relapse monitoring';

    return {
      refinementLikelyNeeded: probability >= 40,
      estimatedRefinementProbability: probability,
      rationale,
      expectedUnderexpressions,
      recommendedApproach,
    };
  }

  // Feature 10: Clinical validation before prescription approval
  async validateForApproval(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<ApprovalValidation> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);

    if (!prescriptions.length) {
      return {
        canApprove: false, score: 0,
        blockers: [{ code: 'NO_PRESCRIPTIONS', description: 'No movement prescriptions exist for this plan' }],
        warnings: [],
        summary: 'Cannot approve: plan has no movement prescriptions',
      };
    }

    const violations = this.detectViolations(prescriptions);
    const collisions  = this.detectCollisions(prescriptions);
    const anchorage   = this.computeAnchorage(prescriptions);

    const blockers: ApprovalValidation['blockers'] = [];
    const warnings: ApprovalValidation['warnings'] = [];
    let score = 100;

    const criticalViolations = violations.filter((v) => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      const affectedTeeth = [...new Set(criticalViolations.map((v) => v.fdi))];
      blockers.push({
        code: 'CRITICAL_KRAVITZ_VIOLATION',
        description: `${criticalViolations.length} movement(s) exceed 2× the Kravitz per-stage limit — cannot be delivered safely`,
        affectedTeeth,
      });
      score -= criticalViolations.length * 10;
    }

    const significantCollisions = collisions.filter((c) => c.overlapMm > 0.5);
    if (significantCollisions.length > 0) {
      const affectedTeeth = [...new Set(significantCollisions.flatMap((c) => [c.fdiA, c.fdiB]))];
      blockers.push({
        code: 'SIGNIFICANT_COLLISION',
        description: `${significantCollisions.length} inter-tooth collision(s) with >0.5mm overlap — IPR or plan revision required`,
        affectedTeeth,
      });
      score -= significantCollisions.length * 15;
    }

    const warningViolations = violations.filter((v) => v.severity === 'warning');
    if (warningViolations.length > 0) {
      warnings.push({
        code: 'KRAVITZ_VIOLATION',
        description: `${warningViolations.length} movement(s) slightly exceed per-stage Kravitz limits`,
        affectedTeeth: [...new Set(warningViolations.map((v) => v.fdi))],
      });
      score -= warningViolations.length * 3;
    }

    const minorCollisions = collisions.filter((c) => c.overlapMm <= 0.5);
    if (minorCollisions.length > 0) {
      warnings.push({
        code: 'MINOR_COLLISION_RISK',
        description: `${minorCollisions.length} inter-tooth contact risk pair(s) detected — monitor and consider IPR`,
        affectedTeeth: [...new Set(minorCollisions.flatMap((c) => [c.fdiA, c.fdiB]))],
      });
      score -= minorCollisions.length * 5;
    }

    if (anchorage.class === 'maximum') {
      warnings.push({
        code: 'MAXIMUM_ANCHORAGE_DEMAND',
        description: `Maximum anchorage class — ${anchorage.required} units required from ${prescriptions.length} moving teeth`,
      });
      score -= 5;
    }

    const rootMovers = prescriptions.filter(
      (p) => (p.rootMovementMm > 1.0) || (Math.abs(p.torqueDeg) > 10) ||
              (Math.abs(p.tipMesialDeg) > 8) || (Math.abs(p.tipDistalDeg) > 8),
    );
    if (rootMovers.length > 0) {
      warnings.push({
        code: 'ROOT_MOVEMENT_UNVERIFIED',
        description: `${rootMovers.length} tooth/teeth with significant root movement — verify attachment plan covers root control`,
        affectedTeeth: rootMovers.map((p) => p.toothNumber),
      });
      score -= rootMovers.length * 2;
    }

    score = Math.max(0, Math.min(100, score));
    const canApprove = blockers.length === 0;
    const summary = canApprove
      ? `Clinical validation passed (score: ${score}/100) — ${warnings.length} advisory warning(s)`
      : `Clinical validation failed — ${blockers.length} blocker(s) must be resolved before approval`;

    return { canApprove, score, blockers, warnings, summary };
  }

  // ── Enhancement 1: Impossible movement detection ───────────────────────────

  /**
   * Identifies movements that exceed anatomical limits, contain conflicts on the same
   * tooth, or create arch-length/extraction-space violations.
   */
  detectImpossibleMovements(movements: ToothMovement[]): ImpossibleMovement[] {
    const impossible: ImpossibleMovement[] = [];

    const classifyLimit = (
      value: number,
      limits: { safe: number; warn: number; max: number },
    ): 'ok' | 'warn' | 'exceeded' => {
      if (value > limits.max)  return 'exceeded';
      if (value > limits.safe) return 'warn';
      return 'ok';
    };

    for (const m of movements) {
      // 1a. Total translation
      const totalTranslation =
        m.translationMesialMm + m.translationDistalMm +
        m.translationBuccalMm + m.translationLingualMm;
      if (classifyLimit(totalTranslation, SAFE_MOVEMENT_LIMITS.translation) === 'exceeded') {
        impossible.push({
          fdi: m.toothNumber,
          type: 'anatomical_limit',
          description: `FDI ${m.toothNumber}: total translation ${totalTranslation.toFixed(2)}mm exceeds anatomical maximum of ${SAFE_MOVEMENT_LIMITS.translation.max}mm per course`,
          severity: 'critical',
          affectedAxis: 'translation',
          prescribedValue: totalTranslation,
          anatomicalMax: SAFE_MOVEMENT_LIMITS.translation.max,
        });
      }

      // 1b. Rotation
      const totalRotation = Math.abs(m.rotationDeg);
      if (classifyLimit(totalRotation, SAFE_MOVEMENT_LIMITS.rotation) === 'exceeded') {
        impossible.push({
          fdi: m.toothNumber,
          type: 'anatomical_limit',
          description: `FDI ${m.toothNumber}: rotation ${totalRotation.toFixed(1)}° exceeds anatomical maximum of ${SAFE_MOVEMENT_LIMITS.rotation.max}°`,
          severity: 'critical',
          affectedAxis: 'rotation',
          prescribedValue: totalRotation,
          anatomicalMax: SAFE_MOVEMENT_LIMITS.rotation.max,
        });
      }

      // 1c. Torque
      const totalTorque = Math.abs(m.torqueDeg);
      if (classifyLimit(totalTorque, SAFE_MOVEMENT_LIMITS.torque) === 'exceeded') {
        impossible.push({
          fdi: m.toothNumber,
          type: 'anatomical_limit',
          description: `FDI ${m.toothNumber}: torque ${totalTorque.toFixed(1)}° exceeds safe maximum of ${SAFE_MOVEMENT_LIMITS.torque.max}°`,
          severity: 'critical',
          affectedAxis: 'torque',
          prescribedValue: totalTorque,
          anatomicalMax: SAFE_MOVEMENT_LIMITS.torque.max,
        });
      }

      // 1d. Tip
      const maxTip = Math.max(Math.abs(m.tipMesialDeg), Math.abs(m.tipDistalDeg));
      if (classifyLimit(maxTip, SAFE_MOVEMENT_LIMITS.tip) === 'exceeded') {
        impossible.push({
          fdi: m.toothNumber,
          type: 'anatomical_limit',
          description: `FDI ${m.toothNumber}: tip ${maxTip.toFixed(1)}° exceeds anatomical maximum of ${SAFE_MOVEMENT_LIMITS.tip.max}°`,
          severity: 'critical',
          affectedAxis: 'tip',
          prescribedValue: maxTip,
          anatomicalMax: SAFE_MOVEMENT_LIMITS.tip.max,
        });
      }

      // 1e. Intrusion
      if (classifyLimit(m.intrusionMm, SAFE_MOVEMENT_LIMITS.intrusion) === 'exceeded') {
        impossible.push({
          fdi: m.toothNumber,
          type: 'anatomical_limit',
          description: `FDI ${m.toothNumber}: intrusion ${m.intrusionMm.toFixed(2)}mm exceeds anatomical maximum of ${SAFE_MOVEMENT_LIMITS.intrusion.max}mm`,
          severity: 'critical',
          affectedAxis: 'intrusion',
          prescribedValue: m.intrusionMm,
          anatomicalMax: SAFE_MOVEMENT_LIMITS.intrusion.max,
        });
      }

      // 1f. Extrusion
      if (classifyLimit(m.extrusionMm, SAFE_MOVEMENT_LIMITS.extrusion) === 'exceeded') {
        impossible.push({
          fdi: m.toothNumber,
          type: 'anatomical_limit',
          description: `FDI ${m.toothNumber}: extrusion ${m.extrusionMm.toFixed(2)}mm exceeds anatomical maximum of ${SAFE_MOVEMENT_LIMITS.extrusion.max}mm`,
          severity: 'critical',
          affectedAxis: 'extrusion',
          prescribedValue: m.extrusionMm,
          anatomicalMax: SAFE_MOVEMENT_LIMITS.extrusion.max,
        });
      }

      // 1g. Distalization
      if (classifyLimit(m.distalizationMm, SAFE_MOVEMENT_LIMITS.distalization) === 'exceeded') {
        impossible.push({
          fdi: m.toothNumber,
          type: 'anatomical_limit',
          description: `FDI ${m.toothNumber}: distalization ${m.distalizationMm.toFixed(2)}mm exceeds anatomical maximum of ${SAFE_MOVEMENT_LIMITS.distalization.max}mm`,
          severity: 'critical',
          affectedAxis: 'distalization',
          prescribedValue: m.distalizationMm,
          anatomicalMax: SAFE_MOVEMENT_LIMITS.distalization.max,
        });
      }

      // 1h. Expansion
      if (classifyLimit(m.expansionMm, SAFE_MOVEMENT_LIMITS.expansion) === 'exceeded') {
        impossible.push({
          fdi: m.toothNumber,
          type: 'anatomical_limit',
          description: `FDI ${m.toothNumber}: expansion ${m.expansionMm.toFixed(2)}mm exceeds anatomical maximum of ${SAFE_MOVEMENT_LIMITS.expansion.max}mm per arch`,
          severity: 'critical',
          affectedAxis: 'expansion',
          prescribedValue: m.expansionMm,
          anatomicalMax: SAFE_MOVEMENT_LIMITS.expansion.max,
        });
      }

      // 2. Conflicting simultaneous movements on the same tooth
      if (m.intrusionMm > 0.1 && m.extrusionMm > 0.1) {
        impossible.push({
          fdi: m.toothNumber,
          type: 'conflicting_movements',
          description: `FDI ${m.toothNumber}: simultaneous intrusion (${m.intrusionMm.toFixed(2)}mm) and extrusion (${m.extrusionMm.toFixed(2)}mm) — physically impossible on the same tooth`,
          severity: 'critical',
          affectedAxis: 'intrusion/extrusion',
          prescribedValue: m.intrusionMm + m.extrusionMm,
          anatomicalMax: 0,
        });
      }

      if (m.expansionMm > 0.1 && m.constrictionMm > 0.1) {
        impossible.push({
          fdi: m.toothNumber,
          type: 'conflicting_movements',
          description: `FDI ${m.toothNumber}: simultaneous expansion (${m.expansionMm.toFixed(2)}mm) and constriction (${m.constrictionMm.toFixed(2)}mm) — bidirectional arch-form conflict`,
          severity: 'critical',
          affectedAxis: 'expansion/constriction',
          prescribedValue: m.expansionMm + m.constrictionMm,
          anatomicalMax: 0,
        });
      }

      if (m.mesializationMm > 0.1 && m.distalizationMm > 0.1) {
        impossible.push({
          fdi: m.toothNumber,
          type: 'conflicting_movements',
          description: `FDI ${m.toothNumber}: simultaneous mesialization (${m.mesializationMm.toFixed(2)}mm) and distalization (${m.distalizationMm.toFixed(2)}mm) — opposing bodily movements will cancel`,
          severity: 'warning',
          affectedAxis: 'mesialization/distalization',
          prescribedValue: m.mesializationMm + m.distalizationMm,
          anatomicalMax: 0,
        });
      }
    }

    // 3. Arch-length discrepancy violations (arch-level check)
    for (const arch of ['upper', 'lower'] as const) {
      const archMovements = movements.filter((m) => archOf(m.toothNumber) === arch);
      if (archMovements.length < 2) continue;

      const netMDChange = archMovements.reduce(
        (sum, m) => sum + m.translationMesialMm - m.translationDistalMm + m.mesializationMm - m.distalizationMm,
        0,
      );

      if (Math.abs(netMDChange) > 5.0) {
        const worst = archMovements.reduce((a, b) => {
          const aNet = Math.abs(a.translationMesialMm - a.translationDistalMm + a.mesializationMm - a.distalizationMm);
          const bNet = Math.abs(b.translationMesialMm - b.translationDistalMm + b.mesializationMm - b.distalizationMm);
          return aNet >= bNet ? a : b;
        });
        impossible.push({
          fdi: worst.toothNumber,
          type: 'arch_length_violation',
          description: `${arch.toUpperCase()} arch: net mesio-distal movement ${Math.abs(netMDChange).toFixed(1)}mm across ${archMovements.length} teeth exceeds 5mm safe arch-length accommodation — crowding relapse risk`,
          severity: 'warning',
          affectedAxis: 'arch_length',
          prescribedValue: Math.abs(netMDChange),
          anatomicalMax: 5.0,
        });
      }
    }

    // 4. Overcrowded extraction space conflicts
    for (const m of movements) {
      const n = m.toothNumber % 10;
      if ((n === 4 || n === 5) && m.distalizationMm > SAFE_MOVEMENT_LIMITS.distalization.warn) {
        // Check if adjacent first molar is also moving mesially — conflicting space closure
        const molarFdi = m.toothNumber - n + 6; // e.g. 14 → 16, 24 → 26
        const adjacentMolar = movements.find((x) => x.toothNumber === molarFdi);
        if (adjacentMolar && adjacentMolar.mesializationMm > 0.5) {
          impossible.push({
            fdi: m.toothNumber,
            type: 'extraction_space_conflict',
            description: `FDI ${m.toothNumber}: premolar distalization (${m.distalizationMm.toFixed(1)}mm) conflicts with molar FDI ${molarFdi} mesialization (${adjacentMolar.mesializationMm.toFixed(1)}mm) — likely extraction space closure conflict requiring staged sequencing`,
            severity: 'warning',
            affectedAxis: 'distalization',
            prescribedValue: m.distalizationMm + adjacentMolar.mesializationMm,
            anatomicalMax: SAFE_MOVEMENT_LIMITS.distalization.warn,
          });
        }
      }
    }

    return impossible;
  }

  /**
   * Returns 'safe' | 'warn' | 'critical' for the worst-case movement axis on this tooth,
   * evaluated against per-course SAFE_MOVEMENT_LIMITS thresholds.
   */
  classifyMovementRisk(movement: ToothMovement): 'safe' | 'warn' | 'critical' {
    type Risk = 'safe' | 'warn' | 'critical';

    const classify = (value: number, limits: { safe: number; warn: number; max: number }): Risk => {
      if (value > limits.max)  return 'critical';
      if (value > limits.safe) return 'warn';
      return 'safe';
    };

    const escalate = (current: Risk, next: Risk): Risk => {
      if (next === 'critical' || current === 'critical') return 'critical';
      if (next === 'warn'     || current === 'warn')     return 'warn';
      return 'safe';
    };

    const totalTranslation =
      movement.translationMesialMm + movement.translationDistalMm +
      movement.translationBuccalMm + movement.translationLingualMm;
    const maxTip = Math.max(Math.abs(movement.tipMesialDeg), Math.abs(movement.tipDistalDeg));

    let risk: Risk = 'safe';
    risk = escalate(risk, classify(totalTranslation,                      SAFE_MOVEMENT_LIMITS.translation));
    risk = escalate(risk, classify(Math.abs(movement.rotationDeg),        SAFE_MOVEMENT_LIMITS.rotation));
    risk = escalate(risk, classify(Math.abs(movement.torqueDeg),          SAFE_MOVEMENT_LIMITS.torque));
    risk = escalate(risk, classify(maxTip,                                SAFE_MOVEMENT_LIMITS.tip));
    risk = escalate(risk, classify(movement.intrusionMm,                  SAFE_MOVEMENT_LIMITS.intrusion));
    risk = escalate(risk, classify(movement.extrusionMm,                  SAFE_MOVEMENT_LIMITS.extrusion));
    risk = escalate(risk, classify(movement.expansionMm,                  SAFE_MOVEMENT_LIMITS.expansion));
    risk = escalate(risk, classify(movement.distalizationMm,              SAFE_MOVEMENT_LIMITS.distalization));
    return risk;
  }

  // ── Enhancement 2: Enhanced root safety assessment ─────────────────────────

  /**
   * Returns a full RootSafetyAssessment with per-tooth risk records,
   * colour-coded risk levels, and lookup-table-generated clinical explanations.
   */
  async assessRootSafety(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<RootSafetyAssessment> {
    const DISCLAIMER =
      'Root proximity estimates are based on population-average root lengths and simplified geometric models. ' +
      'They do not substitute for CBCT evaluation in high-risk cases. ' +
      'Clinical judgment is required before proceeding with movements flagged high or critical risk.';

    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);

    if (!prescriptions.length) {
      return {
        overallRisk: 'low',
        perToothRisk: {},
        highRiskTeeth: [],
        clinicalSummary: 'No prescriptions found — add movement prescriptions to enable root safety analysis',
        confidence: 'low',
        disclaimer: DISCLAIMER,
      };
    }

    const perToothRisk: RootSafetyAssessment['perToothRisk'] = {};

    for (const p of prescriptions) {
      const rootLen = ROOT_LENGTH[p.toothNumber] ?? 14.0;
      const totalAngular = Math.abs(p.torqueDeg) + Math.abs(p.tipMesialDeg) + Math.abs(p.tipDistalDeg);
      const angularApicalMm = Math.sin((totalAngular * Math.PI) / 180) * rootLen;
      const apicalDisp = parseFloat((angularApicalMm + Math.abs(p.rootMovementMm ?? 0)).toFixed(3));

      const proximity = corticalProximityEstMm(p.toothNumber, apicalDisp);
      const maxSafeTorqueDeg   = maxSafeTorqueForTooth(p.toothNumber);
      const maxSafeIntrusionMm = maxSafeIntrusionForTooth(p.toothNumber);

      const riskLevel: 'low' | 'moderate' | 'high' | 'critical' =
        apicalDisp >= 4.0 || proximity < -0.5 ? 'critical' :
        apicalDisp >= 2.5 || proximity < 0.5  ? 'high' :
        apicalDisp >= 1.5 || proximity < 1.0  ? 'moderate' :
        'low';

      const colorCode: 'green' | 'yellow' | 'orange' | 'red' =
        riskLevel === 'critical' ? 'red' :
        riskLevel === 'high'     ? 'orange' :
        riskLevel === 'moderate' ? 'yellow' :
        'green';

      perToothRisk[p.toothNumber] = {
        fdiNumber: p.toothNumber,
        apicalDisplacementEstMm: apicalDisp,
        corticalProximityEstMm: proximity,
        maxSafeTorqueDeg,
        maxSafeIntrusionMm,
        riskLevel,
        clinicalExplanation: buildRootSafetyExplanation(
          p.toothNumber, riskLevel, apicalDisp, Math.abs(p.torqueDeg),
        ),
        colorCode,
      };
    }

    const riskValues = Object.values(perToothRisk);
    const highRiskTeeth = riskValues
      .filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical')
      .map((r) => r.fdiNumber);

    const criticalCount = riskValues.filter((r) => r.riskLevel === 'critical').length;
    const highCount     = riskValues.filter((r) => r.riskLevel === 'high').length;
    const moderateCount = riskValues.filter((r) => r.riskLevel === 'moderate').length;

    const overallRisk: RootSafetyAssessment['overallRisk'] =
      criticalCount > 0 ? 'critical' :
      highCount     > 0 ? 'high' :
      moderateCount > 0 ? 'moderate' :
      'low';

    const clinicalSummary =
      overallRisk === 'critical'
        ? `${criticalCount} tooth/teeth at critical cortical proximity risk — CBCT evaluation strongly recommended before proceeding`
        : overallRisk === 'high'
        ? `${highCount} tooth/teeth at elevated root safety risk — additional root-control attachments recommended`
        : overallRisk === 'moderate'
        ? `${moderateCount} tooth/teeth require monitoring — confirm attachment plan provides root control`
        : 'All root safety parameters within acceptable limits';

    const confidence: RootSafetyAssessment['confidence'] =
      riskValues.length > 10 ? 'high' :
      riskValues.length > 4  ? 'moderate' :
      'low';

    return { overallRisk, perToothRisk, highRiskTeeth, clinicalSummary, confidence, disclaimer: DISCLAIMER };
  }

  // ── Enhancement 3: Collision detection v2 ─────────────────────────────────

  /**
   * Enhanced collision detection with severity scoring (none/minimal/moderate/severe),
   * stage-timeline estimation, correction recommendations, and attachment-hull conflict detection.
   */
  async getEnhancedCollisionsV2(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<CollisionV2Report> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);
    const stages = this.estimateStages(prescriptions);
    const byFdi  = new Map(prescriptions.map((p) => [p.toothNumber, p]));

    const ADJACENT: [number, number][] = [
      [11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],
      [21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],
      [31,32],[32,33],[33,34],[34,35],[35,36],[36,37],[37,38],
      [41,42],[42,43],[43,44],[44,45],[45,46],[46,47],[47,48],
    ];

    const collisions: CollisionV2[] = [];

    for (const [a, b] of ADJACENT) {
      const pA = byFdi.get(a);
      const pB = byFdi.get(b);
      if (!pA || !pB) continue;

      const mesialConflict = pA.translationMesialMm + pB.translationDistalMm;
      const distalConflict = pA.translationDistalMm + pB.translationMesialMm;
      const rawConvergence = Math.max(mesialConflict, distalConflict, 0);
      const rotContrib     = Math.abs(pA.rotationDeg) * 0.035 + Math.abs(pB.rotationDeg) * 0.035;
      const totalOverlap   = parseFloat((rawConvergence + rotContrib).toFixed(3));

      const severity: CollisionV2['severity'] =
        totalOverlap >= 0.5  ? 'severe' :
        totalOverlap >= 0.25 ? 'moderate' :
        totalOverlap >= 0.1  ? 'minimal' :
        'none';

      if (severity === 'none' && rawConvergence <= 0.05) continue;

      // Estimate the stage at which teeth first contact
      const crownWidth        = CROWN_WIDTH_MD[a] ?? 7.0;
      const clearanceThresh   = crownWidth * 0.05;
      const overlapPerStage   = totalOverlap / Math.max(stages, 1);
      const firstAppearanceStage = overlapPerStage > 0
        ? Math.min(stages, Math.max(1, Math.round(clearanceThresh / overlapPerStage)))
        : stages;

      const recommendedCorrections: string[] = [];
      if (severity === 'severe') {
        recommendedCorrections.push(`IPR ${(totalOverlap * 0.8).toFixed(2)}mm at FDI ${a}-${b} contact point`);
        recommendedCorrections.push(`Stage FDI ${a} and ${b} sequentially to avoid simultaneous convergence`);
        recommendedCorrections.push(`Reorder movement sequence: complete distal movements before initiating mesial neighbours`);
      } else if (severity === 'moderate') {
        recommendedCorrections.push(`IPR 0.1–0.2mm at FDI ${a}-${b} contact point`);
        recommendedCorrections.push(`Reduce movement velocity at stage ${firstAppearanceStage} — split into two sub-stages`);
      } else {
        recommendedCorrections.push(`Monitor FDI ${a}-${b} contact; consider staging to avoid interproximal binding`);
        recommendedCorrections.push(`Add horizontal attachment on FDI ${a} or ${b} for improved directional control`);
      }

      collisions.push({
        fdiA: a, fdiB: b,
        overlapMm: totalOverlap,
        severity,
        firstAppearanceStage,
        recommendedCorrections,
      });
    }

    // Attachment-hull vs adjacent tooth collision detection
    // Proxy: any tooth with rotation > 10° or torque > 5° is assumed to carry an attachment
    const attachmentConflicts: CollisionV2Report['attachmentConflicts'] = [];
    for (const [a, b] of ADJACENT) {
      const pA = byFdi.get(a);
      const pB = byFdi.get(b);
      if (!pA || !pB) continue;

      const aHasAttachment = Math.abs(pA.rotationDeg) > 10 || Math.abs(pA.torqueDeg) > 5;
      const bHasAttachment = Math.abs(pB.rotationDeg) > 10 || Math.abs(pB.torqueDeg) > 5;

      if (aHasAttachment && pB.translationMesialMm > 0.2) {
        attachmentConflicts.push({
          fdi: a, adjacentFdi: b,
          description: `FDI ${b} mesial movement (${pB.translationMesialMm.toFixed(2)}mm) may impinge on FDI ${a} attachment hull — verify attachment placement clears adjacent tooth path`,
        });
      }
      if (bHasAttachment && pA.translationDistalMm > 0.2) {
        attachmentConflicts.push({
          fdi: b, adjacentFdi: a,
          description: `FDI ${a} distal movement (${pA.translationDistalMm.toFixed(2)}mm) may impinge on FDI ${b} attachment hull — verify attachment placement clears adjacent tooth path`,
        });
      }
    }

    const severeCount   = collisions.filter((c) => c.severity === 'severe').length;
    const moderateCount = collisions.filter((c) => c.severity === 'moderate').length;
    const summary = collisions.length === 0
      ? 'No inter-tooth collision risk detected'
      : `${collisions.length} collision risk(s): ${severeCount} severe, ${moderateCount} moderate`;

    return { collisions, summary, attachmentConflicts };
  }

  // ── Enhancement 4: Refinement probability ─────────────────────────────────

  /**
   * Estimates the probability that this tooth will require a refinement course,
   * based on clinically validated per-tooth risk factors (Kravitz/Proffit).
   * For arch-level factors (total stages, arch-length discrepancy) call
   * getAnchorageAnalysisEnhanced or getRefinementRecommendations instead.
   */
  estimateRefinementProbability(prescription: MovementPrescription): RefinementEstimate {
    let probability = 0;
    const primaryRiskFactors: string[] = [];

    // RF1: Large rotation
    const totalRotation = Math.abs(prescription.rotationDeg);
    if (totalRotation > 25) {
      probability += 0.15;
      primaryRiskFactors.push(`Rotation ${totalRotation.toFixed(1)}° > 25° (+15%)`);
    }

    // RF2: Deep intrusion
    if (prescription.intrusionMm > 2.0) {
      probability += 0.20;
      primaryRiskFactors.push(`Intrusion ${prescription.intrusionMm.toFixed(2)}mm > 2mm (+20%)`);
    }

    // RF3: Large total translation
    const totalTranslation =
      prescription.translationMesialMm + prescription.translationDistalMm +
      prescription.translationBuccalMm + prescription.translationLingualMm;
    if (totalTranslation > 3.0) {
      probability += 0.10;
      primaryRiskFactors.push(`Total translation ${totalTranslation.toFixed(2)}mm > 3mm (+10%)`);
    }

    // RF4: Upper canine torque
    if (
      (prescription.toothNumber === 13 || prescription.toothNumber === 23) &&
      Math.abs(prescription.torqueDeg) > 15
    ) {
      probability += 0.10;
      primaryRiskFactors.push(
        `Upper canine FDI ${prescription.toothNumber} torque ${Math.abs(prescription.torqueDeg).toFixed(1)}° > 15° (+10%)`,
      );
    }

    // RF5: Molar distalization (FDI n=6 or n=7)
    const n = prescription.toothNumber % 10;
    if ((n === 6 || n === 7) && prescription.distalizationMm > 0.5) {
      probability += 0.20;
      primaryRiskFactors.push(
        `Molar FDI ${prescription.toothNumber} distalization ${prescription.distalizationMm.toFixed(2)}mm (+20%)`,
      );
    }

    // RF6: Large expansion (arch-length risk proxy)
    if (prescription.expansionMm > 4.0) {
      probability += 0.15;
      primaryRiskFactors.push(`Expansion ${prescription.expansionMm.toFixed(2)}mm > 4mm — arch-length discrepancy risk (+15%)`);
    }

    probability = parseFloat(Math.min(1.0, probability).toFixed(3));

    const confidenceLevel: RefinementEstimate['confidenceLevel'] =
      primaryRiskFactors.length >= 3 ? 'high' :
      primaryRiskFactors.length >= 1 ? 'moderate' :
      'low';

    // Expected additional aligners: ~4 aligners per 15% risk increment
    const expectedAdditionalAligners = Math.round((probability / 0.15) * 4);

    const treatmentSuccessProbability = parseFloat(
      Math.max(0.50, 1.0 - probability * 0.4).toFixed(2),
    );

    const explanation =
      primaryRiskFactors.length === 0
        ? `FDI ${prescription.toothNumber}: no significant per-tooth refinement risk factors identified`
        : `FDI ${prescription.toothNumber}: ${(probability * 100).toFixed(0)}% refinement probability — ${primaryRiskFactors.join('; ')}`;

    return {
      probability,
      confidenceLevel,
      primaryRiskFactors,
      expectedAdditionalAligners,
      treatmentSuccessProbability,
      explanation,
      disclaimer:
        'Refinement probability estimates are derived from population-level clinical data (Kravitz et al., Proffit et al.) ' +
        'and do not account for patient-specific factors such as age, bone density, compliance, or attachment design. ' +
        'Arch-level risk factors (total stages, arch-length discrepancy) are not evaluated in single-tooth mode — ' +
        'see getRefinementRecommendations() for plan-level assessment. ' +
        'Clinical refinement decisions must be based on actual treatment progress records.',
    };
  }

  // ── Enhancement 5: Enhanced anchorage analysis ─────────────────────────────

  /**
   * Extends the existing Proffit anchorage analysis with numeric unit count,
   * demand estimate, deficit, protection strategy, and anchorage-loss risk.
   */
  async getAnchorageAnalysisEnhanced(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<AnchorageAnalysisEnhanced> {
    const prescriptions = await this.listPrescriptions(caseId, orgId, planId);
    const base = this.computeAnchorage(prescriptions);

    // Deficit: positive = demand exceeds available anchorage
    const deficit = parseFloat((base.required - base.available).toFixed(1));

    // Total teeth unit count (moving + non-moving)
    const unitCount = base.required + base.available;

    // Demand estimate: weight moving teeth by movement complexity
    const demandEstimate = parseFloat(
      prescriptions
        .reduce((sum, p) => {
          let demand = anchorageUnits(p.toothNumber);
          if (Math.abs(p.rotationDeg) > 10)                        demand *= 1.2;
          if (p.distalizationMm > 1.0 || p.mesializationMm > 1.0) demand *= 1.3;
          if (p.intrusionMm > 1.0)                                 demand *= 1.1;
          return sum + demand;
        }, 0)
        .toFixed(1),
    );

    const riskOfAnchorageLoss: AnchorageAnalysisEnhanced['riskOfAnchorageLoss'] =
      deficit > 5 ? 'high' :
      deficit > 0 ? 'moderate' :
      'low';

    const anchorageProtectionStrategy =
      base.class === 'maximum'
        ? 'Temporary anchorage devices (TADs/miniscrews) strongly recommended; stage posterior movements to minimise reciprocal forces; consider skeletal anchorage for >4mm distalization'
        : base.class === 'moderate'
        ? 'Consider Class II/III elastics or selective staging to protect anchorage; monitor molar position at mid-treatment progress records'
        : 'Standard aligner anchorage is adequate; monitor molar position with periodic progress records';

    return {
      class: base.class,
      unitCount,
      demandEstimate,
      deficit,
      anchorageProtectionStrategy,
      riskOfAnchorageLoss,
      required: base.required,
      available: base.available,
    };
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
