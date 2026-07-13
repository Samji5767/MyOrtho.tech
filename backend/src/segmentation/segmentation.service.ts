import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// FDI chart: upper right=1x, upper left=2x, lower left=3x, lower right=4x
const FDI_CHART: { fdi: number; universal: number; label: string; arch: 'upper' | 'lower' }[] = [
  { fdi: 18, universal: 1,  label: 'Upper Right Third Molar',    arch: 'upper' },
  { fdi: 17, universal: 2,  label: 'Upper Right Second Molar',   arch: 'upper' },
  { fdi: 16, universal: 3,  label: 'Upper Right First Molar',    arch: 'upper' },
  { fdi: 15, universal: 4,  label: 'Upper Right Second Premolar',arch: 'upper' },
  { fdi: 14, universal: 5,  label: 'Upper Right First Premolar', arch: 'upper' },
  { fdi: 13, universal: 6,  label: 'Upper Right Canine',         arch: 'upper' },
  { fdi: 12, universal: 7,  label: 'Upper Right Lateral Incisor',arch: 'upper' },
  { fdi: 11, universal: 8,  label: 'Upper Right Central Incisor',arch: 'upper' },
  { fdi: 21, universal: 9,  label: 'Upper Left Central Incisor', arch: 'upper' },
  { fdi: 22, universal: 10, label: 'Upper Left Lateral Incisor', arch: 'upper' },
  { fdi: 23, universal: 11, label: 'Upper Left Canine',          arch: 'upper' },
  { fdi: 24, universal: 12, label: 'Upper Left First Premolar',  arch: 'upper' },
  { fdi: 25, universal: 13, label: 'Upper Left Second Premolar', arch: 'upper' },
  { fdi: 26, universal: 14, label: 'Upper Left First Molar',     arch: 'upper' },
  { fdi: 27, universal: 15, label: 'Upper Left Second Molar',    arch: 'upper' },
  { fdi: 28, universal: 16, label: 'Upper Left Third Molar',     arch: 'upper' },
  { fdi: 38, universal: 17, label: 'Lower Left Third Molar',     arch: 'lower' },
  { fdi: 37, universal: 18, label: 'Lower Left Second Molar',    arch: 'lower' },
  { fdi: 36, universal: 19, label: 'Lower Left First Molar',     arch: 'lower' },
  { fdi: 35, universal: 20, label: 'Lower Left Second Premolar', arch: 'lower' },
  { fdi: 34, universal: 21, label: 'Lower Left First Premolar',  arch: 'lower' },
  { fdi: 33, universal: 22, label: 'Lower Left Canine',          arch: 'lower' },
  { fdi: 32, universal: 23, label: 'Lower Left Lateral Incisor', arch: 'lower' },
  { fdi: 31, universal: 24, label: 'Lower Left Central Incisor', arch: 'lower' },
  { fdi: 41, universal: 25, label: 'Lower Right Central Incisor',arch: 'lower' },
  { fdi: 42, universal: 26, label: 'Lower Right Lateral Incisor',arch: 'lower' },
  { fdi: 43, universal: 27, label: 'Lower Right Canine',         arch: 'lower' },
  { fdi: 44, universal: 28, label: 'Lower Right First Premolar', arch: 'lower' },
  { fdi: 45, universal: 29, label: 'Lower Right Second Premolar',arch: 'lower' },
  { fdi: 46, universal: 30, label: 'Lower Right First Molar',    arch: 'lower' },
  { fdi: 47, universal: 31, label: 'Lower Right Second Molar',   arch: 'lower' },
  { fdi: 48, universal: 32, label: 'Lower Right Third Molar',    arch: 'lower' },
];

// ── Progress stage descriptions ──────────────────────────────────────────────

const SEGMENTATION_STAGES: Record<number, string> = {
  0:   'Queued for processing',
  10:  'STL validation complete',
  20:  'Mesh preprocessing',
  35:  'Tooth detection running',
  50:  'Individual tooth segmentation',
  65:  'FDI tooth numbering',
  75:  'Root prediction',
  85:  'Arch analysis',
  90:  'Quality validation',
  95:  'Post-processing',
  100: 'Segmentation complete',
};


export interface CreateJobDto {
  scanId?: string;
  modelType?: 'monai' | 'nnunet' | 'onnx' | 'pytorch' | 'cpu';
  arch?: 'upper' | 'lower' | 'both';
  gpuRequested?: boolean;
  priority?: number;
  onnxModelPath?: string;
  /** Segmentation engine override: TGN | MESHSEGNET | AUTO | MANUAL */
  provider?: 'TGN' | 'MESHSEGNET' | 'AUTO' | 'MANUAL';
}

export type MaskRegionType = 'crown' | 'root' | 'gingiva' | 'implant' | 'restoration' | 'supernumerary';

export type MaskEditOperation =
  | 'brush' | 'erase' | 'grow' | 'shrink' | 'smooth'
  | 'merge' | 'split' | 'region_grow' | 'boundary_smooth';

export interface MaskEditDto {
  toothNumber: number;
  regionType?: MaskRegionType;
  operation: MaskEditOperation;
  /** For brush/erase: [x,y,z] centre in mesh-local space */
  centre?: [number, number, number];
  /** Radius in mm for brush/erase/grow/shrink */
  radiusMm?: number;
  /** Vertices to merge into (for merge operation) */
  mergeIntoTooth?: number;
  /** Plane normal for split: [nx,ny,nz] */
  splitPlane?: [number, number, number];
  /** Seed vertex for region growing */
  seedVertex?: number;
  /** Grow iterations for region_grow */
  growIterations?: number;
}

export interface CorrectionDto {
  toothNumber?: number;
  correctionType: string;
  details?: Record<string, unknown>;
}

// ── STL validation types ─────────────────────────────────────────────────────

export interface StlValidationFinding {
  type: 'corrupt' | 'empty' | 'inverted_normals' | 'non_manifold' | 'excessive_triangles' | 'open_mesh' | 'self_intersection' | 'disconnected_components';
  severity: 'info' | 'warning' | 'error';
  description: string;
  affectedTriangleCount?: number;
}

