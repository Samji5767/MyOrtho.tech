import type { Case } from "@/types";
import { apiService } from "@/services/api";

// TODO: Replace with direct Supabase/NestJS/FastAPI calls once backend is configured
export async function getCases(): Promise<Case[]> {
  try {
    return await apiService.getCases();
  } catch {
    return [];
  }
}

export async function createCase(
  patientId: string,
  patientName: string,
  notes: string
): Promise<Case | null> {
  try {
    return await apiService.createCase(patientId, patientName, notes);
  } catch {
    return null;
  }
}

export async function updateCaseStatus(
  id: string,
  status: Case["status"]
): Promise<Case | null> {
  try {
    return await apiService.updateCaseStatus(id, status);
  } catch {
    return null;
  }
}
