import { api, ApiError } from './client';

export interface AnalyticsSummary {
  totalCases: number;
  totalPatients: number;
  casesByStatus: Record<string, number>;
  monthlyThroughput: { month: string; count: number }[];
  planApprovalRate: number | null;
  avgEstimatedStages: number | null;
}

export async function fetchAnalyticsSummary(): Promise<{ data: AnalyticsSummary; source: 'api' | 'demo' }> {
  try {
    const data = await api.get<AnalyticsSummary>('/api/analytics/summary');
    return { data, source: 'api' };
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0) throw err;
    // Representative fallback while backend is unreachable
    return {
      source: 'demo',
      data: {
        totalCases: 47,
        totalPatients: 38,
        casesByStatus: {
          active_treatment: 12,
          scan_review: 6,
          planning: 11,
          manufacturing: 12,
          completed: 5,
          draft: 1,
        },
        monthlyThroughput: [
          { month: '2026-01', count: 31 },
          { month: '2026-02', count: 28 },
          { month: '2026-03', count: 35 },
          { month: '2026-04', count: 41 },
          { month: '2026-05', count: 38 },
          { month: '2026-06', count: 47 },
        ],
        planApprovalRate: 92,
        avgEstimatedStages: 22.4,
      },
    };
  }
}
