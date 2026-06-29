import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

const CDT_CODE_PATTERN = /^D\d{4}$/;

export interface InsurancePlan {
  id: string; patientId: string; payerName: string; planName: string | null;
  memberId: string | null; groupNumber: string | null; isPrimary: boolean;
  effectiveDate: string | null; terminationDate: string | null;
}

export interface PreAuth {
  id: string; caseId: string; insurancePlanId: string | null; authNumber: string | null;
  cdtCodes: string[]; status: string; submittedAt: string | null; decisionAt: string | null;
  approvedAmountCents: number | null; notes: string | null; createdAt: string;
}

@Injectable()
export class InsuranceService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  // ── Insurance Plans ──────────────────────────────────────────────────────────
  async listPlans(patientId: string, orgId: string): Promise<InsurancePlan[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM insurance_plans WHERE patient_id=$1 AND organization_id=$2 ORDER BY is_primary DESC, created_at`,
      [patientId, orgId],
    );
    return rows.map(this.mapPlan);
  }

  async createPlan(orgId: string, patientId: string, dto: {
    payerName: string; planName?: string; memberId?: string; groupNumber?: string;
    isPrimary?: boolean; effectiveDate?: string; terminationDate?: string;
  }): Promise<InsurancePlan> {
    if (dto.isPrimary) {
      await this.db.query(
        'UPDATE insurance_plans SET is_primary=FALSE WHERE patient_id=$1 AND organization_id=$2',
        [patientId, orgId],
      );
    }
    const { rows } = await this.db.query(
      `INSERT INTO insurance_plans
         (organization_id, patient_id, payer_name, plan_name, member_id, group_number, is_primary, effective_date, termination_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [orgId, patientId, dto.payerName, dto.planName ?? null, dto.memberId ?? null,
       dto.groupNumber ?? null, dto.isPrimary ?? false, dto.effectiveDate ?? null, dto.terminationDate ?? null],
    );
    return this.mapPlan(rows[0]);
  }

  // ── Pre-Authorizations ───────────────────────────────────────────────────────
  async listPreAuths(caseId: string, orgId: string): Promise<PreAuth[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      'SELECT * FROM insurance_preauths WHERE case_id=$1 AND organization_id=$2 ORDER BY created_at DESC',
      [caseId, orgId],
    );
    return rows.map(this.mapPreAuth);
  }

  async createPreAuth(caseId: string, orgId: string, createdBy: string, dto: {
    insurancePlanId?: string; cdtCodes: string[]; notes?: string;
  }): Promise<PreAuth> {
    await this.verifyCase(caseId, orgId);
    if (!dto.cdtCodes.length) throw new BadRequestException('At least one CDT code required');
    for (const code of dto.cdtCodes) {
      if (!CDT_CODE_PATTERN.test(code)) throw new BadRequestException(`Invalid CDT code: ${code}`);
    }
    const { rows } = await this.db.query(
      `INSERT INTO insurance_preauths
         (organization_id, case_id, insurance_plan_id, cdt_codes, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, caseId, dto.insurancePlanId ?? null, JSON.stringify(dto.cdtCodes), dto.notes ?? null, createdBy],
    );
    return this.mapPreAuth(rows[0]);
  }

  async submitPreAuth(preAuthId: string, orgId: string): Promise<PreAuth> {
    const { rows } = await this.db.query(
      `UPDATE insurance_preauths SET status='submitted', submitted_at=now(), updated_at=now()
       WHERE id=$1 AND organization_id=$2 AND status='pending' RETURNING *`,
      [preAuthId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Pre-auth not found or not in pending status');
    return this.mapPreAuth(rows[0]);
  }

  async updateDecision(preAuthId: string, orgId: string, dto: {
    status: 'approved' | 'denied'; authNumber?: string; approvedAmountCents?: number; notes?: string;
  }): Promise<PreAuth> {
    const { rows } = await this.db.query(
      `UPDATE insurance_preauths
         SET status=$2, auth_number=$3, approved_amount_cents=$4, notes=COALESCE($5,notes),
             decision_at=now(), updated_at=now()
       WHERE id=$1 AND organization_id=$6 RETURNING *`,
      [preAuthId, dto.status, dto.authNumber ?? null, dto.approvedAmountCents ?? null, dto.notes ?? null, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Pre-auth not found');
    return this.mapPreAuth(rows[0]);
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.db.query('SELECT id FROM cases WHERE id=$1 AND organization_id=$2', [caseId, orgId]);
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private mapPlan(r: Record<string, unknown>): InsurancePlan {
    return {
      id: r['id'] as string, patientId: r['patient_id'] as string,
      payerName: r['payer_name'] as string, planName: r['plan_name'] as string | null,
      memberId: r['member_id'] as string | null, groupNumber: r['group_number'] as string | null,
      isPrimary: r['is_primary'] as boolean,
      effectiveDate: r['effective_date'] ? String(r['effective_date']) : null,
      terminationDate: r['termination_date'] ? String(r['termination_date']) : null,
    };
  }

  private mapPreAuth(r: Record<string, unknown>): PreAuth {
    return {
      id: r['id'] as string, caseId: r['case_id'] as string,
      insurancePlanId: r['insurance_plan_id'] as string | null,
      authNumber: r['auth_number'] as string | null,
      cdtCodes: (r['cdt_codes'] as string[]) ?? [],
      status: r['status'] as string,
      submittedAt: r['submitted_at'] ? String(r['submitted_at']) : null,
      decisionAt: r['decision_at'] ? String(r['decision_at']) : null,
      approvedAmountCents: r['approved_amount_cents'] as number | null,
      notes: r['notes'] as string | null,
      createdAt: String(r['created_at']),
    };
  }
}
