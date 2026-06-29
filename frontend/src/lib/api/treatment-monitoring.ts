const BASE = '/api';

export type CheckInType = 'photo_review' | 'scan_comparison' | 'clinical_exam' | 'patient_self_report';
export type AlertStatus = 'open' | 'reviewed' | 'resolved' | 'escalated';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface CheckIn {
  id: string;
  caseId: string;
  planId: string;
  currentStage: number;
  totalStages: number;
  checkInType: CheckInType;
  notes: string | null;
  photoIds: string[];
  createdAt: string;
}

export interface OffTrackAlert {
  id: string;
  caseId: string;
  planId: string;
  alertType: string;
  severity: AlertSeverity;
  affectedStage: number | null;
  affectedTeeth: number[];
  description: string;
  recommendedAction: string;
  status: AlertStatus;
  createdAt: string;
}

export interface QualityScore {
  planId: string;
  overallScore: number;
  grade: QualityGrade;
  movementSafetyScore: number | null;
  pdlSafetyScore: number | null;
  iprSafetyScore: number | null;
  attachmentScore: number | null;
  simulationScore: number | null;
  archCoordScore: number | null;
  retentionScore: number | null;
  exportReadinessScore: number | null;
  hasCriticalIssues: boolean;
  criticalIssueCount: number;
  warningCount: number;
  scoreBreakdown: Record<string, unknown>;
  recommendations: string[];
  scoredAt: string;
}

export interface CheckInPayload {
  planId: string;
  currentStage: number;
  totalStages: number;
  checkInType: CheckInType;
  notes?: string;
  photoIds?: string[];
}

export async function submitCheckIn(
  caseId: string,
  payload: CheckInPayload,
): Promise<{ checkIn: CheckIn; alerts: OffTrackAlert[] }> {
  const res = await fetch(`${BASE}/cases/${caseId}/check-ins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listCheckIns(caseId: string, planId?: string): Promise<CheckIn[]> {
  const url = planId
    ? `${BASE}/cases/${caseId}/check-ins?planId=${planId}`
    : `${BASE}/cases/${caseId}/check-ins`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listAlerts(caseId: string, planId?: string): Promise<OffTrackAlert[]> {
  const url = planId
    ? `${BASE}/cases/${caseId}/off-track-alerts?planId=${planId}`
    : `${BASE}/cases/${caseId}/off-track-alerts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function resolveAlert(
  caseId: string,
  alertId: string,
  status: 'reviewed' | 'resolved' | 'escalated',
  note?: string,
): Promise<OffTrackAlert> {
  const res = await fetch(`${BASE}/cases/${caseId}/off-track-alerts/${alertId}/resolve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function computeQualityScore(caseId: string, planId: string): Promise<QualityScore> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/quality-score`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getQualityScore(caseId: string, planId: string): Promise<QualityScore | null> {
  const res = await fetch(`${BASE}/cases/${caseId}/plans/${planId}/quality-score`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
