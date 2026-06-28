import { api } from './client';

export type IssueSeverity = 'critical' | 'warning' | 'info';

export type IssueType =
  | 'low_confidence'
  | 'missing_tooth'
  | 'sparse_mask'
  | 'no_gingival_margin'
  | 'adjacent_collision'
  | 'arch_imbalance'
  | 'surface_area_anomaly'
  | 'volume_anomaly'
  | 'supernumerary_unclassified'
  | 'impacted_unlabeled'
  | 'mesh_hole'
  | 'boundary_noise';

export interface AutoCorrectionItem {
  id: string;
  reportId: string;
  toothNumber: number | null;
  regionType: string | null;
  issueType: IssueType;
  severity: IssueSeverity;
  description: string;
  suggestedAction: string;
  autoFixable: boolean;
  isRepaired: boolean;
  repairDetails: Record<string, unknown>;
  repairedAt: string | null;
  createdAt: string;
}

export interface AutoCorrectionReport {
  id: string;
  jobId: string;
  organizationId: string;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  autoFixedCount: number;
  meshValidityScore: number | null;
  analysisDurationMs: number | null;
  analyzedAt: string;
  items: AutoCorrectionItem[];
}

export const ISSUE_LABELS: Record<IssueType, string> = {
  low_confidence:            'Low Confidence',
  missing_tooth:             'Missing Tooth',
  sparse_mask:               'Sparse Mask',
  no_gingival_margin:        'No Gingival Margin',
  adjacent_collision:        'Adjacent Collision',
  arch_imbalance:            'Arch Imbalance',
  surface_area_anomaly:      'Surface Area Anomaly',
  volume_anomaly:            'Volume Anomaly',
  supernumerary_unclassified:'Supernumerary Unclassified',
  impacted_unlabeled:        'Impacted Unlabeled',
  mesh_hole:                 'Mesh Hole',
  boundary_noise:            'Boundary Noise',
};

export const analyzeSegmentation = (caseId: string, jobId: string) =>
  api.post<AutoCorrectionReport>(
    `/api/cases/${caseId}/segmentation/jobs/${jobId}/analyze`, {},
  );

export const getCorrectionReport = (caseId: string, jobId: string) =>
  api.get<AutoCorrectionReport>(
    `/api/cases/${caseId}/segmentation/jobs/${jobId}/corrections/report`,
  );

export const repairCorrectionItem = (caseId: string, jobId: string, itemId: string) =>
  api.post<AutoCorrectionItem>(
    `/api/cases/${caseId}/segmentation/jobs/${jobId}/corrections/items/${itemId}/repair`, {},
  );

export const repairAllItems = (caseId: string, jobId: string) =>
  api.post<{ repairedCount: number; skippedCount: number }>(
    `/api/cases/${caseId}/segmentation/jobs/${jobId}/corrections/repair-all`, {},
  );
