import { api } from './client';

export interface AuditEvent {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  resourceType: string;
  resourceId: string | null;
  action: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditSummary {
  recentCount: number;
  windowHours: number;
}

export const listAuditEvents = (limit = 50, offset = 0): Promise<AuditEvent[]> =>
  api.get<AuditEvent[]>(`/api/audit/events?limit=${limit}&offset=${offset}`);

export const getAuditByResource = (resourceType: string, resourceId: string): Promise<AuditEvent[]> =>
  api.get<AuditEvent[]>(`/api/audit/events/resource/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`);

export const getAuditSummary = (hours = 24): Promise<AuditSummary> =>
  api.get<AuditSummary>(`/api/audit/summary?hours=${hours}`);
