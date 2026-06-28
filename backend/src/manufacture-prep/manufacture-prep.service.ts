import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export type ExportFormat = 'stl' | 'obj' | 'ply' | '3mf' | 'zip';
export type ExportType = 'stage_models' | 'aligner_models' | 'attachment_models' | 'ibt' | 'surgical_guide' | 'full_case' | 'qa_report';

export interface CreateExportDto {
  exportFormat: ExportFormat;
  exportType: ExportType;
  treatmentPlanId?: string;
  stageRangeFrom?: number;
  stageRangeTo?: number;
}

function buildManifest(dto: CreateExportDto, stageCount: number) {
  const format = dto.exportFormat;
  const files: string[] = [];

  switch (dto.exportType) {
    case 'stage_models': {
      const from = dto.stageRangeFrom ?? 1;
      const to = Math.min(dto.stageRangeTo ?? stageCount, stageCount);
      for (let i = from; i <= to; i++) {
        files.push(`stage_${String(i).padStart(3, '0')}_upper.${format}`);
        files.push(`stage_${String(i).padStart(3, '0')}_lower.${format}`);
      }
      break;
    }
    case 'aligner_models': {
      const from = dto.stageRangeFrom ?? 1;
      const to = Math.min(dto.stageRangeTo ?? stageCount, stageCount);
      for (let i = from; i <= to; i++) {
        files.push(`aligner_${String(i).padStart(3, '0')}_upper.${format}`);
        files.push(`aligner_${String(i).padStart(3, '0')}_lower.${format}`);
      }
      break;
    }
    case 'attachment_models':
      files.push(`attachment_template_upper.${format}`);
      files.push(`attachment_template_lower.${format}`);
      files.push(`attachment_tray_upper.${format}`);
      files.push(`attachment_tray_lower.${format}`);
      break;
    case 'ibt':
      files.push(`ibt_upper.${format}`);
      files.push(`ibt_lower.${format}`);
      files.push(`ibt_verification_upper.${format}`);
      files.push(`ibt_verification_lower.${format}`);
      break;
    case 'surgical_guide':
      files.push(`surgical_guide_upper.${format}`);
      files.push(`surgical_guide_lower.${format}`);
      files.push(`surgical_guide_bite_block.${format}`);
      break;
    case 'full_case':
      files.push(`case_package.zip`);
      files.push(`manufacturing_report.pdf`);
      files.push(`qa_report.pdf`);
      for (let i = 1; i <= Math.min(stageCount, 30); i++) {
        files.push(`stage_${String(i).padStart(3, '0')}_upper.${format}`);
        files.push(`stage_${String(i).padStart(3, '0')}_lower.${format}`);
      }
      break;
    case 'qa_report':
      files.push('qa_report.pdf');
      files.push('qa_report_data.json');
      break;
  }

  return {
    fileCount: files.length,
    files,
    format,
    exportType: dto.exportType,
    generatedAt: new Date().toISOString(),
    estimatedSizeBytes: files.length * 2_500_000, // ~2.5 MB per mesh file estimate
  };
}

@Injectable()
export class ManufacturePrepService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async verifyCase(caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT id FROM cases WHERE id = $1 AND organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows.length) throw new NotFoundException('Case not found');
  }

  async listExports(caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT e.*, u.email AS generated_by_email
         FROM manufacture_exports e
         LEFT JOIN profiles u ON u.id = e.generated_by
         WHERE e.case_id = $1
         ORDER BY e.created_at DESC`,
      [caseId],
    );
    return rows.map(this.format);
  }

  async createExport(caseId: string, orgId: string, userId: string, dto: CreateExportDto) {
    await this.verifyCase(caseId, orgId);

    // Count available stages
    const { rows: stageRows } = dto.treatmentPlanId
      ? await this.pool.query(
          `SELECT COUNT(*) AS cnt FROM aligner_stages WHERE treatment_plan_id = $1`,
          [dto.treatmentPlanId],
        )
      : await this.pool.query(
          `SELECT COUNT(*) AS cnt FROM aligner_stages as2
             INNER JOIN treatment_plans tp ON tp.id = as2.treatment_plan_id
             WHERE tp.case_id = $1`,
          [caseId],
        );
    const stageCount = parseInt(stageRows[0]?.cnt ?? '0', 10);
    const manifest = buildManifest(dto, stageCount);

    const { rows } = await this.pool.query(
      `INSERT INTO manufacture_exports
         (case_id, treatment_plan_id, organization_id, export_format, export_type,
          stage_range_from, stage_range_to, status, manifest, generated_by, generated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,NOW())
         RETURNING *`,
      [
        caseId,
        dto.treatmentPlanId ?? null,
        orgId,
        dto.exportFormat,
        dto.exportType,
        dto.stageRangeFrom ?? null,
        dto.stageRangeTo ?? null,
        JSON.stringify(manifest),
        userId,
      ],
    );
    const exportJob = rows[0];

    // Simulate async processing
    setTimeout(async () => {
      await this.pool.query(
        `UPDATE manufacture_exports
           SET status = 'completed', completed_at = NOW(),
               file_path = $2, file_size_bytes = $3
           WHERE id = $1`,
        [
          exportJob.id,
          `/exports/${caseId}/${exportJob.id}/${dto.exportType}.${dto.exportFormat === 'zip' ? 'zip' : 'zip'}`,
          manifest.estimatedSizeBytes,
        ],
      );
    }, 3000);

    return this.format(exportJob);
  }

  async getExport(caseId: string, orgId: string, exportId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT e.*, u.email AS generated_by_email
         FROM manufacture_exports e
         LEFT JOIN profiles u ON u.id = e.generated_by
         WHERE e.id = $1 AND e.case_id = $2`,
      [exportId, caseId],
    );
    if (!rows.length) throw new NotFoundException('Export not found');
    return this.format(rows[0]);
  }

  private format(r: Record<string, unknown>) {
    return {
      id:               r.id,
      caseId:           r.case_id,
      treatmentPlanId:  r.treatment_plan_id,
      exportFormat:     r.export_format,
      exportType:       r.export_type,
      stageRangeFrom:   r.stage_range_from,
      stageRangeTo:     r.stage_range_to,
      status:           r.status,
      filePath:         r.file_path,
      fileSizeBytes:    r.file_size_bytes,
      manifest:         r.manifest,
      errorMessage:     r.error_message,
      generatedByEmail: r.generated_by_email,
      generatedAt:      r.generated_at,
      completedAt:      r.completed_at,
      createdAt:        r.created_at,
    };
  }
}
