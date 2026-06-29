import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckInPayload {
  planId: string;
  currentStage: number;
  totalStages: number;
  checkInType: 'photo_review' | 'scan_comparison' | 'clinical_exam' | 'patient_self_report';
  notes?: string;
  photoIds?: string[];
}

export interface CheckIn {
  id: string;
  caseId: string;
  planId: string;
  currentStage: number;
  totalStages: number;
  checkInType: string;
  notes: string | null;
  photoIds: string[];
  createdAt: string;
}

export interface OffTrackAlert {
  id: string;
  caseId: string;
  planId: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  affectedStage: number | null;
  affectedTeeth: number[];
  description: string;
  recommendedAction: string;
  status: string;
  createdAt: string;
}

export interface QualityScore {
  planId: string;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  movementSafetyScore: number | null;
  pdlSafetyScore: number | null;
  iprSafetyScore: number | null;
  attachmentScore: number | null;
  simulationScore: number | null;
  archCoordScore: number | null;
  retentionScore: number | null;
  exportReadinessScore: number | null;
  hasCriticalIssues: boolean;
  criticalIssueCount: number;
  warningCount: number;
  scoreBreakdown: Record<string, unknown>;
  recommendations: string[];
  scoredAt: string;
}

// ─── Alert generation constants ───────────────────────────────────────────────

