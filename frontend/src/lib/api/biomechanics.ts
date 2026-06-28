import { api, ApiError } from "./client";

export interface BiomechanicsFinding {
  stageNumber: number;
  fdi: number;
  field: string;
  value: number;
  status: "safe" | "warning" | "unsafe";
  limit: number;
  explanation: string;
}

export interface BiomechanicsAssessment {
  planId: string;
  caseId: string;
  overallStatus: "safe" | "warning" | "unsafe" | "unknown";
  stageCount: number;
  safeStageCount: number;
  warningStageCount: number;
  unsafeStageCount: number;
  anchorageScore: number | null;
  rootControlScore: number | null;
  difficultyScore: number | null;
  collisionPairs: number;
  findings: BiomechanicsFinding[];
  assessedAt?: string;
  disclaimer?: string;
}

export async function fetchBiomechanicsAssessment(
  caseId: string,
  planId: string,
): Promise<BiomechanicsAssessment | null> {
  try {
    return await api.get<BiomechanicsAssessment>(
      `/api/cases/${caseId}/plans/${planId}/biomechanics`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function runBiomechanicsAssessment(
  caseId: string,
  planId: string,
): Promise<BiomechanicsAssessment> {
  return api.post<BiomechanicsAssessment>(
    `/api/cases/${caseId}/plans/${planId}/biomechanics/assess`,
    {},
  );
}
