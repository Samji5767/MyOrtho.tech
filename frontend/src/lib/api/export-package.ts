const BASE = '/api';

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

export async function createExportPackage(
  caseId: string,
  planId: string,
  exportType: ExportType,
): Promise<ExportPackage> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/export-packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exportType }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listExportPackages(
  caseId: string,
  planId: string,
): Promise<ExportPackage[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/export-packages`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function validateExportPackage(
  caseId: string,
  planId: string,
  packageId: string,
): Promise<ExportPackage> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/plans/${planId}/export-packages/${packageId}/validate`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function approveExportPackage(
  caseId: string,
  planId: string,
  packageId: string,
): Promise<ExportPackage> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/plans/${planId}/export-packages/${packageId}/approve`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function markExported(
  caseId: string,
  planId: string,
  packageId: string,
  format: string,
  fileSizeBytes: number,
): Promise<ExportPackage> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/plans/${planId}/export-packages/${packageId}/mark-exported`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, fileSizeBytes }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
