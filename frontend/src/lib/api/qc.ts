import { api } from './client';

export type QCCheckType =
  | 'print_quality' | 'model_integrity' | 'thickness_verification'
  | 'fit_verification' | 'surface_finish' | 'dimensional_accuracy' | 'material_compliance';

export type QCCheckStatus = 'pending' | 'pass' | 'fail' | 'warning';

export interface QCCheck {
  id: string;
  printJobId: string;
  checkType: QCCheckType;
  status: QCCheckStatus;
  measuredValue: number | null;
  expectedMin: number | null;
  expectedMax: number | null;
  unit: string | null;
  notes: string | null;
  checkedByEmail: string | null;
  checkedAt: string | null;
  createdAt: string;
}

export interface QCJobSummary {
  id: string;
  caseId: string | null;
  status: string;
  qualityScore: number | null;
  qcNotes: string | null;
  printerName: string | null;
  checks: QCCheck[];
  passCount: number;
  failCount: number;
  pendingCount: number;
  createdAt: string;
}

export const CHECK_TYPE_LABELS: Record<QCCheckType, string> = {
  print_quality:          'Print Quality',
  model_integrity:        'Model Integrity',
  thickness_verification: 'Thickness Verification',
  fit_verification:       'Fit Verification',
  surface_finish:         'Surface Finish',
  dimensional_accuracy:   'Dimensional Accuracy',
  material_compliance:    'Material Compliance',
};

export const listQCJobs = (limit?: number) =>
  api.get<QCJobSummary[]>(`/api/qc/jobs${limit ? `?limit=${limit}` : ''}`);

export const initQCChecks = (jobId: string) =>
  api.post<QCCheck[]>(`/api/qc/jobs/${jobId}/init`, {});

export const updateQCCheck = (
  jobId: string,
  checkId: string,
  dto: { status: QCCheckStatus; measuredValue?: number; notes?: string },
) => api.patch<QCCheck>(`/api/qc/jobs/${jobId}/checks/${checkId}`, dto);
