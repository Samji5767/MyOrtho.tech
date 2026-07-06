import { api } from './client';

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

export const coordinatePlan = (
  caseId: string,
  planId: string,
  strategy: 'simultaneous' | 'upper_first' | 'lower_first' | 'alternating',
  expansionCoordination?: boolean,
): Promise<ArchCoordinationPlan> =>
  api.post<ArchCoordinationPlan>(
    `/api/cases/${caseId}/plans/${planId}/arch-coordination/coordinate`,
    { strategy, expansionCoordination },
  );

export const getCoordinationPlan = (
  caseId: string,
  planId: string,
): Promise<ArchCoordinationPlan> =>
  api.get<ArchCoordinationPlan>(`/api/cases/${caseId}/plans/${planId}/arch-coordination`);

export const getCheckpoints = (
  caseId: string,
  planId: string,
): Promise<ArchCheckpoint[]> =>
  api.get<ArchCheckpoint[]>(`/api/cases/${caseId}/plans/${planId}/arch-coordination/checkpoints`);

export const evaluateCheckpoint = (
  caseId: string,
  planId: string,
  checkpointId: string,
  status: 'passed' | 'failed' | 'deferred',
  clinicalNote?: string,
): Promise<ArchCheckpoint> =>
  api.patch<ArchCheckpoint>(
    `/api/cases/${caseId}/plans/${planId}/arch-coordination/checkpoints/${checkpointId}/evaluate`,
    { status, clinicalNote },
  );

export const getSyncAllocations = (
  caseId: string,
  planId: string,
  arch?: 'upper' | 'lower',
): Promise<ArchSyncAllocation[]> => {
  const url = arch
    ? `/api/cases/${caseId}/plans/${planId}/arch-coordination/sync-allocations?arch=${arch}`
    : `/api/cases/${caseId}/plans/${planId}/arch-coordination/sync-allocations`;
  return api.get<ArchSyncAllocation[]>(url);
};

export const approveCoordinationPlan = (
  caseId: string,
  planId: string,
): Promise<ArchCoordinationPlan> =>
  api.post<ArchCoordinationPlan>(
    `/api/cases/${caseId}/plans/${planId}/arch-coordination/approve`,
    {},
  );
