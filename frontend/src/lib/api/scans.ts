import { api, uploadFile } from './client';

export interface ScanRecord {
  id: string;
  caseId: string;
  jawType: 'maxillary' | 'mandibular' | 'both';
  originalFilename: string;
  fileFormat: string;
  fileSizeBytes: number;
  filePath: string;
  createdAt: string;
}

export interface SegmentJobResult {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  caseId?: string;
  scanId?: string;
  teethDetected?: number;
  missingTeeth?: number[];
  completedAt?: string;
  error?: string;
  disclaimer?: string;
}

export function listScans(caseId: string): Promise<ScanRecord[]> {
  return api.get<ScanRecord[]>(`/api/cases/${caseId}/scans`);
}

export function uploadScan(
  caseId: string,
  file: File,
  jawType: 'maxillary' | 'mandibular' | 'both',
): Promise<ScanRecord> {
  const form = new FormData();
  form.append('file', file);
  form.append('jawType', jawType);
  return uploadFile<ScanRecord>(`/api/cases/${caseId}/scans`, form);
}

export function triggerSegmentation(
  caseId: string,
  scanId: string,
): Promise<{ jobId: string; status: string; disclaimer: string }> {
  return api.post(`/api/cases/${caseId}/scans/${scanId}/segment`, {});
}

export function pollJobStatus(jobId: string): Promise<SegmentJobResult> {
  return api.get<SegmentJobResult>(`/api/segment-jobs/${jobId}`);
}
