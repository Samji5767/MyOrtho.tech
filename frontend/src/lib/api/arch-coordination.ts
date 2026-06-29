const BASE = '/api';

export interface ArchCoordinationPlan {
  id: string;
  planId: string;
  strategy: 'simultaneous' | 'upper_first' | 'lower_first' | 'alternating';
  upperTotalStages: number | null;
  lowerTotalStages: number | null;
  synchronizedStages: number | null;
  phaseOffsetStages: number;
  expansionCoordination: boolean;
  archWidthDiscrepancyMm: number | null;
  coordinationScore: number | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArchCheckpoint {
  id: string;
  coordinationId: string;
  checkpointStage: number;
  checkpointType: string;
  description: string;
  targetMetric: string | null;
  targetValueMm: number | null;
  toleranceMm: number | null;
  isMandatory: boolean;
  clinicalNote: string | null;
  status: 'pending' | 'passed' | 'failed' | 'deferred';
  evaluatedAt: string | null;
}

export interface ArchSyncAllocation {
  id: string;
  arch: 'upper' | 'lower';
  stageNum: number;
  synchronizedStage: number;
  toothFdi: number;
  movementType: string;
  amountMmOrDeg: number;
  isActive: boolean;
}

export async function coordinatePlan(
  caseId: string,
  planId: string,
  strategy: 'simultaneous' | 'upper_first' | 'lower_first' | 'alternating',
  expansionCoordination?: boolean,
): Promise<ArchCoordinationPlan> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/arch-coordination/coordinate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy, expansionCoordination }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCoordinationPlan(
  caseId: string,
  planId: string,
): Promise<ArchCoordinationPlan> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/arch-coordination`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCheckpoints(
  caseId: string,
  planId: string,
): Promise<ArchCheckpoint[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/arch-coordination/checkpoints`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function evaluateCheckpoint(
  caseId: string,
  planId: string,
  checkpointId: string,
  status: 'passed' | 'failed' | 'deferred',
  clinicalNote?: string,
): Promise<ArchCheckpoint> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/plans/${planId}/arch-coordination/checkpoints/${checkpointId}/evaluate`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, clinicalNote }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSyncAllocations(
  caseId: string,
  planId: string,
  arch?: 'upper' | 'lower',
): Promise<ArchSyncAllocation[]> {
  const url = arch
    ? `${BASE}/cases/${caseId}/plans/${planId}/arch-coordination/sync-allocations?arch=${arch}`
    : `${BASE}/cases/${caseId}/plans/${planId}/arch-coordination/sync-allocations`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function approveCoordinationPlan(
  caseId: string,
  planId: string,
): Promise<ArchCoordinationPlan> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/arch-coordination/approve`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
