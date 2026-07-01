import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AlignerDesign {
  id: string;
  organizationId: string;
  digitalSetupId: string;
  stageId: string | null;
  archType: string | null;
  alignerNumber: number | null;
  trimlineData: unknown;
  thicknessMm: number;
  hasRelief: boolean;
  attachmentWindows: unknown[];
  pressureAreas: unknown[];
  label: string | null;
  exportReady: boolean;
  createdAt: Date;
}

export interface UpdateAlignerDto {
  trimlineData?: unknown;
  thicknessMm?: number;
  hasRelief?: boolean;
  attachmentWindows?: unknown[];
  pressureAreas?: unknown[];
  label?: string;
}

export interface ManufacturingPackage {
  setupId: string;
  totalAligners: number;
  totalStages: number;
  upperAligners: number;
  lowerAligners: number;
  exportManifest: Array<{
    label: string;
    alignerNumber: number;
    arch: string;
    stageType: string;
  }>;
  generatedAt: string;
  exportReady: boolean;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): AlignerDesign {
  return {
    id: r['id'] as string,
    organizationId: r['organization_id'] as string,
    digitalSetupId: r['digital_setup_id'] as string,
    stageId: r['stage_id'] as string | null,
    archType: r['arch_type'] as string | null,
    alignerNumber: r['aligner_number'] as number | null,
    trimlineData: r['trimline_data'],
    thicknessMm: parseFloat(String(r['thickness_mm'])),
    hasRelief: r['has_relief'] as boolean,
    attachmentWindows: (r['attachment_windows'] as unknown[]) ?? [],
    pressureAreas: (r['pressure_areas'] as unknown[]) ?? [],
    label: r['label'] as string | null,
    exportReady: r['export_ready'] as boolean,
    createdAt: r['created_at'] as Date,
  };
}

// ─── Stage type from DB ───────────────────────────────────────────────────────

interface StageRow {
  id: string;
  stage_number: number;
  stage_type: string;
  attachments: Array<{ fdi: number; action: string; type: string }>;
  tooth_movements: Array<{ fdi: number; torqueDeg?: number; mesialMm?: number; distalMm?: number; buccalMm?: number; lingualMm?: number; intrusionMm?: number }>;
}

// ─── Trimline template ────────────────────────────────────────────────────────

