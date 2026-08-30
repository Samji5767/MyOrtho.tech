import { api } from './client';

export type StagingStrategy = 'balanced' | 'anterior_first' | 'posterior_first' | 'arch_coordinated';

export const STRATEGY_LABELS: Record<StagingStrategy, string> = {
  balanced:         'Balanced',
  anterior_first:   'Anterior first',
  posterior_first:  'Posterior first',
  arch_coordinated: 'Arch coordinated',
};

export interface StageAllocationSummary {
  stageNum: number;
  teethMoved: number;
  maxTranslationMm: number;
  maxRotationDeg: number;
  hasAttachment: boolean;
  hasIpr: boolean;
  isPassive: boolean;
  isRetention: boolean;
}

export interface AlignerGenerationPlan {
  id: string;
  planId: string;
  totalActiveStages: number;
  passiveAlignerCount: number;
  retentionStageCount: number;
  alignerChangeWeeks: number;
  stagingStrategy: StagingStrategy;
  iprStageSchedule: Array<{ stageNum: number; fdiA: number; fdiB: number; amountMm: number }>;
  elasticStageSchedule: Array<{ stageNum: number; classification: string; notes: string }>;
  stageAllocations: StageAllocationSummary[];
  estimatedTotalWeeks: number | null;
  stlExportReady: boolean;
  status: 'draft' | 'approved' | 'manufacturing' | 'complete';
  notes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  generatedAt: string;
}

export interface QualityIssue {
  stageNum?: number;
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface ManufacturingReadinessCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface StageQualityReport {
  planId: string;
  generatedAt: string;
  overallQualityScore: number;
  issues: QualityIssue[];
  manufacturingReadiness: ManufacturingReadinessCheck[];
  isManufacturingReady: boolean;
}

const base = (caseId: string, planId: string) =>
  `/api/cases/${caseId}/plans/${planId}/aligner-generation`;

/** 404s when /generate has not run yet — callers treat that as "no plan". */
export const getGenerationPlan = (caseId: string, planId: string) =>
  api.get<AlignerGenerationPlan>(`${base(caseId, planId)}/plan`);

export const generatePlan = (caseId: string, planId: string, dto: {
  stagingStrategy?: StagingStrategy;
  alignerChangeWeeks?: number;
  passiveAlignerCount?: number;
  retentionStageCount?: number;
}) => api.post<AlignerGenerationPlan>(`${base(caseId, planId)}/generate`, dto);

export const getQualityReport = (caseId: string, planId: string) =>
  api.get<StageQualityReport>(`${base(caseId, planId)}/quality-report`);

/** Builds per-stage meshes via the AI engine — can take minutes. */
export const generateStageStls = (caseId: string, planId: string) =>
  api.post<AlignerGenerationPlan>(`${base(caseId, planId)}/generate-stl`, {}, 300_000);

export const approveGenerationPlan = (caseId: string, planId: string, notes?: string) =>
  api.post<AlignerGenerationPlan>(`${base(caseId, planId)}/approve`, { notes });

export const stlExportUrl = (caseId: string, planId: string) =>
  `${base(caseId, planId)}/stl-export`;
