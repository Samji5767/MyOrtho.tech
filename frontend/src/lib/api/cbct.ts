import { api } from './client';

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

export const registerCbctScan = (
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
): Promise<CbctScan> =>
  api.post<CbctScan>(`/api/cases/${caseId}/cbct/scans`, data);

export const listCbctScans = (caseId: string): Promise<CbctScan[]> =>
  api.get<CbctScan[]>(`/api/cases/${caseId}/cbct/scans`);

export const createFusion = (
  caseId: string,
  cbctScanId: string,
  stlScanId: string,
  registrationMethod: RegistrationMethod = 'icp',
): Promise<CbctFusion> =>
  api.post<CbctFusion>(`/api/cases/${caseId}/cbct/fusions`, {
    cbctScanId,
    stlScanId,
    registrationMethod,
  });

export const listFusions = (caseId: string): Promise<CbctFusion[]> =>
  api.get<CbctFusion[]>(`/api/cases/${caseId}/cbct/fusions`);

export const reviewFusion = (caseId: string, fusionId: string): Promise<CbctFusion> =>
  api.patch<CbctFusion>(`/api/cases/${caseId}/cbct/fusions/${fusionId}/review`, {});

export const listBoneSegments = (caseId: string, fusionId: string): Promise<BoneSegment[]> =>
  api.get<BoneSegment[]>(`/api/cases/${caseId}/cbct/fusions/${fusionId}/segments`);

export const updateSegmentDensity = (
  caseId: string,
  fusionId: string,
  segmentId: string,
  densityHu: number,
): Promise<BoneSegment> =>
  api.patch<BoneSegment>(
    `/api/cases/${caseId}/cbct/fusions/${fusionId}/segments/${segmentId}/density`,
    { densityHu },
  );
