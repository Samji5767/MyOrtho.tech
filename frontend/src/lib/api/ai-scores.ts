import { api } from './client';

export interface AiScores {
  caseId: string;
  planId: string | null;
  estimatedDurationMonths: number | null;
  refinementProbability: number;
  successConfidence: number;
  clinicalRiskScore: number;
  qualityGrade: string | null;
  qualityScore: number | null;
  criticalIssueCount: number;
  warningCount: number;
  collisionCount: number;
  unsafeIprCount: number;
  refinementCycleCount: number;
  anchorageLevel: 'low' | 'medium' | 'high';
  computedAt: string;
}

export function getAiScores(caseId: string): Promise<AiScores> {
  return api.get<AiScores>(`/api/cases/${caseId}/ai-scores`);
}
