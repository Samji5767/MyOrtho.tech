const BASE = '/api';

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

export async function optimizeIpr(
  caseId: string,
  planId: string,
): Promise<IprOptimizationResult> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/ipr/optimize`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getIprEnamelAnalysis(
  caseId: string,
  planId: string,
): Promise<IprEnamelEstimate[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/ipr/enamel-analysis`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getIprClinicalWarnings(
  caseId: string,
  planId: string,
): Promise<IprClinicalWarning[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/ipr/clinical-warnings`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
