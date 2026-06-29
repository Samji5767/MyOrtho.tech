import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface EmergencyProtocol {
  id: string; organizationId: string; protocolName: string; category: string;
  steps: unknown[]; lastReviewed: string | null; reviewedBy: string | null;
  createdAt: string; updatedAt: string;
}

@Injectable()
export class EmergencyProtocolsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, category?: string): Promise<EmergencyProtocol[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM emergency_protocols WHERE organization_id=$1 ${category ? 'AND category=$2' : ''} ORDER BY category, protocol_name`,
      category ? [orgId, category] : [orgId],
    );
    return rows.map(this.map);
  }

  async create(orgId: string, dto: { protocolName: string; category?: string; steps?: unknown[] }): Promise<EmergencyProtocol> {
    const { rows } = await this.db.query(
      `INSERT INTO emergency_protocols (organization_id, protocol_name, category, steps)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [orgId, dto.protocolName, dto.category ?? 'medical', JSON.stringify(dto.steps ?? [])],
    );
    return this.map(rows[0]);
  }

  async update(id: string, orgId: string, dto: Partial<{ protocolName: string; category: string; steps: unknown[] }>): Promise<EmergencyProtocol> {
    const { rows } = await this.db.query(
      `UPDATE emergency_protocols SET
         protocol_name=COALESCE($3,protocol_name),
         category=COALESCE($4,category),
         steps=COALESCE($5::jsonb,steps),
         updated_at=now()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, dto.protocolName ?? null, dto.category ?? null,
       dto.steps ? JSON.stringify(dto.steps) : null],
    );
    if (!rows[0]) throw new NotFoundException('Protocol not found');
    return this.map(rows[0]);
  }

  async markReviewed(id: string, orgId: string, reviewedBy: string): Promise<EmergencyProtocol> {
    const { rows } = await this.db.query(
      `UPDATE emergency_protocols SET last_reviewed=CURRENT_DATE, reviewed_by=$3, updated_at=now()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, reviewedBy],
    );
    if (!rows[0]) throw new NotFoundException('Protocol not found');
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): EmergencyProtocol {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      protocolName: r['protocol_name'] as string, category: r['category'] as string,
      steps: (r['steps'] as unknown[]) ?? [],
      lastReviewed: r['last_reviewed'] ? String(r['last_reviewed']) : null,
      reviewedBy: r['reviewed_by'] as string | null,
      createdAt: String(r['created_at']), updatedAt: String(r['updated_at']),
    };
  }
}
