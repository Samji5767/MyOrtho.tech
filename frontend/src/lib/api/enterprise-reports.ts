import { api } from './client';

export interface PracticeSummaryReport {
  generatedAt: string;
  period: { from: string; to: string };
  cases: {
    total: number;
    byStatus: Record<string, number>;
    completedThisMonth: number;
    newThisMonth: number;
  };
  patients: { total: number; newThisMonth: number };
  locations: number;
}

export const getPracticeSummary = (period?: string): Promise<PracticeSummaryReport> =>
  api.get<PracticeSummaryReport>(
    `/api/reports/practice-summary${period ? `?period=${period}` : ''}`,
  );

export const getCasesCSVUrl = (period?: string): string =>
  `/api/reports/cases/csv${period ? `?period=${period}` : ''}`;
