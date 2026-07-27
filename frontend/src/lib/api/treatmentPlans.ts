import { api } from './client';

export interface TreatmentPlanSummary {
  id: string;
  caseId: string;
  createdByEmail: string;
  doctorApproval: boolean;
  doctorSignature?: string | null;
  approvedAt?: string | null;
  estimatedStages: number;
  aiRecommendationNotes?: string | null;
  createdAt: string;
  aiDisclaimer?: string;
}

export interface AlignStage {
  id: string;
  planId: string;
  stageNumber: number;
  movements: Record<string, unknown>;
  createdAt: string;
}

export function listPlans(caseId: string): Promise<TreatmentPlanSummary[]> {
  return api.get<TreatmentPlanSummary[]>(`/api/cases/${caseId}/plans`);
}

export function createPlan(
  caseId: string,
  dto: { estimatedStages: number; aiRecommendationNotes?: string },
): Promise<TreatmentPlanSummary> {
  return api.post<TreatmentPlanSummary>(`/api/cases/${caseId}/plans`, dto);
}

export function getPlan(caseId: string, planId: string): Promise<TreatmentPlanSummary> {
  return api.get<TreatmentPlanSummary>(`/api/cases/${caseId}/plans/${planId}`);
}

export function approvePlan(
  caseId: string,
  planId: string,
  doctorSignature: string,
): Promise<TreatmentPlanSummary> {
  return api.post<TreatmentPlanSummary>(`/api/cases/${caseId}/plans/${planId}/approve`, {
    doctorSignature,
  });
}

export function listStages(caseId: string, planId: string): Promise<AlignStage[]> {
  return api.get<AlignStage[]>(`/api/cases/${caseId}/plans/${planId}/stages`);
}

export function generateStages(
  caseId: string,
  planId: string,
  stageCount?: number,
): Promise<{ generated: number; planId: string; caseId: string }> {
  return api.post(`/api/cases/${caseId}/plans/${planId}/stages/generate`, {
    ...(stageCount !== undefined ? { stageCount } : {}),
  });
}

export function updatePlan(
  caseId: string,
  planId: string,
  dto: { estimatedStages?: number; aiRecommendationNotes?: string },
): Promise<TreatmentPlanSummary> {
  return api.patch<TreatmentPlanSummary>(`/api/cases/${caseId}/plans/${planId}`, dto);
}

export function deleteStage(caseId: string, planId: string, stageId: string): Promise<{ deleted: boolean }> {
  return api.delete(`/api/cases/${caseId}/plans/${planId}/stages/${stageId}`);
}

export interface ToothMovement {
  id: string;
  stageId: string;
  fdiNumber: number;
  translateX: number;
  translateY: number;
  translateZ: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  tip: number;
  torque: number;
  intrusion: number;
  extrusion: number;
  isLocked: boolean;
  notes: string | null;
}

export function getStageMovements(
  caseId: string,
  planId: string,
  stageId: string,
): Promise<ToothMovement[]> {
  return api.get<ToothMovement[]>(
    `/api/cases/${caseId}/plans/${planId}/stages/${stageId}/tooth-movements`,
  );
}
