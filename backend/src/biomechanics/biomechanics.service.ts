import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Legacy assessment interface (kept for existing biomechanics_assessments table) ──

export interface MovementLimits {
  safe: number;
  warning: number;
  unsafe: number;
}

export interface StageFinding {
  stageNumber: number;
  fdi: number;
  field: string;
  value: number;
  status: 'safe' | 'warning' | 'unsafe';
  limit: number;
  explanation: string;
}

// ─── Phase 23 interfaces (biomechanical_analyses table) ───────────────────────

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

export interface CollisionPair {
  fdiA: number;
  fdiB: number;
  estimatedOverlapMm: number;
}

export interface ExcessiveMovement {
  fdi: number;
  field: string;
  value: number;
  threshold: number;
}

export interface IprRequirement {
  mesialTooth: number;
  distalTooth: number;
  requiredReductionMm: number;
}

export interface AttachmentRequirement {
  fdi: number;
  indication: string;
}

export interface AlignmentForceEstimate {
  fdi: number;
  estimatedForceGrams: number;
  movementType: string;
}

export interface RecommendedStage {
  stageNumber: number;
  maxTranslationMm: number;
  maxRotationDeg: number;
  maxTorqueDeg: number;
}

export interface BiomechanicalAnalysis {
  id: string;
  organizationId: string;
  digitalSetupId: string;
  movementFeasible: boolean;
  hasCollisions: boolean;
  collisionPairs: CollisionPair[];
  maxPdlStressPercentage: number;
  pdlOverloadTeeth: number[];
  excessiveMovements: ExcessiveMovement[];
  anchorageDemandScore: number;
  iprRequirements: IprRequirement[];
  attachmentRequirements: AttachmentRequirement[];
  rootCollisionRisk: number[];
  alignerForceEstimates: AlignmentForceEstimate[];
  stagingFeasible: boolean;
  recommendedStaging: RecommendedStage[];
  biomechanicalScore: number;
  createdAt: Date;
}

// ─── Legacy constants (kept for assessPlan) ───────────────────────────────────

const LIMITS: Record<string, MovementLimits> = {
  mesialMm:    { safe: 0.20, warning: 0.25, unsafe: 0.30 },
  distalMm:    { safe: 0.20, warning: 0.25, unsafe: 0.30 },
  buccalMm:    { safe: 0.20, warning: 0.25, unsafe: 0.30 },
  lingualMm:   { safe: 0.20, warning: 0.25, unsafe: 0.30 },
  intrusionMm: { safe: 0.20, warning: 0.30, unsafe: 0.40 },
  extrusionMm: { safe: 0.50, warning: 0.65, unsafe: 0.75 },
  torqueDeg:   { safe: 1.50, warning: 2.50, unsafe: 3.50 },
  tipDeg:      { safe: 2.00, warning: 3.00, unsafe: 4.00 },
  rotationDeg: { safe: 1.50, warning: 2.00, unsafe: 3.00 },
};

const CROWN_WIDTH: Record<number, number> = {
  11: 8.5, 12: 6.8, 13: 7.5, 14: 7.0, 15: 7.0, 16: 10.2, 17: 9.9, 18: 9.0,
  21: 8.5, 22: 6.8, 23: 7.5, 24: 7.0, 25: 7.0, 26: 10.2, 27: 9.9, 28: 9.0,
  31: 5.4, 32: 6.0, 33: 6.8, 34: 7.0, 35: 7.0, 36: 10.9, 37: 10.4, 38: 9.8,
  41: 5.4, 42: 6.0, 43: 6.8, 44: 7.0, 45: 7.0, 46: 10.9, 47: 10.4, 48: 9.8,
};

const DIFFICULTY: Record<number, number> = {};
for (const fdi of [11,12,21,22,31,32,41,42]) DIFFICULTY[fdi] = 1.0;
for (const fdi of [13,23,33,43])              DIFFICULTY[fdi] = 1.3;
for (const fdi of [14,15,24,25,34,35,44,45]) DIFFICULTY[fdi] = 1.5;
for (const fdi of [16,17,18,26,27,28,36,37,38,46,47,48]) DIFFICULTY[fdi] = 2.5;

function classifyField(
  field: string,
  absValue: number,
): { status: 'safe' | 'warning' | 'unsafe'; limit: number } {
  const lim = LIMITS[field];
  if (!lim) return { status: 'safe', limit: 0 };
  if (absValue > lim.unsafe) return { status: 'unsafe', limit: lim.unsafe };
  if (absValue > lim.warning) return { status: 'warning', limit: lim.warning };
  return { status: 'safe', limit: lim.safe };
}

