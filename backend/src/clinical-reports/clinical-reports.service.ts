import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface GeneratedReport {
  id: string;
  caseId: string;
  planId: string | null;
  reportType: string;
  title: string;
  contentMarkdown: string | null;
  contentJson: Record<string, unknown>;
  generatedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

@Injectable()
export class ClinicalReportsService {
  private readonly log = new Logger(ClinicalReportsService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listReports(caseId: string, orgId: string): Promise<GeneratedReport[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      `SELECT * FROM generated_reports WHERE case_id=$1 AND organization_id=$2 ORDER BY created_at DESC`,
      [caseId, orgId],
    );
    return rows.map(this.mapReport);
  }

  async generateTreatmentSummary(caseId: string, orgId: string, userId: string): Promise<GeneratedReport> {
    await this.verifyCase(caseId, orgId);

    // Gather case data
    const { rows: caseRows } = await this.db.query(
      `SELECT c.*, p.first_name, p.last_name, p.date_of_birth
       FROM cases c LEFT JOIN patients p ON p.id=c.patient_id
       WHERE c.id=$1 AND c.organization_id=$2`, [caseId, orgId],
    );
    const c = caseRows[0];

    // Gather treatment plan if any
    const { rows: planRows } = await this.db.query(
      `SELECT id, plan_name, malocclusion_class, num_stages, status, created_at
       FROM treatment_plans WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`, [caseId],
    );
    const plan = planRows[0];

    // Gather quality score if any
    const { rows: qsRows } = await this.db.query(
      `SELECT overall_score, grade, has_critical_issues, critical_issue_count
       FROM treatment_quality_scores
       WHERE plan_id = (SELECT id FROM treatment_plans WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1)
       LIMIT 1`, [caseId],
    );
    const qs = qsRows[0];

    const patientName = c ? `${c['first_name'] ?? ''} ${c['last_name'] ?? ''}`.trim() : 'Unknown Patient';
    const dob = c?.date_of_birth ? new Date(String(c['date_of_birth'])).toLocaleDateString() : 'N/A';

    const contentJson: Record<string, unknown> = {
      caseId,
      caseRef: c?.['case_number'] ?? caseId.slice(0, 8).toUpperCase(),
      patientName,
      dateOfBirth: dob,
      malocclusion: plan?.['malocclusion_class'] ?? c?.['malocclusion_class'] ?? 'Not specified',
      planName: plan?.['plan_name'] ?? 'No treatment plan',
      numStages: plan?.['num_stages'] ?? 0,
      planStatus: plan?.['status'] ?? 'none',
      qualityGrade: qs?.['grade'] ?? 'N/A',
      qualityScore: qs ? Math.round(Number(qs['overall_score']) * 100) : null,
      hasCriticalIssues: qs?.['has_critical_issues'] ?? false,
      generatedAt: new Date().toISOString(),
    };

    const md = this.buildTreatmentSummaryMarkdown(contentJson);

    const { rows } = await this.db.query(
      `INSERT INTO generated_reports (organization_id, case_id, plan_id, report_type, title, content_json, content_markdown, generated_by)
       VALUES ($1,$2,$3,'treatment_summary',$4,$5,$6,$7) RETURNING *`,
      [orgId, caseId, plan?.['id'] ?? null, `Treatment Summary — ${patientName}`, JSON.stringify(contentJson), md, userId],
    );
    return this.mapReport(rows[0]);
  }

  async generateAlignerProgressReport(caseId: string, orgId: string, userId: string): Promise<GeneratedReport> {
    await this.verifyCase(caseId, orgId);

    const { rows: stageRows } = await this.db.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN is_approved THEN 1 ELSE 0 END) as approved
       FROM aligner_stages ast
       JOIN aligner_generation_plans agp ON agp.id = ast.plan_id
       JOIN treatment_plans tp ON tp.id = agp.plan_id
       WHERE tp.case_id=$1`, [caseId],
    );

    const { rows: checkIns } = await this.db.query(
      `SELECT COUNT(*) as total FROM treatment_check_ins WHERE case_id=$1`, [caseId],
    );

    const { rows: alerts } = await this.db.query(
      `SELECT COUNT(*) as open FROM off_track_alerts WHERE case_id=$1 AND resolved_at IS NULL`, [caseId],
    );

    const contentJson: Record<string, unknown> = {
      caseId,
      totalStages: parseInt(stageRows[0]?.['total'] ?? '0', 10),
      approvedStages: parseInt(stageRows[0]?.['approved'] ?? '0', 10),
      totalCheckIns: parseInt(checkIns[0]?.['total'] ?? '0', 10),
      openAlerts: parseInt(alerts[0]?.['open'] ?? '0', 10),
      generatedAt: new Date().toISOString(),
    };

    const completionPct = contentJson['totalStages'] as number > 0
      ? Math.round(((contentJson['approvedStages'] as number) / (contentJson['totalStages'] as number)) * 100)
      : 0;
    (contentJson as Record<string, unknown>)['completionPercent'] = completionPct;

    const md = `# Aligner Progress Report\n\n**Generated:** ${new Date().toLocaleDateString()}\n\n## Stage Progress\n- Total stages: ${contentJson['totalStages']}\n- Approved stages: ${contentJson['approvedStages']} (${completionPct}%)\n\n## Monitoring\n- Check-in visits: ${contentJson['totalCheckIns']}\n- Open alerts: ${contentJson['openAlerts']}\n`;

    const { rows } = await this.db.query(
      `INSERT INTO generated_reports (organization_id, case_id, report_type, title, content_json, content_markdown, generated_by)
       VALUES ($1,$2,'aligner_progress','Aligner Progress Report',$3,$4,$5) RETURNING *`,
      [orgId, caseId, JSON.stringify(contentJson), md, userId],
    );
    return this.mapReport(rows[0]);
  }

  async generateInsurancePreauth(caseId: string, orgId: string, userId: string, dto: { cdtCodes: string[]; estimatedFee: number; insurerId?: string }): Promise<GeneratedReport> {
    await this.verifyCase(caseId, orgId);

    const { rows: caseRows } = await this.db.query(
      `SELECT c.*, p.first_name, p.last_name, p.date_of_birth
       FROM cases c LEFT JOIN patients p ON p.id=c.patient_id
       WHERE c.id=$1 AND c.organization_id=$2`, [caseId, orgId],
    );
    const c = caseRows[0];
    const patientName = c ? `${c['first_name'] ?? ''} ${c['last_name'] ?? ''}`.trim() : 'Unknown Patient';

    const contentJson: Record<string, unknown> = {
      caseId,
      patientName,
      dateOfBirth: c?.date_of_birth ? new Date(String(c['date_of_birth'])).toLocaleDateString() : 'N/A',
      insurerId: dto.insurerId ?? null,
      cdtCodes: dto.cdtCodes,
      estimatedFeeUsd: dto.estimatedFee,
      requestDate: new Date().toISOString().split('T')[0],
      diagnosis: c?.['malocclusion_class'] ?? 'Malocclusion requiring orthodontic treatment',
    };

    const codeList = dto.cdtCodes.map(c => `- ${c}`).join('\n');
    const md = `# Pre-Authorization Request\n\n**Patient:** ${patientName}\n**Date:** ${contentJson['requestDate']}\n\n## Procedure Codes\n${codeList}\n\n## Estimated Fee\n$${dto.estimatedFee.toFixed(2)}\n\n## Diagnosis\n${contentJson['diagnosis']}\n\n*Clinician signature required before submission.*`;

    const { rows } = await this.db.query(
      `INSERT INTO generated_reports (organization_id, case_id, report_type, title, content_json, content_markdown, generated_by)
       VALUES ($1,$2,'insurance_preauth',$3,$4,$5,$6) RETURNING *`,
      [orgId, caseId, `Pre-Authorization — ${patientName}`, JSON.stringify(contentJson), md, userId],
    );
    return this.mapReport(rows[0]);
  }

  async getReport(reportId: string, orgId: string): Promise<GeneratedReport> {
    const { rows } = await this.db.query(
      `SELECT * FROM generated_reports WHERE id=$1 AND organization_id=$2`,
      [reportId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Report not found');
    return this.mapReport(rows[0]);
  }

  async approveReport(reportId: string, orgId: string, approverId: string): Promise<GeneratedReport> {
    const { rows } = await this.db.query(
      `UPDATE generated_reports SET approved_by=$2, approved_at=now()
       WHERE id=$1 AND organization_id=$3 RETURNING *`,
      [reportId, approverId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Report not found');
    return this.mapReport(rows[0]);
  }

  private buildTreatmentSummaryMarkdown(d: Record<string, unknown>): string {
    return `# Treatment Summary Report

**Case Reference:** ${d['caseRef']}
**Patient:** ${d['patientName']}
**Date of Birth:** ${d['dateOfBirth']}
**Generated:** ${new Date().toLocaleDateString()}

---

## Diagnosis
**Malocclusion Classification:** ${d['malocclusion']}

## Treatment Plan
**Plan:** ${d['planName']}
**Total Stages:** ${d['numStages']}
**Plan Status:** ${d['planStatus']}

## Quality Assessment
**Grade:** ${d['qualityGrade']}${d['qualityScore'] != null ? ` (${d['qualityScore']}%)` : ''}
${d['hasCriticalIssues'] ? '⚠ Critical issues identified — clinician review required before proceeding.' : '✓ No critical issues identified.'}

---

*This report was generated by MyOrtho.tech and requires clinician review and approval before clinical use.*`;
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT id FROM cases WHERE id=$1 AND organization_id=$2`, [caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private mapReport(r: Record<string, unknown>): GeneratedReport {
    return {
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      planId: r['plan_id'] as string | null,
      reportType: r['report_type'] as string,
      title: r['title'] as string,
      contentMarkdown: r['content_markdown'] as string | null,
      contentJson: r['content_json'] as Record<string, unknown>,
      generatedBy: r['generated_by'] as string | null,
      approvedBy: r['approved_by'] as string | null,
      approvedAt: r['approved_at'] ? String(r['approved_at']) : null,
      createdAt: String(r['created_at']),
    };
  }
}