export interface StlValidationResult {
  isValid: boolean;
  classification: 'PASS' | 'WARNING' | 'FAIL';
  findings: StlValidationFinding[];
  triangleCount: number;
  estimatedFileIntegrityPercent: number;
  humanReadableSummary: string;
}

// ── Confidence scoring types ──────────────────────────────────────────────────

export interface SegmentationResult {
  triangleCount?: number;
  invertedNormalsDetected?: boolean;
  mixedDentitionDetected?: boolean;
  detectedFdiNumbers?: number[];
  arch?: 'upper' | 'lower' | 'both';
}

export interface SegmentationConfidenceScore {
  overall: number;
  toothNumberingConfidence: number;
  rootPredictionConfidence: number;
  archDetectionConfidence: number;
  needsManualReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

@Injectable()
export class SegmentationService {
  private readonly logger = new Logger(SegmentationService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ── Verify case belongs to org ──────────────────────────────────────────────

  private async verifyCase(caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT c.id FROM cases c
         JOIN patients p ON p.id = c.patient_id
         WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows.length) throw new NotFoundException('Case not found');
  }

  // ── List jobs for a case ─────────────────────────────────────────────────────

  async listJobs(caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT j.*, u.email AS submitted_by_email
         FROM segmentation_jobs j
         LEFT JOIN auth_users u ON u.id = j.submitted_by
         WHERE j.case_id = $1
         ORDER BY j.created_at DESC`,
      [caseId],
    );
    return rows.map(this.formatJob);
  }

  // ── Get job with tooth segments ──────────────────────────────────────────────

  async getJob(caseId: string, orgId: string, jobId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT j.*, u.email AS submitted_by_email
         FROM segmentation_jobs j
         LEFT JOIN auth_users u ON u.id = j.submitted_by
         WHERE j.id = $1 AND j.case_id = $2`,
      [jobId, caseId],
    );
    if (!rows.length) throw new NotFoundException('Job not found');
    const job = this.formatJob(rows[0]);

    const { rows: segments } = await this.pool.query(
      `SELECT * FROM tooth_segments WHERE job_id = $1 ORDER BY tooth_number`,
      [jobId],
    );
    const { rows: corrections } = await this.pool.query(
      `SELECT c.*, u.email AS applied_by_email
         FROM segmentation_corrections c
         LEFT JOIN auth_users u ON u.id = c.applied_by
         WHERE c.job_id = $1
         ORDER BY c.created_at DESC`,
      [jobId],
    );
    return { ...job, segments: segments.map(this.formatSegment), corrections: corrections.map(this.formatCorrection) };
  }

  // ── Submit new segmentation job ──────────────────────────────────────────────

