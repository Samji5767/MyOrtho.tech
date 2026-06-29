import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface AttachmentTemplate {
  id: string; organizationId: string | null; name: string; attachmentType: string;
  toothTypes: string[]; geometry: Record<string, unknown>; notes: string | null;
  isGlobal: boolean; createdAt: string;
}

@Injectable()
export class AttachmentLibraryService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, attachmentType?: string): Promise<AttachmentTemplate[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM attachment_templates
       WHERE (organization_id=$1 OR is_global=true)
       ${attachmentType ? 'AND attachment_type=$2' : ''}
       ORDER BY is_global ASC, name`,
      attachmentType ? [orgId, attachmentType] : [orgId],
    );
    return rows.map(this.map);
  }

  async create(orgId: string, dto: {
    name: string; attachmentType?: string; toothTypes?: string[];
    geometry?: Record<string, unknown>; notes?: string;
  }): Promise<AttachmentTemplate> {
    const { rows } = await this.db.query(
      `INSERT INTO attachment_templates (organization_id, name, attachment_type, tooth_types, geometry, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, dto.name, dto.attachmentType ?? 'optimized',
       dto.toothTypes ?? [], JSON.stringify(dto.geometry ?? {}), dto.notes ?? null],
    );
    return this.map(rows[0]);
  }

  async update(id: string, orgId: string, dto: Partial<{ name: string; attachmentType: string; toothTypes: string[]; geometry: Record<string, unknown>; notes: string }>): Promise<AttachmentTemplate> {
    const { rows } = await this.db.query(
      `UPDATE attachment_templates SET
         name=COALESCE($3,name),
         attachment_type=COALESCE($4,attachment_type),
         tooth_types=COALESCE($5,tooth_types),
         geometry=COALESCE($6::jsonb,geometry),
         notes=COALESCE($7,notes)
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, dto.name ?? null, dto.attachmentType ?? null,
       dto.toothTypes ?? null, dto.geometry ? JSON.stringify(dto.geometry) : null, dto.notes ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Template not found');
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): AttachmentTemplate {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string | null,
      name: r['name'] as string, attachmentType: r['attachment_type'] as string,
      toothTypes: (r['tooth_types'] as string[]) ?? [],
      geometry: (r['geometry'] as Record<string, unknown>) ?? {},
      notes: r['notes'] as string | null, isGlobal: r['is_global'] as boolean,
      createdAt: String(r['created_at']),
    };
  }
}
