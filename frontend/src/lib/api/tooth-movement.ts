import { api } from './client';

export interface ApprovalValidation {
  canApprove: boolean;
  score: number;
  blockers: Array<{ code: string; description: string; affectedTeeth?: number[] }>;
  warnings: Array<{ code: string; description: string; affectedTeeth?: number[] }>;
  summary: string;
}

/** Pre-approval validation — same persisted-data rules the approve endpoint enforces. */
export const validateApproval = (caseId: string, planId: string) =>
  api.get<ApprovalValidation>(`/api/cases/${caseId}/plans/${planId}/validate-approval`);
