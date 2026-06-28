import { api } from './client';

export type ProposalStatus = 'draft' | 'reviewed' | 'accepted' | 'rejected';
export type AngleClass = 'I' | 'II_div1' | 'II_div2' | 'III';

export interface IprSuggestion {
  toothA: string;
  toothB: string;
  amountMm: number;
  stage: number;
}

export interface AttachmentSuggestion {
  tooth: string;
  type: string;
  stage: number;
}

export interface AnchorageRec {
  type: string;
  teeth?: string[];
  location?: string;
  stage?: number;
}

export interface MovementPhase {
  phase: number;
  stages: string;
  description: string;
  priority?: string;
}

export interface AIProposal {
  id: string;
  caseId: string;
  treatmentPlanId: string | null;
  status: ProposalStatus;
  angleClassification: AngleClass | null;
  idealOcclusion: { targetOverjet: number; targetOverbite: number; targetMidlineDeviation: number; targetAngleClass: string };
  movementSequence: MovementPhase[];
  estimatedStages: number | null;
  suggestedAttachments: AttachmentSuggestion[];
  suggestedIpr: IprSuggestion[];
  anchorageRecs: AnchorageRec[];
  expansionRecs: { arch: string; type: string; amountMm: number; stage: number }[];
  predictedDurationWeeks: number | null;
  refinementProbability: number | null;
  complexityScore: number | null;
  aiNotes: string | null;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  generatedAt: string;
  createdAt: string;
}

export const ANGLE_CLASS_LABELS: Record<AngleClass, string> = {
  I:       'Class I',
  II_div1: 'Class II Div. 1',
  II_div2: 'Class II Div. 2',
  III:     'Class III',
};

export const listProposals = (caseId: string) =>
  api.get<AIProposal[]>(`/api/cases/${caseId}/proposals`);

export const generateProposal = (caseId: string, dto: {
  treatmentPlanId?: string;
  angleClassification?: AngleClass;
  overjetMm?: number;
  overbitemm?: number;
  upperCrowdingMm?: number;
  lowerCrowdingMm?: number;
  boltonOverall?: number;
  boltonAnterior?: number;
}) => api.post<AIProposal>(`/api/cases/${caseId}/proposals/generate`, dto);

export const getProposal = (caseId: string, proposalId: string) =>
  api.get<AIProposal>(`/api/cases/${caseId}/proposals/${proposalId}`);

export const reviewProposal = (caseId: string, proposalId: string, dto: {
  status: 'reviewed' | 'accepted' | 'rejected';
  reviewNotes?: string;
}) => api.patch<AIProposal>(`/api/cases/${caseId}/proposals/${proposalId}/review`, dto);
