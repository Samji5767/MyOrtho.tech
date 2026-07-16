import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ReadinessFinding {
  code: string;
  message: string;
  level: 'blocker' | 'warning' | 'info';
  field?: string;
}

export interface ManufacturingReadinessResult {
  caseId: string;
  planId: string | null;
  canQueue: boolean;
  blockers: ReadinessFinding[];
  warnings: ReadinessFinding[];
  info: ReadinessFinding[];
  estimatedStages: number | null;
  validatedStages: number;
  checkedAt: string;
}

@Injectable()
export class ManufacturingReadinessGateService {
  private readonly logger = new Logger(ManufacturingReadinessGateService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async evaluate(caseId: string, orgId: string, planId?: string): Promise<ManufacturingReadinessResult> {
    const blockers: ReadinessFinding[] = [];
    const warnings: ReadinessFinding[] = [];
    const info: ReadinessFinding[] = [];

    // ── 1. Case ownership ────────────────────────────────────────────────────
    const { rows: caseRows } = await this.pool.query(
      `SELECT c.id, c.status
       FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!caseRows[0]) {
      blockers.push({ code: 'CASE_NOT_FOUND', message: 'Case not found in this organization.', level: 'blocker' });
      return this.buildResult(caseId, planId ?? null, blockers, warnings, info, null, 0);
    }

    // ── 2. Treatment plan approval ───────────────────────────────────────────
    let resolvedPlanId = planId ?? null;
    let estimatedStages: number | null = null;

    if (resolvedPlanId) {
      const { rows: planRows } = await this.pool.query(
        `SELECT id, doctor_approval, approved_at, estimated_stages
         FROM treatment_plans WHERE id = $1 AND case_id = $2`,
        [resolvedPlanId, caseId],
      );
      if (!planRows[0]) {
        blockers.push({ code: 'PLAN_NOT_FOUND', message: 'Treatment plan not found.', level: 'blocker' });
        return this.buildResult(caseId, resolvedPlanId, blockers, warnings, info, null, 0);
      }
      if (!planRows[0].doctor_approval) {
        blockers.push({
          code: 'PLAN_NOT_APPROVED',
          message: 'Treatment plan has not been approved by a doctor. Doctor approval is required before manufacturing.',
          level: 'blocker',
          field: 'doctor_approval',
        });
      }
      estimatedStages = planRows[0].estimated_stages as number | null;
    } else {
      // Find the most recently approved plan
      const { rows: approvedPlans } = await this.pool.query(
        `SELECT id, doctor_approval, approved_at, estimated_stages
         FROM treatment_plans
         WHERE case_id = $1 AND doctor_approval = true
         ORDER BY approved_at DESC LIMIT 1`,
        [caseId],
      );
      if (approvedPlans.length === 0) {
        blockers.push({
          code: 'NO_APPROVED_PLAN',
          message: 'No doctor-approved treatment plan found for this case.',
          level: 'blocker',
        });
      } else {
        resolvedPlanId = approvedPlans[0].id as string;
        estimatedStages = approvedPlans[0].estimated_stages as number | null;
      }
    }

    // ── 3. Simulated stages must not exist ───────────────────────────────────
    if (resolvedPlanId) {
      const { rows: simRows } = await this.pool.query(
        `SELECT COUNT(*) AS cnt FROM aligner_stages
         WHERE treatment_plan_id = $1
           AND (movement_data::jsonb ->> '_is_simulated')::boolean = true`,
        [resolvedPlanId],
      ).catch(() => ({ rows: [{ cnt: '0' }] }));
      if (parseInt(simRows[0]?.cnt ?? '0', 10) > 0) {
        blockers.push({
          code: 'SIMULATED_STAGES',
          message: 'Treatment plan contains simulated scaffold stages. These cannot be sent to manufacturing.',
          level: 'blocker',
        });
      }
    }

    // ── 4. STL mesh files exist ──────────────────────────────────────────────
    if (resolvedPlanId) {
      const { rows: stageRows } = await this.pool.query(
        `SELECT id, stage_number, maxillary_mesh_path, mandibular_mesh_path
         FROM aligner_stages
         WHERE treatment_plan_id = $1
         ORDER BY stage_number`,
        [resolvedPlanId],
      ).catch(() => ({ rows: [] }));

      const missingMesh = stageRows.filter(
        (s) => !s.maxillary_mesh_path && !s.mandibular_mesh_path,
      );
      if (stageRows.length === 0) {
        blockers.push({
          code: 'NO_STAGES',
          message: 'No aligner stages found for the treatment plan.',
          level: 'blocker',
          field: 'aligner_stages',
        });
      } else if (missingMesh.length > 0) {
        blockers.push({
          code: 'MISSING_MESH_FILES',
          message: `${missingMesh.length} stage(s) are missing STL mesh file paths.`,
          level: 'blocker',
          field: 'mesh_path',
        });
      }

      const validatedStageCount = stageRows.length - missingMesh.length;

      // ── 5. QA inspection ─────────────────────────────────────────────────
      const { rows: qaRows } = await this.pool.query(
        `SELECT status FROM qa_inspections
         WHERE case_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      ).catch(() => ({ rows: [] }));

      if (qaRows.length > 0) {
        const qaStatus = qaRows[0].status as string;
        if (qaStatus === 'rejected' || qaStatus === 'failed') {
          blockers.push({
            code: 'QA_REJECTED',
            message: 'Most recent QA inspection was rejected. Resolve QA findings before sending to manufacturing.',
            level: 'blocker',
            field: 'qa_status',
          });
        } else if (qaStatus === 'approved' || qaStatus === 'passed') {
          info.push({ code: 'QA_PASSED', message: 'QA inspection passed.', level: 'info' });
        } else {
          warnings.push({
            code: 'QA_PENDING',
            message: `QA inspection is in status '${qaStatus}'. Recommend completing QA before manufacturing.`,
            level: 'warning',
          });
        }
      } else {
        warnings.push({
          code: 'NO_QA_RECORD',
          message: 'No QA inspection record found. Consider completing QA before manufacturing.',
          level: 'warning',
        });
      }

      // ── 6. Printer availability ──────────────────────────────────────────
      const { rows: printerRows } = await this.pool.query(
        `SELECT id, status, connector_status FROM printers
         WHERE organization_id = $1 AND status = 'online'
         LIMIT 1`,
        [orgId],
      ).catch(() => ({ rows: [] }));

      if (printerRows.length === 0) {
        warnings.push({
          code: 'NO_ONLINE_PRINTER',
          message: 'No online printer found for this organization.',
          level: 'warning',
          field: 'printer_id',
        });
      }

      return this.buildResult(caseId, resolvedPlanId, blockers, warnings, info, estimatedStages, validatedStageCount);
    }

    return this.buildResult(caseId, resolvedPlanId, blockers, warnings, info, estimatedStages, 0);
  }

  private buildResult(
    caseId: string,
    planId: string | null,
    blockers: ReadinessFinding[],
    warnings: ReadinessFinding[],
    info: ReadinessFinding[],
    estimatedStages: number | null,
    validatedStages: number,
  ): ManufacturingReadinessResult {
    const canQueue = blockers.length === 0;
    this.logger.log(
      `Manufacturing readiness gate: case=${caseId} canQueue=${canQueue} blockers=${blockers.length}`,
    );
    return {
      caseId,
      planId,
      canQueue,
      blockers,
      warnings,
      info,
      estimatedStages,
      validatedStages,
      checkedAt: new Date().toISOString(),
    };
  }
}
