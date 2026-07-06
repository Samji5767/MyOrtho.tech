import { api } from './client';

export interface Vec3 { x: number; y: number; z: number }

export interface BoundingBox {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export interface OrientationResult {
  jobId: string;
  detectedArch: 'maxillary' | 'mandibular' | 'unknown';
  occlusalPlaneNormal: Vec3;
  centroid: Vec3;
  boundingBox: BoundingBox;
  rotationCorrection: Vec3;
  confidence: number;
}

export interface CleanupResult {
  jobId: string;
  disconnectedRemoved: number;
  holesFilled: number;
  spikesSmoothed: number;
  verticesBefore: number | null;
  verticesAfter: number | null;
  reductionPct: number | null;
  trimPlaneZ: number | null;
  trimmedVertices: number | null;
  qualityScoreBefore: number | null;
  qualityScoreAfter: number | null;
}

export interface ToothIdResult {
  fdiNumber: number;
  assignedLabel: number;
  confidence: number;
  centroid: Vec3;
  arch: 'upper' | 'lower';
  isPrimaryTooth: boolean;
}

export interface ProcessingJob {
  id: string;
  scanId: string;
  jobType: string;
  status: string;
  result: Record<string, unknown>;
  durationMs: number | null;
  createdAt: string;
}

export const runAutoOrient = (caseId: string, scanId: string): Promise<OrientationResult> =>
  api.post<OrientationResult>(`/api/cases/${caseId}/scans/${scanId}/processing/orient`, {});

export const runAutoCleanup = (caseId: string, scanId: string): Promise<CleanupResult> =>
  api.post<CleanupResult>(`/api/cases/${caseId}/scans/${scanId}/processing/cleanup`, {});

export const assignToothIds = (
  caseId: string,
  scanId: string,
  segmentationJobId?: string,
): Promise<ToothIdResult[]> =>
  api.post<ToothIdResult[]>(`/api/cases/${caseId}/scans/${scanId}/processing/tooth-id`, {
    segmentationJobId,
  });

export const getToothIds = (caseId: string, scanId: string): Promise<ToothIdResult[]> =>
  api.get<ToothIdResult[]>(`/api/cases/${caseId}/scans/${scanId}/processing/tooth-id`);

export async function confirmToothId(
  caseId: string,
  scanId: string,
  fdiNumber: number,
  newFdi?: number,
): Promise<void> {
  const base = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL ?? '') : '';
  const res = await fetch(
    `${base}/api/cases/${caseId}/scans/${scanId}/processing/tooth-id/${fdiNumber}/confirm`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newFdi }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
}

export const listProcessingJobs = (caseId: string, scanId: string): Promise<ProcessingJob[]> =>
  api.get<ProcessingJob[]>(`/api/cases/${caseId}/scans/${scanId}/processing/jobs`);
