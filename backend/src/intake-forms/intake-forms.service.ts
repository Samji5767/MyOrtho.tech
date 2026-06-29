import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface IntakeTemplate {
  id: string; organizationId: string; templateName: string; formType: string;
  fields: unknown[]; isActive: boolean; createdAt: string; updatedAt: string;
}
export interface IntakeSubmission {
  id: string; organizationId: string; templateId: string; patientId: string | null;
  caseId: string | null; submittedData: Record<string, unknown>;
  submittedAt: string; reviewedBy: string | null; reviewedAt: string | null;
}

@Injectable()
export class IntakeFormsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listTemplates(orgId: string, formType?: string): Promise<IntakeTemplate[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM intake_form_templates WHERE organization_id=$1 ${formType ? 'AND form_type=$2' : ''} ORDER BY template_name`,
      formType ? [orgId, formType] : [orgId],
    );
    return rows.map(this.mapTemplate);
  }

  async createTemplate(orgId: string, dto: {
    templateName: string; formType?: string; fields?: unknown[];
  }): Promise<IntakeTemplate> {
    const { rows } = await this.db.query(
      `INSERT INTO intake_form_templates (organization_id, template_name, form_type, fields)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [orgId, dto.templateName, dto.formType ?? 'medical_history', JSON.stringify(dto.fields ?? [])],
    );
    return this.mapTemplate(rows[0]);
  }

  async updateTemplate(id: string, orgId: string, dto: Partial<{ templateName: string; formType: string; fields: unknown[]; isActive: boolean }>): Promise<IntakeTemplate> {
    const { rows } = await this.db.query(
      `UPDATE intake_form_templates SET
         template_name=COALESCE($3,template_name),
         form_type=COALESCE($4,form_type),
         fields=COALESCE($5::jsonb,fields),
         is_active=COALESCE($6,is_active),
         updated_at=now()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, dto.templateName ?? null, dto.formType ?? null,
       dto.fields ? JSON.stringify(dto.fields) : null, dto.isActive ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Template not found');
    return this.mapTemplate(rows[0]);
  }

  async submit(orgId: string, dto: {
    templateId: string; patientId?: string; caseId?: string; submittedData: Record<string, unknown>;
  }): Promise<IntakeSubmission> {
    const { rows: tRows } = await this.db.query(
      `SELECT id FROM intake_form_templates WHERE id=$1 AND organization_id=$2`, [dto.templateId, orgId],
    );
    if (!tRows[0]) throw new NotFoundException('Template not found');
    const { rows } = await this.db.query(
      `INSERT INTO intake_submissions (organization_id, template_id, patient_id, case_id, submitted_data)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [orgId, dto.templateId, dto.patientId ?? null, dto.caseId ?? null, JSON.stringify(dto.submittedData)],
    );
    return this.mapSubmission(rows[0]);
  }

  async listSubmissions(orgId: string, templateId: string): Promise<IntakeSubmission[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM intake_submissions WHERE organization_id=$1 AND template_id=$2 ORDER BY submitted_at DESC`,
      [orgId, templateId],
    );
    return rows.map(this.mapSubmission);
  }

  async review(submissionId: string, orgId: string, reviewedBy: string): Promise<IntakeSubmission> {
    const { rows } = await this.db.query(
      `UPDATE intake_submissions SET reviewed_by=$3, reviewed_at=now()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [submissionId, orgId, reviewedBy],
    );
    if (!rows[0]) throw new NotFoundException('Submission not found');
    return this.mapSubmission(rows[0]);
  }

  private mapTemplate(r: Record<string, unknown>): IntakeTemplate {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      templateName: r['template_name'] as string, formType: r['form_type'] as string,
      fields: (r['fields'] as unknown[]) ?? [], isActive: r['is_active'] as boolean,
      createdAt: String(r['created_at']), updatedAt: String(r['updated_at']),
    };
  }
  private mapSubmission(r: Record<string, unknown>): IntakeSubmission {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      templateId: r['template_id'] as string, patientId: r['patient_id'] as string | null,
      caseId: r['case_id'] as string | null,
      submittedData: (r['submitted_data'] as Record<string, unknown>) ?? {},
      submittedAt: String(r['submitted_at']),
      reviewedBy: r['reviewed_by'] as string | null,
      reviewedAt: r['reviewed_at'] ? String(r['reviewed_at']) : null,
    };
  }
}
