import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface CheckIn {
  id: string; caseId: string; patientId: string; checkInDate: string;
  wearHours: number | null; painScore: number | null; issuesReported: string[];
  photoUrls: string[]; alignerStage: number | null;
  clinicianNotes: string | null; reviewedBy: string | null; reviewedAt: string | null;
  createdAt: string;
}

@Injectable()
export class RemoteMonitoringService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listCheckIns(caseId: string, orgId: string): Promise<CheckIn[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      'SELECT * FROM compliance_check_ins WHERE case_id=$1 AND organization_id=$2 ORDER BY check_in_date DESC LIMIT 60',
      [caseId, orgId],
    );
    return rows.map(this.map);
  }

  async createCheckIn(caseId: string, orgId: string, dto: {
    checkInDate: string; wearHours?: number; painScore?: number;
    issuesReported?: string[]; photoUrls?: string[]; alignerStage?: number;
  }): Promise<CheckIn> {
    const { rows: c } = await this.db.query(
      'SELECT patient_id FROM cases WHERE id=$1 AND organization_id=$2', [caseId, orgId],
    );
    if (!c[0]) throw new NotFoundException('Case not found');
    const patientId = c[0]['patient_id'] as string;

    const { rows } = await this.db.query(
      `INSERT INTO compliance_check_ins
         (organization_id, case_id, patient_id, check_in_date, wear_hours, pain_score,
          issues_reported, photo_urls, aligner_stage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING RETURNING *`,
      [orgId, caseId, patientId, dto.checkInDate, dto.wearHours ?? null,
       dto.painScore ?? null, dto.issuesReported ?? [], dto.photoUrls ?? [], dto.alignerStage ?? null],
    );
    if (!rows[0]) {
      const { rows: existing } = await this.db.query(
        'SELECT * FROM compliance_check_ins WHERE case_id=$1 AND check_in_date=$2', [caseId, dto.checkInDate],
      );
      return this.map(existing[0]);
    }
    return this.map(rows[0]);
  }

  async reviewCheckIn(checkInId: string, orgId: string, reviewedBy: string, clinicianNotes: string): Promise<CheckIn> {
    const { rows } = await this.db.query(
      `UPDATE compliance_check_ins
         SET clinician_notes=$2, reviewed_by=$3, reviewed_at=now()
       WHERE id=$1 AND organization_id=$4 RETURNING *`,
      [checkInId, clinicianNotes, reviewedBy, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Check-in not found');
    return this.map(rows[0]);
  }

  async getComplianceSummary(caseId: string, orgId: string): Promise<{
    averageWearHours: number | null; totalCheckIns: number; reviewedCount: number;
    averagePainScore: number | null; lastCheckIn: string | null;
  }> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(reviewed_at)::int AS reviewed,
         AVG(wear_hours)::numeric(5,2) AS avg_wear,
         AVG(pain_score)::numeric(4,2) AS avg_pain,
         MAX(check_in_date) AS last_checkin
       FROM compliance_check_ins WHERE case_id=$1 AND organization_id=$2`,
      [caseId, orgId],
    );
    const r = rows[0];
    return {
      totalCheckIns: r['total'] as number,
      reviewedCount: r['reviewed'] as number,
      averageWearHours: r['avg_wear'] ? Number(r['avg_wear']) : null,
      averagePainScore: r['avg_pain'] ? Number(r['avg_pain']) : null,
      lastCheckIn: r['last_checkin'] ? String(r['last_checkin']) : null,
    };
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.db.query('SELECT id FROM cases WHERE id=$1 AND organization_id=$2', [caseId, orgId]);
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private map(r: Record<string, unknown>): CheckIn {
    return {
      id: r['id'] as string, caseId: r['case_id'] as string, patientId: r['patient_id'] as string,
      checkInDate: String(r['check_in_date']),
      wearHours: r['wear_hours'] != null ? Number(r['wear_hours']) : null,
      painScore: r['pain_score'] as number | null,
      issuesReported: (r['issues_reported'] as string[]) ?? [],
      photoUrls: (r['photo_urls'] as string[]) ?? [],
      alignerStage: r['aligner_stage'] as number | null,
      clinicianNotes: r['clinician_notes'] as string | null,
      reviewedBy: r['reviewed_by'] as string | null,
      reviewedAt: r['reviewed_at'] ? String(r['reviewed_at']) : null,
      createdAt: String(r['created_at']),
    };
  }
}
