import { api } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgLocation {
  id: string;
  organizationId: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  timezone: string;
  active: boolean;
  createdAt: string;
}

export interface CreateLocationDto {
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string;
  phone?: string | null;
  email?: string | null;
  isPrimary?: boolean;
  timezone?: string;
}

export interface UpdateLocationDto {
  name?: string;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string;
  phone?: string | null;
  email?: string | null;
  isPrimary?: boolean;
  timezone?: string;
  active?: boolean;
}

// ─── API client ───────────────────────────────────────────────────────────────

/**
 * List org locations.
 * @param activeOnly  When false (default), passes ?all=true to include inactive locations.
 */
export async function listLocations(activeOnly = true): Promise<OrgLocation[]> {
  const path = activeOnly ? '/api/org-locations' : '/api/org-locations?all=true';
  return api.get<OrgLocation[]>(path);
}

export async function createLocation(dto: CreateLocationDto): Promise<OrgLocation> {
  return api.post<OrgLocation>('/api/org-locations', dto);
}

export async function updateLocation(id: string, dto: UpdateLocationDto): Promise<OrgLocation> {
  return api.patch<OrgLocation>(`/api/org-locations/${id}`, dto);
}
