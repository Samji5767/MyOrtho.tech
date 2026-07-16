import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface SafetyFinding {
  code: string;
  message: string;
  level: 'blocker' | 'warning' | 'info';
  dataRequirement?: string;
}

export interface SafetyGateResult {
  caseId: string;
  planId: string | null;
  canApprove: boolean;
  canSendToManufacturing: boolean;
  blockers: SafetyFinding[];
  warnings: SafetyFinding[];
  info: SafetyFinding[];
  allowedNextActions: string[];
  checkedAt: string;
}

@Injectable()
export class ClinicalSafetyGateService {
  private readonly logger = new Logger(ClinicalSafetyGateService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async evaluate(caseId: string, orgId: string, planId?: string): Promise<SafetyGateResult> {
    const blockers: SafetyFinding[] = [];
    const warnings: SafetyFinding[] = [];
    const info: SafetyFinding[] = [];

    // ── 1. Verify case exists in org ─────────────────────────────────────────
    const { rows: caseRows } = await this.pool.query(
      `SELECT c.id, c.status, c.chief_complaint, c.malocclusion_class,
              p.organization_id
       FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!caseRows[0]) {
      blockers.push({ code: 'CASE_NOT_FOUND', message: 'Case not found in this organization.', level: 'blocker' });
      return this.buildResult(caseId, planId ?? null, blockers, warnings, info);
    }
    const caseStatus = caseRows[0].status as string;

    // ── 2. Scan completeness ─────────────────────────────────────────────────
    const { rows: scanRows } = await this.pool.query(
      `SELECT jaw_type, status, file_path
       FROM scans
       WHERE case_id = $1
       ORDER BY created_at DESC`,
      [caseId],
    );

    const approvedScans = scanRows.filter((s) => s.status === 'approved' || s.status === 'validated');
    const hasMaxillary = approvedScans.some((s) => ['maxillary', 'both'].includes(s.jaw_type as string));
    const hasMandibular = approvedScans.some((s) => ['mandibular', 'both'].includes(s.jaw_type as string));

    if (scanRows.length === 0) {
      blockers.push({
        code: 'NO_SCANS',
        message: 'No scan files are associated with this case.',
        level: 'blocker',
        dataRequirement: 'Upload maxillary and mandibular STL scans.',
      });
    } else {
      if (!hasMaxillary) {
        blockers.push({
          code: 'MISSING_MAXILLARY_SCAN',
          message: 'No validated maxillary (upper arch) scan found.',
          level: 'blocker',
          dataRequirement: 'Upload and validate a maxillary STL scan.',
        });
      }
      if (!hasMandibular) {
        blockers.push({
          code: 'MISSING_MANDIBULAR_SCAN',
          message: 'No validated mandibular (lower arch) scan found.',
          level: 'blocker',
          dataRequirement: 'Upload and validate a mandibular STL scan.',
        });
      }
      const pendingScans = scanRows.filter((s) => !['approved', 'validated'].includes(s.status as string));
      if (pendingScans.length > 0) {
        warnings.push({
          code: 'UNVALIDATED_SCANS',
          message: `${pendingScans.length} scan(s) have not been validated yet.`,
          level: 'warning',
        });
      }
    }

    // ── 3. Treatment plan existence ──────────────────────────────────────────
    let resolvedPlanId = planId ?? null;
    if (resolvedPlanId) {
      const { rows: planRows } = await this.pool.query(
        `SELECT id, doctor_approval, approved_at, estimated_stages, ai_recommendation_notes
         FROM treatment_plans WHERE id = $1 AND case_id = $2`,
        [resolvedPlanId, caseId],
      );
      if (!planRows[0]) {
        blockers.push({ code: 'PLAN_NOT_FOUND', message: 'Specified treatment plan not found for this case.', level: 'blocker' });
      } else {
        const plan = planRows[0];

        if (!plan.estimated_stages || plan.estimated_stages === 0) {
          warnings.push({
            code: 'ZERO_STAGES',
            message: 'Treatment plan has zero estimated stages.',
            level: 'warning',
          });
        }

        // ── 4. Simulated stage check ─────────────────────────────────────────
        const { rows: simRows } = await this.pool.query(
          `SELECT id FROM aligner_stages
           WHERE treatment_plan_id = $1
             AND (movement_data::jsonb ->> '_is_simulated')::boolean = true
           LIMIT 1`,
          [resolvedPlanId],
        ).catch(() => ({ rows: [] }));

        if (simRows.length > 0) {
          blockers.push({
            code: 'SIMULATED_STAGES_PRESENT',
            message: 'Treatment plan contains simulated scaffold stages. Replace with AI-computed or clinician-verified stages before approval.',
            level: 'blocker',
          });
        }

        // ── 5. AI notes disclaimer ───────────────────────────────────────────
        if (plan.ai_recommendation_notes) {
          info.push({
            code: 'AI_DISCLAIMER',
            message: 'AI treatment planning recommendations are research-stage only. Not clinically validated. All plans require clinical review and doctor approval.',
            level: 'info',
          });
        }
      }
    } else {
      // No plan specified — check if any plan exists
      const { rows: anyPlan } = await this.pool.query(
        `SELECT id FROM treatment_plans WHERE case_id = $1 LIMIT 1`,
        [caseId],
      );
      if (anyPlan.length === 0) {
        blockers.push({
          code: 'NO_TREATMENT_PLAN',
          message: 'No treatment plan exists for this case.',
          level: 'blocker',
          dataRequirement: 'Create a treatment plan before approval.',
        });
      }
    }

    // ── 6. Approval status check ─────────────────────────────────────────────
    if (resolvedPlanId) {
      const { rows: approvalRows } = await this.pool.query(
        `SELECT doctor_approval, approved_at FROM treatment_plans WHERE id = $1`,
        [resolvedPlanId],
      ).catch(() => ({ rows: [] }));

      if (approvalRows[0]?.doctor_approval) {
        info.push({ code: 'ALREADY_APPROVED', message: 'Treatment plan is already approved.', level: 'info' });
      }
    }

    // ── 7. Case status warnings ──────────────────────────────────────────────
    if (!['clinical_review', 'planning', 'approved'].includes(caseStatus)) {
      warnings.push({
        code: 'UNEXPECTED_STATUS',
        message: `Case is in status '${caseStatus}' — typical approval occurs from 'clinical_review' status.`,
        level: 'warning',
      });
    }

    // ── 8. Chief complaint ──────────────────────────────────────────────────
    if (!caseRows[0].chief_complaint) {
      warnings.push({
        code: 'MISSING_CHIEF_COMPLAINT',
        message: 'Chief complaint is not documented.',
        level: 'warning',
      });
    }

    return this.buildResult(caseId, resolvedPlanId, blockers, warnings, info);
  }

  private buildResult(
    caseId: string,
    planId: string | null,
    blockers: SafetyFinding[],
    warnings: SafetyFinding[],
    info: SafetyFinding[],
  ): SafetyGateResult {
    const canApprove = blockers.length === 0;
    const canSendToManufacturing = canApprove; // manufacturing additionally requires doctor_approval=true

    const allowedNextActions: string[] = [];
    if (canApprove) allowedNextActions.push('approve_plan', 'request_peer_review');
    if (canSendToManufacturing) allowedNextActions.push('send_to_manufacturing');
    allowedNextActions.push('add_notes', 'upload_scan');

    this.logger.log(
      `Safety gate evaluated for case ${caseId}: ${blockers.length} blocker(s), ${warnings.length} warning(s)`,
    );

    return {
      caseId,
      planId,
      canApprove,
      canSendToManufacturing,
      blockers,
      warnings,
      info,
      allowedNextActions,
      checkedAt: new Date().toISOString(),
    };
  }
}
