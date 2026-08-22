import { api } from './client';

// ─── IPR planning ─────────────────────────────────────────────────────────────

export interface IprItem {
  id: string;
  toothAFdi: number;
  toothBFdi: number;
  amountMm: number;
  beforeStage: number;
  safetyStatus: 'safe' | 'warning' | 'unsafe';
  isAutoRecommended: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertIprDto {
  toothAFdi: number;
  toothBFdi: number;
  amountMm: number;
  beforeStage?: number;
  notes?: string;
}

const iprBase = (caseId: string, planId: string) =>
  `/api/cases/${caseId}/plans/${planId}/ipr`;

export const listIpr = (caseId: string, planId: string) =>
  api.get<IprItem[]>(iprBase(caseId, planId));

export const upsertIpr = (caseId: string, planId: string, dto: UpsertIprDto) =>
  api.put<IprItem>(iprBase(caseId, planId), dto);

export const deleteIpr = (caseId: string, planId: string, a: number, b: number) =>
  api.delete<{ deleted: boolean }>(`${iprBase(caseId, planId)}/${a}/${b}`);

// ─── Attachment planning ──────────────────────────────────────────────────────

export const ATTACHMENT_TYPES = [
  'vertical_rectangular', 'horizontal_rectangular', 'optimized',
  'rotation', 'extrusion', 'root_control', 'retention', 'beveled',
] as const;

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

export interface AttachmentItem {
  id: string;
  fdiNumber: number;
  attachmentType: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  surface: 'buccal' | 'lingual' | 'occlusal';
  activationStage: number;
  deactivationStage: number | null;
  isAutoRecommended: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAttachmentDto {
  fdiNumber: number;
  attachmentType: AttachmentType;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  surface?: 'buccal' | 'lingual' | 'occlusal';
  activationStage?: number;
  deactivationStage?: number;
  notes?: string;
}

const attBase = (caseId: string, planId: string) =>
  `/api/cases/${caseId}/plans/${planId}/attachments`;

export const listAttachments = (caseId: string, planId: string) =>
  api.get<AttachmentItem[]>(attBase(caseId, planId));

export const upsertAttachment = (caseId: string, planId: string, dto: UpsertAttachmentDto) =>
  api.put<AttachmentItem>(attBase(caseId, planId), dto);

export const deleteAttachment = (
  caseId: string, planId: string, fdiNumber: number, attachmentType: string,
) =>
  api.delete<{ deleted: boolean }>(`${attBase(caseId, planId)}/${fdiNumber}/${attachmentType}`);
