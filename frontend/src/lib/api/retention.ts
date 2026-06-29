const BASE = '/api';

export type RetainerType = 'essix_full' | 'essix_partial' | 'hawley' | 'fixed_lingual' | 'vivera' | 'combo';

export interface RelapseFactor {
  id: string;
  factorType: string;
  factorWeight: number;
  description: string;
  detectedValue: string | null;
}

export interface RetentionProtocol {
  id: string;
  planId: string;
  relapseRiskScore: number | null;
  relapseRiskLevel: 'low' | 'moderate' | 'high' | 'very_high' | null;
  primaryRetainerType: RetainerType;
  lowerRetainerType: string | null;
  totalRetentionMonths: number;
  nightOnlyStartsMonth: number | null;
  riskFactors: RelapseFactor[];
  clinicalNotes: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface WearPhase {
  id: string;
  phaseNum: number;
  startMonth: number;
  endMonth: number;
  wearHoursPerDay: number;
  wearLabel: string;
  clinicalInstruction: string | null;
}

export async function generateRetentionProtocol(
  caseId: string,
  planId: string,
): Promise<RetentionProtocol> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/retention/generate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRetentionProtocol(
  caseId: string,
  planId: string,
): Promise<RetentionProtocol> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/retention`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getWearSchedule(
  caseId: string,
  planId: string,
): Promise<WearPhase[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/retention/wear-schedule`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function approveRetentionProtocol(
  caseId: string,
  planId: string,
): Promise<RetentionProtocol> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/retention/approve`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
