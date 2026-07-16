import { api, ApiError } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatientListItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  clinicalNotes?: string | null;
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

// Computed at call time (not module load) to avoid server/client Date.now() mismatch.
function makeDemoPatients(): PatientListItem[] {
  const now = Date.now();
  return [
    {
      id: 'p-1', firstName: 'Alex', lastName: 'Chen', fullName: 'Alex Chen',
      dateOfBirth: '1992-04-15', gender: 'prefer_not_to_say', caseCount: 1,
      organizationId: 'demo-org', createdAt: new Date(now - 86400000 * 30).toISOString(),
      updatedAt: new Date(now - 86400000 * 2).toISOString(),
    },
    {
      id: 'p-2', firstName: 'Jordan', lastName: 'Lee', fullName: 'Jordan Lee',
      dateOfBirth: '1988-11-22', gender: 'prefer_not_to_say', caseCount: 1,
      organizationId: 'demo-org', createdAt: new Date(now - 86400000 * 10).toISOString(),
      updatedAt: new Date(now - 86400000 * 1).toISOString(),
    },
    {
      id: 'p-3', firstName: 'Morgan', lastName: 'Taylor', fullName: 'Morgan Taylor',
      dateOfBirth: '2001-07-08', gender: 'prefer_not_to_say', caseCount: 1,
      organizationId: 'demo-org', createdAt: new Date(now - 86400000 * 1).toISOString(),
      updatedAt: new Date(now - 86400000 * 1).toISOString(),
    },
  ];
}

// ─── API client ───────────────────────────────────────────────────────────────

export async function fetchPatients(): Promise<{ patients: PatientListItem[]; source: 'api' | 'demo' }> {
  try {
    const patients = await api.get<PatientListItem[]>('/api/patients');
    return { patients, source: 'api' };
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0) throw err;
    return { patients: makeDemoPatients(), source: 'demo' };
  }
}

export async function fetchPatient(id: string): Promise<{ data: PatientListItem; source: 'api' | 'demo' }> {
  try {
    const data = await api.get<PatientListItem>(`/api/patients/${id}`);
    return { data, source: 'api' };
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0) throw err;
    const demoPatients = makeDemoPatients();
    const data = demoPatients.find((p) => p.id === id) ?? demoPatients[0];
    return { data, source: 'demo' };
  }
}

export async function createPatient(dto: CreatePatientDto): Promise<PatientListItem> {
  return api.post<PatientListItem>('/api/patients', dto);
}

export async function updatePatient(id: string, dto: UpdatePatientDto): Promise<PatientListItem> {
  return api.patch<PatientListItem>(`/api/patients/${id}`, dto);
}

export async function fetchPatientCases(patientId: string): Promise<import('./cases').CaseListItem[]> {
  return api.get<import('./cases').CaseListItem[]>(`/api/cases?patientId=${encodeURIComponent(patientId)}`);
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  type: string;
  label: string;
  detail?: string;
  actor?: string;
  caseId?: string;
  occurredAt: string;
}

export async function fetchPatientTimeline(patientId: string): Promise<TimelineEvent[]> {
  return api.get<TimelineEvent[]>(`/api/patients/${patientId}/timeline`);
}

export async function addPatientTimelineNote(
  patientId: string,
  dto: { note: string; caseId?: string; eventType?: string; eventAt?: string },
): Promise<TimelineEvent> {
  return api.post<TimelineEvent>(`/api/patients/${patientId}/timeline/notes`, dto);
}
