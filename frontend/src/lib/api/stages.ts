import { api } from './client';

export interface ToothMovement {
  tx?: number; ty?: number; tz?: number;
  rx?: number; ry?: number; rz?: number;
}

export interface AttachmentEvent {
  tooth: string;
  type: 'rectangular' | 'beveled' | 'optimized' | 'power_ridge';
  shape?: string;
}

export interface IprEvent {
  toothA: string;
  toothB: string;
  amountMm: number;
}

export interface AlignerStage {
  id: string;
  treatmentPlanId: string;
  caseId: string;
  stageNumber: number;
  movementData: Record<string, ToothMovement>;
  attachmentData: AttachmentEvent[];
  iprData: IprEvent[];
  maxillaryMeshPath: string | null;
  mandibularMeshPath: string | null;
  velocityMmPerWeek: number | null;
  isApproved: boolean;
  approvedByEmail: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export const listStages = (caseId: string, planId: string) =>
  api.get<AlignerStage[]>(`/api/cases/${caseId}/plans/${planId}/stages`);

export const createStage = (caseId: string, planId: string, dto: Partial<AlignerStage>) =>
  api.post<AlignerStage>(`/api/cases/${caseId}/plans/${planId}/stages`, dto);

export const generateStages = (
  caseId: string,
  planId: string,
  dto: { count: number; baseVelocityMmPerWeek?: number; teethToMove?: string[] },
) => api.post<AlignerStage[]>(`/api/cases/${caseId}/plans/${planId}/stages/generate`, dto);

export const approveStage = (caseId: string, planId: string, stageId: string) =>
  api.patch<AlignerStage>(`/api/cases/${caseId}/plans/${planId}/stages/${stageId}/approve`, {});

export const deleteStage = (caseId: string, planId: string, stageId: string) =>
  api.delete<void>(`/api/cases/${caseId}/plans/${planId}/stages/${stageId}`);
