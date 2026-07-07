import { Injectable, Inject, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL ?? 'http://ai-engine:8000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? '';
const AI_ENGINE_HEADERS = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(INTERNAL_API_SECRET ? { 'X-Internal-Token': INTERNAL_API_SECRET } : {}),
});

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

  // Per-file size estimates (bytes) based on export type and format
  const BASE_SIZE: Record<ExportFormat, number> = {
    stl:  2_800_000,
    obj:  3_500_000,
    ply:  2_200_000,
    '3mf': 1_800_000,
    zip:  1_200_000,
  };
  const TYPE_MULTIPLIER: Record<ExportType, number> = {
    stage_models:      1.0,   // arch models ~2.8 MB each
    aligner_models:    0.6,   // shells are thinner meshes
    attachment_models: 0.3,   // small geometry
    ibt:               0.4,
    surgical_guide:    0.8,
    full_case:         0.5,   // compressed in zip
    qa_report:         0.1,   // PDF + JSON
  };
  const perFileMb = (BASE_SIZE[format] ?? 2_500_000) * (TYPE_MULTIPLIER[dto.exportType] ?? 1.0);

  return {
    fileCount: files.length,
    files,
    format,
    exportType: dto.exportType,
    generatedAt: new Date().toISOString(),
    estimatedSizeBytes: Math.round(files.length * perFileMb),
    estimatedSizeMb: Math.round(files.length * perFileMb / 1_048_576 * 10) / 10,
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
         LEFT JOIN auth_users u ON u.id = e.generated_by
         WHERE e.case_id = $1
         ORDER BY e.created_at DESC`,
      [caseId],
    );
    return rows.map(this.format);
  }

  async createExport(caseId: string, orgId: string, userId: string, dto: CreateExportDto) {
    await this.verifyCase(caseId, orgId);

    // Locate the aligner generation plan for this treatment plan / case
    const planQuery = dto.treatmentPlanId
      ? `SELECT agp.id, agp.plan_id, agp.total_active_stages,
                agp.stl_export_ready, agp.stl_export_path, agp.status AS gen_status
           FROM aligner_generation_plans agp
           WHERE agp.plan_id = $1 AND agp.organization_id = $2
           ORDER BY agp.created_at DESC LIMIT 1`
      : `SELECT agp.id, agp.plan_id, agp.total_active_stages,
                agp.stl_export_ready, agp.stl_export_path, agp.status AS gen_status
           FROM aligner_generation_plans agp
           INNER JOIN treatment_plans tp ON tp.id = agp.plan_id
           WHERE tp.case_id = $1 AND agp.organization_id = $2
           ORDER BY agp.created_at DESC LIMIT 1`;
    const planParam = dto.treatmentPlanId ?? caseId;
    const { rows: planRows } = await this.pool.query(planQuery, [planParam, orgId]);

    const genPlan = planRows[0] as {
      plan_id: string;
      total_active_stages: number;
      stl_export_ready: boolean;
      stl_export_path: string | null;
      gen_status: string;
    } | undefined;

    const stageCount = genPlan?.total_active_stages ?? 0;
    const manifest: Record<string, unknown> = buildManifest(dto, stageCount) as Record<string, unknown>;

    // Determine whether we can fulfill the export now
    const needsStageStls =
      dto.exportType === 'stage_models' ||
      dto.exportType === 'aligner_models' ||
      dto.exportType === 'full_case';

    let status: 'completed' | 'processing' | 'failed' = 'failed';
    let filePath: string | null = null;
    let errorMsg: string | null = null;

    if (!needsStageStls) {
      status = 'completed';
      // For QA reports, enhance the manifest with live case data
      if (dto.exportType === 'qa_report' && genPlan) {
        const qaRows = await this.pool.query(
          `SELECT tqs.overall_score, tqs.grade, tqs.has_critical_issues, tqs.critical_issue_count,
                  tqs.total_teeth_moved, tqs.max_movement_mm
           FROM treatment_quality_scores tqs
           WHERE tqs.plan_id = $1 ORDER BY tqs.created_at DESC LIMIT 1`,
          [genPlan.plan_id],
        );
        const iprRows = await this.pool.query(
          `SELECT COUNT(*) AS total, SUM(CASE WHEN is_safe=false THEN 1 ELSE 0 END) AS unsafe
           FROM ipr_enamel_estimates WHERE plan_id=$1`,
          [genPlan.plan_id],
        );
        const attRows = await this.pool.query(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) AS critical_collisions
           FROM attachment_collisions WHERE plan_id=$1`,
          [genPlan.plan_id],
        );
        const qs = qaRows.rows[0];
        const ipr = iprRows.rows[0];
        const att = attRows.rows[0];
        manifest['qaData'] = {
          qualityGrade:        qs?.grade ?? 'N/A',
          qualityScore:        qs ? Math.round(Number(qs.overall_score) * 100) : null,
          hasCriticalIssues:   qs?.has_critical_issues ?? false,
          criticalIssueCount:  qs?.critical_issue_count ?? 0,
          totalTeethMoved:     qs?.total_teeth_moved ?? stageCount,
          maxMovementMm:       qs?.max_movement_mm ? Number(qs.max_movement_mm).toFixed(2) : null,
          iprContacts:         Number(ipr?.total ?? 0),
          unsafeIprContacts:   Number(ipr?.unsafe ?? 0),
          attachmentCollisions: Number(att?.total ?? 0),
          criticalCollisions:   Number(att?.critical_collisions ?? 0),
          stages:              stageCount,
          generatedAt:         new Date().toISOString(),
        };
      }
    } else if (genPlan?.stl_export_ready && genPlan.stl_export_path) {
      // Stage STL zip already produced by the aligner generation step
      if (dto.exportType === 'stage_models') {
        filePath = genPlan.stl_export_path;
        status = 'completed';
      } else if (dto.exportType === 'aligner_models') {
        // Generate aligner shells from the stage STLs
        const stageDir = genPlan.stl_export_path.replace(/\.zip$/, '').replace(
          /aligner_plan_.*$/,
          `stages_${genPlan.plan_id}`,
        );
        try {
          const res = await fetch(`${AI_ENGINE_URL}/ai/generate-aligner-shells`, {
            method: 'POST',
            headers: AI_ENGINE_HEADERS(),
            body: JSON.stringify({ plan_id: genPlan.plan_id, stage_stls_dir: stageDir }),
            signal: AbortSignal.timeout(300_000),
          });
          if (res.ok) {
            const body = (await res.json()) as { zip_path: string };
            filePath = body.zip_path;
            status = 'completed';
          } else {
            const errBody = await res.text().catch(() => '');
            errorMsg = `AI engine returned ${res.status}: ${errBody}`;
            status = 'failed';
          }
        } catch (err) {
          errorMsg = `Aligner shell generation failed: ${String(err)}`;
          status = 'failed';
        }
      } else {
        // full_case: use stage STL zip as primary deliverable
        filePath = genPlan.stl_export_path;
        status = 'completed';
      }
    } else if (genPlan) {
      if (genPlan.gen_status === 'draft') {
        errorMsg =
          'The aligner generation plan has not been approved. ' +
          'Approve the plan before requesting a manufacturing export.';
      } else {
        errorMsg =
          'Stage STL files have not been generated yet. ' +
          'Call POST .../aligner-generation/generate-stl to produce the per-stage meshes, ' +
          'then retry the manufacturing export.';
      }
      status = 'failed';
    } else {
      errorMsg =
        'No aligner generation plan found for this case. ' +
        'Complete the aligner generation step (POST .../aligner-generation/generate) before exporting.';
      status = 'failed';
    }

    const { rows } = await this.pool.query(
      `INSERT INTO manufacture_exports
         (case_id, treatment_plan_id, organization_id, export_format, export_type,
          stage_range_from, stage_range_to, status, error_message, file_path,
          manifest, generated_by, generated_at, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),
           CASE WHEN $8 = 'completed' THEN NOW() ELSE NULL END)
         RETURNING *`,
      [
        caseId,
        dto.treatmentPlanId ?? null,
        orgId,
        dto.exportFormat,
        dto.exportType,
        dto.stageRangeFrom ?? null,
        dto.stageRangeTo ?? null,
        status,
        errorMsg,
        filePath,
        JSON.stringify(manifest),
        userId,
      ],
    );
    return this.format(rows[0]);
  }

  async getExport(caseId: string, orgId: string, exportId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT e.*, u.email AS generated_by_email
         FROM manufacture_exports e
         LEFT JOIN auth_users u ON u.id = e.generated_by
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
