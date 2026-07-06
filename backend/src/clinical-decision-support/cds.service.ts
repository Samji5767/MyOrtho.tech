import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ClinicalAlert {
  id: string; caseId: string | null; patientId: string | null;
  alertType: string; severity: string; title: string; body: string;
  acknowledgedBy: string | null; acknowledgedAt: string | null; createdAt: string;
}

@Injectable()
export class ClinicalDecisionSupportService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listAlerts(orgId: string, opts: { caseId?: string; patientId?: string; unacknowledgedOnly?: boolean }): Promise<ClinicalAlert[]> {
    let where = 'WHERE organization_id=$1';
    const params: unknown[] = [orgId];
    if (opts.caseId) { params.push(opts.caseId); where += ` AND case_id=$${params.length}`; }
    if (opts.patientId) { params.push(opts.patientId); where += ` AND patient_id=$${params.length}`; }
    if (opts.unacknowledgedOnly) { where += ' AND acknowledged_at IS NULL'; }

    const { rows } = await this.db.query(
      `SELECT * FROM clinical_alerts ${where} ORDER BY severity='critical' DESC, created_at DESC LIMIT 100`,
      params,
    );
    return rows.map(this.map);
  }

  async createAlert(orgId: string, dto: {
    caseId?: string; patientId?: string; alertType?: string;
    severity?: string; title: string; body: string;
  }): Promise<ClinicalAlert> {
    const { rows } = await this.db.query(
      `INSERT INTO clinical_alerts
         (organization_id, case_id, patient_id, alert_type, severity, title, body)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [orgId, dto.caseId ?? null, dto.patientId ?? null,
       dto.alertType ?? 'clinical', dto.severity ?? 'warning', dto.title, dto.body],
    );
    return this.map(rows[0]);
  }

  async acknowledgeAlert(alertId: string, orgId: string, userId: string): Promise<ClinicalAlert> {
    const { rows } = await this.db.query(
      `UPDATE clinical_alerts SET acknowledged_by=$2, acknowledged_at=now()
       WHERE id=$1 AND organization_id=$3 AND acknowledged_at IS NULL RETURNING *`,
      [alertId, userId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Alert not found or already acknowledged');
    return this.map(rows[0]);
  }

  async runChecks(caseId: string, orgId: string): Promise<ClinicalAlert[]> {
    const { rows: c } = await this.db.query(
      'SELECT patient_id FROM cases WHERE id=$1 AND organization_id=$2', [caseId, orgId],
    );
    if (!c[0]) throw new NotFoundException('Case not found');

    const newAlerts: ClinicalAlert[] = [];

    const { rows: rx } = await this.db.query(
      'SELECT count(*)::int AS cnt FROM prescriptions WHERE case_id=$1 AND status=\'active\'', [caseId],
    );
    if ((rx[0]?.cnt ?? 0) > 3) {
      const alert = await this.createAlert(orgId, {
        caseId, alertType: 'drug_interaction', severity: 'warning',
        title: 'Multiple Active Prescriptions',
        body: `Case has ${rx[0].cnt} active prescriptions. Review for potential interactions.`,
      });
      newAlerts.push(alert);
    }

    const { rows: ci } = await this.db.query(
      `SELECT check_in_date FROM compliance_check_ins WHERE case_id=$1 AND organization_id=$2 ORDER BY check_in_date DESC LIMIT 1`,
      [caseId, orgId],
    );
    if (!ci[0] || (Date.now() - new Date(ci[0]['check_in_date'] as string).getTime()) > 14 * 86400000) {
      const alert = await this.createAlert(orgId, {
        caseId, alertType: 'compliance', severity: 'info',
        title: 'Overdue Patient Check-In',
        body: 'No patient check-in recorded in the last 14 days. Consider requesting an update.',
      });
      newAlerts.push(alert);
    }

    // Simulation-based checks: constraint violations, BRI, and biomechanics status
    const { rows: simRows } = await this.db.query(
      `SELECT constraint_violations, bone_remodeling_index, biomechanics_status
       FROM movement_simulations
       WHERE case_id = $1 AND org_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [caseId, orgId],
    );
    if (simRows[0]) {
      const sim = simRows[0];

      const violations = (sim['constraint_violations'] as Array<{ severity?: string; type?: string; tooth?: number }> | null) ?? [];
      const criticals = violations.filter((v) => v.severity === 'critical');
      if (criticals.length > 0) {
        const toothList = criticals.map((v) => String(v.tooth ?? '?')).join(', ');
        newAlerts.push(await this.createAlert(orgId, {
          caseId, alertType: 'biomechanics', severity: 'critical',
          title: 'Critical Movement Constraint Violations',
          body: `${criticals.length} critical Kravitz-limit violation(s) detected on teeth: ${toothList}. Reduce per-stage movement before approval.`,
        }));
      }

      const bri = sim['bone_remodeling_index'] !== null ? Number(sim['bone_remodeling_index']) : null;
      if (bri !== null && bri > 1.0) {
        newAlerts.push(await this.createAlert(orgId, {
          caseId, alertType: 'bone_remodeling', severity: 'warning',
          title: 'High Bone Remodelling Index',
          body: `Bone Remodelling Index is ${bri.toFixed(2)} (safe threshold: 1.0). Total movement demand may exceed bone remodelling capacity — consider extending treatment duration.`,
        }));
      }

      if (sim['biomechanics_status'] === 'unsafe') {
        newAlerts.push(await this.createAlert(orgId, {
          caseId, alertType: 'biomechanics', severity: 'critical',
          title: 'Unsafe Biomechanics Status',
          body: 'Movement simulation returned an unsafe biomechanics status. Review PDL stress levels and per-tooth movement prescriptions before proceeding.',
        }));
      }
    }

    // IPR safety check: flag any contacts where enamel safety threshold would be breached
    const { rows: iprRows } = await this.db.query(
      `SELECT tooth_a_fdi, tooth_b_fdi, amount_mm
       FROM ipr_plan_items
       WHERE case_id = $1 AND safety_status = 'unsafe'`,
      [caseId],
    );
    if (iprRows.length > 0) {
      const contactList = iprRows
        .map((r) => `${r['tooth_a_fdi'] as number}–${r['tooth_b_fdi'] as number} (${Number(r['amount_mm']).toFixed(2)} mm)`)
        .join(', ');
      newAlerts.push(await this.createAlert(orgId, {
        caseId, alertType: 'ipr_safety', severity: 'critical',
        title: 'Unsafe IPR Amount Detected',
        body: `${iprRows.length} IPR contact(s) would reduce enamel below the 0.5 mm safety minimum: ${contactList}. Reduce IPR amounts before export.`,
      }));
    }

    return newAlerts;
  }

  private map(r: Record<string, unknown>): ClinicalAlert {
    return {
      id: r['id'] as string, caseId: r['case_id'] as string | null, patientId: r['patient_id'] as string | null,
      alertType: r['alert_type'] as string, severity: r['severity'] as string,
      title: r['title'] as string, body: r['body'] as string,
      acknowledgedBy: r['acknowledged_by'] as string | null,
      acknowledgedAt: r['acknowledged_at'] ? String(r['acknowledged_at']) : null,
      createdAt: String(r['created_at']),
    };
  }
}
