// Clinical data model for the WhatsApp-style Inbox and Case Room.
// All data is deterministic mock — no backend calls.

export type ClinicalPriority = 'urgent' | 'high' | 'normal' | 'low';

export type ThreadStatus =
  | 'new_scan'
  | 'segmentation'
  | 'plan_ready'
  | 'pending_approval'
  | 'cad'
  | 'export'
  | 'shipping'
  | 'completed';

export type FilterKey = 'all' | 'urgent' | 'approval' | 'export' | 'completed';

export type WorkflowSection =
  | 'Overview' | 'Scan' | 'Segment' | 'CAD' | 'Plan' | 'Mfg' | 'Notes' | 'Workflow' | 'Audit';

export type TimelineEventType =
  | 'system'
  | 'scan_uploaded'
  | 'segmentation_done'
  | 'plan_ready'
  | 'approval_pending'
  | 'approval_given'
  | 'cad_review'
  | 'cad_approved'
  | 'export_ready'
  | 'qc_passed'
  | 'shipped'
  | 'note';

export interface PatientThread {
  id: string;
  caseId: string;
  patientName: string;
  initials: string;
  accentClass: string;
  status: ThreadStatus;
  priority: ClinicalPriority;
  lastActivity: string;
  lastMessage: string;
  unread: number;
  slaRisk: boolean;
  progress: number;
  currentStage: string;
  assignedTo: string;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  actor: string;
  title: string;
  body: string;
  metadata?: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function statusLabel(s: ThreadStatus): string {
  const map: Record<ThreadStatus, string> = {
    new_scan: 'New scan',
    segmentation: 'Segmentation',
    plan_ready: 'Plan ready',
    pending_approval: 'Awaiting approval',
    cad: 'CAD review',
    export: 'Export',
    shipping: 'Shipping',
    completed: 'Completed',
  };
  return map[s];
}

export function statusTone(s: ThreadStatus): 'primary' | 'warning' | 'danger' | 'success' | 'info' | 'neutral' {
  if (s === 'pending_approval' || s === 'plan_ready') return 'warning';
  if (s === 'new_scan' || s === 'segmentation') return 'info';
  if (s === 'cad') return 'primary';
  if (s === 'export') return 'primary';
  if (s === 'shipping' || s === 'completed') return 'success';
  return 'neutral';
}

export function priorityTone(p: ClinicalPriority): 'danger' | 'warning' | 'neutral' | 'neutral' {
  if (p === 'urgent') return 'danger';
  if (p === 'high') return 'warning';
  return 'neutral';
}

// ─── Production data — no mock entries ────────────────────────────────────────

// Runtime-populated from API — empty array is the correct initial state
export const MOCK_THREADS: PatientThread[] = [];

export const MOCK_CASE_EVENTS: Record<string, TimelineEvent[]> = {};

export function getThreadEvents(_threadId: string): TimelineEvent[] {
  return [];
}

// Runtime-computed from API on load — null means data has not yet been fetched
export const TODAY_STATS: {
  activeCases: number | null;
  awaitingApproval: number | null;
  readyForExport: number | null;
  slaAtRisk: number | null;
} = {
  activeCases: null,
  awaitingApproval: null,
  readyForExport: null,
  slaAtRisk: null,
};
