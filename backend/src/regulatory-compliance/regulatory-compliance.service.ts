import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ComplianceRequirement {
  id: string; requirementName: string; category: string; description: string | null;
  dueDate: string | null; status: string; evidenceUrl: string | null;
  reviewedBy: string | null; reviewedAt: string | null; createdAt: string;
}

const DEFAULT_REQUIREMENTS = [
  { name: 'HIPAA Risk Assessment',          category: 'hipaa', description: 'Annual HIPAA security risk assessment' },
  { name: 'Staff HIPAA Training',           category: 'hipaa', description: 'Annual HIPAA training for all staff' },
  { name: 'Business Associate Agreements',  category: 'hipaa', description: 'BAAs with all covered vendors' },
  { name: 'Breach Notification Procedure',  category: 'hipaa', description: 'Documented and tested breach response plan' },
  { name: 'Data Backup and Recovery Test',  category: 'hipaa', description: 'Quarterly backup restore test' },
  { name: 'Access Control Review',          category: 'iso',   description: 'Semi-annual review of user access rights' },
  { name: 'Incident Response Plan',         category: 'iso',   description: 'Documented and tested incident response plan' },
];

@Injectable()
export class RegulatoryComplianceService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listRequirements(orgId: string, category?: string): Promise<ComplianceRequirement[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM compliance_requirements WHERE organization_id=$1 ${category ? 'AND category=$2' : ''} ORDER BY due_date ASC NULLS LAST, requirement_name`,
      category ? [orgId, category] : [orgId],
    );
    return rows.map(this.map);
  }

  async seedDefaults(orgId: string, createdBy: string): Promise<ComplianceRequirement[]> {
    const results: ComplianceRequirement[] = [];
    for (const req of DEFAULT_REQUIREMENTS) {
      const { rows } = await this.db.query(
        `INSERT INTO compliance_requirements (organization_id, requirement_name, category, description)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING RETURNING *`,
        [orgId, req.name, req.category, req.description],
      );
      if (rows[0]) results.push(this.map(rows[0]));
    }
    return results;
  }

  async createRequirement(orgId: string, dto: {
    requirementName: string; category?: string; description?: string; dueDate?: string;
  }): Promise<ComplianceRequirement> {
    const { rows } = await this.db.query(
      `INSERT INTO compliance_requirements (organization_id, requirement_name, category, description, due_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [orgId, dto.requirementName, dto.category ?? 'other', dto.description ?? null, dto.dueDate ?? null],
    );
    return this.map(rows[0]);
  }

  async updateStatus(reqId: string, orgId: string, reviewedBy: string, dto: {
    status: string; evidenceUrl?: string;
  }): Promise<ComplianceRequirement> {
    const { rows } = await this.db.query(
      `UPDATE compliance_requirements
         SET status=$2, evidence_url=COALESCE($3,evidence_url), reviewed_by=$4, reviewed_at=now(), updated_at=now()
       WHERE id=$1 AND organization_id=$5 RETURNING *`,
      [reqId, dto.status, dto.evidenceUrl ?? null, reviewedBy, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Requirement not found');
    return this.map(rows[0]);
  }

  async getComplianceScore(orgId: string): Promise<{ total: number; compliant: number; score: number; byCategory: Record<string, { compliant: number; total: number }> }> {
    const { rows } = await this.db.query(
      `SELECT category,
         COUNT(*)::int AS total,
         COUNT(CASE WHEN status='compliant' THEN 1 END)::int AS compliant
       FROM compliance_requirements WHERE organization_id=$1 GROUP BY category`,
      [orgId],
    );
    let totalCount = 0, compliantCount = 0;
    const byCategory: Record<string, { compliant: number; total: number }> = {};
    for (const r of rows) {
      totalCount += r['total'] as number;
      compliantCount += r['compliant'] as number;
      byCategory[r['category'] as string] = { compliant: r['compliant'] as number, total: r['total'] as number };
    }
    return {
      total: totalCount, compliant: compliantCount,
      score: totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0,
      byCategory,
    };
  }

  private map(r: Record<string, unknown>): ComplianceRequirement {
    return {
      id: r['id'] as string, requirementName: r['requirement_name'] as string,
      category: r['category'] as string, description: r['description'] as string | null,
      dueDate: r['due_date'] ? String(r['due_date']) : null, status: r['status'] as string,
      evidenceUrl: r['evidence_url'] as string | null, reviewedBy: r['reviewed_by'] as string | null,
      reviewedAt: r['reviewed_at'] ? String(r['reviewed_at']) : null, createdAt: String(r['created_at']),
    };
  }
}
