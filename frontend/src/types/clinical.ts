// Clinical data model for the WhatsApp-style Inbox and Case Room.
// All data is deterministic mock — no backend calls.

export type ClinicalPriority = 'urgent' | 'high' | 'normal' | 'low';

export type ThreadStatus =
  | 'new_scan'
  | 'segmentation'
  | 'plan_ready'
  | 'pending_approval'
  | 'cad'
  | 'manufacturing'
  | 'shipping'
  | 'completed';

export type FilterKey = 'all' | 'urgent' | 'approval' | 'manufacturing' | 'completed';

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
  | 'manufacturing_started'
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
    manufacturing: 'Manufacturing',
    shipping: 'Shipping',
    completed: 'Completed',
  };
  return map[s];
}

export function statusTone(s: ThreadStatus): 'primary' | 'warning' | 'danger' | 'success' | 'info' | 'neutral' {
  if (s === 'pending_approval' || s === 'plan_ready') return 'warning';
  if (s === 'new_scan' || s === 'segmentation') return 'info';
  if (s === 'cad') return 'primary';
  if (s === 'manufacturing') return 'primary';
  if (s === 'shipping' || s === 'completed') return 'success';
  return 'neutral';
}

export function priorityTone(p: ClinicalPriority): 'danger' | 'warning' | 'neutral' | 'neutral' {
  if (p === 'urgent') return 'danger';
  if (p === 'high') return 'warning';
  return 'neutral';
}

// ─── Production data — no mock entries ────────────────────────────────────────

export const MOCK_THREADS: PatientThread[] = [];

export const MOCK_CASE_EVENTS: Record<string, TimelineEvent[]> = {};

export function getThreadEvents(_threadId: string): TimelineEvent[] {
  return [];
}

export const TODAY_STATS = {
  activeCases: 0,
  awaitingApproval: 0,
  inManufacturing: 0,
  slaAtRisk: 0,
};
