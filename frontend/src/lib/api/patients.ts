import { api, ApiError } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatientListItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  caseCount: number;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  clinicalNotes?: string;
}

export interface UpdatePatientDto {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  clinicalNotes?: string;
}

// ─── Demo fallback ────────────────────────────────────────────────────────────

const DEMO_PATIENTS: PatientListItem[] = [
  {
    id: 'p-1', firstName: 'Alex', lastName: 'Chen', fullName: 'Alex Chen',
    dateOfBirth: '1992-04-15', gender: 'prefer_not_to_say', caseCount: 1,
    organizationId: 'demo-org', createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'p-2', firstName: 'Jordan', lastName: 'Lee', fullName: 'Jordan Lee',
    dateOfBirth: '1988-11-22', gender: 'prefer_not_to_say', caseCount: 1,
    organizationId: 'demo-org', createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'p-3', firstName: 'Morgan', lastName: 'Taylor', fullName: 'Morgan Taylor',
    dateOfBirth: '2001-07-08', gender: 'prefer_not_to_say', caseCount: 1,
    organizationId: 'demo-org', createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

// ─── API client ───────────────────────────────────────────────────────────────

export async function fetchPatients(): Promise<{ patients: PatientListItem[]; source: 'api' | 'demo' }> {
  try {
    const patients = await api.get<PatientListItem[]>('/api/patients');
    return { patients, source: 'api' };
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0) throw err;
    return { patients: DEMO_PATIENTS, source: 'demo' };
  }
}

export async function fetchPatient(id: string): Promise<{ data: PatientListItem; source: 'api' | 'demo' }> {
  try {
    const data = await api.get<PatientListItem>(`/api/patients/${id}`);
    return { data, source: 'api' };
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0) throw err;
    const data = DEMO_PATIENTS.find((p) => p.id === id) ?? DEMO_PATIENTS[0];
    return { data, source: 'demo' };
  }
}

export async function createPatient(dto: CreatePatientDto): Promise<PatientListItem> {
  return api.post<PatientListItem>('/api/patients', dto);
}

export async function updatePatient(id: string, dto: UpdatePatientDto): Promise<PatientListItem> {
  return api.patch<PatientListItem>(`/api/patients/${id}`, dto);
}
