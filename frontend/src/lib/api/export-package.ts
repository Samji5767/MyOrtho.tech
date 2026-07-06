import { api } from './client';

export type ExportType = 'lab_full' | 'aligner_stl' | 'treatment_summary' | 'patient_instructions' | 'insurance_report';

export interface ChecklistItem {
  id: string;
  checkKey: string;
  checkLabel: string;
  module: string;
  status: 'pending' | 'passed' | 'failed' | 'warning' | 'skipped';
  message: string | null;
  isBlocking: boolean;
  checkedAt: string | null;
}

export interface ExportPackage {
  id: string;
  planId: string;
  exportType: ExportType;
  status: 'draft' | 'validated' | 'approved' | 'exported' | 'failed';
  validationResults: ChecklistItem[];
  validationPassed: boolean | null;
  approvedBy: string | null;
  approvedAt: string | null;
  exportedAt: string | null;
  exportFormat: string | null;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  createdAt: string;
  updatedAt: string;
}

export const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  lab_full:             'Full Lab Package',
  aligner_stl:          'Aligner STL Files',
  treatment_summary:    'Treatment Summary',
  patient_instructions: 'Patient Instructions',
  insurance_report:     'Insurance Report',
};

export const createExportPackage = (
  caseId: string,
  planId: string,
  exportType: ExportType,
): Promise<ExportPackage> =>
  api.post<ExportPackage>(`/api/cases/${caseId}/plans/${planId}/export-packages`, { exportType });

export const listExportPackages = (
  caseId: string,
  planId: string,
): Promise<ExportPackage[]> =>
  api.get<ExportPackage[]>(`/api/cases/${caseId}/plans/${planId}/export-packages`);

export const validateExportPackage = (
  caseId: string,
  planId: string,
  packageId: string,
): Promise<ExportPackage> =>
  api.post<ExportPackage>(
    `/api/cases/${caseId}/plans/${planId}/export-packages/${packageId}/validate`,
    {},
  );

export const approveExportPackage = (
  caseId: string,
  planId: string,
  packageId: string,
): Promise<ExportPackage> =>
  api.post<ExportPackage>(
    `/api/cases/${caseId}/plans/${planId}/export-packages/${packageId}/approve`,
    {},
  );

export const markExported = (
  caseId: string,
  planId: string,
  packageId: string,
  format: string,
  fileSizeBytes: number,
): Promise<ExportPackage> =>
  api.post<ExportPackage>(
    `/api/cases/${caseId}/plans/${planId}/export-packages/${packageId}/mark-exported`,
    { format, fileSizeBytes },
  );
