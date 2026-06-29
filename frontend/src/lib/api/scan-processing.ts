const BASE = '/api';

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

export async function runAutoOrient(caseId: string, scanId: string): Promise<OrientationResult> {
  const res = await fetch(`${BASE}/cases/${caseId}/scans/${scanId}/processing/orient`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function runAutoCleanup(caseId: string, scanId: string): Promise<CleanupResult> {
  const res = await fetch(`${BASE}/cases/${caseId}/scans/${scanId}/processing/cleanup`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function assignToothIds(
  caseId: string,
  scanId: string,
  segmentationJobId?: string,
): Promise<ToothIdResult[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/scans/${scanId}/processing/tooth-id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segmentationJobId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getToothIds(caseId: string, scanId: string): Promise<ToothIdResult[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/scans/${scanId}/processing/tooth-id`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function confirmToothId(
  caseId: string,
  scanId: string,
  fdiNumber: number,
  newFdi?: number,
): Promise<void> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/scans/${scanId}/processing/tooth-id/${fdiNumber}/confirm`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newFdi }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function listProcessingJobs(caseId: string, scanId: string): Promise<ProcessingJob[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/scans/${scanId}/processing/jobs`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
