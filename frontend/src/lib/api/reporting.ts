import { api } from './client';

export interface CaseReportData {
  reportId: string;
  caseId: string;
  generatedAt: string;
  patient: { id: string; firstName: string; lastName: string; dateOfBirth: string | null; gender: string | null };
  caseInfo: { status: string; chiefComplaint: string | null; malocclusionClass: string | null; notes: string | null; createdAt: string };
  analysis: {
    boltonOverall: number | null; boltonAnterior: number | null; angleClass: string | null;
    overjetMm: number | null; overbiteM: number | null; upperCrowdingMm: number | null;
    lowerCrowdingMm: number | null; complexityScore: number | null; iprSchedule: unknown[]; notes: string | null;
  } | null;
  treatmentPlan: { id: string; estimatedStages: number; doctorApproval: boolean; approvedAt: string | null; aiRecommendationNotes: string | null } | null;
  scans: { id: string; jawType: string; originalFilename: string; createdAt: string }[];
  workflowHistory: { toStatus: string; actorName: string | null; createdAt: string }[];
}

export interface CaseReport {
  id: string;
  reportType: string;
  status: 'generating' | 'ready' | 'failed';
  generatedAt: string | null;
  createdAt: string;
}

export const getCaseReportData = (caseId: string) =>
  api.get<CaseReportData>(`/api/cases/${caseId}/reports/data`);

export const listCaseReports = (caseId: string) =>
  api.get<CaseReport[]>(`/api/cases/${caseId}/reports`);

export const requestReport = (caseId: string, reportType = 'clinical_summary') =>
  api.post<{ reportId: string; status: string }>(`/api/cases/${caseId}/reports`, { reportType });
