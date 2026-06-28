import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface CephMeasurements {
  snaDeg?: number;
  snbDeg?: number;
  anbDeg?: number;
  witsMm?: number;
  fmaDeg?: number;
  impaDeg?: number;
  fmiaDeg?: number;
  uiSnDeg?: number;
  liMpDeg?: number;
  interincisalDeg?: number;
  facialAxisDeg?: number;
  gonialAngleDeg?: number;
  pgNaMm?: number;
  softTissue?: Record<string, number>;
}

export interface CreateCephDto extends CephMeasurements {
  imagePath?: string;
  landmarks?: Record<string, { x: number; y: number }>;
  aiNotes?: string;
  createdBy: string;
}

export interface CephAnalysis {
  id: string;
  caseId: string;
  imagePath: string | null;
  landmarks: Record<string, { x: number; y: number }>;
  measurements: CephMeasurements;
  skeletalClass: 'I' | 'II' | 'III' | null;
  verticalPattern: 'hypodivergent' | 'normodivergent' | 'hyperdivergent' | null;
  growthPattern: 'horizontal' | 'average' | 'vertical' | null;
  aiNotes: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

function classify(m: CephMeasurements): {
  skeletalClass: CephAnalysis['skeletalClass'];
  verticalPattern: CephAnalysis['verticalPattern'];
  growthPattern: CephAnalysis['growthPattern'];
} {
  let skeletalClass: CephAnalysis['skeletalClass'] = null;
  if (m.anbDeg != null) {
    if (m.anbDeg >= 0 && m.anbDeg <= 4) skeletalClass = 'I';
    else if (m.anbDeg > 4) skeletalClass = 'II';
    else skeletalClass = 'III';
  }

  let verticalPattern: CephAnalysis['verticalPattern'] = null;
  if (m.fmaDeg != null) {
    if (m.fmaDeg < 22) verticalPattern = 'hypodivergent';
    else if (m.fmaDeg > 28) verticalPattern = 'hyperdivergent';
    else verticalPattern = 'normodivergent';
  }

  let growthPattern: CephAnalysis['growthPattern'] = null;
  if (m.facialAxisDeg != null) {
    if (m.facialAxisDeg > 92) growthPattern = 'horizontal';
    else if (m.facialAxisDeg < 88) growthPattern = 'vertical';
    else growthPattern = 'average';
  }

  return { skeletalClass, verticalPattern, growthPattern };
}

@Injectable()
export class CephService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async verifyCase(caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT id FROM cases WHERE id = $1 AND organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows.length) throw new ForbiddenException('Case not found or access denied');
  }

  async list(caseId: string, orgId: string): Promise<CephAnalysis[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT ca.*, u.email AS created_by_email
       FROM cephalometric_analyses ca
       LEFT JOIN auth_users u ON u.id = ca.created_by
       WHERE ca.case_id = $1
       ORDER BY ca.created_at DESC`,
      [caseId],
    );
    return rows.map(this.format);
  }

  async create(caseId: string, orgId: string, dto: CreateCephDto): Promise<CephAnalysis> {
    await this.verifyCase(caseId, orgId);

    const m: CephMeasurements = {
      snaDeg: dto.snaDeg,
      snbDeg: dto.snbDeg,
      anbDeg: dto.anbDeg,
      witsMm: dto.witsMm,
      fmaDeg: dto.fmaDeg,
      impaDeg: dto.impaDeg,
      fmiaDeg: dto.fmiaDeg,
      uiSnDeg: dto.uiSnDeg,
      liMpDeg: dto.liMpDeg,
      interincisalDeg: dto.interincisalDeg,
      facialAxisDeg: dto.facialAxisDeg,
      gonialAngleDeg: dto.gonialAngleDeg,
      pgNaMm: dto.pgNaMm,
      softTissue: dto.softTissue,
    };
    const { skeletalClass, verticalPattern, growthPattern } = classify(m);

    const { rows } = await this.pool.query(
      `INSERT INTO cephalometric_analyses
         (case_id, organization_id, image_path, landmarks,
          sna_deg, snb_deg, anb_deg, wits_mm, fma_deg, impa_deg, fmia_deg,
          ui_sn_deg, li_mp_deg, interincisal_deg, facial_axis_deg,
          gonial_angle_deg, pg_na_mm, soft_tissue,
          skeletal_class, vertical_pattern, growth_pattern, ai_notes,
          created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
               (SELECT id FROM auth_users WHERE id::text=$23 OR email=$23 LIMIT 1))
       RETURNING *,
         (SELECT email FROM auth_users WHERE id = created_by) AS created_by_email`,
      [
        caseId, orgId,
        dto.imagePath ?? null,
        JSON.stringify(dto.landmarks ?? {}),
        dto.snaDeg ?? null, dto.snbDeg ?? null, dto.anbDeg ?? null, dto.witsMm ?? null,
        dto.fmaDeg ?? null, dto.impaDeg ?? null, dto.fmiaDeg ?? null,
        dto.uiSnDeg ?? null, dto.liMpDeg ?? null, dto.interincisalDeg ?? null,
        dto.facialAxisDeg ?? null, dto.gonialAngleDeg ?? null, dto.pgNaMm ?? null,
        JSON.stringify(dto.softTissue ?? {}),
        skeletalClass, verticalPattern, growthPattern,
        dto.aiNotes ?? null,
        dto.createdBy,
      ],
    );
    return this.format(rows[0]);
  }

  async findOne(caseId: string, orgId: string, id: string): Promise<CephAnalysis> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT ca.*, u.email AS created_by_email
       FROM cephalometric_analyses ca
       LEFT JOIN auth_users u ON u.id = ca.created_by
       WHERE ca.id = $1 AND ca.case_id = $2`,
      [id, caseId],
    );
    if (!rows.length) throw new NotFoundException('Cephalometric analysis not found');
    return this.format(rows[0]);
  }

  async delete(caseId: string, orgId: string, id: string): Promise<void> {
    await this.verifyCase(caseId, orgId);
    const { rowCount } = await this.pool.query(
      `DELETE FROM cephalometric_analyses WHERE id = $1 AND case_id = $2`,
      [id, caseId],
    );
    if (!rowCount) throw new NotFoundException('Cephalometric analysis not found');
  }

  private format(row: any): CephAnalysis {
    return {
      id: row.id,
      caseId: row.case_id,
      imagePath: row.image_path ?? null,
      landmarks: row.landmarks ?? {},
      measurements: {
        snaDeg: row.sna_deg ?? undefined,
        snbDeg: row.snb_deg ?? undefined,
        anbDeg: row.anb_deg ?? undefined,
        witsMm: row.wits_mm ?? undefined,
        fmaDeg: row.fma_deg ?? undefined,
        impaDeg: row.impa_deg ?? undefined,
        fmiaDeg: row.fmia_deg ?? undefined,
        uiSnDeg: row.ui_sn_deg ?? undefined,
        liMpDeg: row.li_mp_deg ?? undefined,
        interincisalDeg: row.interincisal_deg ?? undefined,
        facialAxisDeg: row.facial_axis_deg ?? undefined,
        gonialAngleDeg: row.gonial_angle_deg ?? undefined,
        pgNaMm: row.pg_na_mm ?? undefined,
        softTissue: row.soft_tissue ?? undefined,
      },
      skeletalClass: row.skeletal_class ?? null,
      verticalPattern: row.vertical_pattern ?? null,
      growthPattern: row.growth_pattern ?? null,
      aiNotes: row.ai_notes ?? null,
      createdByEmail: row.created_by_email ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
