import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface RevenueTransaction {
  id: string; organizationId: string; caseId: string | null; patientId: string | null;
  transactionType: string; amountCents: number; currency: string; description: string | null;
  cdtCode: string | null; status: string; postedAt: string | null;
  createdBy: string; createdAt: string;
}
export interface RevenueSummary {
  totalChargesCents: number; totalPaymentsCents: number; totalAdjustmentsCents: number;
  netRevenueCents: number; outstandingCents: number; byType: Record<string, number>;
}

@Injectable()
export class RevenueCycleService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, opts: { caseId?: string; patientId?: string; status?: string }): Promise<RevenueTransaction[]> {
    const params: unknown[] = [orgId];
    let where = 'WHERE organization_id=$1';
    if (opts.caseId) { params.push(opts.caseId); where += ` AND case_id=$${params.length}`; }
    if (opts.patientId) { params.push(opts.patientId); where += ` AND patient_id=$${params.length}`; }
    if (opts.status) { params.push(opts.status); where += ` AND status=$${params.length}`; }
    const { rows } = await this.db.query(
      `SELECT * FROM revenue_transactions ${where} ORDER BY created_at DESC`, params,
    );
    return rows.map(this.map);
  }

  async create(orgId: string, createdBy: string, dto: {
    caseId?: string; patientId?: string; transactionType: string;
    amountCents: number; currency?: string; description?: string; cdtCode?: string;
  }): Promise<RevenueTransaction> {
    const { rows } = await this.db.query(
      `INSERT INTO revenue_transactions (organization_id, case_id, patient_id, transaction_type, amount_cents, currency, description, cdt_code, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [orgId, dto.caseId ?? null, dto.patientId ?? null, dto.transactionType,
       dto.amountCents, dto.currency ?? 'USD', dto.description ?? null, dto.cdtCode ?? null, createdBy],
    );
    return this.map(rows[0]);
  }

  async post(id: string, orgId: string): Promise<RevenueTransaction> {
    const { rows } = await this.db.query(
      `UPDATE revenue_transactions SET status='posted', posted_at=now()
       WHERE id=$1 AND organization_id=$2 AND status='pending' RETURNING *`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Transaction not found or not pending');
    return this.map(rows[0]);
  }

  async getSummary(orgId: string, opts?: { caseId?: string; patientId?: string }): Promise<RevenueSummary> {
    const params: unknown[] = [orgId];
    let where = 'WHERE organization_id=$1 AND status IN (\'posted\',\'cleared\')';
    if (opts?.caseId) { params.push(opts.caseId); where += ` AND case_id=$${params.length}`; }
    if (opts?.patientId) { params.push(opts.patientId); where += ` AND patient_id=$${params.length}`; }
    const { rows } = await this.db.query(
      `SELECT transaction_type,
         COALESCE(SUM(amount_cents),0)::bigint AS total
       FROM revenue_transactions
       ${where}
       GROUP BY transaction_type`,
      params,
    );
    const byType: Record<string, number> = {};
    for (const r of rows) byType[r['transaction_type'] as string] = Number(r['total']);
    const charges = (byType['charge'] ?? 0);
    const payments = (byType['payment'] ?? 0);
    const adjustments = (byType['adjustment'] ?? 0) + (byType['writeoff'] ?? 0) + (byType['refund'] ?? 0);
    return {
      totalChargesCents: charges,
      totalPaymentsCents: payments,
      totalAdjustmentsCents: adjustments,
      netRevenueCents: charges - adjustments,
      outstandingCents: Math.max(0, charges - payments - adjustments),
      byType,
    };
  }

  private map(r: Record<string, unknown>): RevenueTransaction {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      caseId: r['case_id'] as string | null, patientId: r['patient_id'] as string | null,
      transactionType: r['transaction_type'] as string,
      amountCents: r['amount_cents'] as number, currency: r['currency'] as string,
      description: r['description'] as string | null, cdtCode: r['cdt_code'] as string | null,
      status: r['status'] as string, postedAt: r['posted_at'] ? String(r['posted_at']) : null,
      createdBy: r['created_by'] as string, createdAt: String(r['created_at']),
    };
  }
}
