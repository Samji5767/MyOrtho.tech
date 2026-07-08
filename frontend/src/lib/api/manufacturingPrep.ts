import { api } from './client';

export type ExportFormat = 'stl' | 'obj' | 'ply' | '3mf' | 'zip';
export type ExportType =
  | 'stage_models' | 'aligner_models' | 'attachment_models'
  | 'ibt' | 'surgical_guide' | 'full_case' | 'qa_report';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ManufactureExport {
  id: string;
  caseId: string;
  treatmentPlanId: string | null;
  exportFormat: ExportFormat;
  exportType: ExportType;
  stageRangeFrom: number | null;
  stageRangeTo: number | null;
  status: ExportStatus;
  filePath: string | null;
  fileSizeBytes: number | null;
  manifest: {
    fileCount: number;
    files: string[];
    format: string;
    exportType: string;
    generatedAt: string;
    estimatedSizeBytes: number;
  };
  errorMessage: string | null;
  generatedByEmail: string | null;
  generatedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  stage_models:      'Stage Models',
  aligner_models:    'Aligner Shell Models',
  attachment_models: 'Attachment Templates',
  ibt:               'Indirect Bonding Trays',
  surgical_guide:    'Surgical Guide',
  full_case:         'Full Case Package',
  qa_report:         'QA Report Only',
};

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  stl: 'STL',
  obj: 'OBJ',
  ply: 'PLY',
  '3mf': '3MF',
  zip: 'ZIP Package',
};

export const listExports = (caseId: string) =>
  api.get<ManufactureExport[]>(`/api/cases/${caseId}/manufacture/exports`);

export const createExport = (caseId: string, dto: {
  exportFormat: ExportFormat;
  exportType: ExportType;
  treatmentPlanId?: string;
  stageRangeFrom?: number;
  stageRangeTo?: number;
}) => api.post<ManufactureExport>(`/api/cases/${caseId}/manufacture/exports`, dto);

export const getExport = (caseId: string, exportId: string) =>
  api.get<ManufactureExport>(`/api/cases/${caseId}/manufacture/exports/${exportId}`);

// ─── Manufacturing Readiness ──────────────────────────────────────────────────

export interface PrintabilityScoreFactor {
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
}

export interface PrintabilityScore {
  overall: number;
  meshIntegrity: number;
  printability: number;
  complexity: number;
  factors: PrintabilityScoreFactor[];
  recommendation: string;
  estimatedPrintTimeMinutes: number;
  estimatedResinGrams: number;
  estimatedCostUsd: number;
}

export interface ManufacturingReadiness {
  caseId: string;
  printabilityScore: PrintabilityScore;
  compatiblePrinters: string[];
  exportCount: number;
  lastExportAt: string | null;
  qaIssueCount: number;
  computedAt: string;
}

export const getManufacturingReadiness = (caseId: string) =>
  api.get<ManufacturingReadiness>(`/api/cases/${caseId}/manufacture/readiness`);
