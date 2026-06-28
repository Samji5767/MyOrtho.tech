import { api } from "./client";

export interface IprPlanItem {
  id: string;
  caseId: string;
  planId: string;
  toothAFdi: number;
  toothBFdi: number;
  amountMm: number;
  beforeStage: number;
  remainingEnamelA: number | null;
  remainingEnamelB: number | null;
  safetyStatus: "safe" | "warning" | "unsafe";
  isAutoRecommended: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIprItemDto {
  toothAFdi: number;
  toothBFdi: number;
  amountMm: number;
  beforeStage: number;
  notes?: string | null;
}

export function listIprItems(caseId: string, planId: string): Promise<IprPlanItem[]> {
  return api.get<IprPlanItem[]>(`/api/cases/${caseId}/plans/${planId}/ipr`);
}

export function addIprItem(caseId: string, planId: string, dto: CreateIprItemDto): Promise<IprPlanItem> {
  return api.post<IprPlanItem>(`/api/cases/${caseId}/plans/${planId}/ipr`, dto);
}

export function deleteIprItem(caseId: string, planId: string, itemId: string): Promise<void> {
  return api.delete<void>(`/api/cases/${caseId}/plans/${planId}/ipr/${itemId}`);
}

export function autoRecommendIpr(
  caseId: string,
  planId: string,
): Promise<{ recommended: number; items: IprPlanItem[] }> {
  return api.post<{ recommended: number; items: IprPlanItem[] }>(
    `/api/cases/${caseId}/plans/${planId}/ipr/recommend`,
    {},
  );
}
