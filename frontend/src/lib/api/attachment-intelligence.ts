import { api } from './client';

export interface AttachmentLibraryEntry {
  id: string;
  organizationId: string | null;
  name: string;
  attachmentType: string;
  description: string | null;
  depthMm: number;
  widthMm: number;
  heightMm: number;
  retentionScore: number;
  torqueEfficiency: number;
  verticalControl: number;
  rotationControl: number;
  isSystem: boolean;
}

export interface AttachmentForceVector {
  toothFdi: number;
  attachmentType: string;
  forceMagnitudeN: number;
  momentMagnitudeNmm: number;
  forceX: number;
  forceY: number;
  forceZ: number;
  momentX: number;
  momentY: number;
  momentZ: number;
  efficiencyScore: number;
}

export interface AttachmentCollision {
  toothFdiA: number;
  toothFdiB: number;
  collisionType: string;
  overlapMm: number;
  severity: 'info' | 'warning' | 'critical';
  recommendation: string;
}

export interface ManufacturingValidation {
  isValid: boolean;
  issues: Array<{
    attachmentId: string;
    field: string;
    value: number;
    minimum: number;
    message: string;
  }>;
}

export interface AttachmentOptimizationResult {
  placements: Array<{
    toothFdi: number;
    selectedAttachmentId: string;
    selectedAttachmentName: string;
    score: number;
    reason: string;
  }>;
  forceVectors: AttachmentForceVector[];
  collisions: AttachmentCollision[];
  manufacturingValid: boolean;
  manufacturingIssues: ManufacturingValidation['issues'];
}

export const getAttachmentLibrary = (
  caseId: string,
  planId: string,
): Promise<AttachmentLibraryEntry[]> =>
  api.get<AttachmentLibraryEntry[]>(`/api/cases/${caseId}/plans/${planId}/attachments/library`);

export const createCustomAttachment = (
  caseId: string,
  planId: string,
  body: Partial<AttachmentLibraryEntry>,
): Promise<AttachmentLibraryEntry> =>
  api.post<AttachmentLibraryEntry>(
    `/api/cases/${caseId}/plans/${planId}/attachments/library/custom`,
    body,
  );

export const optimizeAttachments = (
  caseId: string,
  planId: string,
): Promise<AttachmentOptimizationResult> =>
  api.post<AttachmentOptimizationResult>(
    `/api/cases/${caseId}/plans/${planId}/attachments/optimize`,
    {},
  );

export const getAttachmentForceAnalysis = (
  caseId: string,
  planId: string,
): Promise<AttachmentForceVector[]> =>
  api.get<AttachmentForceVector[]>(`/api/cases/${caseId}/plans/${planId}/attachments/force-analysis`);

export const getAttachmentCollisions = (
  caseId: string,
  planId: string,
): Promise<AttachmentCollision[]> =>
  api.get<AttachmentCollision[]>(`/api/cases/${caseId}/plans/${planId}/attachments/collisions`);

export const validateAttachmentManufacturing = (
  caseId: string,
  planId: string,
): Promise<ManufacturingValidation> =>
  api.post<ManufacturingValidation>(
    `/api/cases/${caseId}/plans/${planId}/attachments/validate-manufacturing`,
    {},
  );
