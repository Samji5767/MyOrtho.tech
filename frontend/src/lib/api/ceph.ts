import { api } from './client';

export interface CephMeasurements {
  snaDeg?: number;
  snbDeg?: number;
  anbDeg?: number;
  witsMm?: number;
  fmaDeg?: number;
  impaDeg?: number;
  fmiaDeg?: number;
  uiSnDeg?: number;
  liMpDeg?: number;
  interincisalDeg?: number;
  facialAxisDeg?: number;
  gonialAngleDeg?: number;
  pgNaMm?: number;
  softTissue?: Record<string, number>;
}

export interface CephAnalysis {
  id: string;
  caseId: string;
  imagePath: string | null;
  landmarks: Record<string, { x: number; y: number }>;
  measurements: CephMeasurements;
  skeletalClass: 'I' | 'II' | 'III' | null;
  verticalPattern: 'hypodivergent' | 'normodivergent' | 'hyperdivergent' | null;
  growthPattern: 'horizontal' | 'average' | 'vertical' | null;
  aiNotes: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCephDto extends CephMeasurements {
  imagePath?: string;
  landmarks?: Record<string, { x: number; y: number }>;
  aiNotes?: string;
}

export const listCephAnalyses = (caseId: string) =>
  api.get<CephAnalysis[]>(`/api/cases/${caseId}/ceph`);

export const createCephAnalysis = (caseId: string, dto: CreateCephDto) =>
  api.post<CephAnalysis>(`/api/cases/${caseId}/ceph`, dto);

export const deleteCephAnalysis = (caseId: string, id: string) =>
  api.delete<void>(`/api/cases/${caseId}/ceph/${id}`);

export const CEPH_NORMS: Record<keyof CephMeasurements, { min: number; max: number; label: string; unit: string }> = {
  snaDeg:           { min: 80, max: 84,  label: 'SNA',             unit: '°' },
  snbDeg:           { min: 78, max: 82,  label: 'SNB',             unit: '°' },
  anbDeg:           { min: 0,  max: 4,   label: 'ANB',             unit: '°' },
  witsMm:           { min: -1, max: 3,   label: 'Wits Appraisal',  unit: ' mm' },
  fmaDeg:           { min: 22, max: 28,  label: 'FMA',             unit: '°' },
  impaDeg:          { min: 87, max: 95,  label: 'IMPA',            unit: '°' },
  fmiaDeg:          { min: 65, max: 70,  label: 'FMIA',            unit: '°' },
  uiSnDeg:          { min: 100, max: 108, label: 'U1 to SN',       unit: '°' },
  liMpDeg:          { min: 87, max: 95,  label: 'L1 to MP',        unit: '°' },
  interincisalDeg:  { min: 125, max: 135, label: 'Interincisal',   unit: '°' },
  facialAxisDeg:    { min: 88, max: 92,  label: 'Facial Axis',     unit: '°' },
  gonialAngleDeg:   { min: 118, max: 130, label: 'Gonial Angle',   unit: '°' },
  pgNaMm:           { min: -4, max: 4,   label: 'Pg to NA',        unit: ' mm' },
  softTissue:       { min: 0,  max: 0,   label: 'Soft Tissue',     unit: '' },
};
