import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface Referral {
  id: string;
  caseId: string;
  referralType: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  urgency: string;
  reason: string;
  clinicalNotes: string | null;
  status: string;
  sentAt: string | null;
  respondedAt: string | null;
  responseNotes: string | null;
  createdAt: string;
}

@Injectable()
export class ReferralsService {
  private readonly log = new Logger(ReferralsService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listReferrals(caseId: string, orgId: string): Promise<Referral[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      `SELECT * FROM referrals WHERE case_id=$1 AND organization_id=$2 ORDER BY created_at DESC`,
      [caseId, orgId],
    );
    return rows.map(this.map);
  }

  async listOrgReferrals(orgId: string, status?: string): Promise<Referral[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM referrals WHERE organization_id=$1 ${status ? 'AND status=$2' : ''} ORDER BY created_at DESC LIMIT 100`,
      status ? [orgId, status] : [orgId],
    );
    return rows.map(this.map);
  }

  async createReferral(caseId: string, orgId: string, createdBy: string, dto: {
    referralType: string;
    recipientName: string;
    recipientEmail?: string;
    recipientPhone?: string;
    urgency?: string;
    reason: string;
    clinicalNotes?: string;
  }): Promise<Referral> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      `INSERT INTO referrals
         (organization_id, case_id, referral_type, recipient_name, recipient_email, recipient_phone,
          urgency, reason, clinical_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [orgId, caseId, dto.referralType, dto.recipientName, dto.recipientEmail ?? null,
       dto.recipientPhone ?? null, dto.urgency ?? 'routine', dto.reason, dto.clinicalNotes ?? null, createdBy],
    );
    return this.map(rows[0]);
  }

  async sendReferral(referralId: string, orgId: string): Promise<Referral> {
    const { rows } = await this.db.query(
      `UPDATE referrals SET status='sent', sent_at=now(), updated_at=now()
       WHERE id=$1 AND organization_id=$2 AND status='pending' RETURNING *`,
      [referralId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Referral not found or already sent');
    return this.map(rows[0]);
  }

  async updateReferralResponse(referralId: string, orgId: string, dto: { status: string; responseNotes?: string }): Promise<Referral> {
    const valid = ['accepted','declined','completed'];
    if (!valid.includes(dto.status)) throw new NotFoundException('Invalid status');
    const { rows } = await this.db.query(
      `UPDATE referrals SET status=$2, responded_at=now(), response_notes=$3, updated_at=now()
       WHERE id=$1 AND organization_id=$4 RETURNING *`,
      [referralId, dto.status, dto.responseNotes ?? null, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Referral not found');
    return this.map(rows[0]);
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.db.query(`SELECT id FROM cases WHERE id=$1 AND organization_id=$2`, [caseId, orgId]);
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private map(r: Record<string, unknown>): Referral {
    return {
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      referralType: r['referral_type'] as string,
      recipientName: r['recipient_name'] as string,
      recipientEmail: r['recipient_email'] as string | null,
      recipientPhone: r['recipient_phone'] as string | null,
      urgency: r['urgency'] as string,
      reason: r['reason'] as string,
      clinicalNotes: r['clinical_notes'] as string | null,
      status: r['status'] as string,
      sentAt: r['sent_at'] ? String(r['sent_at']) : null,
      respondedAt: r['responded_at'] ? String(r['responded_at']) : null,
      responseNotes: r['response_notes'] as string | null,
      createdAt: String(r['created_at']),
    };
  }
}
