import { api } from './client';

export type QAStatus = 'pending' | 'passed' | 'warnings' | 'failed';

export interface QACheck {
  key: string;
  label: string;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
}

export interface QAReport {
  id: string;
  caseId: string;
  treatmentPlanId: string | null;
  overallStatus: QAStatus;
  passCount: number;
  warningCount: number;
  failCount: number;
  checks: QACheck[];
  flaggedItems: QACheck[];
  generatedByEmail: string | null;
  approvedByEmail: string | null;
  approvedAt: string | null;
  generatedAt: string;
  createdAt: string;
}

export const QA_CHECK_LABELS: Record<string, string> = {
  missing_teeth:      'Missing Teeth',
  invalid_numbering:  'Tooth Numbering',
  mesh_integrity:     'Mesh Integrity',
  wall_thickness:     'Wall Thickness',
  attachment_validity:'Attachment Validity',
  trim_continuity:    'Trim Line Continuity',
  occlusion_quality:  'Occlusion Quality',
  collision_detection:'Collision Detection',
  printable_geometry: 'Printable Geometry',
  stage_consistency:  'Stage Consistency',
};

export const listQAReports = (caseId: string) =>
  api.get<QAReport[]>(`/api/cases/${caseId}/preexport-qa`);

export const runQA = (caseId: string, dto?: { treatmentPlanId?: string }) =>
  api.post<QAReport>(`/api/cases/${caseId}/preexport-qa/run`, dto ?? {});

export const approveQAReport = (caseId: string, reportId: string, notes?: string) =>
  api.post<QAReport>(`/api/cases/${caseId}/preexport-qa/${reportId}/approve`, { notes });
