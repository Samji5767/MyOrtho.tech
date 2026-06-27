import { api } from './client';

export interface Implant {
  id: string;
  manufacturer: string;
  system: string;
  sku: string | null;
  diameterMm: number;
  lengthMm: number;
  neckDiameterMm: number | null;
  material: string;
  connectionType: string | null;
  catalogYear: number | null;
}

export interface ImplantPlacement {
  id: string;
  toothNumber: string;
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  pitchDeg: number | null;
  rollDeg: number | null;
  yawDeg: number | null;
  boneDensity: 'D1' | 'D2' | 'D3' | 'D4' | null;
  safetyStatus: 'safe' | 'warning' | 'collision';
  notes: string | null;
  implant: { manufacturer: string; system: string; diameterMm: number; lengthMm: number } | null;
  plannedByEmail: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface TadPlan {
  id: string;
  insertionSite: string;
  toothA: string;
  toothB: string | null;
  angulationDeg: number | null;
  depthMm: number | null;
  boneThicknessMm: number | null;
  safeCorridor: Record<string, unknown>;
  rootCollisionRisk: 'low' | 'moderate' | 'high';
  purpose: string | null;
  notes: string | null;
  plannedByEmail: string | null;
  createdAt: string;
}

export interface SurgicalGuide {
  id: string;
  guideType: 'implant' | 'tad' | 'osteotomy';
  sleeveDiameterMm: number | null;
  guideThicknessMm: number;
  ventHoles: boolean;
  offsetMm: number;
  stlPath: string | null;
  exportStatus: 'pending' | 'ready' | 'exported';
  exportedAt: string | null;
  designedByEmail: string | null;
  createdAt: string;
}

export const listImplants = (params?: { manufacturer?: string; minDiameter?: number; maxDiameter?: number }) => {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString() : '';
  return api.get<Implant[]>(`/api/implants${qs}`);
};

export const listPlacements = (caseId: string) =>
  api.get<ImplantPlacement[]>(`/api/cases/${caseId}/surgical/placements`);

export interface CreatePlacementDto {
  toothNumber: string;
  implantId?: string;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  pitchDeg?: number;
  rollDeg?: number;
  yawDeg?: number;
  boneDensity?: 'D1' | 'D2' | 'D3' | 'D4';
  notes?: string;
}

export const createPlacement = (caseId: string, dto: CreatePlacementDto) =>
  api.post<ImplantPlacement>(`/api/cases/${caseId}/surgical/placements`, dto);

export const updatePlacement = (caseId: string, id: string, dto: Partial<ImplantPlacement>) =>
  api.patch<ImplantPlacement>(`/api/cases/${caseId}/surgical/placements/${id}`, dto);

export const deletePlacement = (caseId: string, id: string) =>
  api.delete<void>(`/api/cases/${caseId}/surgical/placements/${id}`);

export const listTadPlans = (caseId: string) =>
  api.get<TadPlan[]>(`/api/cases/${caseId}/surgical/tads`);

export const createTadPlan = (caseId: string, dto: Omit<TadPlan, 'id' | 'plannedByEmail' | 'createdAt'>) =>
  api.post<TadPlan>(`/api/cases/${caseId}/surgical/tads`, dto);

export const deleteTadPlan = (caseId: string, id: string) =>
  api.delete<void>(`/api/cases/${caseId}/surgical/tads/${id}`);

export const listGuides = (caseId: string) =>
  api.get<SurgicalGuide[]>(`/api/cases/${caseId}/surgical/guides`);

export const createGuide = (caseId: string, dto: Pick<SurgicalGuide, 'guideType' | 'sleeveDiameterMm' | 'guideThicknessMm' | 'ventHoles' | 'offsetMm'>) =>
  api.post<SurgicalGuide>(`/api/cases/${caseId}/surgical/guides`, dto);

export const markGuideExported = (caseId: string, id: string) =>
  api.post<SurgicalGuide>(`/api/cases/${caseId}/surgical/guides/${id}/export`, {});
