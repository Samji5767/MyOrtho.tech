import { api } from './client';

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

const base = (caseId: string, planId: string) =>
  `/api/cases/${caseId}/plans/${planId}/movements`;

export const upsertPrescription = (
  caseId: string,
  planId: string,
  dto: MovementPrescriptionDto,
) => api.post<MovementPrescription>(`${base(caseId, planId)}/prescriptions`, dto);

export const listPrescriptions = (caseId: string, planId: string) =>
  api.get<MovementPrescription[]>(`${base(caseId, planId)}/prescriptions`);

export const deletePrescription = (caseId: string, planId: string, fdi: number) =>
  api.delete<{ deleted: boolean }>(`${base(caseId, planId)}/prescriptions/${fdi}`);

export const approvePrescriptions = (caseId: string, planId: string) =>
  api.post<{ approvedCount: number }>(`${base(caseId, planId)}/approve`, {});

export const runSimulation = (caseId: string, planId: string) =>
  api.post<MovementSimulation>(`${base(caseId, planId)}/simulate`, {});

export const getSimulation = (caseId: string, planId: string) =>
  api.get<MovementSimulation>(`${base(caseId, planId)}/simulation`);

export const getPdlResults = (caseId: string, planId: string, stageNum: number) =>
  api.get<PdlResult[]>(`${base(caseId, planId)}/pdl/${stageNum}`);

export const getConstraintViolations = (caseId: string, planId: string) =>
  api.get<{ violations: ConstraintViolation[]; stagesNeeded: number }>(
    `${base(caseId, planId)}/constraints`,
  );

// ─── Clinical Analysis Types (Phase 2) ───────────────────────────────────────

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

// ─── Clinical Analysis API Functions (Phase 2) ───────────────────────────────

export const getEnhancedCollisions = (caseId: string, planId: string) =>
  api.get<{ pairs: EnhancedCollisionPair[] }>(`${base(caseId, planId)}/collisions`);

export const getRootSafety = (caseId: string, planId: string) =>
  api.get<{ results: RootSafetyResult[] }>(`${base(caseId, planId)}/root-safety`);

export const getDifficultyScore = (caseId: string, planId: string) =>
  api.get<DifficultyScoreBreakdown>(`${base(caseId, planId)}/difficulty`);

export const getForceHeatmap = (caseId: string, planId: string) =>
  api.get<{ teeth: ToothForceData[] }>(`${base(caseId, planId)}/force-heatmap`);

export const getMovementConflicts = (caseId: string, planId: string) =>
  api.get<{ conflicts: MovementConflict[] }>(`${base(caseId, planId)}/conflicts`);

export const getOvercorrectionSuggestions = (caseId: string, planId: string) =>
  api.get<{ suggestions: OvercorrectionSuggestion[] }>(
    `${base(caseId, planId)}/overcorrection-suggestions`,
  );

export const getRefinementRecommendations = (caseId: string, planId: string) =>
  api.get<{ recommendation: RefinementRecommendation }>(
    `${base(caseId, planId)}/refinement-recommendations`,
  );

export const validateApproval = (caseId: string, planId: string) =>
  api.get<ApprovalValidation>(`${base(caseId, planId)}/validate-approval`);