// ─── Phase 23 biomechanics algorithm ─────────────────────────────────────────

// Adjacent teeth in FDI order per arch
const UPPER_ADJACENT: [number, number][] = [
  [17, 16], [16, 15], [15, 14], [14, 13], [13, 12], [12, 11],
  [11, 21], [21, 22], [22, 23], [23, 24], [24, 25], [25, 26], [26, 27],
];
const LOWER_ADJACENT: [number, number][] = [
  [47, 46], [46, 45], [45, 44], [44, 43], [43, 42], [42, 41],
  [41, 31], [31, 32], [32, 33], [33, 34], [34, 35], [35, 36], [36, 37],
];
const ALL_ADJACENT = [...UPPER_ADJACENT, ...LOWER_ADJACENT];

function computePdlStress(tooth: ToothState): number {
  const totalTranslation = Math.sqrt(
    Math.pow(tooth.mesialMm + tooth.distalMm, 2) +
    Math.pow(tooth.buccalMm + tooth.lingualMm, 2),
  );
  const totalRotation = Math.abs(tooth.mesialRotDeg + tooth.distalRotDeg);
  const torque = Math.abs(tooth.torqueDeg);
  return Math.min(200, totalTranslation * 15 + totalRotation * 3 + torque * 4);
}

function computeAnchorageDemand(teeth: ToothState[]): number {
  let totalDemand = 0;
  for (const tooth of teeth) {
    const translation = Math.sqrt(
      Math.pow(tooth.mesialMm + tooth.distalMm, 2) +
      Math.pow(tooth.buccalMm + tooth.lingualMm, 2),
    );
    const rotation = Math.abs(tooth.mesialRotDeg + tooth.distalRotDeg);
    const fdiDiff = DIFFICULTY[tooth.fdi] ?? 1.0;
    totalDemand += (translation * 12 + rotation * 2) * fdiDiff;
  }
  return Math.min(100, Math.round(totalDemand));
}

function estimateForce(tooth: ToothState): AlignmentForceEstimate {
  const translation = Math.sqrt(
    Math.pow(tooth.mesialMm + tooth.distalMm, 2) +
    Math.pow(tooth.buccalMm + tooth.lingualMm, 2),
  );
  const rotation = Math.abs(tooth.mesialRotDeg + tooth.distalRotDeg);
  const torque = Math.abs(tooth.torqueDeg);
  // Simplified: translation ~ 50g/0.25mm, rotation ~ 30g/1.5°, torque ~ 20g/1.5°
  const forceG = translation * 200 + rotation * 20 + torque * 13;
  const dominantType = translation > 0.1
    ? 'translation'
    : rotation > 1
    ? 'rotation'
    : 'torque';
  return {
    fdi: tooth.fdi,
    estimatedForceGrams: Math.round(forceG),
    movementType: dominantType,
  };
}

function computeRecommendedStaging(teeth: ToothState[]): RecommendedStage[] {
  // Find the tooth with maximum total movement to determine stage count
  let maxTranslation = 0;
  let maxRotation    = 0;
  let maxTorque      = 0;
  for (const t of teeth) {
    const trans = Math.max(t.mesialMm, t.distalMm, t.buccalMm, t.lingualMm, t.intrusionMm, t.extrusionMm);
    const rot   = Math.max(t.mesialRotDeg, t.distalRotDeg);
    const torq  = Math.abs(t.torqueDeg);
    if (trans > maxTranslation) maxTranslation = trans;
    if (rot   > maxRotation)    maxRotation    = rot;
    if (torq  > maxTorque)      maxTorque      = torq;
  }

  const stagesForTranslation = maxTranslation > 0 ? Math.ceil(maxTranslation / 0.25) : 1;
  const stagesForRotation    = maxRotation    > 0 ? Math.ceil(maxRotation    / 1.5)  : 1;
  const stagesForTorque      = maxTorque      > 0 ? Math.ceil(maxTorque      / 2.0)  : 1;
  const totalStages = Math.max(stagesForTranslation, stagesForRotation, stagesForTorque);

  const stages: RecommendedStage[] = [];
  for (let i = 1; i <= totalStages; i++) {
    stages.push({
      stageNumber: i,
      maxTranslationMm: 0.25,
      maxRotationDeg: 1.5,
      maxTorqueDeg: 2.0,
    });
  }
  return stages;
}

function computeBiomechanicalScore(
  hasCollisions: boolean,
  pdlOverloadTeeth: number[],
  excessiveMovements: ExcessiveMovement[],
  anchorageDemandScore: number,
): number {
  let score = 100;
  score -= pdlOverloadTeeth.length * 8;
  score -= excessiveMovements.length * 5;
  if (hasCollisions) score -= 15;
  score -= Math.floor(anchorageDemandScore / 10) * 2;
  return Math.max(0, Math.min(100, score));
}

