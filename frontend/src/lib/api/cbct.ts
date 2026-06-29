const BASE = '/api';

export interface CbctScan {
  id: string;
  caseId: string;
  originalFilename: string | null;
  filePath: string;
  fileFormat: string;
  fileSizeBytes: number | null;
  voxelSizeMm: number | null;
  fovMm: number | null;
  kvp: number | null;
  ma: number | null;
  acquisitionDate: string | null;
  createdAt: string;
}

export interface CbctFusion {
  id: string;
  caseId: string;
  cbctScanId: string;
  stlScanId: string;
  status: string;
  registrationMatrix: number[] | null;
  registrationErrorMm: number | null;
  registrationMethod: string;
  boneSegmentPath: string | null;
  toothRootPath: string | null;
  nerveCanalPath: string | null;
  fusionQualityScore: number | null;
  clinicianReviewed: boolean;
  createdAt: string;
}

export interface BoneSegment {
  id: string;
  fusionId: string;
  segmentType: string;
  densityHu: number | null;
  volumeMm3: number | null;
  surfaceAreaMm2: number | null;
  boneQuality: string | null;
  meshPath: string | null;
  fdiNumber: number | null;
  createdAt: string;
}

export type FileFormat = 'dicom' | 'dcm_zip' | 'nifti' | 'raw';
export type RegistrationMethod = 'icp' | 'surface_match' | 'landmark' | 'manual';

export async function registerCbctScan(
  caseId: string,
  data: {
    filePath: string;
    fileFormat: FileFormat;
    originalFilename?: string;
    fileSizeBytes?: number;
    voxelSizeMm?: number;
    fovMm?: number;
    kvp?: number;
    ma?: number;
    acquisitionDate?: string;
  },
): Promise<CbctScan> {
  const res = await fetch(`${BASE}/cases/${caseId}/cbct/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listCbctScans(caseId: string): Promise<CbctScan[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/cbct/scans`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createFusion(
  caseId: string,
  cbctScanId: string,
  stlScanId: string,
  registrationMethod: RegistrationMethod = 'icp',
): Promise<CbctFusion> {
  const res = await fetch(`${BASE}/cases/${caseId}/cbct/fusions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cbctScanId, stlScanId, registrationMethod }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listFusions(caseId: string): Promise<CbctFusion[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/cbct/fusions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function reviewFusion(caseId: string, fusionId: string): Promise<CbctFusion> {
  const res = await fetch(`${BASE}/cases/${caseId}/cbct/fusions/${fusionId}/review`, { method: 'PATCH' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listBoneSegments(caseId: string, fusionId: string): Promise<BoneSegment[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/cbct/fusions/${fusionId}/segments`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateSegmentDensity(
  caseId: string,
  fusionId: string,
  segmentId: string,
  densityHu: number,
): Promise<BoneSegment> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/cbct/fusions/${fusionId}/segments/${segmentId}/density`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ densityHu }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
