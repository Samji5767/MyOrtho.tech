import { api } from './client';

export interface ApiPrintJob {
  id: string;
  printerId?: string | null;
  printerName?: string | null;
  stageId?: string | null;
  patientName?: string | null;
  status: string;
  qualityScore?: number | null;
  qcNotes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface ApiPrinter {
  id: string;
  name: string;
  brand: string;
  model: string;
  status: string;
  materialType?: string | null;
  materialVolumeMl?: number | null;
  ipAddress?: string | null;
  connectorStatus: 'connector_required';
  connectorNote: string;
  createdAt: string;
}

export interface ManufacturingJobsResponse {
  jobs: ApiPrintJob[];
  total: number;
}

export interface PrintersResponse {
  printers: ApiPrinter[];
}

export function listManufacturingJobs(): Promise<ManufacturingJobsResponse> {
  return api.get<ManufacturingJobsResponse>('/api/manufacturing/jobs');
}

export function createManufacturingJob(dto: { qcNotes?: string }): Promise<ApiPrintJob> {
  return api.post<ApiPrintJob>('/api/manufacturing/jobs', dto);
}

export function listPrinters(): Promise<PrintersResponse> {
  return api.get<PrintersResponse>('/api/printers');
}
