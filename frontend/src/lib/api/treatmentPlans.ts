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
