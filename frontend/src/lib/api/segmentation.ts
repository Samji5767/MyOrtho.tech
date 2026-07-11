import { api } from './client';

export type SegmentationModel = 'monai' | 'nnunet' | 'onnx' | 'pytorch' | 'cpu';
export type SegmentationArch = 'upper' | 'lower' | 'both';
export type JobStatus =
  | 'pending'
  | 'queued'
  | 'preprocessing'
  | 'running'
  | 'validating'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'manual_review_required'
  | 'unavailable';
export type CorrectionType =
  | 'fix_geometry' | 'improve_segmentation' | 'repair_mesh'
  | 'recalculate_landmarks' | 'rebuild_tooth' | 'merge_teeth'
  | 'split_tooth' | 'fill_hole' | 'smooth_boundary'
  | 'smart_grow' | 'smart_shrink' | 'lock_region' | 'unlock_region';

export interface ToothSegment {
  id: string;
  jobId: string;
  caseId: string;
  toothNumber: number;
  universalNumber: number | null;
  label: string;
  arch: 'upper' | 'lower' | null;
  confidence: number | null;
  meshPath: string | null;
  landmarkData: { flags?: string[]; warning?: string };
  boundingBox: Record<string, number>;
  surfaceAreaMm2: number | null;
  volumeMm3: number | null;
  isImpacted: boolean;
  isMissing: boolean;
  isSupernumerary: boolean;
  isLocked: boolean;
  version: number;
  createdAt: string;
}

export interface SegmentationCorrection {
  id: string;
  jobId: string;
  toothNumber: number | null;
  correctionType: CorrectionType;
  beforeConfidence: number | null;
  afterConfidence: number | null;
  details: Record<string, unknown>;
  appliedByEmail: string | null;
  createdAt: string;
}

export interface SegmentationJob {
  id: string;
  caseId: string;
  scanId: string | null;
  modelType: SegmentationModel;
  arch: SegmentationArch;
  status: JobStatus;
  progress: number;
  toothCount: number | null;
  resultSummary: Record<string, unknown>;
  errorMessage: string | null;
  aiVersion: string;
  startedAt: string | null;
  completedAt: string | null;
  submittedByEmail: string | null;
  createdAt: string;
  // Populated by getJob only
  segments?: ToothSegment[];
  corrections?: SegmentationCorrection[];
}

export const CORRECTION_LABELS: Record<CorrectionType, string> = {
  fix_geometry:          'Fix Geometry',
  improve_segmentation:  'Improve Segmentation',
  repair_mesh:           'Repair Mesh',
  recalculate_landmarks: 'Recalculate Landmarks',
  rebuild_tooth:         'Rebuild Tooth',
  merge_teeth:           'Merge Teeth',
  split_tooth:           'Split Tooth',
  fill_hole:             'Fill Hole',
  smooth_boundary:       'Smooth Boundary',
  smart_grow:            'Smart Grow',
  smart_shrink:          'Smart Shrink',
  lock_region:           'Lock Region',
  unlock_region:         'Unlock Region',
};

export const MODEL_LABELS: Record<SegmentationModel, string> = {
  monai:   'MONAI (GPU)',
  nnunet:  'nnU-Net (GPU)',
  onnx:    'ONNX Runtime',
  pytorch: 'PyTorch',
  cpu:     'CPU (Rule-based)',
};

export const listSegmentationJobs = (caseId: string) =>
  api.get<SegmentationJob[]>(`/api/cases/${caseId}/segmentation/jobs`);

export const submitSegmentationJob = (caseId: string, dto: {
  scanId?: string;
  modelType?: SegmentationModel;
  arch?: SegmentationArch;
  gpuRequested?: boolean;
  priority?: number;
  onnxModelPath?: string;
}) => api.post<SegmentationJob>(`/api/cases/${caseId}/segmentation/jobs`, dto);

export const getSegmentationJob = (caseId: string, jobId: string) =>
  api.get<SegmentationJob>(`/api/cases/${caseId}/segmentation/jobs/${jobId}`);

export const applyCorrection = (caseId: string, jobId: string, dto: {
  toothNumber?: number;
  correctionType: CorrectionType;
  details?: Record<string, unknown>;
}) => api.post<SegmentationCorrection>(`/api/cases/${caseId}/segmentation/jobs/${jobId}/corrections`, dto);

export const updateSegment = (caseId: string, jobId: string, toothNumber: number, patch: {
  isLocked?: boolean;
  isMissing?: boolean;
}) => api.patch<ToothSegment>(`/api/cases/${caseId}/segmentation/jobs/${jobId}/segments/${toothNumber}`, patch);

// ─── Phase 24: Mask editing ───────────────────────────────────────────────────

export type MaskRegionType = 'crown' | 'root' | 'gingiva' | 'implant' | 'restoration' | 'supernumerary';

export type MaskEditOperation =
  | 'brush' | 'erase' | 'grow' | 'shrink' | 'smooth'
  | 'merge' | 'split' | 'region_grow' | 'boundary_smooth';

export interface SegmentationMask {
  id: string;
  jobId: string;
  toothNumber: number;
  regionType: MaskRegionType;
  maskData: { vertices: number[]; normals: unknown[] };
  confidenceHeatmap: Record<string, number>;
  brushRadiusMm: number;
  isManuallyEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaskEditDto {
  toothNumber: number;
  regionType?: MaskRegionType;
  operation: MaskEditOperation;
  centre?: [number, number, number];
  radiusMm?: number;
  mergeIntoTooth?: number;
  splitPlane?: [number, number, number];
  seedVertex?: number;
  growIterations?: number;
}

export interface HistoryEntry {
  id: string;
  sequenceNum: number;
  actionType: string;
  toothNumber: number | null;
  regionType: string | null;
  isUndone: boolean;
  createdAt: string;
}

export const getMask = (caseId: string, jobId: string, toothNumber: number, regionType?: MaskRegionType) =>
  api.get<SegmentationMask | null>(
    `/api/cases/${caseId}/segmentation/jobs/${jobId}/masks/${toothNumber}${regionType ? `?regionType=${regionType}` : ''}`,
  );

export const editMask = (caseId: string, jobId: string, dto: MaskEditDto) =>
  api.post<SegmentationMask>(`/api/cases/${caseId}/segmentation/jobs/${jobId}/masks`, dto);

export const undoMaskEdit = (caseId: string, jobId: string) =>
  api.post<{ undone: boolean; sequence?: number; action?: string }>(
    `/api/cases/${caseId}/segmentation/jobs/${jobId}/undo`, {},
  );

export const redoMaskEdit = (caseId: string, jobId: string) =>
  api.post<{ redone: boolean; sequence?: number; action?: string }>(
    `/api/cases/${caseId}/segmentation/jobs/${jobId}/redo`, {},
  );

export const getHistoryStack = (caseId: string, jobId: string) =>
  api.get<HistoryEntry[]>(`/api/cases/${caseId}/segmentation/jobs/${jobId}/history`);

export const getConfidenceHeatmap = (caseId: string, jobId: string) =>
  api.get<{ jobId: string; heatmapByTooth: Record<number, { confidence: number | null; regionHeatmaps: Record<string, unknown> }> }>(
    `/api/cases/${caseId}/segmentation/jobs/${jobId}/heatmap`,
  );
