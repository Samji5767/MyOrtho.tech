import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface AiAuditRecord {
  id: string;
  organizationId: string;
  modelName: string;
  modelVersion: string;
  invokedBy: string;
  invokedByEmail: string | null;
  caseId: string | null;
  patientId: string | null;
  outcome: string | null;
  latencyMs: number | null;
  tokensUsed: number | null;
  disclaimerShown: boolean;
  createdAt: string;
}

export interface AiAuditListResult {
  records: AiAuditRecord[];
  total: number;
}

@Injectable()
export class AiGovernanceService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listAuditRecords(
    orgId: string | null,
    opts: { limit: number; offset: number; caseId?: string },
  ): Promise<AiAuditListResult> {
    const { limit, offset, caseId } = opts;
    const params: unknown[] = [];

    let where = 'WHERE 1=1';
    if (orgId) {
      params.push(orgId);
      where += ` AND a.organization_id = $${params.length}`;
    }
    if (caseId) {
      params.push(caseId);
      where += ` AND a.case_id = $${params.length}`;
    }

    params.push(limit, offset);
    const limitPlaceholder = `$${params.length - 1}`;
    const offsetPlaceholder = `$${params.length}`;

    const [dataRes, countRes] = await Promise.all([
      this.pool.query(
        `SELECT
           a.id, a.organization_id, a.model_name, a.model_version,
           a.invoked_by, u.email AS invoked_by_email,
           a.case_id, a.patient_id, a.outcome,
           a.latency_ms, a.tokens_used, a.disclaimer_shown, a.created_at
         FROM ai_inference_audit a
         LEFT JOIN auth_users u ON u.id = a.invoked_by
         ${where}
         ORDER BY a.created_at DESC
         LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
        params,
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS total FROM ai_inference_audit a ${where}`,
        params.slice(0, params.length - 2),
      ),
    ]);

    return {
      records: dataRes.rows.map((r) => ({
        id: r['id'] as string,
        organizationId: r['organization_id'] as string,
        modelName: r['model_name'] as string,
        modelVersion: r['model_version'] as string,
        invokedBy: r['invoked_by'] as string,
        invokedByEmail: (r['invoked_by_email'] as string | null) ?? null,
        caseId: (r['case_id'] as string | null) ?? null,
        patientId: (r['patient_id'] as string | null) ?? null,
        outcome: (r['outcome'] as string | null) ?? null,
        latencyMs: (r['latency_ms'] as number | null) ?? null,
        tokensUsed: (r['tokens_used'] as number | null) ?? null,
        disclaimerShown: r['disclaimer_shown'] as boolean,
        createdAt: r['created_at'] as string,
      })),
      total: (countRes.rows[0]?.['total'] as number) ?? 0,
    };
  }

  async exportCsv(orgId: string | null): Promise<string> {
    const { records } = await this.listAuditRecords(orgId, { limit: 10000, offset: 0 });
    const header = [
      'id', 'organization_id', 'model_name', 'model_version',
      'invoked_by', 'invoked_by_email', 'case_id', 'patient_id',
      'outcome', 'latency_ms', 'tokens_used', 'disclaimer_shown', 'created_at',
    ].join(',');
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const rows = records.map((r) =>
      [
        r.id, r.organizationId, r.modelName, r.modelVersion,
        r.invokedBy, r.invokedByEmail, r.caseId, r.patientId,
        r.outcome, r.latencyMs, r.tokensUsed, r.disclaimerShown, r.createdAt,
      ]
        .map(escape)
        .join(','),
    );
    return [header, ...rows].join('\n');
  }
}
