import type { Patient } from "@/types";
import { apiService } from "@/services/api";

// TODO: Replace with direct Supabase/NestJS/FastAPI calls once backend is configured
export async function getPatients(): Promise<Patient[]> {
  try {
    return await apiService.getPatients();
  } catch {
    return [];
  }
}

export async function createPatient(
  firstName: string,
  lastName: string,
  dob: string,
  gender: string,
  clinicalNotes: string
): Promise<Patient | null> {
  try {
    return await apiService.createPatient(firstName, lastName, dob, gender, clinicalNotes);
  } catch {
    return null;
  }
}
