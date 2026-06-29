import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface RadiologyImage {
  id: string; organizationId: string; patientId: string; caseId: string | null;
  imageType: string; fileUrl: string; captureDate: string | null; notes: string | null;
  uploadedBy: string; createdAt: string;
}

@Injectable()
export class RadiologyService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, opts: { patientId?: string; caseId?: string; imageType?: string }): Promise<RadiologyImage[]> {
    const params: unknown[] = [orgId];
    let where = 'WHERE r.organization_id=$1';
    if (opts.patientId) { params.push(opts.patientId); where += ` AND r.patient_id=$${params.length}`; }
    if (opts.caseId) { params.push(opts.caseId); where += ` AND r.case_id=$${params.length}`; }
    if (opts.imageType) { params.push(opts.imageType); where += ` AND r.image_type=$${params.length}`; }
    const { rows } = await this.db.query(
      `SELECT r.* FROM radiology_images r ${where} ORDER BY r.created_at DESC`, params,
    );
    return rows.map(this.map);
  }

  async upload(orgId: string, uploadedBy: string, dto: {
    patientId: string; caseId?: string; imageType?: string;
    fileUrl: string; captureDate?: string; notes?: string;
  }): Promise<RadiologyImage> {
    const { rows } = await this.db.query(
      `INSERT INTO radiology_images (organization_id, patient_id, case_id, image_type, file_url, capture_date, notes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, dto.patientId, dto.caseId ?? null, dto.imageType ?? 'panoramic',
       dto.fileUrl, dto.captureDate ?? null, dto.notes ?? null, uploadedBy],
    );
    return this.map(rows[0]);
  }

  async delete(id: string, orgId: string): Promise<void> {
    const { rowCount } = await this.db.query(
      `DELETE FROM radiology_images WHERE id=$1 AND organization_id=$2`, [id, orgId],
    );
    if (!rowCount) throw new NotFoundException('Image not found');
  }

  private map(r: Record<string, unknown>): RadiologyImage {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      patientId: r['patient_id'] as string, caseId: r['case_id'] as string | null,
      imageType: r['image_type'] as string, fileUrl: r['file_url'] as string,
      captureDate: r['capture_date'] ? String(r['capture_date']) : null,
      notes: r['notes'] as string | null, uploadedBy: r['uploaded_by'] as string,
      createdAt: String(r['created_at']),
    };
  }
}
