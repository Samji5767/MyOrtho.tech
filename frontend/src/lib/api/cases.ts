import { api } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaseListItem {
  id: string;
  status: string;
  chiefComplaint: string | null;
  malocclusionClass: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient: { id: string; firstName: string; lastName: string };
  assignedTo: { id: string; name: string; email: string } | null;
}

export interface LinkedResources {
  latestScanId: string | null;
  setupId:      string | null;
  planId:       string | null;
  analysisId:   string | null;
  goalsId:      string | null;
}

export interface CaseDetail extends CaseListItem {
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    gender: string | null;
    clinicalNotes: string | null;
  };
  linkedResources?: LinkedResources;
  workflowHistory: WorkflowEvent[];
  allowedTransitions: string[];
}

export interface WorkflowEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateCaseDto {
  patientId: string;
  chiefComplaint?: string;
  malocclusionClass?: string;
  notes?: string;
}

export interface CreateCaseWithPatientDto {
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    clinicalNotes?: string;
  };
  chiefComplaint?: string;
  malocclusionClass?: string;
  notes?: string;
}

export interface UpdateCaseDto {
  chiefComplaint?: string;
  malocclusionClass?: string;
  notes?: string;
}

// ─── API client ───────────────────────────────────────────────────────────────

export async function fetchCases(): Promise<{ cases: CaseListItem[]; source: 'api' }> {
  const cases = await api.get<CaseListItem[]>('/api/cases');
  return { cases, source: 'api' };
}

export async function fetchCase(id: string): Promise<{ data: CaseDetail; source: 'api' }> {
  const data = await api.get<CaseDetail>(`/api/cases/${id}`);
  return { data, source: 'api' };
}

export async function createCase(dto: CreateCaseDto): Promise<CaseDetail> {
  return api.post<CaseDetail>('/api/cases', dto);
}

export async function createCaseWithNewPatient(dto: CreateCaseWithPatientDto): Promise<CaseDetail> {
  return api.post<CaseDetail>('/api/cases/with-new-patient', dto);
}

export async function updateCase(id: string, dto: UpdateCaseDto): Promise<CaseDetail> {
  return api.patch<CaseDetail>(`/api/cases/${id}`, dto);
}

export async function transitionCase(id: string, toStatus: string, notes?: string): Promise<void> {
  await api.post(`/api/cases/${id}/transition`, { toStatus, notes });
}
