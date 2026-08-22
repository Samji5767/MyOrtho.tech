import { Injectable, Inject, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

const UPLOADS_ROOT = process.env.UPLOADS_DIR ?? '/app/uploads';

/** Resolve a path and require it inside the uploads sandbox (download safety). */
function resolveInUploads(p: string): string | null {
  const resolved = path.resolve(p);
  const root = path.resolve(UPLOADS_ROOT) + path.sep;
  return resolved.startsWith(root) ? resolved : null;
}

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
  // Describes the export REQUEST. Real file details are attached in
  // createExport only after the file has been verified on disk — the
  // manifest never lists files that were not produced.
  return {
    format: dto.exportFormat,
    exportType: dto.exportType,
    stageRangeFrom: dto.stageRangeFrom ?? 1,
    stageRangeTo: Math.min(dto.stageRangeTo ?? stageCount, stageCount) || null,
    planStageCount: stageCount,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Printability Score ───────────────────────────────────────────────────────

export interface PrintabilityScoreFactor {
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
}

export interface PrintabilityScore {
  overall: number;
  meshIntegrity: number;
  printability: number;
  complexity: number;
  factors: PrintabilityScoreFactor[];
  recommendation: string;
  estimatedPrintTimeMinutes: number;
  estimatedResinGrams: number;
  estimatedCostUsd: number;
}

export interface ManufacturingReadiness {
  caseId: string;
  printabilityScore: PrintabilityScore;
  compatiblePrinters: string[];
  exportCount: number;
  lastExportAt: string | null;
  qaIssueCount: number;
  computedAt: string;
}

interface PrintabilityParams {
  stageCount: number;
  avgMovementMm: number;
  hasAttachments: boolean;
  hasBiocompatibleMaterial: boolean;
  meshWarnings: number;
  shellThicknessMm: number | null;
}

interface StageAllocationEntry {
  maxTranslationMm: number;
}

const COMPATIBLE_PRINTERS = [
  'Formlabs Form 3B+',
  'Formlabs Form 3BL',
  'SprintRay Pro 55 S',
  'SprintRay Pro 95 H',
];

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

    // No geometry pipeline exists for these appliance types. Refuse honestly
    // instead of recording a "completed" export with no file.
    if (
      dto.exportType === 'attachment_models' ||
      dto.exportType === 'ibt' ||
      dto.exportType === 'surgical_guide'
    ) {
      throw new BadRequestException(
        `Export type "${dto.exportType}" is not available: no geometry pipeline ` +
        'is implemented for this appliance type yet.',
      );
    }


    // Locate the aligner generation plan for this treatment plan / case
    const planQuery = dto.treatmentPlanId
      ? `SELECT agp.id, agp.plan_id, agp.total_active_stages,
                agp.stl_export_ready, agp.stl_export_path, agp.status AS gen_status
           FROM aligner_generation_plans agp
           WHERE agp.plan_id = $1 AND agp.organization_id = $2
           ORDER BY agp.generated_at DESC LIMIT 1`
      : `SELECT agp.id, agp.plan_id, agp.total_active_stages,
                agp.stl_export_ready, agp.stl_export_path, agp.status AS gen_status
           FROM aligner_generation_plans agp
           INNER JOIN treatment_plans tp ON tp.id = agp.plan_id
           WHERE tp.case_id = $1 AND agp.organization_id = $2
           ORDER BY agp.generated_at DESC LIMIT 1`;
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
      // qa_report: the deliverable is the QA data itself, assembled below
      // from real database rows and returned inline in the manifest.
      status = 'completed';
      manifest['deliverable'] = 'inline_json';
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

    // A file-backed export is only "completed" when the file verifiably
    // exists inside the uploads sandbox. Never record success for a path
    // that is missing, empty, or outside storage.
    if (status === 'completed' && filePath !== null) {
      const safe = resolveInUploads(filePath);
      let stat: fs.Stats | null = null;
      if (safe) {
        try { stat = fs.statSync(safe); } catch { stat = null; }
      }
      if (!safe || !stat || !stat.isFile() || stat.size === 0) {
        status = 'failed';
        errorMsg =
          'Export blocked: the generated file could not be verified on disk. ' +
          (safe ? 'File is missing or empty.' : 'File path is outside managed storage.');
        filePath = null;
      } else {
        filePath = safe;
        manifest['deliverable'] = 'file';
        manifest['file'] = {
          name: path.basename(safe),
          sizeBytes: stat.size,
          verifiedAt: new Date().toISOString(),
        };
        // Geometric validation for STL deliverables via the AI engine
        // (watertightness, non-manifold ratio, components). Archive files
        // skip mesh-level checks; an unreachable validator is recorded as
        // unavailable — never a fabricated pass.
        if (safe.toLowerCase().endsWith('.stl')) {
          try {
            const res = await fetch(`${AI_ENGINE_URL}/mesh/validate`, {
              method: 'POST',
              headers: AI_ENGINE_HEADERS(),
              body: JSON.stringify({ file_path: safe }),
              signal: AbortSignal.timeout(60_000),
            });
            if (res.ok) {
              const report = (await res.json()) as { valid?: boolean; issues?: string[] };
              manifest['meshValidation'] = report;
              if (report.valid === false) {
                status = 'failed';
                errorMsg =
                  'Export blocked: mesh validation failed — ' +
                  ((report.issues ?? []).join('; ') || 'geometry is not manufacturable');
                filePath = null;
              }
            } else {
              manifest['meshValidation'] = { status: 'unavailable', httpStatus: res.status };
            }
          } catch {
            manifest['meshValidation'] = { status: 'unavailable' };
          }
        } else {
          manifest['meshValidation'] = { status: 'not_applicable', reason: 'non-STL deliverable' };
        }
      }
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

  // ── Printability Scoring ────────────────────────────────────────────────────

  computePrintabilityScore(params: PrintabilityParams): PrintabilityScore {
    let score = 100;
    let meshIntegrity = 100;
    let printability = 100;
    let complexity = 100;
    const factors: PrintabilityScoreFactor[] = [];

    // Stage count
    if (params.stageCount > 40) {
      score -= 20;
      complexity -= 20;
      factors.push({
        label: 'High Stage Count',
        impact: 'negative',
        detail: `${params.stageCount} stages exceeds recommended maximum of 40.`,
      });
    } else if (params.stageCount > 30) {
      score -= 10;
      complexity -= 10;
      factors.push({
        label: 'Elevated Stage Count',
        impact: 'negative',
        detail: `${params.stageCount} stages — moderate complexity treatment.`,
      });
    } else {
      factors.push({
        label: 'Stage Count',
        impact: 'neutral',
        detail: `${params.stageCount} stages — within normal range.`,
      });
    }

    // Average movement per stage
    if (params.avgMovementMm > 0.3) {
      score -= 15;
      printability -= 15;
      factors.push({
        label: 'Rapid Movement Rate',
        impact: 'negative',
        detail: `Average ${params.avgMovementMm.toFixed(3)} mm/stage exceeds 0.3 mm threshold.`,
      });
    } else {
      factors.push({
        label: 'Movement Rate',
        impact: 'neutral',
        detail: `Average ${params.avgMovementMm.toFixed(3)} mm/stage — within safe range.`,
      });
    }

    // Mesh warnings
    if (params.meshWarnings > 0) {
      score -= 10;
      meshIntegrity -= 20;
      factors.push({
        label: 'Mesh Warnings',
        impact: 'negative',
        detail: `${params.meshWarnings} mesh warning(s) detected — repair recommended before printing.`,
      });
    } else {
      factors.push({
        label: 'Mesh Integrity',
        impact: 'positive',
        detail: 'No mesh integrity issues detected.',
      });
    }

    // Biocompatible material
    if (params.hasBiocompatibleMaterial) {
      score += 5;
      factors.push({
        label: 'Biocompatible Material',
        impact: 'positive',
        detail: 'Biocompatible dental resin configured for this organisation.',
      });
    }

    // Shell thickness
    if (params.shellThicknessMm === null) {
      factors.push({
        label: 'Shell Thickness Unknown',
        impact: 'neutral',
        detail: 'No quality report has measured shell thickness for this plan.',
      });
    } else if (params.shellThicknessMm < 0.5) {
      score -= 20;
      printability -= 30;
      factors.push({
        label: 'Dangerously Thin Shell',
        impact: 'negative',
        detail: `Shell thickness ${params.shellThicknessMm.toFixed(2)} mm is below the 0.5 mm minimum.`,
      });
    } else if (params.shellThicknessMm >= 0.8) {
      score += 5;
      factors.push({
        label: 'Good Shell Thickness',
        impact: 'positive',
        detail: `Shell thickness ${params.shellThicknessMm.toFixed(2)} mm meets the recommended 0.8 mm+ standard.`,
      });
    } else {
      factors.push({
        label: 'Shell Thickness',
        impact: 'neutral',
        detail: `Shell thickness ${params.shellThicknessMm.toFixed(2)} mm meets the minimum but is below the optimal 0.8 mm.`,
      });
    }

    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const overall = clamp(score);

    const estimatedPrintTimeMinutes = params.stageCount * 45;
    const estimatedResinGrams = params.stageCount * 16;
    const estimatedCostUsd = estimatedResinGrams * 0.15;

    let recommendation: string;
    if (overall >= 80) {
      recommendation = 'Case is ready for manufacturing. All parameters within acceptable range.';
    } else if (overall >= 60) {
      recommendation =
        'Review flagged issues before printing. Manufacturing is possible but quality may be affected.';
    } else {
      recommendation =
        'Case requires attention before manufacturing. Address all critical issues.';
    }

    return {
      overall,
      meshIntegrity: clamp(meshIntegrity),
      printability: clamp(printability),
      complexity: clamp(complexity),
      factors,
      recommendation,
      estimatedPrintTimeMinutes,
      estimatedResinGrams,
      estimatedCostUsd,
    };
  }

  // ── Manufacturing Readiness ──────────────────────────────────────────────────

  async getManufacturingReadiness(caseId: string, orgId: string): Promise<ManufacturingReadiness> {
    await this.verifyCase(caseId, orgId);

    // 1. Aligner generation plan — stage count, movement data, attachment info
    const { rows: planRows } = await this.pool.query<{
      total_active_stages: number;
      attachment_start_stage: number | null;
      attachment_end_stage: number | null;
      stage_allocations: unknown;
      quality_report: Record<string, unknown> | null;
    }>(
      `SELECT agp.total_active_stages, agp.attachment_start_stage, agp.attachment_end_stage,
              agp.stage_allocations, agp.quality_report
       FROM aligner_generation_plans agp
       INNER JOIN treatment_plans tp ON tp.id = agp.plan_id
       WHERE tp.case_id = $1 AND agp.organization_id = $2
       ORDER BY agp.generated_at DESC LIMIT 1`,
      [caseId, orgId],
    );
    const planRow = planRows[0];

    const stageCount = planRow?.total_active_stages ?? 0;

    // Average movement from stage_allocations JSONB
    let avgMovementMm = 0;
    if (planRow?.stage_allocations) {
      const allocs = planRow.stage_allocations as StageAllocationEntry[];
      if (allocs.length > 0) {
        const total = allocs.reduce((sum, a) => sum + (a.maxTranslationMm ?? 0), 0);
        avgMovementMm = total / allocs.length;
      }
    }

    const hasAttachments =
      planRow?.attachment_start_stage != null && planRow.attachment_end_stage != null;

    // Shell thickness from quality_report JSONB — null (unknown) when no
    // quality report has measured it; never substitute an invented value.
    const shellThicknessMm =
      typeof planRow?.quality_report?.['min_thickness_mm'] === 'number'
        ? (planRow.quality_report['min_thickness_mm'] as number)
        : null;

    // 2. QA report — mesh warning proxy from warn + fail counts
    const { rows: qaRows } = await this.pool.query<{
      warning_count: number;
      fail_count: number;
    }>(
      `SELECT warning_count, fail_count
       FROM preexport_qa_reports
       WHERE case_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [caseId],
    );
    const qaRow = qaRows[0];
    const meshWarnings = qaRow ? Number(qaRow.warning_count) + Number(qaRow.fail_count) : 0;

    // 3. Material biocompatibility from printers table
    const { rows: matRows } = await this.pool.query<{ material_type: string | null }>(
      `SELECT material_type FROM printers
       WHERE organization_id = $1 AND material_type ILIKE '%bio%'
       LIMIT 1`,
      [orgId],
    );
    const hasBiocompatibleMaterial = matRows.length > 0;

    // 4. Export stats
    const { rows: exportRows } = await this.pool.query<{
      count: string;
      last_at: string | null;
    }>(
      `SELECT COUNT(*) AS count, MAX(completed_at) AS last_at
       FROM manufacture_exports WHERE case_id = $1`,
      [caseId],
    );
    const exportRow = exportRows[0];

    const printabilityScore = this.computePrintabilityScore({
      stageCount,
      avgMovementMm,
      hasAttachments,
      hasBiocompatibleMaterial,
      meshWarnings,
      shellThicknessMm,
    });

    return {
      caseId,
      printabilityScore,
      compatiblePrinters: COMPATIBLE_PRINTERS,
      exportCount: Number(exportRow?.count ?? 0),
      lastExportAt: exportRow?.last_at ?? null,
      qaIssueCount: meshWarnings,
      computedAt: new Date().toISOString(),
    };
  }

  /** Resolve a completed export's verified file for streaming (org-checked). */
  async getExportFile(
    caseId: string,
    orgId: string,
    exportId: string,
  ): Promise<{ filePath: string; fileName: string }> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT status, file_path FROM manufacture_exports
       WHERE id = $1 AND case_id = $2 AND organization_id = $3`,
      [exportId, caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Export not found');
    if (rows[0].status !== 'completed' || !rows[0].file_path) {
      throw new BadRequestException('Export has no downloadable file');
    }
    const safe = resolveInUploads(rows[0].file_path as string);
    if (!safe || !fs.existsSync(safe)) {
      throw new NotFoundException('Export file is no longer available on disk');
    }
    return { filePath: safe, fileName: path.basename(safe) };
  }

  private format(r: Record<string, unknown>) {
    const manifest = (r.manifest ?? {}) as Record<string, unknown>;
    const fileMeta = (manifest['file'] ?? null) as { name?: string; sizeBytes?: number } | null;
    return {
      id:               r.id,
      caseId:           r.case_id,
      treatmentPlanId:  r.treatment_plan_id,
      exportFormat:     r.export_format,
      exportType:       r.export_type,
      stageRangeFrom:   r.stage_range_from,
      stageRangeTo:     r.stage_range_to,
      status:           r.status,
      // Internal storage paths stay server-side; clients get name + size and
      // download via GET .../exports/:exportId/download.
      fileName:         fileMeta?.name ?? null,
      fileSizeBytes:    fileMeta?.sizeBytes ?? null,
      hasFile:          Boolean(r.file_path),
      manifest,
      errorMessage:     r.error_message,
      generatedByEmail: r.generated_by_email,
      generatedAt:      r.generated_at,
      completedAt:      r.completed_at,
      createdAt:        r.created_at,
    };
  }
}