interface AlertSpec {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  recommendedAction: string;
  affectedTeeth: number[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TreatmentMonitoringService {
  private readonly log = new Logger(TreatmentMonitoringService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async submitCheckIn(
    caseId: string,
    orgId: string,
    userId: string,
    payload: CheckInPayload,
  ): Promise<{ checkIn: CheckIn; alerts: OffTrackAlert[] }> {
    await this.verifyCase(caseId, orgId);

    const res = await this.db.query(
      `INSERT INTO treatment_check_ins
         (organization_id, case_id, plan_id, current_stage, total_stages,
          check_in_type, submitted_by, notes, photo_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        orgId, caseId, payload.planId, payload.currentStage, payload.totalStages,
        payload.checkInType, userId,
        payload.notes ?? null,
        JSON.stringify(payload.photoIds ?? []),
      ],
    );
    const row = res.rows[0];
    const checkIn = this.mapCheckIn(row);

    // Run off-track detection on the check-in
    const alerts = await this.detectOffTrack(caseId, orgId, payload, checkIn.id);

    this.log.log(`Phase 36 check-in: case ${caseId} stage ${payload.currentStage}/${payload.totalStages} — ${alerts.length} alerts`);

    return { checkIn, alerts };
  }

  async listCheckIns(caseId: string, orgId: string, planId?: string): Promise<CheckIn[]> {
    const res = await this.db.query(
      planId
        ? `SELECT * FROM treatment_check_ins WHERE case_id=$1 AND organization_id=$2 AND plan_id=$3 ORDER BY created_at DESC`
        : `SELECT * FROM treatment_check_ins WHERE case_id=$1 AND organization_id=$2 ORDER BY created_at DESC`,
      planId ? [caseId, orgId, planId] : [caseId, orgId],
    );
    return res.rows.map(r => this.mapCheckIn(r));
  }

  async listAlerts(caseId: string, orgId: string, planId?: string): Promise<OffTrackAlert[]> {
    const res = await this.db.query(
      planId
        ? `SELECT * FROM off_track_alerts WHERE case_id=$1 AND organization_id=$2 AND plan_id=$3 ORDER BY created_at DESC`
        : `SELECT * FROM off_track_alerts WHERE case_id=$1 AND organization_id=$2 ORDER BY created_at DESC`,
      planId ? [caseId, orgId, planId] : [caseId, orgId],
    );
    return res.rows.map(r => this.mapAlert(r));
  }

  async resolveAlert(
    caseId: string,
    orgId: string,
    userId: string,
    alertId: string,
    status: 'reviewed' | 'resolved' | 'escalated',
    note?: string,
  ): Promise<OffTrackAlert> {
    const res = await this.db.query(
      `UPDATE off_track_alerts
       SET status=$1, resolved_by=$2, resolved_at=now(), resolution_note=$3
       WHERE id=$4 AND case_id=$5 AND organization_id=$6
       RETURNING *`,
      [status, userId, note ?? null, alertId, caseId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Alert not found');
    return this.mapAlert(res.rows[0]);
  }

  async computeQualityScore(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
  ): Promise<QualityScore> {
    await this.verifyCase(caseId, orgId);

    // Gather component data in parallel
    const [
      prescriptionRes,
      pdlRes,
      iprRes,
      attachmentRes,
      simulationRes,
      archRes,
      retentionRes,
      exportRes,
    ] = await Promise.all([
      // movement_safety: check Kravitz per-stage limits
      this.db.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN translation_mesial_mm > 0.30 OR translation_distal_mm > 0.30
                         OR translation_buccal_mm > 0.30 OR translation_lingual_mm > 0.30
                         OR rotation_deg > 3.0 OR torque_deg > 3.5
                         OR tip_mesial_deg > 4.0 OR tip_distal_deg > 4.0
                         OR intrusion_mm > 0.40 OR extrusion_mm > 0.75 THEN 1 ELSE 0 END) as violations
         FROM movement_prescriptions WHERE plan_id=$1`,
        [planId],
      ),
      // pdl_safety (Yoshida 2001 thresholds)
      this.db.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN stress_mpa > 0.015 THEN 1 ELSE 0 END) as critical,
                SUM(CASE WHEN stress_mpa > 0.008 AND stress_mpa <= 0.015 THEN 1 ELSE 0 END) as high
         FROM pdl_simulation_results WHERE plan_id=$1`,
        [planId],
      ),
      // ipr_safety: Sheridan 0.5mm minimum
      this.db.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN is_safe=false THEN 1 ELSE 0 END) as unsafe
         FROM ipr_enamel_estimates WHERE plan_id=$1`,
        [planId],
      ),
      // attachment_score: manufacturing validation
      this.db.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN manufacturing_valid=false THEN 1 ELSE 0 END) as invalid
         FROM attachment_force_analysis WHERE plan_id=$1`,
        [planId],
      ),
      // simulation_score
      this.db.query(
        `SELECT arch_coordination_score, occlusion_score, smile_arc_score
         FROM treatment_simulations WHERE plan_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [planId],
      ),
      // arch_coord_score
      this.db.query(
        `SELECT coordination_score FROM arch_coordination_plans WHERE plan_id=$1`,
        [planId],
      ),
      // retention_score (relapse risk)
      this.db.query(
        `SELECT relapse_risk_score FROM retention_protocols WHERE plan_id=$1`,
        [planId],
      ),
      // export_readiness: check if approved export exists
      this.db.query(
        `SELECT COUNT(*) as approved FROM export_packages WHERE plan_id=$1 AND status IN ('approved','exported')`,
        [planId],
      ),
    ]);

    // Compute component scores (0–1 scale)
    const prescriptionTotal = parseInt(prescriptionRes.rows[0]?.['total'] as string ?? '0', 10);
    const prescriptionViolations = parseInt(prescriptionRes.rows[0]?.['violations'] as string ?? '0', 10);
    const movementSafetyScore = prescriptionTotal > 0
      ? parseFloat((1 - prescriptionViolations / prescriptionTotal).toFixed(3))
      : null;

    const pdlTotal = parseInt(pdlRes.rows[0]?.['total'] as string ?? '0', 10);
    const pdlCritical = parseInt(pdlRes.rows[0]?.['critical'] as string ?? '0', 10);
    const pdlHigh = parseInt(pdlRes.rows[0]?.['high'] as string ?? '0', 10);
    const pdlSafetyScore = pdlTotal > 0
      ? parseFloat((1 - (pdlCritical * 1.0 + pdlHigh * 0.5) / pdlTotal).toFixed(3))
      : null;

    const iprTotal = parseInt(iprRes.rows[0]?.['total'] as string ?? '0', 10);
    const iprUnsafe = parseInt(iprRes.rows[0]?.['unsafe'] as string ?? '0', 10);
    const iprSafetyScore = iprTotal > 0
      ? parseFloat((1 - iprUnsafe / iprTotal).toFixed(3))
      : null;

    const attachTotal = parseInt(attachmentRes.rows[0]?.['total'] as string ?? '0', 10);
    const attachInvalid = parseInt(attachmentRes.rows[0]?.['invalid'] as string ?? '0', 10);
    const attachmentScore = attachTotal > 0
      ? parseFloat((1 - attachInvalid / attachTotal).toFixed(3))
      : null;

    const simRow = simulationRes.rows[0];
    const simulationScore = simRow
      ? parseFloat((
          ((simRow['arch_coordination_score'] as number ?? 0.7) +
           (simRow['occlusion_score'] as number ?? 0.7) +
           (simRow['smile_arc_score'] as number ?? 0.7)) / 3
        ).toFixed(3))
      : null;

    const archRow = archRes.rows[0];
    const archCoordScore = archRow
      ? parseFloat((archRow['coordination_score'] as number ?? 0.7).toFixed(3))
      : null;

    const retentionRow = retentionRes.rows[0];
    const retentionRisk = retentionRow ? (retentionRow['relapse_risk_score'] as number ?? 0.5) : 0.5;
    const retentionScore = parseFloat((1 - retentionRisk * 0.5).toFixed(3));

    const approvedExports = parseInt(exportRes.rows[0]?.['approved'] as string ?? '0', 10);
    const exportReadinessScore = prescriptionTotal > 0 ? (approvedExports > 0 ? 1.0 : 0.6) : null;

    // Weighted average of available scores
    const components: [number | null, number][] = [
      [movementSafetyScore, 0.25],
      [pdlSafetyScore, 0.20],
      [iprSafetyScore, 0.15],
      [attachmentScore, 0.10],
      [simulationScore, 0.10],
      [archCoordScore, 0.08],
      [retentionScore, 0.07],
      [exportReadinessScore, 0.05],
    ];

    let weightedSum = 0;
    let totalWeight = 0;
    for (const [score, weight] of components) {
      if (score != null) {
        weightedSum += score * weight;
        totalWeight += weight;
      }
    }

    const overallScore = totalWeight > 0
      ? parseFloat((weightedSum / totalWeight).toFixed(3))
      : 0.5;

    const grade = this.gradeFromScore(overallScore * 100);

    const hasCriticalIssues = pdlCritical > 0 || iprUnsafe > 0 || prescriptionViolations > 0;
    const criticalIssueCount = pdlCritical + iprUnsafe + prescriptionViolations;
    const warningCount = pdlHigh + attachInvalid;

    const recommendations: string[] = [];
    if (prescriptionViolations > 0) {
      recommendations.push(`Review ${prescriptionViolations} prescription(s) exceeding Kravitz per-stage movement limits.`);
    }
    if (pdlCritical > 0) {
      recommendations.push(`${pdlCritical} tooth movement(s) exceed PDL stress threshold (>0.015 MPa). Reduce force or add staging.`);
    }
    if (iprUnsafe > 0) {
      recommendations.push(`${iprUnsafe} IPR contact(s) below Sheridan 0.5mm enamel minimum. Reduce IPR amount.`);
    }
    if (attachInvalid > 0) {
      recommendations.push(`${attachInvalid} attachment(s) failed manufacturing validation. Review placement geometry.`);
    }
    if (!simRow) {
      recommendations.push('Generate a treatment simulation to assess arch coordination and occlusion quality.');
    }
    if (!retentionRow) {
      recommendations.push('Generate a retention protocol to complete risk assessment.');
    }

    const breakdown: Record<string, unknown> = {
      movement_safety: { score: movementSafetyScore, violations: prescriptionViolations, total: prescriptionTotal },
      pdl_safety: { score: pdlSafetyScore, critical: pdlCritical, high: pdlHigh, total: pdlTotal },
      ipr_safety: { score: iprSafetyScore, unsafe: iprUnsafe, total: iprTotal },
      attachment: { score: attachmentScore, invalid: attachInvalid, total: attachTotal },
      simulation: { score: simulationScore },
      arch_coordination: { score: archCoordScore },
      retention: { score: retentionScore, risk: retentionRisk },
      export_readiness: { score: exportReadinessScore, approved_packages: approvedExports },
    };

    await this.db.query(
      `INSERT INTO treatment_quality_scores
         (organization_id, plan_id, overall_score, grade,
          movement_safety_score, pdl_safety_score, ipr_safety_score, attachment_score,
          simulation_score, arch_coord_score, retention_score, export_readiness_score,
          has_critical_issues, critical_issue_count, warning_count,
          score_breakdown, recommendations, scored_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (plan_id) DO UPDATE SET
         overall_score=EXCLUDED.overall_score, grade=EXCLUDED.grade,
         movement_safety_score=EXCLUDED.movement_safety_score,
         pdl_safety_score=EXCLUDED.pdl_safety_score,
         ipr_safety_score=EXCLUDED.ipr_safety_score,
         attachment_score=EXCLUDED.attachment_score,
         simulation_score=EXCLUDED.simulation_score,
         arch_coord_score=EXCLUDED.arch_coord_score,
         retention_score=EXCLUDED.retention_score,
         export_readiness_score=EXCLUDED.export_readiness_score,
         has_critical_issues=EXCLUDED.has_critical_issues,
         critical_issue_count=EXCLUDED.critical_issue_count,
         warning_count=EXCLUDED.warning_count,
         score_breakdown=EXCLUDED.score_breakdown,
         recommendations=EXCLUDED.recommendations,
         scored_by=EXCLUDED.scored_by,
         scored_at=now()`,
      [
        orgId, planId, overallScore, grade,
        movementSafetyScore, pdlSafetyScore, iprSafetyScore, attachmentScore,
        simulationScore, archCoordScore, retentionScore, exportReadinessScore,
        hasCriticalIssues, criticalIssueCount, warningCount,
        JSON.stringify(breakdown), JSON.stringify(recommendations), userId,
      ],
    );

    this.log.log(`Phase 36 quality score: plan ${planId} → ${grade} (${(overallScore * 100).toFixed(0)})`);

    return {
      planId, overallScore, grade,
      movementSafetyScore, pdlSafetyScore, iprSafetyScore, attachmentScore,
      simulationScore, archCoordScore, retentionScore, exportReadinessScore,
      hasCriticalIssues, criticalIssueCount, warningCount,
      scoreBreakdown: breakdown, recommendations,
      scoredAt: new Date().toISOString(),
    };
  }

  async getQualityScore(caseId: string, orgId: string, planId: string): Promise<QualityScore | null> {
    await this.verifyCase(caseId, orgId);
    const res = await this.db.query(
      `SELECT tqs.* FROM treatment_quality_scores tqs
       JOIN aligner_generation_plans agp ON agp.plan_id=tqs.plan_id
       WHERE tqs.plan_id=$1 AND agp.organization_id=$2`,
      [planId, orgId],
    );
    if (res.rowCount === 0) return null;
    return this.mapQualityScore(res.rows[0]);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  // ─── Pure helpers (testable without DB) ─────────────────────────────────

  analyzeNoteForAlerts(rawNotes: string): AlertSpec[] {
    const notes = rawNotes.toLowerCase();
    const specs: AlertSpec[] = [];

    if (notes.includes('not seating') || notes.includes('not fitting') || notes.includes('gap')) {
      specs.push({
        type: 'aligner_not_seating',
        severity: 'critical',
        description: 'Patient reports aligner is not fully seating. Gap detected between aligner and teeth.',
        recommendedAction: 'Schedule clinical exam. Consider extending current stage. Verify attachment integrity.',
        affectedTeeth: [],
      });
    }

    if (notes.includes('attachment') && (notes.includes('off') || notes.includes('fell') || notes.includes('detach'))) {
      specs.push({
        type: 'attachment_detached',
        severity: 'warning',
        description: 'Attachment detachment reported. Movement efficiency may be compromised.',
        recommendedAction: 'Rebond attachment at next appointment. Evaluate if stage extension is needed.',
        affectedTeeth: [],
      });
    }

    if (notes.includes('pain') || notes.includes('sore') || notes.includes('pressure')) {
      specs.push({
        type: 'movement_lagging',
        severity: 'info',
        description: 'Patient reports discomfort consistent with tooth movement. Monitor stage progression.',
        recommendedAction: 'Assess patient compliance. Pain may indicate accelerated movement or resistance.',
        affectedTeeth: [],
      });
    }

    if (notes.includes('non-compliant') || notes.includes('not wearing') || notes.includes('forgot')) {
      specs.push({
        type: 'patient_non_compliance',
        severity: 'warning',
        description: 'Compliance issue reported. Less than 22 hours/day wear may delay treatment.',
        recommendedAction: 'Reinforce compliance counseling. Consider compliance monitoring accessories.',
        affectedTeeth: [],
      });
    }

    return specs;
  }

  computeWeightedScore(components: { name: string; score: number; weight: number }[]): number {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const { score, weight } of components) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  gradeFromScore(scorePercent: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (scorePercent >= 90) return 'A';
    if (scorePercent >= 80) return 'B';
    if (scorePercent >= 70) return 'C';
    if (scorePercent >= 60) return 'D';
    return 'F';
  }

  // ─────────────────────────────────────────────────────────────────────────

  private async detectOffTrack(
    caseId: string,
    orgId: string,
    payload: CheckInPayload,
    checkInId: string,
  ): Promise<OffTrackAlert[]> {
    const alerts: OffTrackAlert[] = [];
    const progress = payload.currentStage / payload.totalStages;

    const specs: AlertSpec[] = this.analyzeNoteForAlerts(payload.notes ?? '');

    // Stage-based deviation heuristics
    if (payload.checkInType === 'scan_comparison' && progress > 0.5) {
      // At midpoint scan, detect movement lag
      const midpointScanRes = await this.db.query(
        `SELECT COUNT(*) as cnt FROM treatment_check_ins
         WHERE case_id=$1 AND check_in_type='scan_comparison'`,
        [caseId],
      );
      const scanCount = parseInt(midpointScanRes.rows[0]?.['cnt'] as string ?? '0', 10);
      if (scanCount === 1) {
        specs.push({
          type: 'movement_lagging',
          severity: 'info',
          description: `Mid-treatment scan at stage ${payload.currentStage}/${payload.totalStages}. Baseline scan comparison recommended to verify movement rates.`,
          recommendedAction: 'Compare current scan against predicted stage model. Adjust staging if tooth movement lags by >1 stage.',
          affectedTeeth: [],
        });
      }
    }

    // Insert all alerts
    for (const spec of specs) {
      const alertRes = await this.db.query(
        `INSERT INTO off_track_alerts
           (organization_id, case_id, plan_id, check_in_id, alert_type, severity,
            affected_stage, affected_teeth, description, recommended_action)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          orgId, caseId, payload.planId, checkInId,
          spec.type, spec.severity,
          payload.currentStage,
          JSON.stringify(spec.affectedTeeth),
          spec.description,
          spec.recommendedAction,
        ],
      );
      alerts.push(this.mapAlert(alertRes.rows[0]));
    }

    return alerts;
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const res = await this.db.query(
      `SELECT id FROM cases WHERE id=$1 AND organization_id=$2`,
      [caseId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Case not found');
  }

  private mapCheckIn(r: Record<string, unknown>): CheckIn {
    return {
      id:            r['id'] as string,
      caseId:        r['case_id'] as string,
      planId:        r['plan_id'] as string,
      currentStage:  r['current_stage'] as number,
      totalStages:   r['total_stages'] as number,
      checkInType:   r['check_in_type'] as string,
      notes:         r['notes'] as string | null,
      photoIds:      (r['photo_ids'] as string[]) ?? [],
      createdAt:     r['created_at'] as string,
    };
  }

  private mapAlert(r: Record<string, unknown>): OffTrackAlert {
    return {
      id:                r['id'] as string,
      caseId:            r['case_id'] as string,
      planId:            r['plan_id'] as string,
      alertType:         r['alert_type'] as string,
      severity:          r['severity'] as 'info' | 'warning' | 'critical',
      affectedStage:     r['affected_stage'] as number | null,
      affectedTeeth:     (r['affected_teeth'] as number[]) ?? [],
      description:       r['description'] as string,
      recommendedAction: r['recommended_action'] as string,
      status:            r['status'] as string,
      createdAt:         r['created_at'] as string,
    };
  }

  private mapQualityScore(r: Record<string, unknown>): QualityScore {
    return {
      planId:                r['plan_id'] as string,
      overallScore:          r['overall_score'] as number,
      grade:                 r['grade'] as 'A' | 'B' | 'C' | 'D' | 'F',
      movementSafetyScore:   r['movement_safety_score'] as number | null,
      pdlSafetyScore:        r['pdl_safety_score'] as number | null,
      iprSafetyScore:        r['ipr_safety_score'] as number | null,
      attachmentScore:       r['attachment_score'] as number | null,
      simulationScore:       r['simulation_score'] as number | null,
      archCoordScore:        r['arch_coord_score'] as number | null,
      retentionScore:        r['retention_score'] as number | null,
      exportReadinessScore:  r['export_readiness_score'] as number | null,
      hasCriticalIssues:     r['has_critical_issues'] as boolean,
      criticalIssueCount:    r['critical_issue_count'] as number,
      warningCount:          r['warning_count'] as number,
      scoreBreakdown:        r['score_breakdown'] as Record<string, unknown>,
      recommendations:       r['recommendations'] as string[],
      scoredAt:              r['scored_at'] as string,
    };
  }
}