// ─── PDL area constants (Melsen 2001, cm²) per tooth type ────────────────────
// These constants are used by the enhanced BRI computation below.
const PDL_AREA_BY_TOOTH: Record<string, number> = {
  central_incisor:  1.54,
  lateral_incisor:  1.04,
  canine:           2.04,
  first_premolar:   1.51,
  second_premolar:  1.57,
  first_molar:      4.42,
  second_molar:     4.06,
  third_molar:      3.09,
};

/** Maps an FDI tooth number to its anatomic type name (for PDL area & root length look-ups). */
function fdiToToothType(fdi: number): string {
  const n = fdi % 10;
  if (n === 1) return 'central_incisor';
  if (n === 2) return 'lateral_incisor';
  if (n === 3) return 'canine';
  if (n === 4) return 'first_premolar';
  if (n === 5) return 'second_premolar';
  if (n === 6) return 'first_molar';
  if (n === 7) return 'second_molar';
  return 'third_molar';
}

/** Root length estimates — Andrews norms (mm). Used as moment arm input. */
const ROOT_LENGTH_MM: Record<string, number> = {
  central_incisor:  13,
  lateral_incisor:  14,
  canine:           17,
  first_premolar:   14,
  second_premolar:  15,
  first_molar:      13,
  second_molar:     13,
  third_molar:      13,
};

/** Moment threshold (N·mm) above which bodily root movement is occurring. */
const MOMENT_THRESHOLD_NMM = 15;

// ─── Enhanced BRI — Bone Remodeling Index (Melsen 2001) ──────────────────────

export interface BriResult {
  bri: number;
  interpretation: string;
  isHyalinizing: boolean;
}

/**
 * Computes the enhanced Bone Remodeling Index (Melsen 2001).
 *
 * @param force                 Applied force in grams-force.
 * @param pdlArea               PDL area in cm² (from PDL_AREA_BY_TOOTH).
 * @param corticalProximityFactor  1.0 = no cortical bone proximity; >1 = elevated risk.
 */
function computeEnhancedBRI(
  force: number,
  pdlArea: number,
  corticalProximityFactor = 1.0,
): BriResult {
  const stress = force / pdlArea;             // g/cm²
  const bri    = stress * corticalProximityFactor;
  const isHyalinizing = bri > 26;             // Melsen 2001: 26 g/cm² triggers hyalinization
  const interpretation =
    bri < 10  ? 'Optimal remodeling zone'
    : bri < 20 ? 'Acceptable remodeling — monitor'
    : bri < 26 ? 'Elevated stress — consider reducing force'
    :            'Hyalinization risk — force exceeds PDL capacity';
  return { bri: parseFloat(bri.toFixed(3)), interpretation, isHyalinizing };
}

// ─── Force balance analysis ───────────────────────────────────────────────────

export interface ForceBalanceResult {
  /** Net resultant force on arch (g). Approaches 0 for well-balanced treatment. */
  netResultantForce: number;
  /** Sum of all moments (N·mm). Approaches 0 for balanced treatment. */
  momentSum: number;
  /** Reactive load the anchor units must resist (g). */
  reactiveForceOnAnchors: number;
  /** demand / supply ratio — >1.0 means anchorage is insufficient. */
  anchorageSupplyRatio: number;
  isBalanced: boolean;
}

function computeForceBalance(
  teeth: ToothState[],
  forceEstimates: AlignmentForceEstimate[],
): ForceBalanceResult {
  const forceMap = new Map<number, number>(
    forceEstimates.map((f) => [f.fdi, f.estimatedForceGrams]),
  );

  let netForce    = 0;
  let momentSum   = 0;
  let anchorDemand = 0;
  let anchorSupply = 0;

  for (const tooth of teeth) {
    const forceG  = forceMap.get(tooth.fdi) ?? 0;
    const netDispl =
      (tooth.mesialMm - tooth.distalMm) + (tooth.buccalMm - tooth.lingualMm);

    netForce += forceG * (netDispl === 0 ? 1 : Math.sign(netDispl));

    // Moment (N·mm): convert g-force → N (×0.009807) then multiply by half root length
    const rootLength  = ROOT_LENGTH_MM[fdiToToothType(tooth.fdi)] ?? 13;
    momentSum += (forceG * 0.009807) * (rootLength / 2);

    // Classify tooth as anchor unit if displacement is small
    const isAnchor = Math.abs(netDispl) < 0.1 && Math.abs(tooth.torqueDeg) < 2;
    if (isAnchor) {
      anchorSupply += DIFFICULTY[tooth.fdi] ?? 1.0;
    } else {
      anchorDemand += forceG;
    }
  }

  // Each DIFFICULTY unit ≈ 50 g anchorage capacity (calibration constant)
  const anchorageSupplyRatio =
    anchorSupply > 0 ? anchorDemand / (anchorSupply * 50) : 999;

  return {
    netResultantForce:      parseFloat(Math.abs(netForce).toFixed(2)),
    momentSum:              parseFloat(Math.abs(momentSum).toFixed(3)),
    reactiveForceOnAnchors: parseFloat(Math.abs(netForce).toFixed(2)),
    anchorageSupplyRatio:   parseFloat(anchorageSupplyRatio.toFixed(3)),
    isBalanced:             Math.abs(netForce) < 50 && anchorageSupplyRatio < 1.5,
  };
}

