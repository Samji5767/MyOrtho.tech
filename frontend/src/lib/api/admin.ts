import { api } from './client';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_onboarded: boolean;
  organization_id: string | null;
  organization_name: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface AdminOrg {
  id: string;
  name: string;
  type: string;
  user_count: number;
  credit_balance: number;
  created_at: string;
}

export interface AdminAuditEvent {
  id: string;
  organization_id: string | null;
  org_name: string | null;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  resource_type: string;
  resource_id: string | null;
  action: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface PlatformStats {
  users: { total: number; active: number };
  orgs: { total: number };
  cases: { total: number };
  credits: { total: number };
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

export const getPlatformStats = () => api.get<PlatformStats>('/api/admin/stats');

export const listAdminUsers = (params?: { limit?: number; offset?: number }) =>
  api.get<AdminUser[]>(`/api/admin/users${qs(params ?? {})}`);

export const updateUserRole = (userId: string, role: string) =>
  api.patch<{ updated: boolean }>(`/api/admin/users/${userId}/role`, { role });

export const setUserActive = (userId: string, active: boolean) =>
  api.patch<{ updated: boolean }>(`/api/admin/users/${userId}/active`, { active });

export const listAdminOrgs = (params?: { limit?: number; offset?: number }) =>
  api.get<AdminOrg[]>(`/api/admin/orgs${qs(params ?? {})}`);

export const grantCredits = (orgId: string, amount: number, notes?: string) =>
  api.post<{ granted: number }>(`/api/admin/orgs/${orgId}/credits/grant`, { amount, notes });

export const listAdminAudit = (params?: { orgId?: string; limit?: number; offset?: number }) =>
  api.get<AdminAuditEvent[]>(`/api/admin/audit${qs(params ?? {})}`);
