import { api } from './client';

export interface IprEnamelEstimate {
  fdiA: number;
  fdiB: number;
  enamelAMm: number;
  enamelBMm: number;
  availableIprMm: number;
  recommendedIprMm: number;
  remainingEnamelMm: number;
  isSafe: boolean;
  warning: string | null;
}

export interface IprClinicalWarning {
  fdiA: number;
  fdiB: number;
  warningType: 'enamel_thin' | 'near_pulp' | 'excessive_removal' | 'root_proximity' | 'restoration_present';
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface IprOptimizationResult {
  totalIprMm: number;
  pairsOptimized: number;
  enamelSafetyPassed: boolean;
  clinicalWarningCount: number;
  optimizedItems: Array<{
    fdiA: number;
    fdiB: number;
    originalMm: number;
    optimizedMm: number;
    reason: string;
  }>;
}

export const optimizeIpr = (
  caseId: string,
  planId: string,
): Promise<IprOptimizationResult> =>
  api.post<IprOptimizationResult>(`/api/cases/${caseId}/plans/${planId}/ipr/optimize`, {});

export const getIprEnamelAnalysis = (
  caseId: string,
  planId: string,
): Promise<IprEnamelEstimate[]> =>
  api.get<IprEnamelEstimate[]>(`/api/cases/${caseId}/plans/${planId}/ipr/enamel-analysis`);

export const getIprClinicalWarnings = (
  caseId: string,
  planId: string,
): Promise<IprClinicalWarning[]> =>
  api.get<IprClinicalWarning[]>(`/api/cases/${caseId}/plans/${planId}/ipr/clinical-warnings`);
