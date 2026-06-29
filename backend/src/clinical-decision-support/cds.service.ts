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
