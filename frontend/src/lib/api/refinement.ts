import { api } from "./client";

export interface RefinementCycle {
  id: string;
  caseId: string;
  planId: string;
  cycleNumber: number;
  restartFromStage: number;
  newScanId: string | null;
  status: "pending" | "planning" | "stages_generated" | "approved";
  newStagesGenerated: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRefinementDto {
  restartFromStage: number;
  newScanId?: string | null;
  notes?: string | null;
}

export function listRefinementCycles(caseId: string, planId: string): Promise<RefinementCycle[]> {
  return api.get<RefinementCycle[]>(`/api/cases/${caseId}/plans/${planId}/refinement`);
}

export function createRefinementCycle(
  caseId: string,
  planId: string,
  dto: CreateRefinementDto,
): Promise<RefinementCycle> {
  return api.post<RefinementCycle>(`/api/cases/${caseId}/plans/${planId}/refinement`, dto);
}

export function updateRefinementStatus(
  caseId: string,
  planId: string,
  cycleId: string,
  status: RefinementCycle["status"],
  newStagesGenerated?: number,
): Promise<RefinementCycle> {
  return api.patch<RefinementCycle>(
    `/api/cases/${caseId}/plans/${planId}/refinement/${cycleId}/status`,
    { status, newStagesGenerated },
  );
}

export function deleteRefinementCycle(caseId: string, planId: string, cycleId: string): Promise<void> {
  return api.delete<void>(`/api/cases/${caseId}/plans/${planId}/refinement/${cycleId}`);
}
