import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface CreateImplantPlacementDto {
  implantId?: string;
  toothNumber: string;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  pitchDeg?: number;
  rollDeg?: number;
  yawDeg?: number;
  boneDensity?: 'D1' | 'D2' | 'D3' | 'D4';
  notes?: string;
}

export interface CreateTadPlanDto {
  insertionSite: string;
  toothA: string;
  toothB?: string;
  angulationDeg?: number;
  depthMm?: number;
  boneThicknessMm?: number;
  safeCorridor?: Record<string, unknown>;
  rootCollisionRisk?: 'low' | 'moderate' | 'high';
  purpose?: string;
  notes?: string;
}

export interface CreateSurgicalGuideDto {
  guideType: 'implant' | 'tad' | 'osteotomy';
  sleeveDiameterMm?: number;
  guideThicknessMm?: number;
  ventHoles?: boolean;
  offsetMm?: number;
}

@Injectable()
export class SurgicalService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT c.id FROM cases c JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  // ── Implant Library ────────────────────────────────────────────────────────

  async listImplants(filters: { manufacturer?: string; minDiameter?: number; maxDiameter?: number } = {}) {
    let q = `SELECT id, manufacturer, system, sku, diameter_mm, length_mm,
                    neck_diameter_mm, thread_pitch_mm, material, connection_type, catalog_year
             FROM implants WHERE is_active = true`;
    const params: unknown[] = [];
    if (filters.manufacturer) { params.push(filters.manufacturer); q += ` AND manufacturer ILIKE $${params.length}`; }
    if (filters.minDiameter != null) { params.push(filters.minDiameter); q += ` AND diameter_mm >= $${params.length}`; }
    if (filters.maxDiameter != null) { params.push(filters.maxDiameter); q += ` AND diameter_mm <= $${params.length}`; }
    q += ' ORDER BY manufacturer, diameter_mm';
    const { rows } = await this.pool.query(q, params);
    return rows.map(this.formatImplant);
  }

  // ── Implant Placements ─────────────────────────────────────────────────────

  async listPlacements(caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT ip.id, ip.tooth_number, ip.position_x, ip.position_y, ip.position_z,
              ip.pitch_deg, ip.roll_deg, ip.yaw_deg, ip.bone_density, ip.safety_status,
              ip.notes, ip.created_at, ip.updated_at,
              i.manufacturer, i.system, i.diameter_mm, i.length_mm, i.connection_type,
              au.email as planned_by_email
       FROM implant_placements ip
       LEFT JOIN implants i ON i.id = ip.implant_id
       LEFT JOIN auth_users au ON au.id = ip.planned_by
       WHERE ip.case_id = $1 ORDER BY ip.created_at`,
      [caseId],
    );
    return rows.map(this.formatPlacement);
  }

  async createPlacement(caseId: string, orgId: string, userId: string, dto: CreateImplantPlacementDto) {
    await this.verifyCase(caseId, orgId);
    if (dto.implantId) {
      const { rows } = await this.pool.query(`SELECT id FROM implants WHERE id = $1 AND is_active = true`, [dto.implantId]);
      if (!rows[0]) throw new BadRequestException('Implant not found in library');
    }
    const safetyStatus = this.computeSafetyStatus(dto.pitchDeg, dto.rollDeg);
    const { rows } = await this.pool.query(
      `INSERT INTO implant_placements
         (case_id, implant_id, tooth_number, position_x, position_y, position_z,
          pitch_deg, roll_deg, yaw_deg, bone_density, safety_status, notes, planned_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [caseId, dto.implantId ?? null, dto.toothNumber, dto.positionX ?? null, dto.positionY ?? null,
       dto.positionZ ?? null, dto.pitchDeg ?? null, dto.rollDeg ?? null, dto.yawDeg ?? null,
       dto.boneDensity ?? null, safetyStatus, dto.notes ?? null, userId],
    );
    return this.formatPlacement(rows[0]);
  }

  async updatePlacement(id: string, caseId: string, orgId: string, dto: Partial<CreateImplantPlacementDto>) {
    await this.verifyCase(caseId, orgId);
    const safetyStatus = this.computeSafetyStatus(dto.pitchDeg, dto.rollDeg);
    const { rows } = await this.pool.query(
      `UPDATE implant_placements SET
         implant_id       = COALESCE($3, implant_id),
         tooth_number     = COALESCE($4, tooth_number),
         position_x       = COALESCE($5, position_x),
         position_y       = COALESCE($6, position_y),
         position_z       = COALESCE($7, position_z),
         pitch_deg        = COALESCE($8, pitch_deg),
         roll_deg         = COALESCE($9, roll_deg),
         yaw_deg          = COALESCE($10, yaw_deg),
         bone_density     = COALESCE($11, bone_density),
         safety_status    = $12,
         notes            = COALESCE($13, notes),
         updated_at       = now()
       WHERE id = $1 AND case_id = $2 RETURNING *`,
      [id, caseId, dto.implantId ?? null, dto.toothNumber ?? null,
       dto.positionX ?? null, dto.positionY ?? null, dto.positionZ ?? null,
       dto.pitchDeg ?? null, dto.rollDeg ?? null, dto.yawDeg ?? null,
       dto.boneDensity ?? null, safetyStatus, dto.notes ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Placement not found');
    return this.formatPlacement(rows[0]);
  }

  async deletePlacement(id: string, caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    await this.pool.query(`DELETE FROM implant_placements WHERE id = $1 AND case_id = $2`, [id, caseId]);
  }

  // ── TAD Plans ──────────────────────────────────────────────────────────────

  async listTadPlans(caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT tp.id, tp.insertion_site, tp.tooth_a, tp.tooth_b, tp.angulation_deg,
              tp.depth_mm, tp.bone_thickness_mm, tp.safe_corridor, tp.root_collision_risk,
              tp.purpose, tp.notes, tp.created_at, au.email as planned_by_email
       FROM tad_plans tp LEFT JOIN auth_users au ON au.id = tp.planned_by
       WHERE tp.case_id = $1 ORDER BY tp.created_at`,
      [caseId],
    );
    return rows.map(this.formatTad);
  }

  async createTadPlan(caseId: string, orgId: string, userId: string, dto: CreateTadPlanDto) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `INSERT INTO tad_plans
         (case_id, insertion_site, tooth_a, tooth_b, angulation_deg, depth_mm,
          bone_thickness_mm, safe_corridor, root_collision_risk, purpose, notes, planned_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [caseId, dto.insertionSite, dto.toothA, dto.toothB ?? null, dto.angulationDeg ?? null,
       dto.depthMm ?? null, dto.boneThicknessMm ?? null, JSON.stringify(dto.safeCorridor ?? {}),
       dto.rootCollisionRisk ?? 'low', dto.purpose ?? null, dto.notes ?? null, userId],
    );
    return this.formatTad(rows[0]);
  }

  async deleteTadPlan(id: string, caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    await this.pool.query(`DELETE FROM tad_plans WHERE id = $1 AND case_id = $2`, [id, caseId]);
  }

  // ── Surgical Guides ────────────────────────────────────────────────────────

  async listGuides(caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT sg.id, sg.guide_type, sg.sleeve_diameter_mm, sg.guide_thickness_mm,
              sg.vent_holes, sg.offset_mm, sg.stl_path, sg.export_status, sg.exported_at,
              sg.created_at, au.email as designed_by_email
       FROM surgical_guides sg LEFT JOIN auth_users au ON au.id = sg.designed_by
       WHERE sg.case_id = $1 ORDER BY sg.created_at`,
      [caseId],
    );
    return rows.map(this.formatGuide);
  }

  async createGuide(caseId: string, orgId: string, userId: string, dto: CreateSurgicalGuideDto) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `INSERT INTO surgical_guides
         (case_id, guide_type, sleeve_diameter_mm, guide_thickness_mm, vent_holes, offset_mm, designed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [caseId, dto.guideType, dto.sleeveDiameterMm ?? null, dto.guideThicknessMm ?? 2.0,
       dto.ventHoles ?? false, dto.offsetMm ?? 0.0, userId],
    );
    return this.formatGuide(rows[0]);
  }

  async markGuideExported(id: string, caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `UPDATE surgical_guides SET export_status = 'exported', exported_at = now(), updated_at = now()
       WHERE id = $1 AND case_id = $2 RETURNING *`,
      [id, caseId],
    );
    if (!rows[0]) throw new NotFoundException('Guide not found');
    return this.formatGuide(rows[0]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private computeSafetyStatus(pitchDeg?: number, rollDeg?: number): 'safe' | 'warning' | 'collision' {
    const p = Math.abs(pitchDeg ?? 0);
    const r = Math.abs(rollDeg ?? 0);
    if (p > 20 || r > 20) return 'collision';
    if (p > 12 || r > 12) return 'warning';
    return 'safe';
  }

  private formatImplant(r: Record<string, unknown>) {
    return {
      id: r.id, manufacturer: r.manufacturer, system: r.system, sku: r.sku,
      diameterMm: r.diameter_mm != null ? Number(r.diameter_mm) : null,
      lengthMm: r.length_mm != null ? Number(r.length_mm) : null,
      neckDiameterMm: r.neck_diameter_mm != null ? Number(r.neck_diameter_mm) : null,
      material: r.material, connectionType: r.connection_type, catalogYear: r.catalog_year,
    };
  }

  private formatPlacement(r: Record<string, unknown>) {
    return {
      id: r.id, toothNumber: r.tooth_number,
      positionX: r.position_x != null ? Number(r.position_x) : null,
      positionY: r.position_y != null ? Number(r.position_y) : null,
      positionZ: r.position_z != null ? Number(r.position_z) : null,
      pitchDeg: r.pitch_deg != null ? Number(r.pitch_deg) : null,
      rollDeg: r.roll_deg != null ? Number(r.roll_deg) : null,
      yawDeg: r.yaw_deg != null ? Number(r.yaw_deg) : null,
      boneDensity: r.bone_density, safetyStatus: r.safety_status, notes: r.notes,
      implant: r.manufacturer ? { manufacturer: r.manufacturer, system: r.system, diameterMm: Number(r.diameter_mm), lengthMm: Number(r.length_mm) } : null,
      plannedByEmail: r.planned_by_email,
      createdAt: (r.created_at as Date).toISOString(),
      updatedAt: r.updated_at ? (r.updated_at as Date).toISOString() : null,
    };
  }

  private formatTad(r: Record<string, unknown>) {
    return {
      id: r.id, insertionSite: r.insertion_site, toothA: r.tooth_a, toothB: r.tooth_b,
      angulationDeg: r.angulation_deg != null ? Number(r.angulation_deg) : null,
      depthMm: r.depth_mm != null ? Number(r.depth_mm) : null,
      boneThicknessMm: r.bone_thickness_mm != null ? Number(r.bone_thickness_mm) : null,
      safeCorridor: r.safe_corridor ?? {},
      rootCollisionRisk: r.root_collision_risk, purpose: r.purpose, notes: r.notes,
      plannedByEmail: r.planned_by_email,
      createdAt: (r.created_at as Date).toISOString(),
    };
  }

  private formatGuide(r: Record<string, unknown>) {
    return {
      id: r.id, guideType: r.guide_type,
      sleeveDiameterMm: r.sleeve_diameter_mm != null ? Number(r.sleeve_diameter_mm) : null,
      guideThicknessMm: Number(r.guide_thickness_mm ?? 2.0),
      ventHoles: Boolean(r.vent_holes),
      offsetMm: Number(r.offset_mm ?? 0),
      stlPath: r.stl_path, exportStatus: r.export_status,
      exportedAt: r.exported_at ? (r.exported_at as Date).toISOString() : null,
      designedByEmail: r.designed_by_email,
      createdAt: (r.created_at as Date).toISOString(),
    };
  }
}
