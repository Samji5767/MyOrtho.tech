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
