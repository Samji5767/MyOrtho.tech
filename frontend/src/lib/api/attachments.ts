import { api } from "./client";

export type AttachmentType =
  | "vertical_rectangular"
  | "horizontal_rectangular"
  | "optimized"
  | "rotation"
  | "extrusion"
  | "root_control"
  | "retention"
  | "beveled";

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  vertical_rectangular: "Vertical Rectangular",
  horizontal_rectangular: "Horizontal Rectangular",
  optimized: "Optimized",
  rotation: "Rotation",
  extrusion: "Extrusion",
  root_control: "Root Control",
  retention: "Retention",
  beveled: "Beveled",
};

export interface TreatmentAttachment {
  id: string;
  caseId: string;
  planId: string;
  fdiNumber: number;
  attachmentType: AttachmentType;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  surface: "buccal" | "lingual" | "occlusal";
  activationStage: number;
  deactivationStage: number | null;
  isAutoRecommended: boolean;
  isApproved: boolean;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttachmentDto {
  fdiNumber: number;
  attachmentType: AttachmentType;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  surface?: "buccal" | "lingual" | "occlusal";
  activationStage?: number;
  deactivationStage?: number | null;
  notes?: string | null;
}

export function listAttachments(caseId: string, planId: string): Promise<TreatmentAttachment[]> {
  return api.get<TreatmentAttachment[]>(`/api/cases/${caseId}/plans/${planId}/attachments`);
}

export function addAttachment(
  caseId: string,
  planId: string,
  dto: CreateAttachmentDto,
): Promise<TreatmentAttachment> {
  return api.post<TreatmentAttachment>(`/api/cases/${caseId}/plans/${planId}/attachments`, dto);
}

export function deleteAttachment(caseId: string, planId: string, attachmentId: string): Promise<void> {
  return api.delete<void>(
    `/api/cases/${caseId}/plans/${planId}/attachments/${attachmentId}`,
  );
}

export function approveAttachment(
  caseId: string,
  planId: string,
  attachmentId: string,
): Promise<TreatmentAttachment> {
  return api.patch<TreatmentAttachment>(
    `/api/cases/${caseId}/plans/${planId}/attachments/${attachmentId}/approve`,
    {},
  );
}

export function autoRecommendAttachments(
  caseId: string,
  planId: string,
): Promise<{ recommended: number; attachments: TreatmentAttachment[] }> {
  return api.post<{ recommended: number; attachments: TreatmentAttachment[] }>(
    `/api/cases/${caseId}/plans/${planId}/attachments/recommend`,
    {},
  );
}
