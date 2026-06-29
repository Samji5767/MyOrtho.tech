import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface OrgBranding {
  clinicName: string | null; logoUrl: string | null;
  primaryColor: string | null; secondaryColor: string | null; accentColor: string | null;
  customDomain: string | null; footerText: string | null; updatedAt: string;
}

@Injectable()
export class WhiteLabelService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async getBranding(orgId: string): Promise<OrgBranding | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM org_branding WHERE organization_id=$1', [orgId],
    );
    return rows[0] ? this.map(rows[0]) : null;
  }

  async updateBranding(orgId: string, updatedBy: string, dto: Partial<{
    clinicName: string; logoUrl: string; primaryColor: string;
    secondaryColor: string; accentColor: string; customDomain: string; footerText: string;
  }>): Promise<OrgBranding> {
    const { rows } = await this.db.query(
      `INSERT INTO org_branding (organization_id, clinic_name, logo_url, primary_color, secondary_color, accent_color, custom_domain, footer_text, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       ON CONFLICT (organization_id) DO UPDATE SET
         clinic_name = COALESCE($2, org_branding.clinic_name),
         logo_url = COALESCE($3, org_branding.logo_url),
         primary_color = COALESCE($4, org_branding.primary_color),
         secondary_color = COALESCE($5, org_branding.secondary_color),
         accent_color = COALESCE($6, org_branding.accent_color),
         custom_domain = COALESCE($7, org_branding.custom_domain),
         footer_text = COALESCE($8, org_branding.footer_text),
         updated_by = $9, updated_at = now()
       RETURNING *`,
      [orgId, dto.clinicName ?? null, dto.logoUrl ?? null, dto.primaryColor ?? null,
       dto.secondaryColor ?? null, dto.accentColor ?? null, dto.customDomain ?? null,
       dto.footerText ?? null, updatedBy],
    );
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): OrgBranding {
    return {
      clinicName: r['clinic_name'] as string | null, logoUrl: r['logo_url'] as string | null,
      primaryColor: r['primary_color'] as string | null, secondaryColor: r['secondary_color'] as string | null,
      accentColor: r['accent_color'] as string | null, customDomain: r['custom_domain'] as string | null,
      footerText: r['footer_text'] as string | null, updatedAt: String(r['updated_at']),
    };
  }
}
