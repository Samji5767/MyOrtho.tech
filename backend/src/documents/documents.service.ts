import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface OrgDocument {
  id: string; organizationId: string; caseId: string | null; patientId: string | null;
  documentType: string; fileName: string; fileUrl: string; fileSizeBytes: number | null;
  mimeType: string | null; tags: string[]; uploadedBy: string; createdAt: string;
}

@Injectable()
export class DocumentsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, opts: { caseId?: string; patientId?: string; documentType?: string }): Promise<OrgDocument[]> {
    const params: unknown[] = [orgId];
    let where = 'WHERE organization_id=$1';
    if (opts.caseId) { params.push(opts.caseId); where += ` AND case_id=$${params.length}`; }
    if (opts.patientId) { params.push(opts.patientId); where += ` AND patient_id=$${params.length}`; }
    if (opts.documentType) { params.push(opts.documentType); where += ` AND document_type=$${params.length}`; }
    const { rows } = await this.db.query(`SELECT * FROM documents ${where} ORDER BY created_at DESC`, params);
    return rows.map(this.map);
  }

  async upload(orgId: string, uploadedBy: string, dto: {
    caseId?: string; patientId?: string; documentType: string;
    fileName: string; fileUrl: string; fileSizeBytes?: number; mimeType?: string; tags?: string[];
  }): Promise<OrgDocument> {
    const { rows } = await this.db.query(
      `INSERT INTO documents (organization_id, case_id, patient_id, document_type, file_name, file_url, file_size_bytes, mime_type, tags, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [orgId, dto.caseId ?? null, dto.patientId ?? null, dto.documentType,
       dto.fileName, dto.fileUrl, dto.fileSizeBytes ?? null, dto.mimeType ?? null,
       dto.tags ?? [], uploadedBy],
    );
    return this.map(rows[0]);
  }

  async delete(id: string, orgId: string): Promise<void> {
    const { rowCount } = await this.db.query(
      `DELETE FROM documents WHERE id=$1 AND organization_id=$2`, [id, orgId],
    );
    if (!rowCount) throw new NotFoundException('Document not found');
  }

  private map(r: Record<string, unknown>): OrgDocument {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      caseId: r['case_id'] as string | null, patientId: r['patient_id'] as string | null,
      documentType: r['document_type'] as string, fileName: r['file_name'] as string,
      fileUrl: r['file_url'] as string, fileSizeBytes: r['file_size_bytes'] as number | null,
      mimeType: r['mime_type'] as string | null, tags: (r['tags'] as string[]) ?? [],
      uploadedBy: r['uploaded_by'] as string, createdAt: String(r['created_at']),
    };
  }
}
