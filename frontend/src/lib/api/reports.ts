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

// Practice-level reports

export interface PracticeSummaryReport {
  generatedAt: string;
  period: { from: string; to: string };
  cases: { total: number; byStatus: Record<string, number>; completedThisMonth: number; newThisMonth: number };
  patients: { total: number; newThisMonth: number };
  locations: number;
}

export const downloadCasesCSV = (period?: string): Promise<string> =>
  api.get<string>(`/api/reports/cases/csv${period ? `?period=${period}` : ''}`);

export const getPracticeSummary = (period?: string): Promise<PracticeSummaryReport> =>
  api.get<PracticeSummaryReport>(`/api/reports/practice-summary${period ? `?period=${period}` : ''}`);
