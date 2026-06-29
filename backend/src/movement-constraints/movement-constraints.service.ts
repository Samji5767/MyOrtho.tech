import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface MovementConstraint {
  id: string; organizationId: string | null; name: string;
  maxTranslationMm: number; maxRotationDeg: number; maxTorqueDeg: number;
  maxTipDeg: number; maxIntrusionMm: number; maxExtrusionMm: number;
  isDefault: boolean; createdAt: string;
}

@Injectable()
export class MovementConstraintsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string): Promise<MovementConstraint[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM movement_constraints WHERE organization_id=$1 OR is_default=true ORDER BY is_default DESC, name`,
      [orgId],
    );
    return rows.map(this.map);
  }

  async create(orgId: string, dto: {
    name: string; maxTranslationMm?: number; maxRotationDeg?: number; maxTorqueDeg?: number;
    maxTipDeg?: number; maxIntrusionMm?: number; maxExtrusionMm?: number;
  }): Promise<MovementConstraint> {
    const { rows } = await this.db.query(
      `INSERT INTO movement_constraints
         (organization_id, name, max_translation_mm, max_rotation_deg, max_torque_deg, max_tip_deg, max_intrusion_mm, max_extrusion_mm)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, dto.name, dto.maxTranslationMm ?? 0.30, dto.maxRotationDeg ?? 3.0,
       dto.maxTorqueDeg ?? 3.5, dto.maxTipDeg ?? 4.0, dto.maxIntrusionMm ?? 0.40, dto.maxExtrusionMm ?? 0.75],
    );
    return this.map(rows[0]);
  }

  async update(id: string, orgId: string, dto: Partial<{
    name: string; maxTranslationMm: number; maxRotationDeg: number; maxTorqueDeg: number;
    maxTipDeg: number; maxIntrusionMm: number; maxExtrusionMm: number;
  }>): Promise<MovementConstraint> {
    const { rows } = await this.db.query(
      `UPDATE movement_constraints SET
         name=COALESCE($3,name),
         max_translation_mm=COALESCE($4,max_translation_mm),
         max_rotation_deg=COALESCE($5,max_rotation_deg),
         max_torque_deg=COALESCE($6,max_torque_deg),
         max_tip_deg=COALESCE($7,max_tip_deg),
         max_intrusion_mm=COALESCE($8,max_intrusion_mm),
         max_extrusion_mm=COALESCE($9,max_extrusion_mm)
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, dto.name ?? null, dto.maxTranslationMm ?? null, dto.maxRotationDeg ?? null,
       dto.maxTorqueDeg ?? null, dto.maxTipDeg ?? null, dto.maxIntrusionMm ?? null, dto.maxExtrusionMm ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Constraint not found');
    return this.map(rows[0]);
  }

  async validate(orgId: string, constraintId: string, movement: {
    translationMm?: number; rotationDeg?: number; torqueDeg?: number;
    tipDeg?: number; intrusionMm?: number; extrusionMm?: number;
  }): Promise<{ valid: boolean; violations: string[] }> {
    const { rows } = await this.db.query(
      `SELECT * FROM movement_constraints WHERE id=$1 AND (organization_id=$2 OR is_default=true)`,
      [constraintId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Constraint not found');
    const c = this.map(rows[0]);
    const violations: string[] = [];
    if (movement.translationMm !== undefined && movement.translationMm > c.maxTranslationMm)
      violations.push(`Translation ${movement.translationMm}mm exceeds max ${c.maxTranslationMm}mm`);
    if (movement.rotationDeg !== undefined && movement.rotationDeg > c.maxRotationDeg)
      violations.push(`Rotation ${movement.rotationDeg}° exceeds max ${c.maxRotationDeg}°`);
    if (movement.torqueDeg !== undefined && movement.torqueDeg > c.maxTorqueDeg)
      violations.push(`Torque ${movement.torqueDeg}° exceeds max ${c.maxTorqueDeg}°`);
    if (movement.tipDeg !== undefined && movement.tipDeg > c.maxTipDeg)
      violations.push(`Tip ${movement.tipDeg}° exceeds max ${c.maxTipDeg}°`);
    if (movement.intrusionMm !== undefined && movement.intrusionMm > c.maxIntrusionMm)
      violations.push(`Intrusion ${movement.intrusionMm}mm exceeds max ${c.maxIntrusionMm}mm`);
    if (movement.extrusionMm !== undefined && movement.extrusionMm > c.maxExtrusionMm)
      violations.push(`Extrusion ${movement.extrusionMm}mm exceeds max ${c.maxExtrusionMm}mm`);
    return { valid: violations.length === 0, violations };
  }

  private map(r: Record<string, unknown>): MovementConstraint {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string | null,
      name: r['name'] as string,
      maxTranslationMm: parseFloat(String(r['max_translation_mm'])),
      maxRotationDeg: parseFloat(String(r['max_rotation_deg'])),
      maxTorqueDeg: parseFloat(String(r['max_torque_deg'])),
      maxTipDeg: parseFloat(String(r['max_tip_deg'])),
      maxIntrusionMm: parseFloat(String(r['max_intrusion_mm'])),
      maxExtrusionMm: parseFloat(String(r['max_extrusion_mm'])),
      isDefault: r['is_default'] as boolean, createdAt: String(r['created_at']),
    };
  }
}