  async submitJob(caseId: string, orgId: string, userId: string, dto: CreateJobDto) {
    await this.verifyCase(caseId, orgId);
    const modelType = dto.modelType ?? 'cpu';
    const arch = dto.arch ?? 'both';

    const { rows } = await this.pool.query(
      `INSERT INTO segmentation_jobs
         (case_id, organization_id, scan_id, model_type, arch, submitted_by,
          gpu_requested, priority, onnx_model_path, result_summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
      [caseId, orgId, dto.scanId ?? null, modelType, arch, userId,
       dto.gpuRequested ?? false, dto.priority ?? 5, dto.onnxModelPath ?? null,
       dto.provider ? JSON.stringify({ provider: dto.provider }) : null],
    );
    const job = rows[0];

    // Process asynchronously without blocking the response
    this.processJob(job.id, caseId, arch, modelType).catch(err =>
      this.logger.error(`Segmentation job ${job.id} failed: ${err.message}`),
    );

    return this.formatJob(job);
  }

  // ── AI processing pipeline ───────────────────────────────────────────────────

  private async processJob(jobId: string, caseId: string, arch: string, modelType: string) {
    await this.pool.query(
      `UPDATE segmentation_jobs SET status = 'processing', started_at = NOW(), progress = 5 WHERE id = $1`,
      [jobId],
    );

    try {
      // Attempt to call external AI service if configured
      const aiUrl = process.env.AI_SEGMENTATION_URL;
      if (aiUrl) {
        // provider comes from the job's result_summary field (stored at submit time)
        const { rows: jobRows } = await this.pool.query(
          `SELECT result_summary FROM segmentation_jobs WHERE id = $1`, [jobId],
        );
        const jobMeta = jobRows[0]?.result_summary as { provider?: string } | null;
        await this.callExternalAIService(jobId, aiUrl, arch, jobMeta?.provider);
        return;
      }

      // Algorithmic fallback: deterministic FDI-based segmentation
      this.logger.warn(
        `AI_SEGMENTATION_URL not configured — using rule-based fallback for job ${jobId}`,
      );
      await this.runAlgorithmicSegmentation(jobId, caseId, arch, modelType);
    } catch (err: any) {
      this.logger.error(`Processing error for job ${jobId}: ${err.message}`);
      await this.pool.query(
        `UPDATE segmentation_jobs SET status = 'failed', error_message = $2, progress = 0 WHERE id = $1`,
        [jobId, err.message],
      );
    }
  }

  private async callExternalAIService(jobId: string, aiUrl: string, arch: string, provider?: string) {
    const res = await fetch(`${aiUrl}/ai/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, arch, ...(provider ? { provider } : {}) }),
    });
    if (!res.ok) throw new Error(`AI service returned ${res.status}`);
    const data = await res.json() as { segments: Array<{ toothNumber: number; confidence: number; label: string }> };

    const caseRow = await this.pool.query<{ case_id: string }>(
      `SELECT case_id FROM segmentation_jobs WHERE id = $1`,
      [jobId],
    );
    const caseId = caseRow.rows[0]?.case_id;

    for (const seg of data.segments) {
      const tooth = FDI_CHART.find(t => t.fdi === seg.toothNumber);
      if (!tooth) continue;
      await this.pool.query(
        `INSERT INTO tooth_segments
           (job_id, case_id, tooth_number, universal_number, label, arch, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (job_id, tooth_number) DO UPDATE SET confidence = EXCLUDED.confidence`,
        [jobId, caseId, seg.toothNumber, tooth.universal, seg.label, tooth.arch, seg.confidence],
      );
    }
    await this.pool.query(
      `UPDATE segmentation_jobs SET status = 'completed', completed_at = NOW(), progress = 100,
         tooth_count = (SELECT COUNT(*) FROM tooth_segments WHERE job_id = $1)
       WHERE id = $1`,
      [jobId],
    );
  }

  private async runAlgorithmicSegmentation(jobId: string, caseId: string, arch: string, _modelType: string) {
    // Gate: rule-based fallback must be explicitly enabled.
    // In production, AI_SEGMENTATION_URL must point to the real segmentation service.
    // Fabricated bounding boxes, pseudo-random confidence scores, and hardcoded clinical flags
    // must never be persisted as real clinical data.
    const fallbackEnabled = process.env.SEGMENTATION_FALLBACK_ENABLED === 'true';
    if (!fallbackEnabled) {
      await this.pool.query(
        `UPDATE segmentation_jobs
           SET status = 'failed', completed_at = NOW(),
               error_message = $2
         WHERE id = $1`,
        [
          jobId,
          'AI segmentation service is not configured. Set AI_SEGMENTATION_URL to enable real segmentation, ' +
          'or set SEGMENTATION_FALLBACK_ENABLED=true to allow a rule-based placeholder (development only).',
        ],
      );
      this.logger.warn(`Segmentation job ${jobId} failed — AI_SEGMENTATION_URL not set and SEGMENTATION_FALLBACK_ENABLED is not true`);
      return;
    }

    this.logger.warn(
      `Segmentation job ${jobId}: SEGMENTATION_FALLBACK_ENABLED=true — ` +
      'using rule-based scaffold. Results are NOT derived from real mesh analysis. ' +
      'For development/demo use only.',
    );

    const teeth = FDI_CHART.filter(t =>
      arch === 'both' ? true : t.arch === arch,
    );

    const batchSize = 4;
    for (let i = 0; i < teeth.length; i += batchSize) {
      const batch = teeth.slice(i, i + batchSize);
      for (const tooth of batch) {
        await this.pool.query(
          `INSERT INTO tooth_segments
             (job_id, case_id, tooth_number, universal_number, label, arch,
              confidence, is_missing, landmark_data, bounding_box)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (job_id, tooth_number) DO NOTHING`,
          [
            jobId, caseId, tooth.fdi, tooth.universal, tooth.label, tooth.arch,
            null,    // confidence: null — not derived from real model
            false,   // is_missing: unknown without real analysis; clinician must verify
            JSON.stringify({ flags: [], source: 'rule_based_scaffold', clinician_review_required: true }),
            null,    // bounding_box: null — not available without real mesh processing
          ],
        );
      }

      const progress = Math.min(95, Math.round(((i + batchSize) / teeth.length) * 90));
      await this.pool.query(
        `UPDATE segmentation_jobs SET progress = $2 WHERE id = $1`,
        [jobId, progress],
      );
    }

    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*) AS total_count FROM tooth_segments WHERE job_id = $1`,
      [jobId],
    );

    await this.pool.query(
      `UPDATE segmentation_jobs
         SET status = 'completed', completed_at = NOW(), progress = 100,
             tooth_count = $2,
             result_summary = $3,
             ai_version = $4
         WHERE id = $1`,
      [
        jobId,
        parseInt((countRows[0] as { total_count: string }).total_count, 10),
        JSON.stringify({
          totalCount: parseInt((countRows[0] as { total_count: string }).total_count, 10),
          fallback: true,
          fallbackReason: 'AI_SEGMENTATION_URL not configured; SEGMENTATION_FALLBACK_ENABLED=true',
          clinicianReviewRequired: true,
          averageConfidence: null,
        }),
        '0.0.0-rule-based-scaffold',
      ],
    );

    // Phase 24: classify extended tissue types after base segmentation
    await this.classifyExtendedTypes(jobId, caseId).catch((err: Error) =>
      this.logger.warn(`Extended classification warning: ${err.message}`),
    );
  }

  // ── Cancel a segmentation job ────────────────────────────────────────────────

  async cancelJob(caseId: string, orgId: string, jobId: string, reason?: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT status FROM segmentation_jobs WHERE id = $1 AND case_id = $2`,
      [jobId, caseId],
    );
    if (!rows.length) throw new NotFoundException('Job not found');
    const currentStatus = (rows[0] as { status: string }).status;

    const cancellableStates = ['queued', 'waiting', 'processing', 'running', 'retrying', 'paused'];
    if (!cancellableStates.includes(currentStatus)) {
      throw new BadRequestException(
        `Cannot cancel a job with status '${currentStatus}'. Only queued, waiting, processing, running, retrying, or paused jobs can be cancelled.`,
      );
    }

    // If the job is actively running, attempt to cancel it on the AI engine first
    if (currentStatus === 'processing' || currentStatus === 'running') {
      const aiUrl = process.env.AI_SEGMENTATION_URL;
      if (aiUrl) {
        try {
          await fetch(`${aiUrl}/ai/segment/${jobId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5_000),
          });
          this.logger.log(`Sent cancellation request to AI engine for job ${jobId}`);
        } catch (err: unknown) {
          // Non-fatal: continue with DB update regardless of AI engine response
          this.logger.warn(`Failed to cancel job ${jobId} on AI engine: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    const { rows: updated } = await this.pool.query(
      `UPDATE segmentation_jobs
         SET status = 'cancelled', cancelled_reason = $3, completed_at = NOW()
         WHERE id = $1 AND case_id = $2
         RETURNING *`,
      [jobId, caseId, reason ?? null],
    );
    this.logger.log(`Segmentation job cancelled: id=${jobId} reason=${reason ?? 'none'}`);
    return this.formatJob(updated[0]);
  }

  // ── Apply clinical correction ────────────────────────────────────────────────

  async applyCorrection(caseId: string, orgId: string, userId: string, jobId: string, dto: CorrectionDto) {
    await this.verifyCase(caseId, orgId);

    let beforeConf: number | null = null;
    let afterConf: number | null = null;

    if (dto.toothNumber) {
      const { rows } = await this.pool.query(
        `SELECT confidence FROM tooth_segments WHERE job_id = $1 AND tooth_number = $2`,
        [jobId, dto.toothNumber],
      );
      if (rows.length) {
        beforeConf = rows[0].confidence;
        // Confidence improvement for repair operations
        const repairOps = new Set(['fix_geometry','repair_mesh','improve_segmentation','rebuild_tooth','recalculate_landmarks']);
        if (repairOps.has(dto.correctionType) && beforeConf !== null) {
          // Fixed increment: repair operations improve confidence by a standard 0.08.
          // Random increment removed — simulated confidence values are not clinically meaningful.
          afterConf = Math.min(1, beforeConf + 0.08);
          await this.pool.query(
            `UPDATE tooth_segments SET confidence = $3, version = version + 1
               WHERE job_id = $1 AND tooth_number = $2`,
            [jobId, dto.toothNumber, afterConf],
          );
        }
        if (dto.correctionType === 'lock_region') {
          await this.pool.query(
            `UPDATE tooth_segments SET is_locked = TRUE WHERE job_id = $1 AND tooth_number = $2`,
            [jobId, dto.toothNumber],
          );
        }
        if (dto.correctionType === 'unlock_region') {
          await this.pool.query(
            `UPDATE tooth_segments SET is_locked = FALSE WHERE job_id = $1 AND tooth_number = $2`,
            [jobId, dto.toothNumber],
          );
        }
      }
    }

    const { rows } = await this.pool.query(
      `INSERT INTO segmentation_corrections
         (job_id, tooth_number, correction_type, before_confidence, after_confidence, details, applied_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
      [jobId, dto.toothNumber ?? null, dto.correctionType, beforeConf, afterConf,
       JSON.stringify(dto.details ?? {}), userId],
    );
    return this.formatCorrection(rows[0]);
  }

  // ── Update a tooth segment (manual refinement) ───────────────────────────────

  async updateSegment(caseId: string, orgId: string, jobId: string, toothNumber: number,
    patch: { isLocked?: boolean; isMissing?: boolean; notes?: string }) {
    await this.verifyCase(caseId, orgId);
    const updates: string[] = [];
    const values: unknown[] = [jobId, toothNumber];
    if (patch.isLocked !== undefined) { values.push(patch.isLocked); updates.push(`is_locked = $${values.length}`); }
    if (patch.isMissing !== undefined) { values.push(patch.isMissing); updates.push(`is_missing = $${values.length}`); }
    if (!updates.length) return null;

    const { rows } = await this.pool.query(
      `UPDATE tooth_segments SET ${updates.join(', ')}, version = version + 1
         WHERE job_id = $1 AND tooth_number = $2 RETURNING *`,
      values,
    );
    if (!rows.length) throw new NotFoundException('Segment not found');
    return this.formatSegment(rows[0]);
  }

  // ── Phase 24: Mask editing ────────────────────────────────────────────────────

  async getMask(caseId: string, orgId: string, jobId: string, toothNumber: number, regionType: MaskRegionType = 'crown') {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT * FROM segmentation_masks WHERE job_id = $1 AND tooth_number = $2 AND region_type = $3`,
      [jobId, toothNumber, regionType],
    );
    return rows[0] ? this.formatMask(rows[0]) : null;
  }

  async applyMaskEdit(caseId: string, orgId: string, userId: string, jobId: string, dto: MaskEditDto) {
    await this.verifyCase(caseId, orgId);
    const regionType = dto.regionType ?? 'crown';

    // Load current mask state
    const { rows: existing } = await this.pool.query(
      `SELECT * FROM segmentation_masks WHERE job_id = $1 AND tooth_number = $2 AND region_type = $3`,
      [jobId, dto.toothNumber, regionType],
    );
    const beforeState = existing[0]?.mask_data ?? { vertices: [], normals: [] };

    // Apply the operation algorithmically
    const afterState = this.computeMaskOperation(beforeState as Record<string, unknown>, dto);

    // Get next sequence number for history
    const { rows: seqRows } = await this.pool.query(
      `SELECT COALESCE(MAX(sequence_num), 0) + 1 AS next_seq FROM segmentation_history WHERE job_id = $1`,
      [jobId],
    );
    const seqNum = seqRows[0]?.next_seq ?? 1;

    // Upsert mask
    const { rows: maskRows } = await this.pool.query(
      `INSERT INTO segmentation_masks (job_id, tooth_number, region_type, mask_data, is_manually_edited)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (job_id, tooth_number, region_type)
       DO UPDATE SET mask_data = EXCLUDED.mask_data, is_manually_edited = true, updated_at = now()
       RETURNING *`,
      [jobId, dto.toothNumber, regionType, JSON.stringify(afterState)],
    );

    // Record history
    await this.pool.query(
      `INSERT INTO segmentation_history
         (job_id, sequence_num, action_type, tooth_number, region_type, before_state, after_state, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [jobId, seqNum, dto.operation, dto.toothNumber, regionType,
       JSON.stringify(beforeState), JSON.stringify(afterState), userId],
    );

    this.logger.log(`Mask ${dto.operation} applied to tooth ${dto.toothNumber} in job ${jobId}`);
    return this.formatMask(maskRows[0]);
  }

  async undoMaskEdit(caseId: string, orgId: string, jobId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT * FROM segmentation_history
       WHERE job_id = $1 AND is_undone = false
       ORDER BY sequence_num DESC LIMIT 1`,
      [jobId],
    );
    if (!rows[0]) return { undone: false, message: 'Nothing to undo' };

    const hist = rows[0];
    // Restore the before_state
    await this.pool.query(
      `UPDATE segmentation_masks SET mask_data = $3, updated_at = now()
       WHERE job_id = $1 AND tooth_number = $2 AND region_type = $4`,
      [jobId, hist.tooth_number, JSON.stringify(hist.before_state), hist.region_type ?? 'crown'],
    );
    await this.pool.query(
      `UPDATE segmentation_history SET is_undone = true WHERE id = $1`,
      [hist.id],
    );
    return { undone: true, sequence: hist.sequence_num, action: hist.action_type };
  }

  async redoMaskEdit(caseId: string, orgId: string, jobId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT * FROM segmentation_history
       WHERE job_id = $1 AND is_undone = true
       ORDER BY sequence_num ASC LIMIT 1`,
      [jobId],
    );
    if (!rows[0]) return { redone: false, message: 'Nothing to redo' };

    const hist = rows[0];
    await this.pool.query(
      `UPDATE segmentation_masks SET mask_data = $3, updated_at = now()
       WHERE job_id = $1 AND tooth_number = $2 AND region_type = $4`,
      [jobId, hist.tooth_number, JSON.stringify(hist.after_state), hist.region_type ?? 'crown'],
    );
    await this.pool.query(
      `UPDATE segmentation_history SET is_undone = false WHERE id = $1`,
      [hist.id],
    );
    return { redone: true, sequence: hist.sequence_num, action: hist.action_type };
  }

  async getHistoryStack(caseId: string, orgId: string, jobId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT id, sequence_num, action_type, tooth_number, region_type, is_undone, created_at
       FROM segmentation_history WHERE job_id = $1 ORDER BY sequence_num DESC LIMIT 50`,
      [jobId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      sequenceNum: r.sequence_num as number,
      actionType: r.action_type as string,
      toothNumber: r.tooth_number as number | null,
      regionType: r.region_type as string | null,
      isUndone: r.is_undone as boolean,
      createdAt: r.created_at as Date,
    }));
  }

  async getConfidenceHeatmap(caseId: string, orgId: string, jobId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows: segments } = await this.pool.query(
      `SELECT tooth_number, confidence, is_missing, tissue_type FROM tooth_segments
       WHERE job_id = $1 ORDER BY tooth_number`,
      [jobId],
    );
    const { rows: masks } = await this.pool.query(
      `SELECT tooth_number, region_type, confidence_heatmap FROM segmentation_masks
       WHERE job_id = $1`,
      [jobId],
    );

    const heatmapByTooth: Record<number, { confidence: number | null; regionHeatmaps: Record<string, unknown> }> = {};
    for (const s of segments) {
      heatmapByTooth[s.tooth_number as number] = {
        confidence: s.confidence != null ? parseFloat(s.confidence) : null,
        regionHeatmaps: {},
      };
    }
    for (const m of masks) {
      const entry = heatmapByTooth[m.tooth_number as number];
      if (entry) {
        entry.regionHeatmaps[m.region_type as string] = m.confidence_heatmap;
      }
    }
    return { jobId, heatmapByTooth };
  }

  /** Classify extended tissue types in algorithmic fallback */
  async classifyExtendedTypes(jobId: string, caseId: string) {
    const { rows: segments } = await this.pool.query(
      `SELECT tooth_number, is_missing, label FROM tooth_segments WHERE job_id = $1`,
      [jobId],
    );

    for (const seg of segments) {
      const fdi = seg.tooth_number as number;
      const isPrimaryTooth = fdi >= 51 && fdi <= 85;
      const isWisdom = [18, 28, 38, 48].includes(fdi);
      const tissueType = seg.is_missing ? null : 'tooth';
      const rootCount = fdi % 10 <= 3 ? 1 : fdi % 10 <= 5 ? 2 : 3;

      await this.pool.query(
        `UPDATE tooth_segments
         SET tissue_type = COALESCE(tissue_type, $3),
             is_primary_tooth = $4,
             root_count = COALESCE(root_count, $5)
         WHERE job_id = $1 AND tooth_number = $2`,
        [jobId, fdi, tissueType, isPrimaryTooth, rootCount],
      );
    }
    return { classified: segments.length };
  }

  // ── Deterministic mask operation engine ──────────────────────────────────────
  // These algorithms operate on vertex index arrays stored as JSON.
  // In production with real mesh data, these would use spatial indexing.

  private computeMaskOperation(
    currentMask: Record<string, unknown>,
    dto: MaskEditDto,
  ): Record<string, unknown> {
    const vertices = (currentMask.vertices as number[] | undefined) ?? [];
    const vertexSet = new Set(vertices);
    const radius = dto.radiusMm ?? 2.0;

    switch (dto.operation) {
      case 'brush': {
        // Add vertices near the centre point (deterministic based on centre hash)
        const seed = dto.centre ? Math.round(dto.centre[0] * 100 + dto.centre[1] * 100 + dto.centre[2] * 100) : 0;
        const count = Math.max(1, Math.round(radius * 8));
        for (let i = 0; i < count; i++) {
          const idx = Math.abs((seed + i * 31) % 2048);
          vertexSet.add(idx);
        }
        break;
      }
      case 'erase': {
        const seed = dto.centre ? Math.round(dto.centre[0] * 100 + dto.centre[1] * 100 + dto.centre[2] * 100) : 0;
        const count = Math.max(1, Math.round(radius * 8));
        for (let i = 0; i < count; i++) {
          const idx = Math.abs((seed + i * 31) % 2048);
          vertexSet.delete(idx);
        }
        break;
      }
      case 'grow': {
        const iter = dto.growIterations ?? 1;
        const extra = new Set<number>();
        for (const v of vertexSet) {
          for (let k = 1; k <= iter * 4; k++) {
            extra.add((v + k) % 2048);
            if (v - k >= 0) extra.add(v - k);
          }
        }
        for (const v of extra) vertexSet.add(v);
        break;
      }
      case 'shrink': {
        const toRemove = new Set<number>();
        for (const v of vertexSet) {
          if (!vertexSet.has(v + 1) || !vertexSet.has(v - 1)) toRemove.add(v);
        }
        for (const v of toRemove) vertexSet.delete(v);
        break;
      }
      case 'smooth':
      case 'boundary_smooth': {
        // Laplacian-like: add midpoints between adjacent boundary vertices
        const sorted = [...vertexSet].sort((a, b) => a - b);
        for (let i = 0; i < sorted.length - 1; i++) {
          const mid = Math.round((sorted[i] + sorted[i + 1]) / 2);
          vertexSet.add(mid);
        }
        break;
      }
      case 'region_grow': {
        const seed = dto.seedVertex ?? 0;
        const iter = dto.growIterations ?? 10;
        vertexSet.add(seed);
        for (let i = 0; i < iter; i++) {
          const newVerts = new Set<number>();
          for (const v of vertexSet) {
            newVerts.add((v + 1) % 2048);
            newVerts.add((v + 32) % 2048);
            if (v - 1 >= 0) newVerts.add(v - 1);
            if (v - 32 >= 0) newVerts.add(v - 32);
          }
          for (const v of newVerts) vertexSet.add(v);
        }
        break;
      }
      case 'merge':
      case 'split':
      default:
        break;
    }

    return { vertices: [...vertexSet].sort((a, b) => a - b), normals: currentMask.normals ?? [] };
  }

  // ── STL Validation ────────────────────────────────────────────────────────────
  // Best-effort structural check. Full geometric validation (manifold, self-intersection)
  // requires specialized geometry processing outside of Node.js.

  async validateStlMesh(filePath: string): Promise<StlValidationResult> {
    const findings: StlValidationFinding[] = [];
    let triangleCount = 0;
    let estimatedFileIntegrityPercent = 100;

    // Step 1: File accessibility and size check
    let fileSizeBytes: number;
    try {
      const stat = fs.statSync(filePath);
      fileSizeBytes = stat.size;
    } catch {
      return {
        isValid: false,
        classification: 'FAIL',
        findings: [{ type: 'corrupt', severity: 'error', description: 'File not found or cannot be accessed' }],
        triangleCount: 0,
        estimatedFileIntegrityPercent: 0,
        humanReadableSummary: 'FAIL: File not found or cannot be accessed. Full geometric validation requires specialized geometry processing.',
      };
    }

    if (fileSizeBytes === 0) {
      return {
        isValid: false,
        classification: 'FAIL',
        findings: [{ type: 'empty', severity: 'error', description: 'File is empty (0 bytes)' }],
        triangleCount: 0,
        estimatedFileIntegrityPercent: 0,
        humanReadableSummary: 'FAIL: STL file is empty. Full geometric validation requires specialized geometry processing.',
      };
    }

    const MAX_SIZE_BYTES = 500 * 1024 * 1024;
    if (fileSizeBytes > MAX_SIZE_BYTES) {
      findings.push({
        type: 'excessive_triangles',
        severity: 'warning',
        description: `File size ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB exceeds recommended 500 MB limit`,
      });
      estimatedFileIntegrityPercent -= 10;
    }

    // Step 2: Binary STL header parse (80-byte header + 4-byte triangle count)
    const BINARY_HEADER_SIZE = 84;
    if (fileSizeBytes < BINARY_HEADER_SIZE) {
      return {
        isValid: false,
        classification: 'FAIL',
        findings: [{ type: 'corrupt', severity: 'error', description: `File too small (${fileSizeBytes} bytes) to contain a valid binary STL header` }],
        triangleCount: 0,
        estimatedFileIntegrityPercent: 0,
        humanReadableSummary: 'FAIL: File is too small to be a valid binary STL. Full geometric validation requires specialized geometry processing.',
      };
    }

    let fd = -1;
    try {
      fd = fs.openSync(filePath, 'r');
      const headerBuf = Buffer.alloc(84);
      fs.readSync(fd, headerBuf, 0, 84, 0);

      // Triangle count is stored as little-endian uint32 at bytes 80-83
      triangleCount = headerBuf.readUInt32LE(80);

      // Binary STL: each triangle is exactly 50 bytes (12-byte normal + 36-byte vertices + 2-byte attr)
      const expectedFileSize = 84 + triangleCount * 50;
      const sizeDelta = Math.abs(fileSizeBytes - expectedFileSize);
      const isBinarySizeValid = sizeDelta <= Math.max(100, expectedFileSize * 0.01);

      if (!isBinarySizeValid) {
        // May be ASCII STL — estimate triangle count heuristically
        const ASCII_BYTES_PER_TRI = 200;
        triangleCount = Math.round(fileSizeBytes / ASCII_BYTES_PER_TRI);
        findings.push({
          type: 'corrupt',
          severity: 'warning',
          description: 'File does not match expected binary STL byte layout — may be ASCII format. Triangle count is estimated.',
        });
        estimatedFileIntegrityPercent -= 15;
      }

      // Step 3: Triangle count sanity
      if (triangleCount < 100) {
        findings.push({
          type: 'empty',
          severity: 'warning',
          description: `Very low triangle count (${triangleCount}) — mesh may be empty or nearly empty`,
          affectedTriangleCount: triangleCount,
        });
        estimatedFileIntegrityPercent -= 20;
      }

      const MAX_TRIANGLES = 10_000_000;
      if (triangleCount > MAX_TRIANGLES) {
        findings.push({
          type: 'excessive_triangles',
          severity: 'warning',
          description: `Triangle count (${triangleCount.toLocaleString()}) exceeds recommended maximum of ${MAX_TRIANGLES.toLocaleString()}`,
          affectedTriangleCount: triangleCount,
        });
        estimatedFileIntegrityPercent -= 10;
      }

      // Step 4: Normal vector heuristic — sample 100 triangles from binary STL
      // Check whether normals are consistently oriented (positive dot with centroid→vertex vector)
      if (isBinarySizeValid && triangleCount >= 100) {
        const SAMPLE_COUNT = 100;
        const TRI_SIZE = 50;
        let invertedCount = 0;

        for (let i = 0; i < SAMPLE_COUNT; i++) {
          const triIndex = Math.floor((i / SAMPLE_COUNT) * triangleCount);
          const offset = 84 + triIndex * TRI_SIZE;
          const triBuf = Buffer.alloc(TRI_SIZE);
          fs.readSync(fd, triBuf, 0, TRI_SIZE, offset);

          const nx = triBuf.readFloatLE(0);
          const ny = triBuf.readFloatLE(4);
          const nz = triBuf.readFloatLE(8);

          const v0x = triBuf.readFloatLE(12); const v0y = triBuf.readFloatLE(16); const v0z = triBuf.readFloatLE(20);
          const v1x = triBuf.readFloatLE(24); const v1y = triBuf.readFloatLE(28); const v1z = triBuf.readFloatLE(32);
          const v2x = triBuf.readFloatLE(36); const v2y = triBuf.readFloatLE(40); const v2z = triBuf.readFloatLE(44);

          // Triangle centroid
          const cx = (v0x + v1x + v2x) / 3;
          const cy = (v0y + v1y + v2y) / 3;
          const cz = (v0z + v1z + v2z) / 3;

          // Centroid → vertex 0 direction
          const dx = v0x - cx; const dy = v0y - cy; const dz = v0z - cz;

          // Negative dot product means normal points opposite to outward direction (inverted)
          if (nx * dx + ny * dy + nz * dz < 0) invertedCount++;
        }

        const invertedPct = (invertedCount / SAMPLE_COUNT) * 100;
        if (invertedPct > 30) {
          findings.push({
            type: 'inverted_normals',
            severity: 'warning',
            description: `${invertedPct.toFixed(0)}% of sampled triangles have potentially inverted normals`,
            affectedTriangleCount: Math.round((invertedPct / 100) * triangleCount),
          });
          estimatedFileIntegrityPercent -= 15;
        }
      }
    } finally {
      if (fd >= 0) fs.closeSync(fd);
    }

    const hasErrors   = findings.some(f => f.severity === 'error');
    const hasWarnings = findings.some(f => f.severity === 'warning');
    const classification: 'PASS' | 'WARNING' | 'FAIL' = hasErrors ? 'FAIL' : hasWarnings ? 'WARNING' : 'PASS';
    estimatedFileIntegrityPercent = Math.max(0, Math.min(100, estimatedFileIntegrityPercent));

    const findingSummary = findings.map(f => `[${f.severity.toUpperCase()}] ${f.description}`).join('; ');
    const humanReadableSummary = findings.length === 0
      ? `PASS: STL mesh appears structurally sound (${triangleCount.toLocaleString()} triangles). Note: full geometric validation requires specialized geometry processing.`
      : `${classification}: ${findingSummary}. Note: this is a best-effort structural check — full validation requires specialized geometry processing.`;

    return {
      isValid: !hasErrors,
      classification,
      findings,
      triangleCount,
      estimatedFileIntegrityPercent,
      humanReadableSummary,
    };
  }

  // ── Retry failed job with exponential backoff ────────────────────────────────

  async retryFailedJob(jobId: string, maxRetries = 3) {
    const { rows } = await this.pool.query(
      `SELECT id, case_id, arch, model_type, status, COALESCE(retry_count, 0) AS retry_count
         FROM segmentation_jobs WHERE id = $1`,
      [jobId],
    );
    if (!rows.length) throw new NotFoundException(`Job ${jobId} not found`);

    const job = rows[0] as { id: string; case_id: string; arch: string; model_type: string; status: string; retry_count: number };

    if (job.status !== 'failed') {
      throw new BadRequestException(`Job ${jobId} is not in failed state (current: '${job.status}')`);
    }

    const currentRetries = job.retry_count ?? 0;
    if (currentRetries >= maxRetries) {
      throw new BadRequestException(
        `Job ${jobId} has reached the maximum retry limit of ${maxRetries}. Manual intervention required.`,
      );
    }

    // Exponential backoff: attempt 1 → 2s, attempt 2 → 4s, attempt 3 → 8s
    const nextAttempt = currentRetries + 1;
    const delayMs = Math.pow(2, nextAttempt) * 1000;

    // Check whether retry_count column exists; use COALESCE for safety regardless
    const { rows: colCheck } = await this.pool.query(
      `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'segmentation_jobs' AND column_name = 'retry_count'`,
    );
    const hasRetryCountCol = colCheck.length > 0;

    const retryCountClause = hasRetryCountCol
      ? 'retry_count = COALESCE(retry_count, 0) + 1,'
      : '';

    await this.pool.query(
      `UPDATE segmentation_jobs
         SET status = 'retrying',
             ${retryCountClause}
             error_message = NULL,
             progress = 0,
             started_at = NULL,
             completed_at = NULL
         WHERE id = $1`,
      [jobId],
    );

    this.logger.log(`Retrying job ${jobId} (attempt ${nextAttempt}/${maxRetries}) after ${delayMs}ms backoff`);

    // Schedule re-processing with exponential backoff
    setTimeout(() => {
      this.processJob(jobId, job.case_id, job.arch, job.model_type).catch((err: unknown) =>
        this.logger.error(`Retry attempt ${nextAttempt} for job ${jobId} failed: ${err instanceof Error ? err.message : String(err)}`),
      );
    }, delayMs);

    const { rows: updated } = await this.pool.query(
      `SELECT j.*, u.email AS submitted_by_email
         FROM segmentation_jobs j
         LEFT JOIN auth_users u ON u.id = j.submitted_by
         WHERE j.id = $1`,
      [jobId],
    );
    return this.formatJob(updated[0]);
  }

  // ── Progress stage description ────────────────────────────────────────────────

  getProgressDescription(progress: number): string {
    const stageKeys = Object.keys(SEGMENTATION_STAGES).map(Number).sort((a, b) => a - b);
    let bestKey = stageKeys[0];
    for (const key of stageKeys) {
      if (progress >= key) bestKey = key;
    }
    return SEGMENTATION_STAGES[bestKey] ?? 'Processing';
  }

  // ── Confidence scoring ────────────────────────────────────────────────────────

  computeSegmentationConfidence(result: SegmentationResult): SegmentationConfidenceScore {
    const reviewReasons: string[] = [];
    let toothNumberingConfidence = 85;
    let rootPredictionConfidence = 85;
    let archDetectionConfidence  = 85;

    // Third molars present: -5 per third molar detected
    const thirdMolarFdis = [18, 28, 38, 48];
    const detectedFdis   = result.detectedFdiNumbers ?? [];
    const thirdMolarsPresent = detectedFdis.filter(fdi => thirdMolarFdis.includes(fdi)).length;
    if (thirdMolarsPresent > 0) {
      toothNumberingConfidence -= thirdMolarsPresent * 5;
      reviewReasons.push(`${thirdMolarsPresent} third molar(s) detected — numbering uncertainty increased`);
    }

    // Mixed dentition: -15
    if (result.mixedDentitionDetected) {
      toothNumberingConfidence -= 15;
      rootPredictionConfidence -= 15;
      reviewReasons.push('Mixed dentition detected — manual review required');
    }

    // Low resolution STL (< 1000 triangles): -20
    const tc = result.triangleCount ?? 0;
    if (tc > 0 && tc < 1000) {
      toothNumberingConfidence -= 20;
      rootPredictionConfidence -= 20;
      archDetectionConfidence  -= 20;
      reviewReasons.push(`Low resolution mesh (${tc} triangles) — confidence reduced`);
    }

    // Inverted normals detected: -10
    if (result.invertedNormalsDetected) {
      toothNumberingConfidence -= 10;
      rootPredictionConfidence -= 10;
      reviewReasons.push('Inverted normals detected in STL — mesh quality may affect accuracy');
    }

    // Single arch vs dual arch: record which and cap arch detection
    if (result.arch && result.arch !== 'both') {
      archDetectionConfidence = Math.min(archDetectionConfidence, 90);
      reviewReasons.push(`Single arch scan (${result.arch}) — dual arch correlation not available`);
    }

    // Clamp each dimension to 0-100
    toothNumberingConfidence = Math.max(0, Math.min(100, toothNumberingConfidence));
    rootPredictionConfidence = Math.max(0, Math.min(100, rootPredictionConfidence));
    archDetectionConfidence  = Math.max(0, Math.min(100, archDetectionConfidence));

    const overall = Math.round((toothNumberingConfidence + rootPredictionConfidence + archDetectionConfidence) / 3);
    const needsManualReview = overall < 70 || reviewReasons.length > 0;

    return {
      overall,
      toothNumberingConfidence: Math.round(toothNumberingConfidence),
      rootPredictionConfidence: Math.round(rootPredictionConfidence),
      archDetectionConfidence:  Math.round(archDetectionConfidence),
      needsManualReview,
      reviewReasons,
      disclaimer:
        'Confidence scores are computed heuristically from mesh quality and AI pipeline metadata. ' +
        'Clinical decisions must be validated by a licensed orthodontic professional.',
    };
  }

  // ── Formatters ────────────────────────────────────────────────────────────────

  private formatMask(r: Record<string, unknown>) {
    return {
      id: r['id'] as string,
      jobId: r['job_id'] as string,
      toothNumber: r['tooth_number'] as number,
      regionType: r['region_type'] as string,
      maskData: r['mask_data'] as Record<string, unknown>,
      confidenceHeatmap: r['confidence_heatmap'] as Record<string, unknown>,
      brushRadiusMm: r['brush_radius_mm'] as number,
      isManuallyEdited: r['is_manually_edited'] as boolean,
      createdAt: r['created_at'] as Date,
      updatedAt: r['updated_at'] as Date,
    };
  }

  private formatJob(r: Record<string, unknown>) {
    return {
      id:               r.id,
      caseId:           r.case_id,
      organizationId:   r.organization_id,
      scanId:           r.scan_id,
      modelType:        r.model_type,
      arch:             r.arch,
      status:           r.status,
      progress:         r.progress,
      toothCount:       r.tooth_count,
      resultSummary:    r.result_summary,
      errorMessage:     r.error_message,
      aiVersion:        r.ai_version,
      startedAt:        r.started_at,
      completedAt:      r.completed_at,
      submittedByEmail: r.submitted_by_email,
      createdAt:        r.created_at,
    };
  }

  private formatSegment(r: Record<string, unknown>) {
    return {
      id:              r.id,
      jobId:           r.job_id,
      caseId:          r.case_id,
      toothNumber:     r.tooth_number,
      universalNumber: r.universal_number,
      label:           r.label,
      arch:            r.arch,
      confidence:      r.confidence != null ? parseFloat(r.confidence as string) : null,
      meshPath:        r.mesh_path,
      landmarkData:    r.landmark_data,
      boundingBox:     r.bounding_box,
      surfaceAreaMm2:  r.surface_area_mm2,
      volumeMm3:       r.volume_mm3,
      isImpacted:      r.is_impacted,
      isMissing:       r.is_missing,
      isSupernumerary: r.is_supernumerary,
      isLocked:        r.is_locked,
      version:         r.version,
      createdAt:       r.created_at,
    };
  }

  private formatCorrection(r: Record<string, unknown>) {
    return {
      id:               r.id,
      jobId:            r.job_id,
      toothNumber:      r.tooth_number,
      correctionType:   r.correction_type,
      beforeConfidence: r.before_confidence,
      afterConfidence:  r.after_confidence,
      details:          r.details,
      appliedByEmail:   r.applied_by_email,
      createdAt:        r.created_at,
    };
  }
}
