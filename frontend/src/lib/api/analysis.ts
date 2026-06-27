import { api } from './client';

export interface IprEntry {
  stage: number;
  toothA: string;
  toothB: string;
  amountMm: number;
}

export interface CaseAnalysis {
  id: string;
  caseId: string;
  boltonOverall: number | null;
  boltonAnterior: number | null;
  toothMeasurements: Record<string, number>;
  angleClass: string | null;
  overjetMm: number | null;
  overbiteM: number | null;
  upperCrowdingMm: number | null;
  lowerCrowdingMm: number | null;
  iprSchedule: IprEntry[];
  complexityScore: number | null;
  createdByEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAnalysisDto {
  boltonOverall?: number;
  boltonAnterior?: number;
  toothMeasurements?: Record<string, number>;
  angleClass?: string;
  overjetMm?: number;
  overbiteM?: number;
  upperCrowdingMm?: number;
  lowerCrowdingMm?: number;
  iprSchedule?: IprEntry[];
  complexityScore?: number;
  notes?: string;
}

export const getLatestAnalysis = (caseId: string) =>
  api.get<CaseAnalysis | null>(`/api/cases/${caseId}/analysis/latest`);

export const listAnalyses = (caseId: string) =>
  api.get<CaseAnalysis[]>(`/api/cases/${caseId}/analysis`);

export const createAnalysis = (caseId: string, dto: SaveAnalysisDto) =>
  api.post<CaseAnalysis>(`/api/cases/${caseId}/analysis`, dto);

export const updateAnalysis = (caseId: string, id: string, dto: SaveAnalysisDto) =>
  api.patch<CaseAnalysis>(`/api/cases/${caseId}/analysis/${id}`, dto);
