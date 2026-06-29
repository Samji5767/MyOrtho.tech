import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface EducationContent {
  id: string; organizationId: string | null; title: string; category: string;
  contentType: string; contentUrl: string | null; bodyText: string | null;
  tags: string[]; isGlobal: boolean; createdAt: string;
}
export interface EducationAssignment {
  id: string; caseId: string; contentId: string; assignedBy: string;
  viewedAt: string | null; completedAt: string | null; assignedAt: string;
  title?: string; category?: string;
}

@Injectable()
export class PatientEducationService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listContent(orgId: string, category?: string): Promise<EducationContent[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM education_content
       WHERE (organization_id=$1 OR is_global=true)
       ${category ? 'AND category=$2' : ''}
       ORDER BY title`,
      category ? [orgId, category] : [orgId],
    );
    return rows.map(this.mapContent);
  }

  async createContent(orgId: string, dto: {
    title: string; category?: string; contentType?: string;
    contentUrl?: string; bodyText?: string; tags?: string[];
  }): Promise<EducationContent> {
    const { rows } = await this.db.query(
      `INSERT INTO education_content (organization_id, title, category, content_type, content_url, body_text, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [orgId, dto.title, dto.category ?? 'general', dto.contentType ?? 'article',
       dto.contentUrl ?? null, dto.bodyText ?? null, dto.tags ?? []],
    );
    return this.mapContent(rows[0]);
  }

  async listAssignments(caseId: string, orgId: string): Promise<EducationAssignment[]> {
    const { rows } = await this.db.query(
      `SELECT a.*, c.title, c.category
       FROM patient_education_assignments a
       JOIN education_content c ON c.id=a.content_id
       JOIN cases cs ON cs.id=a.case_id
       WHERE a.case_id=$1 AND cs.organization_id=$2
       ORDER BY a.assigned_at DESC`,
      [caseId, orgId],
    );
    return rows.map(this.mapAssignment);
  }

  async assign(caseId: string, orgId: string, assignedBy: string, contentId: string): Promise<EducationAssignment> {
    const { rows: caseRows } = await this.db.query(
      `SELECT id FROM cases WHERE id=$1 AND organization_id=$2`, [caseId, orgId],
    );
    if (!caseRows[0]) throw new NotFoundException('Case not found');
    const { rows } = await this.db.query(
      `INSERT INTO patient_education_assignments (case_id, content_id, assigned_by)
       VALUES ($1,$2,$3) ON CONFLICT (case_id, content_id) DO NOTHING RETURNING *`,
      [caseId, contentId, assignedBy],
    );
    if (!rows[0]) {
      const { rows: existing } = await this.db.query(
        `SELECT a.*, c.title, c.category FROM patient_education_assignments a
         JOIN education_content c ON c.id=a.content_id
         WHERE a.case_id=$1 AND a.content_id=$2`, [caseId, contentId],
      );
      return this.mapAssignment(existing[0]);
    }
    return this.mapAssignment(rows[0]);
  }

  async markViewed(assignmentId: string, orgId: string): Promise<EducationAssignment> {
    const { rows } = await this.db.query(
      `UPDATE patient_education_assignments a SET viewed_at=now()
       FROM cases c WHERE a.id=$1 AND a.case_id=c.id AND c.organization_id=$2
       RETURNING a.*`,
      [assignmentId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Assignment not found');
    return this.mapAssignment(rows[0]);
  }

  async markCompleted(assignmentId: string, orgId: string): Promise<EducationAssignment> {
    const { rows } = await this.db.query(
      `UPDATE patient_education_assignments a SET completed_at=now()
       FROM cases c WHERE a.id=$1 AND a.case_id=c.id AND c.organization_id=$2
       RETURNING a.*`,
      [assignmentId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Assignment not found');
    return this.mapAssignment(rows[0]);
  }

  private mapContent(r: Record<string, unknown>): EducationContent {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string | null,
      title: r['title'] as string, category: r['category'] as string,
      contentType: r['content_type'] as string, contentUrl: r['content_url'] as string | null,
      bodyText: r['body_text'] as string | null, tags: (r['tags'] as string[]) ?? [],
      isGlobal: r['is_global'] as boolean, createdAt: String(r['created_at']),
    };
  }
  private mapAssignment(r: Record<string, unknown>): EducationAssignment {
    return {
      id: r['id'] as string, caseId: r['case_id'] as string,
      contentId: r['content_id'] as string, assignedBy: r['assigned_by'] as string,
      viewedAt: r['viewed_at'] ? String(r['viewed_at']) : null,
      completedAt: r['completed_at'] ? String(r['completed_at']) : null,
      assignedAt: String(r['assigned_at']),
      title: r['title'] as string | undefined, category: r['category'] as string | undefined,
    };
  }
}
