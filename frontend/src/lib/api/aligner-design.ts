import { api } from './client';

export interface AlignerDesign {
  id: string;
  organizationId: string;
  digitalSetupId: string;
  stageId: string | null;
  archType: string | null;
  alignerNumber: number | null;
  trimlineData: unknown;
  thicknessMm: number;
  hasRelief: boolean;
  attachmentWindows: unknown[];
  pressureAreas: unknown[];
  label: string | null;
  exportReady: boolean;
  createdAt: string;
}

export interface UpdateAlignerDto {
  trimlineData?: unknown;
  thicknessMm?: number;
  hasRelief?: boolean;
  attachmentWindows?: unknown[];
  pressureAreas?: unknown[];
  label?: string;
}

export const listAlignerDesigns = (setupId: string) =>
  api.get<AlignerDesign[]>(`/api/aligner-design?setupId=${encodeURIComponent(setupId)}`);

export const generateAlignerDesigns = (setupId: string) =>
  api.post<AlignerDesign[]>(`/api/aligner-design/generate/${setupId}`, {});

export const updateAlignerDesign = (id: string, dto: UpdateAlignerDto) =>
  api.patch<AlignerDesign>(`/api/aligner-design/${id}`, dto);
