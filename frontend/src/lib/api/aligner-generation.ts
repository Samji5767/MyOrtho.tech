import { api } from './client';

export type StagingStrategy = 'balanced' | 'anterior_first' | 'posterior_first' | 'arch_coordinated';

export interface GenerateDto {
  stagingStrategy?: StagingStrategy;
  alignerChangeWeeks?: number;
  passiveAlignerCount?: number;
  retentionStageCount?: number;
}

export interface IprScheduleEntry {
  stageNum: number;
  fdiA: number;
  fdiB: number;
  amountMm: number;
}

export interface ElasticScheduleEntry {
  stageNum: number;
  classification: 'class_ii' | 'class_iii' | 'midline';
  notes: string;
}

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
  organizationId: string;
  totalActiveStages: number;
  passiveAlignerCount: number;
  retentionStageCount: number;
  alignerChangeWeeks: number;
  stagingStrategy: StagingStrategy;
  attachmentStartStage: number | null;
  attachmentEndStage: number | null;
  iprStageSchedule: IprScheduleEntry[];
  elasticStageSchedule: ElasticScheduleEntry[];
  stageAllocations: StageAllocationSummary[];
  estimatedTotalWeeks: number | null;
  stlExportReady: boolean;
  status: 'draft' | 'approved' | 'manufacturing' | 'complete';
  notes: string | null;
  generatedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  generatedAt: string;
}

const base = (caseId: string, planId: string) =>
  `/api/cases/${caseId}/plans/${planId}/aligner-generation`;

export const generateAlignerPlan = (caseId: string, planId: string, dto: GenerateDto) =>
  api.post<AlignerGenerationPlan>(`${base(caseId, planId)}/generate`, dto);

export const getAlignerGenerationPlan = (caseId: string, planId: string) =>
  api.get<AlignerGenerationPlan>(`${base(caseId, planId)}/plan`);

export const getStageAllocations = (caseId: string, planId: string, stageNum: number) =>
  api.get<Record<string, unknown>[]>(`${base(caseId, planId)}/stages/${stageNum}`);

export const approveAlignerPlan = (caseId: string, planId: string, notes?: string) =>
  api.post<AlignerGenerationPlan>(`${base(caseId, planId)}/approve`, { notes });

export const markStlReady = (caseId: string, planId: string, exportPath: string) =>
  api.post<AlignerGenerationPlan>(`${base(caseId, planId)}/stl-ready`, { exportPath });

export const generateStlExport = (caseId: string, planId: string) =>
  api.post<AlignerGenerationPlan>(`${base(caseId, planId)}/generate-stl`, {});

export interface QualityIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface QualityReport {
  overallScore: number;
  meshIntegrity: number;
  printability: number;
  minThicknessMm: number;
  overhangCount: number;
  estimatedResinGrams: number;
  estimatedPrintTimeMinutes: number;
  estimatedCostUsd: number;
  batchCount: number;
  stageCount: number;
  issues: QualityIssue[];
  generatedAt: string;
}

export const getQualityReport = (caseId: string, planId: string) =>
  api.get<QualityReport>(`${base(caseId, planId)}/quality-report`);
