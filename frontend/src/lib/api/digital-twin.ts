import { api } from './client';

export interface DigitalTwin {
  caseId: string;
  status: string;
  chiefComplaint: string | null;
  malocclusionClass: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    gender: string | null;
  };
  latestScan: {
    id: string;
    jawType: string;
    fileFormat: string;
    fileSizeBytes: number | null;
    createdAt: string;
  } | null;
  treatmentPlan: {
    id: string;
    status: string;
    approved: boolean;
    approvedAt: string | null;
    createdAt: string;
  } | null;
  staging: {
    totalActiveStages: number;
    passiveAlignerCount: number;
    retentionStageCount: number;
    alignerChangeWeeks: number;
    estimatedTotalWeeks: number | null;
    stagingStrategy: string;
  } | null;
  qualityScore: {
    grade: string;
    overallScore: number;
    movementSafetyScore: number | null;
    iprSafetyScore: number | null;
    attachmentScore: number | null;
    hasCriticalIssues: boolean;
    criticalIssueCount: number;
    warningCount: number;
  } | null;
  clinicalSummary: {
    collisionCount: number;
    criticalCollisionCount: number;
    unsafeIprCount: number;
    refinementCycleCount: number;
    manufacturingExportCount: number;
    openSuggestionCount: number;
  };
  generatedAt: string;
}

export function getDigitalTwin(caseId: string): Promise<DigitalTwin> {
  return api.get<DigitalTwin>(`/api/cases/${caseId}/digital-twin`);
}