const TRIMLINE_SCALLOPED = {
  type: 'scalloped',
  depth: 0.5,
  gingivaMargin: 1.0,
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AlignerDesignService {
  private readonly logger = new Logger(AlignerDesignService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async generateAligners(
    orgId: string,
    setupId: string,
  ): Promise<AlignerDesign[]> {
    // Verify setup ownership
    const { rows: setupRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT id FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!setupRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    // Fetch all stages
    const { rows: stageRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT id, stage_number, stage_type, attachments, tooth_movements
       FROM treatment_stages
       WHERE digital_setup_id = $1 AND organization_id = $2
       ORDER BY stage_number ASC`,
      [setupId, orgId],
    );
    const stages: StageRow[] = stageRows.map((r) => ({
      id: r['id'] as string,
      stage_number: r['stage_number'] as number,
      stage_type: r['stage_type'] as string,
      attachments: (r['attachments'] as StageRow['attachments']) ?? [],
      tooth_movements: (r['tooth_movements'] as StageRow['tooth_movements']) ?? [],
    }));

    // Load latest biomechanical score to determine export readiness
    const { rows: bioRows } = await this.pool.query<{ biomechanical_score: number | null }>(
      `SELECT biomechanical_score FROM biomechanical_analyses
       WHERE digital_setup_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [setupId, orgId],
    );
    const bioScore = bioRows[0]?.biomechanical_score ?? null;

    // Delete existing aligner designs for this setup
    await this.pool.query(
      `DELETE FROM aligner_designs WHERE digital_setup_id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );

    const archs: Array<'upper' | 'lower'> = ['upper', 'lower'];
    const insertedDesigns: AlignerDesign[] = [];

    for (const stage of stages) {
      for (const arch of archs) {
        const archType = arch === 'upper' ? 'maxillary' : 'mandibular';
        const label = `Stage ${stage.stage_number} - ${arch === 'upper' ? 'Maxillary' : 'Mandibular'}`;

        // Thickness: retention stages use 1.0mm, active stages use 0.75mm
        const thicknessMm = stage.stage_type === 'retention' ? 1.0 : 0.75;

        // Attachment windows: based on stage.attachments for this arch
        // Upper arch: FDI 11-18, 21-28; Lower arch: FDI 31-38, 41-48
        const isUpperFdi = (fdi: number) => fdi >= 11 && fdi <= 28;
        const isLowerFdi = (fdi: number) => fdi >= 31 && fdi <= 48;
        const archFilter = arch === 'upper' ? isUpperFdi : isLowerFdi;

        const attachmentWindows = stage.attachments
          .filter((a) => a.action === 'place' && archFilter(a.fdi))
          .map((a) => ({
            fdi: a.fdi,
            type: a.type,
            windowShape: a.type.includes('rectangular') ? 'rectangular' : 'oval',
            widthMm: 3.0,
            heightMm: 4.0,
            depth: 0.5,
          }));

        // Pressure areas: torque movements need force concentration
        const pressureAreas = stage.tooth_movements
          .filter((mv) => {
            const hasTorque = Math.abs(mv.torqueDeg ?? 0) > 0.5;
            return hasTorque && archFilter(mv.fdi);
          })
          .map((mv) => ({
            fdi: mv.fdi,
            type: 'torque_pressure',
            forceMagnitude: Math.min(1.5, Math.abs(mv.torqueDeg ?? 0) * 0.08),
            locationBuccal: true,
          }));

        // Also add pressure areas for intrusion movements
        const intrusionPressure = stage.tooth_movements
          .filter((mv) => Math.abs(mv.intrusionMm ?? 0) > 0.1 && archFilter(mv.fdi))
          .map((mv) => ({
            fdi: mv.fdi,
            type: 'intrusion_pressure',
            forceMagnitude: Math.min(1.0, Math.abs(mv.intrusionMm ?? 0) * 0.5),
            locationOcclusal: true,
          }));

        const allPressureAreas = [...pressureAreas, ...intrusionPressure];

        // Export readiness: biomechanical score >= 70 (or no analysis run yet: default to ready for retention)
        const exportReady =
          stage.stage_type === 'retention' ||
          (bioScore !== null ? bioScore >= 70 : true);

        const { rows } = await this.pool.query<Record<string, unknown>>(
          `INSERT INTO aligner_designs
             (organization_id, digital_setup_id, stage_id, arch_type, aligner_number,
              trimline_data, thickness_mm, has_relief, attachment_windows,
              pressure_areas, label, export_ready)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10, $11)
           RETURNING *`,
          [
            orgId,
            setupId,
            stage.id,
            archType,
            stage.stage_number,
            JSON.stringify(TRIMLINE_SCALLOPED),
            thicknessMm,
            JSON.stringify(attachmentWindows),
            JSON.stringify(allPressureAreas),
            label,
            exportReady,
          ],
        );
        insertedDesigns.push(mapRow(rows[0]!));
      }
    }

    this.logger.log(
      `Generated ${insertedDesigns.length} aligner designs for setup ${setupId} ` +
      `(${stages.length} stages × 2 arches)`,
    );
    return insertedDesigns;
  }

  async listAligners(
    orgId: string,
    setupId: string,
  ): Promise<AlignerDesign[]> {
    const { rows: ownerRows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!ownerRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM aligner_designs
       WHERE digital_setup_id = $1 AND organization_id = $2
       ORDER BY aligner_number ASC, arch_type ASC`,
      [setupId, orgId],
    );
    return rows.map(mapRow);
  }

  async getAligner(orgId: string, alignerId: string): Promise<AlignerDesign> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM aligner_designs WHERE id = $1 AND organization_id = $2`,
      [alignerId, orgId],
    );
    if (!rows[0]) throw new NotFoundException(`Aligner design ${alignerId} not found`);
    return mapRow(rows[0]);
  }

  async updateAligner(
    orgId: string,
    alignerId: string,
    dto: UpdateAlignerDto,
  ): Promise<AlignerDesign> {
    // Fetch current record to verify ownership
    const existing = await this.getAligner(orgId, alignerId);

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.trimlineData !== undefined) {
      updates.push(`trimline_data = $${idx++}`);
      params.push(JSON.stringify(dto.trimlineData));
    }
    if (dto.thicknessMm !== undefined) {
      updates.push(`thickness_mm = $${idx++}`);
      params.push(dto.thicknessMm);
    }
    if (dto.hasRelief !== undefined) {
      updates.push(`has_relief = $${idx++}`);
      params.push(dto.hasRelief);
    }
    if (dto.attachmentWindows !== undefined) {
      updates.push(`attachment_windows = $${idx++}`);
      params.push(JSON.stringify(dto.attachmentWindows));
    }
    if (dto.pressureAreas !== undefined) {
      updates.push(`pressure_areas = $${idx++}`);
      params.push(JSON.stringify(dto.pressureAreas));
    }
    if (dto.label !== undefined) {
      updates.push(`label = $${idx++}`);
      params.push(dto.label);
    }

    if (updates.length === 0) return existing;

    params.push(alignerId, orgId);
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `UPDATE aligner_designs
       SET ${updates.join(', ')}
       WHERE id = $${idx++} AND organization_id = $${idx++}
       RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException(`Aligner design ${alignerId} not found`);
    return mapRow(rows[0]);
  }

  async generateManufacturingPackage(
    orgId: string,
    setupId: string,
  ): Promise<ManufacturingPackage> {
    const { rows: ownerRows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!ownerRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    const aligners = await this.listAligners(orgId, setupId);

    const upperAligners = aligners.filter((a) => a.archType === 'maxillary').length;
    const lowerAligners = aligners.filter((a) => a.archType === 'mandibular').length;

    const stageIds = new Set(aligners.map((a) => a.stageId).filter(Boolean));
    const totalStages = stageIds.size;

    const allExportReady = aligners.length > 0 && aligners.every((a) => a.exportReady);

    // Build export manifest
    const { rows: stageRows } = await this.pool.query<{ id: string; stage_type: string }>(
      `SELECT id, stage_type FROM treatment_stages
       WHERE digital_setup_id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    const stageTypeMap = new Map<string, string>(
      stageRows.map((r) => [r.id, r.stage_type]),
    );

    const exportManifest = aligners.map((a) => ({
      label: a.label ?? `Aligner ${a.alignerNumber ?? '?'} (${a.archType ?? 'unknown'})`,
      alignerNumber: a.alignerNumber ?? 0,
      arch: a.archType === 'maxillary' ? 'upper' : 'lower',
      stageType: a.stageId ? (stageTypeMap.get(a.stageId) ?? 'unknown') : 'unknown',
    }));

    return {
      setupId,
      totalAligners: aligners.length,
      totalStages,
      upperAligners,
      lowerAligners,
      exportManifest,
      generatedAt: new Date().toISOString(),
      exportReady: allExportReady,
    };
  }
}
