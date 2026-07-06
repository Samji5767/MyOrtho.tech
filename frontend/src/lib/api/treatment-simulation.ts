import { api } from './client';

export interface ToothPosition {
  tx: number; ty: number; tz: number;
  rx: number; ry: number; rz: number;
}

export interface SimulationFrame {
  stageNum: number;
  toothPositions: Record<number, ToothPosition>;
  upperArchWidthMm: number | null;
  lowerArchWidthMm: number | null;
  overbiteM: number | null;
  overjetMm: number | null;
  midlineDeviationMm: number | null;
  isKeyframe: boolean;
}

export interface TreatmentSimulation {
  id: string;
  planId: string;
  totalFrames: number;
  archCoordinationScore: number | null;
  occlusionScore: number | null;
  smileArcScore: number | null;
  overjetInitialMm: number | null;
  overjetFinalMm: number | null;
  overbiteInitialMm: number | null;
  overbiteFinalmm: number | null;
  generationDurationMs: number | null;
  generatedAt: string;
}

export interface ArchCoordination {
  score: number;
  upperExpansionMm: number;
  lowerExpansionMm: number;
  imbalanceMm: number;
  recommendation: string;
}

export const generateSimulation = (
  caseId: string,
  planId: string,
): Promise<TreatmentSimulation> =>
  api.post<TreatmentSimulation>(`/api/cases/${caseId}/plans/${planId}/simulation/generate`, {});

export const getSimulation = (
  caseId: string,
  planId: string,
): Promise<TreatmentSimulation> =>
  api.get<TreatmentSimulation>(`/api/cases/${caseId}/plans/${planId}/simulation`);

export const getSimulationFrame = (
  caseId: string,
  planId: string,
  stageNum: number,
): Promise<SimulationFrame> =>
  api.get<SimulationFrame>(`/api/cases/${caseId}/plans/${planId}/simulation/frames/${stageNum}`);

export const getArchCoordination = (
  caseId: string,
  planId: string,
): Promise<ArchCoordination> =>
  api.get<ArchCoordination>(`/api/cases/${caseId}/plans/${planId}/simulation/arch-coordination`);
