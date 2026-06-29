import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface OrgLocation {
  id: string; organizationId: string; name: string; addressLine1: string | null;
  city: string | null; state: string | null; postalCode: string | null; country: string;
  phone: string | null; email: string | null; isPrimary: boolean; timezone: string;
  active: boolean; createdAt: string;
}

@Injectable()
export class OrgLocationsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, activeOnly = true): Promise<OrgLocation[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM org_locations WHERE organization_id=$1 ${activeOnly ? 'AND active=true' : ''} ORDER BY is_primary DESC, name`,
      [orgId],
    );
    return rows.map(this.map);
  }

  async create(orgId: string, dto: {
    name: string; addressLine1?: string; city?: string; state?: string;
    postalCode?: string; country?: string; phone?: string; email?: string;
    isPrimary?: boolean; timezone?: string;
  }): Promise<OrgLocation> {
    if (dto.isPrimary) {
      await this.db.query(`UPDATE org_locations SET is_primary=false WHERE organization_id=$1`, [orgId]);
    }
    const { rows } = await this.db.query(
      `INSERT INTO org_locations (organization_id, name, address_line1, city, state, postal_code, country, phone, email, is_primary, timezone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [orgId, dto.name, dto.addressLine1 ?? null, dto.city ?? null, dto.state ?? null,
       dto.postalCode ?? null, dto.country ?? 'US', dto.phone ?? null, dto.email ?? null,
       dto.isPrimary ?? false, dto.timezone ?? 'America/New_York'],
    );
    return this.map(rows[0]);
  }

  async update(id: string, orgId: string, dto: Partial<{ name: string; addressLine1: string; city: string; state: string; postalCode: string; phone: string; email: string; isPrimary: boolean; timezone: string; active: boolean }>): Promise<OrgLocation> {
    if (dto.isPrimary) {
      await this.db.query(`UPDATE org_locations SET is_primary=false WHERE organization_id=$1 AND id<>$2`, [orgId, id]);
    }
    const { rows } = await this.db.query(
      `UPDATE org_locations SET
         name=COALESCE($3,name), address_line1=COALESCE($4,address_line1),
         city=COALESCE($5,city), state=COALESCE($6,state), postal_code=COALESCE($7,postal_code),
         phone=COALESCE($8,phone), email=COALESCE($9,email),
         is_primary=COALESCE($10,is_primary), timezone=COALESCE($11,timezone),
         active=COALESCE($12,active)
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, dto.name ?? null, dto.addressLine1 ?? null, dto.city ?? null,
       dto.state ?? null, dto.postalCode ?? null, dto.phone ?? null, dto.email ?? null,
       dto.isPrimary ?? null, dto.timezone ?? null, dto.active ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Location not found');
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): OrgLocation {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      name: r['name'] as string, addressLine1: r['address_line1'] as string | null,
      city: r['city'] as string | null, state: r['state'] as string | null,
      postalCode: r['postal_code'] as string | null, country: r['country'] as string,
      phone: r['phone'] as string | null, email: r['email'] as string | null,
      isPrimary: r['is_primary'] as boolean, timezone: r['timezone'] as string,
      active: r['active'] as boolean, createdAt: String(r['created_at']),
    };
  }
}
