import { api } from './client';

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

// ─── API client ───────────────────────────────────────────────────────────────

export async function fetchPatients(): Promise<{ patients: PatientListItem[]; source: 'api' }> {
  const patients = await api.get<PatientListItem[]>('/api/patients');
  return { patients, source: 'api' };
}

export async function fetchPatient(id: string): Promise<{ data: PatientListItem; source: 'api' }> {
  const data = await api.get<PatientListItem>(`/api/patients/${id}`);
  return { data, source: 'api' };
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
