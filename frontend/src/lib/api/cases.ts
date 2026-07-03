import { api, ApiError } from './client';

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

// ─── Demo fallback data ───────────────────────────────────────────────────────
// Shown when the backend is not reachable (local dev without a running API).

const DEMO_CASES: CaseListItem[] = [
  {
    id: 'demo-1',
    status: 'active_treatment',
    chiefComplaint: 'Class II malocclusion with crowding',
    malocclusionClass: 'Class II Div 1',
    notes: null,
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    patient: { id: 'p-1', firstName: 'Alex', lastName: 'Chen' },
    assignedTo: null,
  },
  {
    id: 'demo-2',
    status: 'scan_review',
    chiefComplaint: 'Open bite, anterior spacing',
    malocclusionClass: 'Class I',
    notes: null,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    patient: { id: 'p-2', firstName: 'Jordan', lastName: 'Lee' },
    assignedTo: null,
  },
  {
    id: 'demo-3',
    status: 'draft',
    chiefComplaint: 'Crowding, referred by GP',
    malocclusionClass: null,
    notes: null,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    patient: { id: 'p-3', firstName: 'Morgan', lastName: 'Taylor' },
    assignedTo: null,
  },
];

// ─── API client ───────────────────────────────────────────────────────────────

export async function fetchCases(): Promise<{ cases: CaseListItem[]; source: 'api' | 'demo' }> {
  try {
    const cases = await api.get<CaseListItem[]>('/api/cases');
    return { cases, source: 'api' };
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0) throw err;
    return { cases: DEMO_CASES, source: 'demo' };
  }
}

export async function fetchCase(id: string): Promise<{ data: CaseDetail; source: 'api' | 'demo' }> {
  try {
    const data = await api.get<CaseDetail>(`/api/cases/${id}`);
    return { data, source: 'api' };
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0) throw err;
    // Build a stub demo detail from demo list
    const base = DEMO_CASES.find((c) => c.id === id) ?? DEMO_CASES[0];
    const data: CaseDetail = {
      ...base,
      patient: {
        id: base.patient.id,
        firstName: base.patient.firstName,
        lastName: base.patient.lastName,
        dateOfBirth: '1992-04-15',
        gender: 'prefer_not_to_say',
        clinicalNotes: null,
      },
      workflowHistory: [],
      allowedTransitions: ['scan_review'],
    };
    return { data, source: 'demo' };
  }
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
