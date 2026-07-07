import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

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

@Injectable()
export class DigitalTwinService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getDigitalTwin(caseId: string, orgId: string): Promise<DigitalTwin> {
    // Verify case ownership and load case + patient in one query
    const { rows: caseRows } = await this.pool.query<{
      id: string;
      status: string;
      chief_complaint: string | null;
      malocclusion_class: string | null;
      patient_id: string;
      first_name: string;
      last_name: string;
      dob: string | null;
      gender: string | null;
    }>(
      `SELECT c.id, c.status, c.chief_complaint, c.malocclusion_class,
              p.id AS patient_id, p.first_name, p.last_name, p.dob, p.gender
       FROM cases c JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!caseRows.length) throw new NotFoundException('Case not found');
    const cas = caseRows[0];

    // Fetch all supporting data in parallel
    const [scanRows, planRows, stagingRows, qualityRows, summaryRows] = await Promise.all([
      // Latest scan
      this.pool.query<{
        id: string;
        jaw_type: string;
        file_format: string;
        file_size_bytes: number | null;
        created_at: string;
      }>(
        `SELECT id, jaw_type, file_format, file_size_bytes, created_at
         FROM scans WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      ),
      // Latest treatment plan
      this.pool.query<{
        id: string;
        status: string;
        approved: boolean;
        approved_at: string | null;
        created_at: string;
      }>(
        `SELECT id, status, approved, approved_at, created_at
         FROM treatment_plans WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      ),
      // Staging plan for latest treatment plan
      this.pool.query<{
        total_active_stages: number;
        passive_aligner_count: number;
        retention_stage_count: number;
        aligner_change_weeks: number;
        estimated_total_weeks: number | null;
        staging_strategy: string;
      }>(
        `SELECT agp.total_active_stages, agp.passive_aligner_count, agp.retention_stage_count,
                agp.aligner_change_weeks, agp.estimated_total_weeks, agp.staging_strategy
         FROM aligner_generation_plans agp
         JOIN treatment_plans tp ON tp.id = agp.plan_id
         WHERE tp.case_id = $1 ORDER BY agp.created_at DESC LIMIT 1`,
        [caseId],
      ),
      // Quality score for latest plan
      this.pool.query<{
        grade: string;
        overall_score: string;
        movement_safety_score: string | null;
        ipr_safety_score: string | null;
        attachment_score: string | null;
        has_critical_issues: boolean;
        critical_issue_count: number;
        warning_count: number;
      }>(
        `SELECT tqs.grade, tqs.overall_score, tqs.movement_safety_score,
                tqs.ipr_safety_score, tqs.attachment_score,
                tqs.has_critical_issues, tqs.critical_issue_count, tqs.warning_count
         FROM treatment_quality_scores tqs
         JOIN treatment_plans tp ON tp.id = tqs.plan_id
         WHERE tp.case_id = $1 ORDER BY tqs.scored_at DESC LIMIT 1`,
        [caseId],
      ),
      // Aggregated clinical summary counts
      this.pool.query<{
        collision_count: string;
        critical_collision_count: string;
        unsafe_ipr_count: string;
        refinement_cycle_count: string;
        manufacturing_export_count: string;
        open_suggestion_count: string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM attachment_collisions ac
            JOIN treatment_plans tp ON tp.id = ac.plan_id WHERE tp.case_id = $1
           ) AS collision_count,
           (SELECT COUNT(*) FROM attachment_collisions ac
            JOIN treatment_plans tp ON tp.id = ac.plan_id WHERE tp.case_id = $1
            AND ac.severity = 'critical'
           ) AS critical_collision_count,
           (SELECT COUNT(*) FROM ipr_enamel_estimates ie
            JOIN treatment_plans tp ON tp.id = ie.plan_id WHERE tp.case_id = $1
            AND ie.is_safe = false
           ) AS unsafe_ipr_count,
           (SELECT COUNT(*) FROM refinement_cycles WHERE case_id = $1
           ) AS refinement_cycle_count,
           (SELECT COUNT(*) FROM manufacture_exports WHERE case_id = $1
           ) AS manufacturing_export_count,
           (SELECT COUNT(*) FROM copilot_suggestions cs
            JOIN copilot_conversations cc ON cc.id = cs.conversation_id
            WHERE cc.case_id = $1 AND cs.status = 'open'
           ) AS open_suggestion_count`,
        [caseId],
      ),
    ]);

    const scan = scanRows.rows[0] ?? null;
    const plan = planRows.rows[0] ?? null;
    const staging = stagingRows.rows[0] ?? null;
    const quality = qualityRows.rows[0] ?? null;
    const summary = summaryRows.rows[0];

    return {
      caseId,
      status: cas.status,
      chiefComplaint: cas.chief_complaint,
      malocclusionClass: cas.malocclusion_class,
      patient: {
        id: cas.patient_id,
        firstName: cas.first_name,
        lastName: cas.last_name,
        dateOfBirth: cas.dob ? String(cas.dob).slice(0, 10) : null,
        gender: cas.gender,
      },
      latestScan: scan
        ? {
            id: scan.id,
            jawType: scan.jaw_type,
            fileFormat: scan.file_format,
            fileSizeBytes: scan.file_size_bytes,
            createdAt: String(scan.created_at),
          }
        : null,
      treatmentPlan: plan
        ? {
            id: plan.id,
            status: plan.status,
            approved: plan.approved,
            approvedAt: plan.approved_at ? String(plan.approved_at) : null,
            createdAt: String(plan.created_at),
          }
        : null,
      staging: staging
        ? {
            totalActiveStages: staging.total_active_stages,
            passiveAlignerCount: staging.passive_aligner_count,
            retentionStageCount: staging.retention_stage_count,
            alignerChangeWeeks: staging.aligner_change_weeks,
            estimatedTotalWeeks: staging.estimated_total_weeks,
            stagingStrategy: staging.staging_strategy,
          }
        : null,
      qualityScore: quality
        ? {
            grade: quality.grade,
            overallScore: Math.round(Number(quality.overall_score) * 100),
            movementSafetyScore: quality.movement_safety_score
              ? Math.round(Number(quality.movement_safety_score) * 100)
              : null,
            iprSafetyScore: quality.ipr_safety_score
              ? Math.round(Number(quality.ipr_safety_score) * 100)
              : null,
            attachmentScore: quality.attachment_score
              ? Math.round(Number(quality.attachment_score) * 100)
              : null,
            hasCriticalIssues: quality.has_critical_issues,
            criticalIssueCount: quality.critical_issue_count,
            warningCount: quality.warning_count,
          }
        : null,
      clinicalSummary: {
        collisionCount: Number(summary?.collision_count ?? 0),
        criticalCollisionCount: Number(summary?.critical_collision_count ?? 0),
        unsafeIprCount: Number(summary?.unsafe_ipr_count ?? 0),
        refinementCycleCount: Number(summary?.refinement_cycle_count ?? 0),
        manufacturingExportCount: Number(summary?.manufacturing_export_count ?? 0),
        openSuggestionCount: Number(summary?.open_suggestion_count ?? 0),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
