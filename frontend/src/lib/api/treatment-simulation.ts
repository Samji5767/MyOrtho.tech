const BASE = '/api';

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

export async function generateSimulation(
  caseId: string,
  planId: string,
): Promise<TreatmentSimulation> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/simulation/generate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSimulation(
  caseId: string,
  planId: string,
): Promise<TreatmentSimulation> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/simulation`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSimulationFrame(
  caseId: string,
  planId: string,
  stageNum: number,
): Promise<SimulationFrame> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/simulation/frames/${stageNum}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getArchCoordination(
  caseId: string,
  planId: string,
): Promise<ArchCoordination> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/simulation/arch-coordination`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
