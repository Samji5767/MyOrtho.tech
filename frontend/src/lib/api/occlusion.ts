import { api } from './client';

export interface OcclusionAnalysis {
  id: string;
  caseId: string;
  analysisDate: string;
  angleClass: string | null;
  overjetMm: number | null;
  overbitemm: number | null;
  midlineShiftMm: number | null;
  crossbiteTeeth: number[];
  openBiteTeeth: number[];
  crowdingUpperMm: number | null;
  crowdingLowerMm: number | null;
  tmjFindings: string | null;
  notes: string | null;
  recordedBy: string;
  createdAt: string;
}

export const listOcclusionAnalyses = (caseId: string) =>
  api.get<OcclusionAnalysis[]>(`/api/cases/${caseId}/occlusion`);

export const createOcclusionAnalysis = (
  caseId: string,
  dto: {
    analysisDate: string;
    angleClass?: string;
    overjetMm?: number;
    overbitemm?: number;
    midlineShiftMm?: number;
    crossbiteTeeth?: number[];
    openBiteTeeth?: number[];
    crowdingUpperMm?: number;
    crowdingLowerMm?: number;
    tmjFindings?: string;
    notes?: string;
  },
) => api.post<OcclusionAnalysis>(`/api/cases/${caseId}/occlusion`, dto);
