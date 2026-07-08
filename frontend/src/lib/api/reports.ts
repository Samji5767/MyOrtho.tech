import { api } from './client';

export interface GeneratedReport {
  id: string;
  caseId: string;
  planId: string | null;
  reportType: string;
  title: string;
  contentMarkdown: string | null;
  contentJson: Record<string, unknown>;
  generatedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export const generateTreatmentSummary = (caseId: string): Promise<GeneratedReport> =>
  api.post<GeneratedReport>(`/api/cases/${caseId}/reports/treatment-summary`, {});

export const listReports = (caseId: string): Promise<GeneratedReport[]> =>
  api.get<GeneratedReport[]>(`/api/cases/${caseId}/reports`);

export const getReport = (caseId: string, reportId: string): Promise<GeneratedReport> =>
  api.get<GeneratedReport>(`/api/cases/${caseId}/reports/${reportId}`);
