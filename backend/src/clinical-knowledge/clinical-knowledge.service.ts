import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ClinicalProtocol {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  clinicalArea: string;
  evidenceLevel: string;
  status: string;
  contentJson: Record<string, unknown>;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialLibrary {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  manufacturer: string | null;
  sku: string | null;
  propertiesJson: Record<string, unknown>;
  compatiblePrinters: string[];
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManufacturingProfile {
  id: string;
  organizationId: string;
  name: string;
  printerModel: string | null;
  resinMaterial: string | null;
  layerHeightMm: number | null;
  exposureMs: number | null;
  supportsJson: Record<string, unknown>;
  postCureJson: Record<string, unknown>;
  isDefault: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const VALID_AREAS = ['orthodontics', 'restorative', 'surgical', 'pediatric', 'general'];
const VALID_EVIDENCE = ['A', 'B', 'C'];
const VALID_PROTOCOL_STATUS = ['draft', 'active', 'archived'];
const VALID_MATERIAL_CATEGORIES = ['resin', 'wire', 'bracket', 'composite', 'adhesive', 'other'];

@Injectable()
export class ClinicalKnowledgeService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  // ─── Protocols ───────────────────────────────────────────────────────────────

  async listProtocols(orgId: string, area?: string, status?: string): Promise<ClinicalProtocol[]> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [orgId];
    if (area) { params.push(area); conditions.push(`clinical_area = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    const { rows } = await this.db.query(
      `SELECT * FROM clinical_protocols WHERE ${conditions.join(' AND ')} ORDER BY clinical_area, code`,
      params,
    );
    return rows.map(this.mapProtocol);
  }

  async getProtocol(id: string, orgId: string): Promise<ClinicalProtocol> {
    const { rows } = await this.db.query(
      `SELECT * FROM clinical_protocols WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Protocol not found');
    return this.mapProtocol(rows[0]);
  }

  async createProtocol(
    orgId: string,
    createdBy: string,
    dto: {
      code: string;
      title: string;
      clinicalArea: string;
      evidenceLevel?: string;
      contentJson?: Record<string, unknown>;
    },
  ): Promise<ClinicalProtocol> {
    if (!VALID_AREAS.includes(dto.clinicalArea)) {
      throw new BadRequestException(`Invalid clinical area. Valid: ${VALID_AREAS.join(', ')}`);
    }
    if (dto.evidenceLevel && !VALID_EVIDENCE.includes(dto.evidenceLevel)) {
      throw new BadRequestException(`Invalid evidence level. Valid: ${VALID_EVIDENCE.join(', ')}`);
    }
    const { rows } = await this.db.query(
      `INSERT INTO clinical_protocols
         (organization_id, code, title, clinical_area, evidence_level, content_json, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        orgId, dto.code, dto.title, dto.clinicalArea,
        dto.evidenceLevel ?? 'C',
        JSON.stringify(dto.contentJson ?? {}),
        createdBy,
      ],
    );
    return this.mapProtocol(rows[0]);
  }

  async updateProtocolStatus(
    id: string,
    orgId: string,
    status: string,
  ): Promise<ClinicalProtocol> {
    if (!VALID_PROTOCOL_STATUS.includes(status)) {
      throw new BadRequestException(`Invalid status. Valid: ${VALID_PROTOCOL_STATUS.join(', ')}`);
    }
    const { rows } = await this.db.query(
      `UPDATE clinical_protocols SET status = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [id, orgId, status],
    );
    if (!rows[0]) throw new NotFoundException('Protocol not found');
    return this.mapProtocol(rows[0]);
  }

  // ─── Material Libraries ───────────────────────────────────────────────────────

  async listMaterials(orgId: string, category?: string): Promise<MaterialLibrary[]> {
    const hasCategory = category != null && category !== '';
    const { rows } = await this.db.query(
      `SELECT * FROM material_libraries
       WHERE organization_id = $1 ${hasCategory ? 'AND category = $2' : ''}
       ORDER BY category, name`,
      hasCategory ? [orgId, category] : [orgId],
    );
    return rows.map(this.mapMaterial);
  }

  async createMaterial(
    orgId: string,
    createdBy: string,
    dto: {
      name: string;
      category: string;
      manufacturer?: string;
      sku?: string;
      propertiesJson?: Record<string, unknown>;
      compatiblePrinters?: string[];
    },
  ): Promise<MaterialLibrary> {
    if (!VALID_MATERIAL_CATEGORIES.includes(dto.category)) {
      throw new BadRequestException(`Invalid category. Valid: ${VALID_MATERIAL_CATEGORIES.join(', ')}`);
    }
    const { rows } = await this.db.query(
      `INSERT INTO material_libraries
         (organization_id, name, category, manufacturer, sku, properties_json, compatible_printers, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        orgId, dto.name, dto.category,
        dto.manufacturer ?? null,
        dto.sku ?? null,
        JSON.stringify(dto.propertiesJson ?? {}),
        dto.compatiblePrinters ?? [],
        createdBy,
      ],
    );
    return this.mapMaterial(rows[0]);
  }

  // ─── Manufacturing Profiles ───────────────────────────────────────────────────

  async listProfiles(orgId: string): Promise<ManufacturingProfile[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM manufacturing_profiles WHERE organization_id = $1 ORDER BY is_default DESC, name`,
      [orgId],
    );
    return rows.map(this.mapProfile);
  }

  async createProfile(
    orgId: string,
    createdBy: string,
    dto: {
      name: string;
      printerModel?: string;
      resinMaterial?: string;
      layerHeightMm?: number;
      exposureMs?: number;
      supportsJson?: Record<string, unknown>;
      postCureJson?: Record<string, unknown>;
      isDefault?: boolean;
    },
  ): Promise<ManufacturingProfile> {
    if (dto.isDefault) {
      await this.db.query(
        `UPDATE manufacturing_profiles SET is_default = FALSE WHERE organization_id = $1`,
        [orgId],
      );
    }
    const { rows } = await this.db.query(
      `INSERT INTO manufacturing_profiles
         (organization_id, name, printer_model, resin_material, layer_height_mm,
          exposure_ms, supports_json, post_cure_json, is_default, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        orgId, dto.name,
        dto.printerModel ?? null,
        dto.resinMaterial ?? null,
        dto.layerHeightMm ?? null,
        dto.exposureMs ?? null,
        JSON.stringify(dto.supportsJson ?? {}),
        JSON.stringify(dto.postCureJson ?? {}),
        dto.isDefault ?? false,
        createdBy,
      ],
    );
    return this.mapProfile(rows[0]);
  }

  private mapProtocol(r: Record<string, unknown>): ClinicalProtocol {
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      code: r['code'] as string,
      title: r['title'] as string,
      clinicalArea: r['clinical_area'] as string,
      evidenceLevel: r['evidence_level'] as string,
      status: r['status'] as string,
      contentJson: (r['content_json'] as Record<string, unknown>) ?? {},
      version: Number(r['version']),
      createdBy: r['created_by'] as string,
      createdAt: String(r['created_at']),
      updatedAt: String(r['updated_at']),
    };
  }

  private mapMaterial(r: Record<string, unknown>): MaterialLibrary {
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      name: r['name'] as string,
      category: r['category'] as string,
      manufacturer: (r['manufacturer'] as string | null) ?? null,
      sku: (r['sku'] as string | null) ?? null,
      propertiesJson: (r['properties_json'] as Record<string, unknown>) ?? {},
      compatiblePrinters: (r['compatible_printers'] as string[]) ?? [],
      status: r['status'] as string,
      createdBy: r['created_by'] as string,
      createdAt: String(r['created_at']),
      updatedAt: String(r['updated_at']),
    };
  }

  private mapProfile(r: Record<string, unknown>): ManufacturingProfile {
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      name: r['name'] as string,
      printerModel: (r['printer_model'] as string | null) ?? null,
      resinMaterial: (r['resin_material'] as string | null) ?? null,
      layerHeightMm: r['layer_height_mm'] != null ? Number(r['layer_height_mm']) : null,
      exposureMs: r['exposure_ms'] != null ? Number(r['exposure_ms']) : null,
      supportsJson: (r['supports_json'] as Record<string, unknown>) ?? {},
      postCureJson: (r['post_cure_json'] as Record<string, unknown>) ?? {},
      isDefault: Boolean(r['is_default']),
      isActive: Boolean(r['is_active']),
      createdBy: r['created_by'] as string,
      createdAt: String(r['created_at']),
      updatedAt: String(r['updated_at']),
    };
  }
}
