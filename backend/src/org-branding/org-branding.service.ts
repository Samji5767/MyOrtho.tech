import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface OrgBranding {
  organization_id: string;
  clinic_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  custom_domain: string | null;
  footer_text: string | null;
  updated_at: string;
}

@Injectable()
export class OrgBrandingService {
  private readonly logger = new Logger(OrgBrandingService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getBranding(orgId: string): Promise<OrgBranding | null> {
    const rows = await (async () => {
      try {
        const { rows } = await this.pool.query<OrgBranding>(
          `SELECT ob.*, o.name AS clinic_name_fallback
           FROM org_branding ob
           RIGHT JOIN organizations o ON o.id = ob.organization_id
           WHERE o.id = $1`,
          [orgId],
        );
        return rows;
      } catch { return [] as OrgBranding[]; }
    })();

    if (!rows[0]) {
      // Return defaults from org name if branding row doesn't exist
      const orgRows = await (async () => {
        try {
          const { rows } = await this.pool.query(
            `SELECT id, name FROM organizations WHERE id = $1`,
            [orgId],
          );
          return rows;
        } catch { return []; }
      })();

      if (!orgRows[0]) return null;

      return {
        organization_id: orgRows[0].id,
        clinic_name: orgRows[0].name,
        logo_url: null,
        primary_color: '#0F9F8F',
        secondary_color: '#1a1f2e',
        accent_color: '#f59e0b',
        custom_domain: null,
        footer_text: null,
        updated_at: new Date().toISOString(),
      };
    }

    return {
      ...rows[0],
      clinic_name: rows[0].clinic_name ?? (rows[0] as any).clinic_name_fallback,
    };
  }

  async updateBranding(orgId: string, updatedBy: string, data: Partial<OrgBranding>): Promise<OrgBranding> {
    const allowed = ['clinic_name', 'logo_url', 'primary_color', 'secondary_color', 'accent_color', 'custom_domain', 'footer_text'];
    const fields = Object.entries(data).filter(([k]) => allowed.includes(k) && data[k as keyof OrgBranding] !== undefined);

    if (fields.length === 0) {
      return (await this.getBranding(orgId))!;
    }

    const setClauses = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ');
    const values = fields.map(([, v]) => v);

    await this.pool.query(
      `INSERT INTO org_branding (organization_id, updated_by, updated_at, ${fields.map(([k]) => k).join(', ')})
       VALUES ($1, $2, now(), ${fields.map((_, i) => `$${i + 3}`).join(', ')})
       ON CONFLICT (organization_id)
       DO UPDATE SET updated_by = $2, updated_at = now(), ${setClauses}`,
      [orgId, updatedBy, ...values],
    );

    // If clinic_name is changing, also update organizations.name
    if (data.clinic_name) {
      try {
        await this.pool.query(
          `UPDATE organizations SET name = $1, updated_at = now() WHERE id = $2`,
          [data.clinic_name, orgId],
        );
      } catch { /* best-effort */ }
    }

    return (await this.getBranding(orgId))!;
  }

  async getBrandingByDomain(domain: string): Promise<OrgBranding | null> {
    try {
      const { rows } = await this.pool.query<OrgBranding>(
        `SELECT * FROM org_branding WHERE custom_domain = $1 LIMIT 1`,
        [domain],
      );
      return rows[0] ?? null;
    } catch { return null; }
  }
}
