import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface CaseReportData {
  reportId: string;
  caseId: string;
  generatedAt: string;
  patient: { id: string; firstName: string; lastName: string; dateOfBirth: string | null; gender: string | null };
  caseInfo: { status: string; chiefComplaint: string | null; malocclusionClass: string | null; notes: string | null; createdAt: string };
  analysis: {
    boltonOverall: number | null; boltonAnterior: number | null; angleClass: string | null;
    overjetMm: number | null; overbiteM: number | null; upperCrowdingMm: number | null;
    lowerCrowdingMm: number | null; complexityScore: number | null; iprSchedule: unknown[]; notes: string | null;
  } | null;
  treatmentPlan: { id: string; estimatedStages: number; doctorApproval: boolean; approvedAt: string | null; aiRecommendationNotes: string | null } | null;
  scans: { id: string; jawType: string; originalFilename: string; createdAt: string }[];
  workflowHistory: { toStatus: string; actorName: string | null; createdAt: string }[];
}

@Injectable()
export class ReportingService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async generateCaseReport(caseId: string, orgId: string): Promise<CaseReportData> {
    const { rows: cRows } = await this.pool.query(
      `SELECT c.id, c.status, c.chief_complaint, c.malocclusion_class, c.notes, c.created_at,
              p.id as patient_id, p.first_name, p.last_name, p.date_of_birth, p.gender
       FROM cases c JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!cRows[0]) throw new NotFoundException('Case not found');
    const c = cRows[0];

    const [{ rows: aRows }, { rows: pRows }, { rows: sRows }, { rows: wRows }] = await Promise.all([
      this.pool.query(
        `SELECT bolton_overall, bolton_anterior, angle_class, overjet_mm, overbite_m,
                upper_crowding_mm, lower_crowding_mm, complexity_score, ipr_schedule, notes
         FROM case_analyses WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      ),
      this.pool.query(
        `SELECT id, estimated_stages, doctor_approval, approved_at, ai_recommendation_notes
         FROM treatment_plans WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      ),
      this.pool.query(
        `SELECT id, jaw_type, original_filename, created_at FROM scans WHERE case_id = $1 ORDER BY created_at`,
        [caseId],
      ),
      this.pool.query(
        `SELECT we.to_status, au.name as actor_name, we.created_at
         FROM workflow_events we LEFT JOIN auth_users au ON au.id = we.actor_id
         WHERE we.case_id = $1 ORDER BY we.created_at`,
        [caseId],
      ),
    ]);

    const a = aRows[0];
    const p = pRows[0];
    return {
      reportId: `RPT-${caseId.slice(0, 8).toUpperCase()}-${Date.now()}`,
      caseId,
      generatedAt: new Date().toISOString(),
      patient: {
        id: c.patient_id as string,
        firstName: c.first_name as string,
        lastName: c.last_name as string,
        dateOfBirth: c.date_of_birth as string | null,
        gender: c.gender as string | null,
      },
      caseInfo: {
        status: c.status as string,
        chiefComplaint: c.chief_complaint as string | null,
        malocclusionClass: c.malocclusion_class as string | null,
        notes: c.notes as string | null,
        createdAt: (c.created_at as Date).toISOString(),
      },
      analysis: a
        ? {
            boltonOverall: a.bolton_overall != null ? Number(a.bolton_overall) : null,
            boltonAnterior: a.bolton_anterior != null ? Number(a.bolton_anterior) : null,
            angleClass: a.angle_class as string | null,
            overjetMm: a.overjet_mm != null ? Number(a.overjet_mm) : null,
            overbiteM: a.overbite_m != null ? Number(a.overbite_m) : null,
            upperCrowdingMm: a.upper_crowding_mm != null ? Number(a.upper_crowding_mm) : null,
            lowerCrowdingMm: a.lower_crowding_mm != null ? Number(a.lower_crowding_mm) : null,
            complexityScore: a.complexity_score != null ? Number(a.complexity_score) : null,
            iprSchedule: (a.ipr_schedule as unknown[]) ?? [],
            notes: a.notes as string | null,
          }
        : null,
      treatmentPlan: p
        ? {
            id: p.id as string,
            estimatedStages: Number(p.estimated_stages),
            doctorApproval: Boolean(p.doctor_approval),
            approvedAt: p.approved_at ? (p.approved_at as Date).toISOString() : null,
            aiRecommendationNotes: p.ai_recommendation_notes as string | null,
          }
        : null,
      scans: sRows.map((s) => ({
        id: s.id as string,
        jawType: s.jaw_type as string,
        originalFilename: s.original_filename as string,
        createdAt: (s.created_at as Date).toISOString(),
      })),
      workflowHistory: wRows.map((w) => ({
        toStatus: w.to_status as string,
        actorName: w.actor_name as string | null,
        createdAt: (w.created_at as Date).toISOString(),
      })),
    };
  }

  async requestReport(caseId: string, orgId: string, reportType: string, userId: string): Promise<{ reportId: string; status: string }> {
    await this.generateCaseReport(caseId, orgId); // validates ownership + throws 404 if missing
    const { rows } = await this.pool.query(
      `INSERT INTO case_reports (case_id, report_type, status, file_path, generated_by, generated_at)
       VALUES ($1, $2, 'ready', $3, $4, now()) RETURNING id`,
      [caseId, reportType, `/reports/${caseId}/${reportType}-${Date.now()}.json`, userId],
    );
    return { reportId: rows[0].id as string, status: 'ready' };
  }

  async listCaseReports(caseId: string, orgId: string): Promise<{ id: string; reportType: string; status: string; generatedAt: string | null; createdAt: string }[]> {
    const { rows: ownerCheck } = await this.pool.query(
      `SELECT c.id FROM cases c JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!ownerCheck[0]) throw new NotFoundException('Case not found');
    const { rows } = await this.pool.query(
      `SELECT id, report_type, status, generated_at, created_at
       FROM case_reports WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      reportType: r.report_type as string,
      status: r.status as string,
      generatedAt: r.generated_at ? (r.generated_at as Date).toISOString() : null,
      createdAt: (r.created_at as Date).toISOString(),
    }));
  }
}
