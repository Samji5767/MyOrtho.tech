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

    // Gather IPR, attachment, and simulation data when a plan is present
    let iprContacts = 0, iprTotalMm = 0, attachmentCount = 0;
    let simData: Record<string, unknown> | null = null;

    if (plan?.['id']) {
      const planId = plan['id'];
      const [iprRes, attachRes, simRes] = await Promise.all([
        this.db.query(
          `SELECT COUNT(*) as contacts, COALESCE(SUM(amount_mm),0) as total_mm
           FROM ipr_plan_items WHERE treatment_plan_id = $1`,
          [planId],
        ),
        this.db.query(
          `SELECT COUNT(*) as total FROM treatment_attachments WHERE treatment_plan_id = $1`,
          [planId],
        ),
        this.db.query(
          `SELECT total_frames, overjet_final_mm, overbite_final_mm, arch_coordination_score
           FROM treatment_simulations WHERE plan_id = $1`,
          [planId],
        ),
      ]);
      iprContacts     = parseInt(String(iprRes.rows[0]?.['contacts']  ?? '0'), 10);
      iprTotalMm      = parseFloat(String(iprRes.rows[0]?.['total_mm'] ?? '0'));
      attachmentCount = parseInt(String(attachRes.rows[0]?.['total']   ?? '0'), 10);
      if (simRes.rows[0]) {
        const sr = simRes.rows[0];
        simData = {
          totalFrames:       parseInt(String(sr['total_frames']             ?? '0'), 10),
          overjetFinalMm:    sr['overjet_final_mm']       != null ? parseFloat(String(sr['overjet_final_mm']))       : null,
          overbiteFinalmm:   sr['overbite_final_mm']      != null ? parseFloat(String(sr['overbite_final_mm']))      : null,
          archCoordScore:    sr['arch_coordination_score'] != null ? parseFloat(String(sr['arch_coordination_score'])) : null,
        };
      }
    }

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
      iprContactCount: iprContacts,
      iprTotalMm: Math.round(iprTotalMm * 100) / 100,
      attachmentCount,
      simulation: simData,
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

    const totalStages    = contentJson['totalStages']    as number;
    const approvedStages = contentJson['approvedStages'] as number;
    const totalCheckIns  = contentJson['totalCheckIns']  as number;

    const completionPct = totalStages > 0
      ? Math.round((approvedStages / totalStages) * 100)
      : 0;

    // Compliance: ratio of actual check-ins to expected (1 per approved stage)
    const compliancePct = approvedStages > 0
      ? Math.min(100, Math.round((totalCheckIns / approvedStages) * 100))
      : 100;

    // Estimated completion: assume standard 2-week wear per remaining stage
    const remainingStages = totalStages - approvedStages;
    let estimatedCompletionDate = 'N/A';
    if (remainingStages > 0) {
      const est = new Date();
      est.setDate(est.getDate() + remainingStages * 14);
      estimatedCompletionDate = est.toLocaleDateString();
    } else if (totalStages > 0) {
      estimatedCompletionDate = 'Treatment complete';
    }

    contentJson['completionPercent']       = completionPct;
    contentJson['compliancePercent']       = compliancePct;
    contentJson['estimatedCompletionDate'] = estimatedCompletionDate;
    contentJson['remainingStages']         = remainingStages;

    const md = [
      '# Aligner Progress Report',
      '',
      `**Generated:** ${new Date().toLocaleDateString()}`,
      '',
      '## Stage Progress',
      `- Total stages: ${totalStages}`,
      `- Approved stages: ${approvedStages} (${completionPct}%)`,
      `- Remaining stages: ${remainingStages}`,
      '',
      '## Compliance & Timeline',
      `- Patient compliance: ${compliancePct}%`,
      `- Estimated completion: ${estimatedCompletionDate}`,
      '',
      '## Monitoring',
      `- Check-in visits: ${totalCheckIns}`,
      `- Open alerts: ${contentJson['openAlerts']}`,
      '',
    ].join('\n');

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

  async generatePatientReport(caseId: string, orgId: string, userId: string): Promise<GeneratedReport> {
    await this.verifyCase(caseId, orgId);
    const { rows: caseRows } = await this.db.query(
      `SELECT c.*, p.first_name, p.last_name
       FROM cases c LEFT JOIN patients p ON p.id=c.patient_id
       WHERE c.id=$1 AND c.organization_id=$2`, [caseId, orgId],
    );
    const c = caseRows[0];
    const patientName = c ? `${c['first_name'] ?? ''} ${c['last_name'] ?? ''}`.trim() : 'Patient';

    const { rows: planRows } = await this.db.query(
      `SELECT plan_name, num_stages, status FROM treatment_plans WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`, [caseId],
    );
    const plan = planRows[0];

    const totalStages = plan?.['num_stages'] ?? 0;
    const weeksTotal  = totalStages * 2;
    const monthsTotal = Math.round(weeksTotal / 4.3);

    const md = [
      `# Your Orthodontic Treatment Plan`,
      ``,
      `Dear ${patientName},`,
      ``,
      `Thank you for choosing clear aligner treatment. Here is a summary of your planned treatment in plain language.`,
      ``,
      `## What We Are Treating`,
      `Your orthodontist has identified a malocclusion (bite problem) that can be improved with a series of custom-made clear aligners.`,
      ``,
      `## How It Works`,
      `- You will wear a series of **${totalStages} clear aligner trays**, changing each one every **2 weeks**.`,
      `- Each tray gently moves your teeth a small amount toward the final position.`,
      `- Your estimated treatment time is approximately **${monthsTotal} months** (this can vary).`,
      ``,
      `## Your Responsibilities`,
      `- Wear your aligners **20–22 hours per day** (remove only for eating and brushing).`,
      `- Clean your teeth and aligners after every meal before putting them back in.`,
      `- Attend all scheduled check-up appointments.`,
      `- Contact your orthodontist if an aligner cracks, fits poorly, or causes severe discomfort.`,
      ``,
      `## After Treatment`,
      `- You will need to wear a **retainer** after finishing active treatment to keep your teeth in their new positions.`,
      `- Retainer wear is typically nightly, indefinitely, to prevent relapse.`,
      ``,
      `## Important Notice`,
      `This summary is for informational purposes only. All clinical details and final treatment decisions are discussed with your orthodontist. If you have questions, please contact your clinic directly.`,
      ``,
      `*Generated by MyOrtho.tech — AI-assisted orthodontic platform*`,
    ].join('\n');

    const { rows } = await this.db.query(
      `INSERT INTO generated_reports (organization_id, case_id, plan_id, report_type, title, content_json, content_markdown, generated_by)
       VALUES ($1,$2,$3,'patient_report',$4,$5,$6,$7) RETURNING *`,
      [orgId, caseId, plan ? null : null, `Patient Treatment Summary — ${patientName}`,
       JSON.stringify({ caseId, patientName, totalStages, monthsTotal, planStatus: plan?.['status'] ?? 'none', generatedAt: new Date().toISOString() }),
       md, userId],
    );
    return this.mapReport(rows[0]);
  }

  async generateReferringDentistReport(caseId: string, orgId: string, userId: string): Promise<GeneratedReport> {
    await this.verifyCase(caseId, orgId);
    const { rows: caseRows } = await this.db.query(
      `SELECT c.*, p.first_name, p.last_name, p.date_of_birth
       FROM cases c LEFT JOIN patients p ON p.id=c.patient_id
       WHERE c.id=$1 AND c.organization_id=$2`, [caseId, orgId],
    );
    const c = caseRows[0];
    const patientName = c ? `${c['first_name'] ?? ''} ${c['last_name'] ?? ''}`.trim() : 'Patient';
    const dob = c?.date_of_birth ? new Date(String(c['date_of_birth'])).toLocaleDateString() : 'N/A';

    const { rows: planRows } = await this.db.query(
      `SELECT plan_name, malocclusion_class, num_stages FROM treatment_plans WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`, [caseId],
    );
    const plan = planRows[0];

    const { rows: analysisRows } = await this.db.query(
      `SELECT angle_class, overjet_mm, overbite_mm, crowding_upper_mm, crowding_lower_mm, bolton_overall_ratio, bolton_anterior_ratio
       FROM case_analyses WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`, [caseId],
    );
    const analysis = analysisRows[0];

    const md = [
      `# Orthodontic Referral Report`,
      ``,
      `**To:** Referring Dentist`,
      `**Date:** ${new Date().toLocaleDateString()}`,
      ``,
      `## Patient Information`,
      `- **Name:** ${patientName}`,
      `- **Date of Birth:** ${dob}`,
      `- **Case Reference:** ${caseId.slice(0, 8).toUpperCase()}`,
      ``,
      `## Clinical Findings`,
      analysis ? [
        `- **Angle Classification:** ${analysis['angle_class'] ?? 'Not recorded'}`,
        `- **Overjet:** ${analysis['overjet_mm'] != null ? `${analysis['overjet_mm']} mm` : 'Not measured'}`,
        `- **Overbite:** ${analysis['overbite_mm'] != null ? `${analysis['overbite_mm']} mm` : 'Not measured'}`,
        `- **Upper Crowding:** ${analysis['crowding_upper_mm'] != null ? `${analysis['crowding_upper_mm']} mm` : 'Not measured'}`,
        `- **Lower Crowding:** ${analysis['crowding_lower_mm'] != null ? `${analysis['crowding_lower_mm']} mm` : 'Not measured'}`,
        `- **Bolton Overall Ratio:** ${analysis['bolton_overall_ratio'] != null ? `${parseFloat(String(analysis['bolton_overall_ratio'])).toFixed(1)}%` : 'Not computed'}`,
      ].join('\n') : `*Clinical measurements not yet recorded.*`,
      ``,
      `## Treatment Plan`,
      `- **Plan Name:** ${plan?.['plan_name'] ?? 'Not yet generated'}`,
      `- **Malocclusion Class:** ${plan?.['malocclusion_class'] ?? c?.['malocclusion_class'] ?? 'Not specified'}`,
      `- **Number of Stages:** ${plan?.['num_stages'] ?? 'TBD'}`,
      ``,
      `## Coordination Notes`,
      `Please continue to monitor the patient's periodontal health throughout orthodontic treatment.`,
      `Any restorative work planned after orthodontic completion should be deferred until final tooth positions are confirmed.`,
      ``,
      `---`,
      `*This report was generated by MyOrtho.tech. All clinical details should be verified by the treating orthodontist.*`,
      `*AI-assisted report generation. Final clinical decisions remain the responsibility of the licensed orthodontist.*`,
    ].join('\n');

    const { rows } = await this.db.query(
      `INSERT INTO generated_reports (organization_id, case_id, report_type, title, content_json, content_markdown, generated_by)
       VALUES ($1,$2,'referring_dentist_report',$3,$4,$5,$6) RETURNING *`,
      [orgId, caseId, `Referring Dentist Report — ${patientName}`,
       JSON.stringify({ caseId, patientName, dob, analysis: analysis ?? null, generatedAt: new Date().toISOString() }),
       md, userId],
    );
    return this.mapReport(rows[0]);
  }

  async generateLaboratoryReport(caseId: string, orgId: string, userId: string): Promise<GeneratedReport> {
    await this.verifyCase(caseId, orgId);
    const { rows: planRows } = await this.db.query(
      `SELECT tp.id, tp.plan_name, tp.num_stages, tp.status,
              agp.total_active_stages, agp.passive_aligner_count, agp.retention_stage_count,
              agp.aligner_change_weeks, agp.stl_export_ready
       FROM treatment_plans tp
       LEFT JOIN aligner_generation_plans agp ON agp.plan_id = tp.id
       WHERE tp.case_id=$1 ORDER BY tp.created_at DESC LIMIT 1`, [caseId],
    );
    const plan = planRows[0];

    const { rows: qualityRows } = await this.db.query(
      `SELECT overall_quality_score, is_manufacturing_ready FROM treatment_qa_reports WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`, [caseId],
    );
    const qa = qualityRows[0];

    const { rows: iprRows } = await this.db.query(
      `SELECT tooth_a, tooth_b, amount_mm, stage_number
       FROM ipr_plan_items WHERE treatment_plan_id=$1 ORDER BY stage_number, tooth_a`,
      [plan?.['id'] ?? '00000000-0000-0000-0000-000000000000'],
    );

    const iprList = iprRows.length > 0
      ? iprRows.map((r: Record<string, unknown>) => `- Stage ${r['stage_number']}: ${r['tooth_a']}–${r['tooth_b']} — ${parseFloat(String(r['amount_mm'])).toFixed(2)} mm`).join('\n')
      : '*No IPR scheduled.*';

    const md = [
      `# Laboratory Manufacturing Report`,
      ``,
      `**Date:** ${new Date().toLocaleDateString()}`,
      `**Case Reference:** ${caseId.slice(0, 8).toUpperCase()}`,
      ``,
      `## Treatment Plan Specifications`,
      `- **Plan Name:** ${plan?.['plan_name'] ?? 'Not generated'}`,
      `- **Total Active Stages:** ${plan?.['total_active_stages'] ?? plan?.['num_stages'] ?? 'N/A'}`,
      `- **Passive Aligner Stages:** ${plan?.['passive_aligner_count'] ?? 'N/A'}`,
      `- **Retention Stages:** ${plan?.['retention_stage_count'] ?? 'N/A'}`,
      `- **Aligner Change Interval:** ${plan?.['aligner_change_weeks'] ?? 2} weeks per set`,
      ``,
      `## Manufacturing Readiness`,
      `- **STL Export Ready:** ${plan?.['stl_export_ready'] ? 'Yes' : 'Not yet generated'}`,
      `- **Quality Score:** ${qa?.['overall_quality_score'] != null ? `${Math.round(parseFloat(String(qa['overall_quality_score'])))} / 100` : 'Not assessed'}`,
      `- **Manufacturing Ready:** ${qa?.['is_manufacturing_ready'] ? 'Yes — cleared for production' : 'No — see quality report for blocking issues'}`,
      ``,
      `## IPR Schedule`,
      iprList,
      ``,
      `## Material & Print Specifications`,
      `- **Recommended Resin:** Dental-grade Class IIa biocompatible resin (e.g., Formlabs Dental LT Clear, SprintRay OrthoFlex)`,
      `- **Layer Height:** 25–50 µm (printer-dependent)`,
      `- **Orientation:** 45° to minimize layer lines on occlusal surfaces`,
      `- **Supports:** Remove carefully — use IPA rinse, UV cure per manufacturer protocol`,
      `- **Post-Processing:** Wash 20 min IPA, cure per resin spec, inspect all contact surfaces`,
      ``,
      `## Quality Control Checklist`,
      `- [ ] Mesh watertight verified (STL validator)`,
      `- [ ] Layer adhesion confirmed (no delamination)`,
      `- [ ] Contact surfaces smooth (≤ 1 µm Ra)`,
      `- [ ] Fit on stone model within 0.1 mm tolerance`,
      `- [ ] Attachment windows aligned to prescription`,
      `- [ ] IPR cuts applied at specified contacts`,
      `- [ ] Labelling / engraving: case reference + stage number`,
      ``,
      `---`,
      `*This manufacturing report is generated from the digital treatment plan. All specifications must be reviewed by the responsible clinician before production.*`,
      `*Simulated values — actual print times, resin usage, and costs must be validated against first-article print.*`,
    ].join('\n');

    const { rows } = await this.db.query(
      `INSERT INTO generated_reports (organization_id, case_id, plan_id, report_type, title, content_json, content_markdown, generated_by)
       VALUES ($1,$2,$3,'laboratory_report','Laboratory Manufacturing Report',$4,$5,$6) RETURNING *`,
      [orgId, caseId, plan?.['id'] ?? null,
       JSON.stringify({ caseId, totalActiveStages: plan?.['total_active_stages'] ?? null, iprCount: iprRows.length, manufacturingReady: qa?.['is_manufacturing_ready'] ?? false, generatedAt: new Date().toISOString() }),
       md, userId],
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
    const iprSection = (d['iprContactCount'] as number) > 0 || (d['attachmentCount'] as number) > 0
      ? `\n## IPR & Attachments\n- IPR contact points: ${d['iprContactCount']}\n- Total IPR reduction: ${d['iprTotalMm']} mm\n- Planned attachments: ${d['attachmentCount']}\n`
      : '';

    const sim = d['simulation'] as Record<string, unknown> | null;
    const simSection = sim
      ? `\n## Simulation Projections\n- Simulation frames: ${sim['totalFrames']}${sim['overjetFinalMm'] != null ? `\n- Projected overjet: ${sim['overjetFinalMm']} mm` : ''}${sim['overbiteFinalmm'] != null ? `\n- Projected overbite: ${sim['overbiteFinalmm']} mm` : ''}${sim['archCoordScore'] != null ? `\n- Arch coordination score: ${Math.round((sim['archCoordScore'] as number) * 100)}%` : ''}\n`
      : '';

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
${iprSection}${simSection}
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
