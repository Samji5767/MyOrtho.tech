import { api } from './client';

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

const base = (caseId: string, planId: string) =>
  `/api/cases/${caseId}/plans/${planId}/retention`;

export const generateRetentionProtocol = (caseId: string, planId: string): Promise<RetentionProtocol> =>
  api.post<RetentionProtocol>(`${base(caseId, planId)}/generate`, {});

export const getRetentionProtocol = (caseId: string, planId: string): Promise<RetentionProtocol> =>
  api.get<RetentionProtocol>(base(caseId, planId));

export const getWearSchedule = (caseId: string, planId: string): Promise<WearPhase[]> =>
  api.get<WearPhase[]>(`${base(caseId, planId)}/wear-schedule`);

export const approveRetentionProtocol = (caseId: string, planId: string): Promise<RetentionProtocol> =>
  api.post<RetentionProtocol>(`${base(caseId, planId)}/approve`, {});