// ─── Moment of force per tooth ────────────────────────────────────────────────

export interface ToothMoment {
  fdi: number;
  forceGrams: number;
  momentArmMm: number;
  momentNMm: number;
  /** True when moment exceeds 15 N·mm — bodily root movement is implied */
  requiresRootMovement: boolean;
}

function estimateMoments(
  teeth: ToothState[],
  forceEstimates: AlignmentForceEstimate[],
): ToothMoment[] {
  const forceMap = new Map<number, number>(
    forceEstimates.map((f) => [f.fdi, f.estimatedForceGrams]),
  );
  return teeth.map((tooth) => {
    const forceG      = forceMap.get(tooth.fdi) ?? 0;
    const rootLength  = ROOT_LENGTH_MM[fdiToToothType(tooth.fdi)] ?? 13;
    const momentArmMm = rootLength / 2;                            // centre of resistance ≈ ½ root
    const momentNMm   = parseFloat(((forceG * 0.009807) * momentArmMm).toFixed(3));
    return {
      fdi: tooth.fdi,
      forceGrams: forceG,
      momentArmMm,
      momentNMm,
      requiresRootMovement: momentNMm > MOMENT_THRESHOLD_NMM,
    };
  });
}

/** Convenience alias used by generateBiomechanicsExplanation. */
export type BiomechanicsResult = BiomechanicalAnalysis;

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapAnalysisRow(r: Record<string, unknown>): BiomechanicalAnalysis {
  return {
    id: r['id'] as string,
    organizationId: r['organization_id'] as string,
    digitalSetupId: r['digital_setup_id'] as string,
    movementFeasible: r['movement_feasible'] as boolean,
    hasCollisions: r['has_collisions'] as boolean,
    collisionPairs: (r['collision_pairs'] as CollisionPair[]) ?? [],
    maxPdlStressPercentage: parseFloat(r['max_pdl_stress_percentage'] as string),
    pdlOverloadTeeth: (r['pdl_overload_teeth'] as number[]) ?? [],
    excessiveMovements: (r['excessive_movements'] as ExcessiveMovement[]) ?? [],
    anchorageDemandScore: r['anchorage_demand_score'] as number,
    iprRequirements: (r['ipr_requirements'] as IprRequirement[]) ?? [],
    attachmentRequirements: (r['attachment_requirements'] as AttachmentRequirement[]) ?? [],
    rootCollisionRisk: (r['root_collision_risk'] as number[]) ?? [],
    alignerForceEstimates: (r['aligner_force_estimates'] as AlignmentForceEstimate[]) ?? [],
    stagingFeasible: r['staging_feasible'] as boolean,
    recommendedStaging: (r['recommended_staging'] as RecommendedStage[]) ?? [],
    biomechanicalScore: r['biomechanical_score'] as number,
    createdAt: r['created_at'] as Date,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BiomechanicsService {
  private readonly logger = new Logger(BiomechanicsService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ── Phase 23: analyze a digital setup ──────────────────────────────────────

  async analyzeBiomechanics(
    orgId: string,
    setupId: string,
  ): Promise<BiomechanicalAnalysis> {
    // Fetch digital setup
    const { rows: setupRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT tooth_positions FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!setupRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    const teeth = (setupRows[0]['tooth_positions'] as ToothState[]) ?? [];

    // ── 1. PDL stress analysis ─────────────────────────────────────────────
    const pdlOverloadTeeth: number[] = [];
    let maxPdlStress = 0;

    for (const tooth of teeth) {
      const pdlStress = computePdlStress(tooth);
      if (pdlStress > maxPdlStress) maxPdlStress = pdlStress;
      if (pdlStress > 120) pdlOverloadTeeth.push(tooth.fdi);
    }

    // ── 2. Collision detection ─────────────────────────────────────────────
    const toothMap = new Map<number, ToothState>(teeth.map((t) => [t.fdi, t]));
    const collisionPairs: CollisionPair[] = [];

    for (const [fdiA, fdiB] of ALL_ADJACENT) {
      const tA = toothMap.get(fdiA);
      const tB = toothMap.get(fdiB);
      if (!tA || !tB) continue;
      // Estimate centroid displacement along mesial-distal axis
      const netDisplA = tA.mesialMm - tA.distalMm;
      const netDisplB = tB.distalMm - tB.mesialMm;
      const crowding = netDisplA + netDisplB;
      const threshold = (CROWN_WIDTH[fdiA] ?? 7) * 0.08; // 8% crown width
      if (crowding > threshold) {
        collisionPairs.push({
          fdiA,
          fdiB,
          estimatedOverlapMm: parseFloat((crowding - threshold).toFixed(3)),
        });
      }
    }

    const hasCollisions = collisionPairs.length > 0;

    // ── 3. Excessive movements ─────────────────────────────────────────────
    const excessiveMovements: ExcessiveMovement[] = [];
    for (const tooth of teeth) {
      const checks: { field: keyof ToothState; threshold: number }[] = [
        { field: 'mesialMm',       threshold: 5 },
        { field: 'distalMm',       threshold: 5 },
        { field: 'buccalMm',       threshold: 5 },
        { field: 'lingualMm',      threshold: 5 },
        { field: 'intrusionMm',    threshold: 5 },
        { field: 'extrusionMm',    threshold: 5 },
        { field: 'mesialRotDeg',   threshold: 45 },
        { field: 'distalRotDeg',   threshold: 45 },
        { field: 'torqueDeg',      threshold: 25 },
      ];
      for (const { field, threshold } of checks) {
        const val = Math.abs(tooth[field] as number);
        if (val > threshold) {
          excessiveMovements.push({ fdi: tooth.fdi, field, value: val, threshold });
        }
      }
    }

    // ── 4. Anchorage demand score ──────────────────────────────────────────
    const anchorageDemandScore = computeAnchorageDemand(teeth);

    // ── 5. IPR requirements ────────────────────────────────────────────────
    const iprRequirements: IprRequirement[] = [];
    for (const [fdiA, fdiB] of ALL_ADJACENT) {
      const tA = toothMap.get(fdiA);
      const tB = toothMap.get(fdiB);
      if (!tA || !tB) continue;
      // If adjacent teeth are converging to < 0.1mm clearance
      const displacementToward = tA.mesialMm + tB.distalMm;
      if (displacementToward > 0.1) {
        iprRequirements.push({
          mesialTooth: fdiA,
          distalTooth: fdiB,
          requiredReductionMm: parseFloat(Math.min(displacementToward, 0.5).toFixed(2)),
        });
      }
    }

    // ── 6. Attachment requirements ─────────────────────────────────────────
    const attachmentRequirements: AttachmentRequirement[] = [];
    for (const tooth of teeth) {
      const rotation = Math.abs(tooth.mesialRotDeg + tooth.distalRotDeg);
      const torque   = Math.abs(tooth.torqueDeg);
      if (rotation > 10) {
        attachmentRequirements.push({
          fdi: tooth.fdi,
          indication: `Rotation ${rotation.toFixed(1)}° requires attachment for adequate force couple`,
        });
      } else if (torque > 15) {
        attachmentRequirements.push({
          fdi: tooth.fdi,
          indication: `Torque ${torque.toFixed(1)}° requires attachment for root control`,
        });
      }
    }

    // ── 7. Root collision risk ─────────────────────────────────────────────
    const rootCollisionRisk: number[] = [];
    for (const [fdiA, fdiB] of ALL_ADJACENT) {
      const tA = toothMap.get(fdiA);
      const tB = toothMap.get(fdiB);
      if (!tA || !tB) continue;
      if (Math.abs(tA.rootTipDeg) > 5 && Math.abs(tB.rootTipDeg) > 5) {
        if (!rootCollisionRisk.includes(fdiA)) rootCollisionRisk.push(fdiA);
        if (!rootCollisionRisk.includes(fdiB)) rootCollisionRisk.push(fdiB);
      }
    }

    // ── 8. Aligner force estimates ─────────────────────────────────────────
    const alignerForceEstimates = teeth
      .map(estimateForce)
      .filter((f) => f.estimatedForceGrams > 0);

    // ── 9. Staging feasibility ─────────────────────────────────────────────
    const stagingFeasible = maxPdlStress < 200;
    const recommendedStaging = computeRecommendedStaging(teeth);

    // ── 10. Overall biomechanical score ───────────────────────────────────
    const biomechanicalScore = computeBiomechanicalScore(
      hasCollisions, pdlOverloadTeeth, excessiveMovements, anchorageDemandScore,
    );

    const movementFeasible =
      excessiveMovements.length === 0 &&
      pdlOverloadTeeth.length === 0 &&
      !hasCollisions;

    // Persist result
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO biomechanical_analyses (
         organization_id, digital_setup_id,
         movement_feasible, has_collisions, collision_pairs,
         max_pdl_stress_percentage, pdl_overload_teeth, excessive_movements,
         anchorage_demand_score, ipr_requirements, attachment_requirements,
         root_collision_risk, aligner_force_estimates,
         staging_feasible, recommended_staging, biomechanical_score,
         created_at
       ) VALUES (
         $1, $2,
         $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         $12, $13,
         $14, $15, $16,
         now()
       ) RETURNING *`,
      [
        orgId, setupId,
        movementFeasible, hasCollisions, JSON.stringify(collisionPairs),
        parseFloat(maxPdlStress.toFixed(2)),
        JSON.stringify(pdlOverloadTeeth),
        JSON.stringify(excessiveMovements),
        anchorageDemandScore,
        JSON.stringify(iprRequirements),
        JSON.stringify(attachmentRequirements),
        JSON.stringify(rootCollisionRisk),
        JSON.stringify(alignerForceEstimates),
        stagingFeasible,
        JSON.stringify(recommendedStaging),
        biomechanicalScore,
      ],
    );

    this.logger.log(
      `Biomechanical analysis for setup ${setupId}: score ${biomechanicalScore}, ` +
      `feasible=${movementFeasible}, collisions=${collisionPairs.length}`,
    );
    return mapAnalysisRow(rows[0]!);
  }

  async getLatestAnalysis(
    orgId: string,
    setupId: string,
  ): Promise<BiomechanicalAnalysis | null> {
    // Verify org owns the setup
    const { rows: ownerRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT id FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!ownerRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM biomechanical_analyses
       WHERE digital_setup_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [setupId, orgId],
    );
    if (!rows[0]) return null;
    return mapAnalysisRow(rows[0]);
  }

  // ── Clinical explanation generator ────────────────────────────────────────

  /**
   * Produces a clinician-friendly text explanation of a biomechanical analysis.
   * Incorporates BRI per tooth, force balance, moment threshold flags, and
   * overall score interpretation.
   *
   * @param analysis  Result from analyzeBiomechanics or getLatestAnalysis.
   * @param teeth     Optional tooth states from the digital setup; required for
   *                  per-tooth BRI and force-balance calculations.
   */
  generateBiomechanicsExplanation(
    analysis: BiomechanicsResult,
    teeth: ToothState[] = [],
  ): string {
    const lines: string[] = [];

    if (analysis.alignerForceEstimates.length > 0) {
      const forceBalance = computeForceBalance(teeth, analysis.alignerForceEstimates);
      const moments      = estimateMoments(teeth, analysis.alignerForceEstimates);

      for (const fe of analysis.alignerForceEstimates) {
        const toothType = fdiToToothType(fe.fdi);
        const pdlArea   = PDL_AREA_BY_TOOTH[toothType] ?? 1.54;
        const briRes    = computeEnhancedBRI(fe.estimatedForceGrams, pdlArea);
        const momentRes = moments.find((m) => m.fdi === fe.fdi);

        if (briRes.bri > 10) {
          lines.push(
            `Tooth ${fe.fdi}: estimated force ${fe.estimatedForceGrams}g — ` +
            `PDL stress index ${briRes.bri.toFixed(1)} g/cm² (${briRes.interpretation}).` +
            (briRes.isHyalinizing
              ? ` Approaches hyalinization threshold (26 g/cm²) — consider reducing force or extending staging by 2+ stages.`
              : ''),
          );
        }

        if (momentRes?.requiresRootMovement) {
          lines.push(
            `Tooth ${fe.fdi}: moment ${momentRes.momentNMm} N·mm ` +
            `(arm ${momentRes.momentArmMm}mm) exceeds 15 N·mm root-movement threshold. ` +
            `Bodily translation likely — attachment recommended for adequate root control.`,
          );
        }
      }

      lines.push(
        `Force balance: net resultant ${forceBalance.netResultantForce}g ` +
        `(${forceBalance.isBalanced ? 'balanced' : 'imbalanced — review anchor unit selection'}). ` +
        `Anchorage demand/supply ratio: ${forceBalance.anchorageSupplyRatio.toFixed(2)}` +
        `${forceBalance.anchorageSupplyRatio > 1.0 ? ' — anchorage reinforcement advised (TADs or additional anchor teeth)' : ''}.`,
      );
    }

    if (analysis.pdlOverloadTeeth.length > 0) {
      lines.push(
        `PDL overload detected on teeth: ${analysis.pdlOverloadTeeth.join(', ')}. ` +
        `Reduce per-stage force delivery or add intermediate active stages.`,
      );
    }

    if (analysis.hasCollisions && analysis.collisionPairs.length > 0) {
      const pairStr = analysis.collisionPairs
        .map((p) => `${p.fdiA}–${p.fdiB} (${p.estimatedOverlapMm}mm overlap)`)
        .join(', ');
      lines.push(
        `Interproximal collision risk: ${pairStr}. ` +
        `IPR or staging adjustment recommended before these contacts close.`,
      );
    }

    if (analysis.rootCollisionRisk.length > 0) {
      lines.push(
        `Root collision risk flagged on teeth: ${analysis.rootCollisionRisk.join(', ')}. ` +
        `CBCT or periapical radiographs advised to confirm inter-radicular clearance.`,
      );
    }

    lines.push(
      `Overall biomechanical score: ${analysis.biomechanicalScore}/100. ` +
      (analysis.biomechanicalScore >= 80
        ? 'Treatment plan appears clinically feasible.'
        : analysis.biomechanicalScore >= 60
        ? 'Moderate concerns — clinician review recommended before proceeding.'
        : 'Significant biomechanical concerns — plan revision strongly advised.'),
    );

    lines.push('[AI-assisted recommendation only — clinician review required before treatment.]');
    return lines.join('\n');
  }

  /**
   * Computes the Enhanced BRI for every tooth in a force estimate list.
   * Useful for batch reporting without persisting a full analysis.
   */
  computeEnhancedBriForEstimates(
    forceEstimates: AlignmentForceEstimate[],
    corticalProximityByFdi: Record<number, number> = {},
  ): Array<BriResult & { fdi: number; toothType: string; pdlAreaCm2: number }> {
    return forceEstimates.map((fe) => {
      const toothType = fdiToToothType(fe.fdi);
      const pdlArea   = PDL_AREA_BY_TOOTH[toothType] ?? 1.54;
      const cpFactor  = corticalProximityByFdi[fe.fdi] ?? 1.0;
      const bri       = computeEnhancedBRI(fe.estimatedForceGrams, pdlArea, cpFactor);
      return { fdi: fe.fdi, toothType, pdlAreaCm2: pdlArea, ...bri };
    });
  }

  // ── Legacy: assess a treatment plan (uses biomechanics_assessments table) ───

  async assessPlan(planId: string, caseId: string, orgId: string) {
    const { rows: ownerRows } = await this.pool.query(
      `SELECT c.id FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!ownerRows[0]) throw new NotFoundException('Case not found');

    const { rows: planRows } = await this.pool.query(
      `SELECT id FROM treatment_plans WHERE id = $1 AND case_id = $2`,
      [planId, caseId],
    );
    if (!planRows[0]) throw new NotFoundException('Treatment plan not found');

    const { rows: stages } = await this.pool.query(
      `SELECT id, stage_number, movement_data
       FROM aligner_stages WHERE treatment_plan_id = $1 ORDER BY stage_number`,
      [planId],
    );

    const findings: StageFinding[] = [];
    let safeCount = 0;
    let warnCount = 0;
    let unsafeCount = 0;
    let totalDifficulty = 0;
    let rootControlScore = 0;
    let collisionPairsCount = 0;

    for (const stage of stages) {
      const md = (stage['movement_data'] as Record<string, Record<string, number>>) ?? {};
      const stageNum = stage['stage_number'] as number;
      let stageWorst: 'safe' | 'warning' | 'unsafe' = 'safe';

      for (const [fdiStr, mv] of Object.entries(md)) {
        const fdi = Number(fdiStr);
        for (const [field, value] of Object.entries(mv)) {
          if (value === 0) continue;
          const absVal = Math.abs(value);
          const { status, limit } = classifyField(field, absVal);
          if (status !== 'safe') {
            const diff = DIFFICULTY[fdi] ?? 1.0;
            totalDifficulty += diff * absVal;
            if (field === 'torqueDeg' || field === 'tipDeg') rootControlScore += absVal;
            findings.push({
              stageNumber: stageNum, fdi, field, value, status, limit,
              explanation: `${field} = ${value.toFixed(3)} exceeds ${status} threshold ${limit} for FDI ${fdi}`,
            });
            if (status === 'unsafe') stageWorst = 'unsafe';
            else if (status === 'warning' && stageWorst !== 'unsafe') stageWorst = 'warning';
          }
        }
      }

      const fdis = Object.keys(md).map(Number).sort((a, b) => a - b);
      for (let i = 0; i < fdis.length - 1; i++) {
        const a = fdis[i]!;
        const b = fdis[i + 1]!;
        if (Math.floor(a / 10) !== Math.floor(b / 10)) continue;
        const mvA = md[String(a)] ?? {};
        const mvB = md[String(b)] ?? {};
        const clearance = (CROWN_WIDTH[a] ?? 7) * 0.1;
        const netDisp = Math.abs((mvA['mesialMm'] ?? 0) - (mvB['distalMm'] ?? 0));
        if (netDisp > clearance) {
          collisionPairsCount++;
          findings.push({
            stageNumber: stageNum, fdi: a, field: 'collision',
            value: netDisp, status: 'warning', limit: clearance,
            explanation: `Potential contact risk between FDI ${a}–${b}: net displacement ${netDisp.toFixed(2)} mm > clearance ${clearance.toFixed(2)} mm`,
          });
        }
      }

      if (stageWorst === 'unsafe') unsafeCount++;
      else if (stageWorst === 'warning') warnCount++;
      else safeCount++;
    }

    const n = stages.length;
    const overallStatus = unsafeCount > 0 ? 'unsafe' : warnCount > 0 ? 'warning' : 'safe';
    const anchorageScore = Math.min(100, Math.round(totalDifficulty * 5));
    const rcScore = Math.min(100, Math.round(rootControlScore * 10));
    const diffScore = Math.min(100, Math.round(anchorageScore * 0.6 + rcScore * 0.4));

    const { rows: saved } = await this.pool.query(
      `INSERT INTO biomechanics_assessments
         (case_id, treatment_plan_id, overall_status, stage_count,
          safe_stage_count, warning_stage_count, unsafe_stage_count,
          anchorage_score, root_control_score, difficulty_score,
          collision_pairs, findings, assessed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [caseId, planId, overallStatus, n, safeCount, warnCount, unsafeCount,
       anchorageScore, rcScore, diffScore, collisionPairsCount, JSON.stringify(findings)],
    );

    if (!saved[0]) {
      await this.pool.query(
        `UPDATE biomechanics_assessments
         SET overall_status = $3, stage_count = $4,
             safe_stage_count = $5, warning_stage_count = $6, unsafe_stage_count = $7,
             anchorage_score = $8, root_control_score = $9, difficulty_score = $10,
             collision_pairs = $11, findings = $12, assessed_at = now()
         WHERE case_id = $1 AND treatment_plan_id = $2`,
        [caseId, planId, overallStatus, n, safeCount, warnCount, unsafeCount,
         anchorageScore, rcScore, diffScore, collisionPairsCount, JSON.stringify(findings)],
      );
    }

    this.logger.log(`Biomechanics assessment for plan ${planId}: ${overallStatus} (${n} stages, ${findings.length} findings)`);
    return {
      planId, caseId, overallStatus, stageCount: n,
      safeStageCount: safeCount, warningStageCount: warnCount, unsafeStageCount: unsafeCount,
      anchorageScore, rootControlScore: rcScore, difficultyScore: diffScore,
      collisionPairs: collisionPairsCount, findings,
      disclaimer: 'Biomechanics assessment is a clinical decision-support tool. Clinician review required before treatment.',
    };
  }

  async getAssessment(planId: string, caseId: string, orgId: string) {
    const { rows: ownerRows } = await this.pool.query(
      `SELECT c.id FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!ownerRows[0]) throw new NotFoundException('Case not found');

    const { rows } = await this.pool.query(
      `SELECT * FROM biomechanics_assessments
       WHERE treatment_plan_id = $1 AND case_id = $2
       ORDER BY assessed_at DESC LIMIT 1`,
      [planId, caseId],
    );
    if (!rows[0]) return null;
    return this.formatAssessment(rows[0] as Record<string, unknown>);
  }

  private formatAssessment(r: Record<string, unknown>) {
    return {
      id: r['id'] as string,
      planId: r['treatment_plan_id'] as string,
      caseId: r['case_id'] as string,
      overallStatus: r['overall_status'] as string,
      stageCount: r['stage_count'] as number,
      safeStageCount: r['safe_stage_count'] as number,
      warningStageCount: r['warning_stage_count'] as number,
      unsafeStageCount: r['unsafe_stage_count'] as number,
      anchorageScore: r['anchorage_score'] as number | null,
      rootControlScore: r['root_control_score'] as number | null,
      difficultyScore: r['difficulty_score'] as number | null,
      collisionPairs: r['collision_pairs'] as number,
      findings: r['findings'] as unknown[],
      assessedAt: r['assessed_at'] as Date,
    };
  }
}
