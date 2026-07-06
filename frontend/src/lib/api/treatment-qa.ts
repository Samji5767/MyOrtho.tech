import { api } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TreatmentQAReport {
  id: string;
  organizationId: string;
  digitalSetupId: string;
  treatmentQualityScore: number;
  clinicalSafetyScore: number;
  manufacturingScore: number;
  overallScore: number;
  excessiveMovements: unknown[];
  collisionIssues: unknown[];
  pdlWarnings: unknown[];
  attachmentWarnings: unknown[];
  iprWarnings: unknown[];
  stagingIssues: unknown[];
  exportReady: boolean;
  issues: unknown[];
  warnings: unknown[];
  createdAt: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

/** Fetch the latest QA report for a digital setup (no new scan). */
export const getLatestQA = (setupId: string) =>
  api.get<TreatmentQAReport | null>(`/api/treatment-qa/${setupId}`);

/** Trigger a fresh QA check for a digital setup. */
export const runQACheck = (setupId: string) =>
  api.post<TreatmentQAReport>(`/api/treatment-qa/${setupId}`, {});
