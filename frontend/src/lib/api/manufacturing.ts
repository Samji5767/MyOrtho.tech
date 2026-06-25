import { api } from './client';

export type ConnectorStatus =
  | 'not_configured'
  | 'connector_required'
  | 'configured'
  | 'offline'
  | 'online'
  | 'error';

export interface ApiPrintJob {
  id: string;
  printerId?: string | null;
  printer?: {
    name: string;
    brand: string;
    model: string;
    status: string;
    connectorStatus: ConnectorStatus;
  } | null;
  stageId?: string | null;
  stageNumber?: number | null;
  status: string;
  qualityScore?: number | null;
  qcNotes?: string | null;
  failureReason?: string | null;
  retryCount?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  connectorNote?: string;
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
  connectorStatus: ConnectorStatus;
  apiEndpoint?: string | null;
  connectorNote: string;
  createdAt: string;
  updatedAt: string;
}

export function listManufacturingJobs(): Promise<ApiPrintJob[]> {
  return api.get<ApiPrintJob[]>('/api/manufacturing/jobs');
}

export function createManufacturingJob(dto: {
  printerId?: string;
  stageId?: string;
  gcodePath?: string;
  qcNotes?: string;
}): Promise<ApiPrintJob> {
  return api.post<ApiPrintJob>('/api/manufacturing/jobs', dto);
}

export function updateJobStatus(
  id: string,
  dto: { status: string; qcNotes?: string; failureReason?: string },
): Promise<ApiPrintJob> {
  return api.patch<ApiPrintJob>(`/api/manufacturing/jobs/${id}/status`, dto);
}

export function retryJob(id: string): Promise<ApiPrintJob> {
  return api.post<ApiPrintJob>(`/api/manufacturing/jobs/${id}/retry`, {});
}

export function cancelJob(id: string, reason?: string): Promise<ApiPrintJob> {
  return api.post<ApiPrintJob>(`/api/manufacturing/jobs/${id}/cancel`, { reason });
}

export function listPrinters(): Promise<ApiPrinter[]> {
  return api.get<ApiPrinter[]>('/api/printers');
}
