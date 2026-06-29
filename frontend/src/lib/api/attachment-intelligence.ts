const BASE = '/api';

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

export async function getAttachmentLibrary(
  caseId: string,
  planId: string,
): Promise<AttachmentLibraryEntry[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/attachments/library`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createCustomAttachment(
  caseId: string,
  planId: string,
  body: Partial<AttachmentLibraryEntry>,
): Promise<AttachmentLibraryEntry> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/attachments/library/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function optimizeAttachments(
  caseId: string,
  planId: string,
): Promise<AttachmentOptimizationResult> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/attachments/optimize`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAttachmentForceAnalysis(
  caseId: string,
  planId: string,
): Promise<AttachmentForceVector[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/attachments/force-analysis`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAttachmentCollisions(
  caseId: string,
  planId: string,
): Promise<AttachmentCollision[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/attachments/collisions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function validateAttachmentManufacturing(
  caseId: string,
  planId: string,
): Promise<ManufacturingValidation> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/attachments/validate-manufacturing`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
