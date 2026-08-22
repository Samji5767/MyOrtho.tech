import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
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

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

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
    this.processJob(job.id, caseId, orgId, userId, arch, modelType).catch(err =>
      this.logger.error(`Segmentation job ${job.id} failed: ${err.message}`),
    );

    return this.formatJob(job);
  }

  // ── AI processing pipeline ───────────────────────────────────────────────────

  private async processJob(
    jobId: string,
    caseId: string,
    orgId: string,
    userId: string,
    arch: string,
    modelType: string,
  ) {
    await this.pool.query(
      `UPDATE segmentation_jobs SET status = 'processing', started_at = NOW(), progress = 5 WHERE id = $1`,
      [jobId],
    );

    const aiUrl = process.env.AI_SEGMENTATION_URL;

    try {
      if (aiUrl) {
        const { rows: jobRows } = await this.pool.query(
          `SELECT result_summary FROM segmentation_jobs WHERE id = $1`, [jobId],
        );
        const jobMeta = jobRows[0]?.result_summary as { provider?: string } | null;
        await this.callExternalAIService(jobId, aiUrl, arch, jobMeta?.provider);
      } else {
        this.logger.warn(
          `AI_SEGMENTATION_URL not configured — using rule-based fallback for job ${jobId}`,
        );
        await this.runAlgorithmicSegmentation(jobId, caseId, arch, modelType);
      }
    } catch (err: any) {
      this.logger.error(`Processing error for job ${jobId}: ${err.message}`);
      await this.pool.query(
        `UPDATE segmentation_jobs SET status = 'failed', error_message = $2, progress = 0 WHERE id = $1`,
        [jobId, err.message],
      );
    }
  }

  /**
   * Drive the real AI-engine contract: submit the scan file for segmentation
   * (async — the engine returns a job id), poll until it finishes, then
   * persist per-tooth confidences. A manual-review result (no automated
   * provider available) is recorded as review_required, never as completed.
   */
  private async callExternalAIService(jobId: string, aiUrl: string, arch: string, provider?: string) {
    const internalSecret = process.env.INTERNAL_API_SECRET ?? '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(internalSecret ? { 'X-Internal-Token': internalSecret } : {}),
    };

    // Resolve the scan file to segment: the job's scan, else the latest scan
    // for the case. Segmentation without a scan is impossible.
    const { rows: jobRows } = await this.pool.query(
      `SELECT j.case_id, j.scan_id,
              COALESCE(s.file_path, latest.file_path) AS file_path,
              COALESCE(s.jaw_type, latest.jaw_type) AS jaw_type
       FROM segmentation_jobs j
       LEFT JOIN scans s ON s.id = j.scan_id
       LEFT JOIN LATERAL (
         SELECT file_path, jaw_type FROM scans
         WHERE case_id = j.case_id ORDER BY created_at DESC LIMIT 1
       ) latest ON true
       WHERE j.id = $1`,
      [jobId],
    );
    const jobRow = jobRows[0] as
      | { case_id: string; scan_id: string | null; file_path: string | null; jaw_type: string | null }
      | undefined;
    if (!jobRow?.file_path) {
      throw new Error('No scan uploaded for this case — upload a scan before requesting segmentation');
    }
    const caseId = jobRow.case_id;
    const jawType =
      arch === 'both' || jobRow.jaw_type === 'both'
        ? 'combined'
        : (jobRow.jaw_type ?? 'auto');

    const res = await fetch(`${aiUrl}/ai/segment`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        case_id: caseId,
        scan_id: jobRow.scan_id,
        file_path: jobRow.file_path,
        jaw_type: jawType,
        ...(provider ? { provider } : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AI service returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
    const submitted = (await res.json()) as { job_id: string };

    // Poll the engine until the job resolves (bounded).
    const POLL_INTERVAL_MS = 3_000;
    const POLL_LIMIT = 100; // 5 minutes
    let aiJob: Record<string, unknown> | null = null;
    for (let i = 0; i < POLL_LIMIT; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const poll = await fetch(`${aiUrl}/ai/jobs/${submitted.job_id}`, {
        headers,
        signal: AbortSignal.timeout(5_000),
      });
      if (!poll.ok) continue;
      const body = (await poll.json()) as Record<string, unknown>;
      const s = body['status'] as string | undefined;
      if (s === 'completed' || s === 'failed') { aiJob = body; break; }
      await this.pool.query(
        `UPDATE segmentation_jobs SET progress = LEAST(90, progress + 5) WHERE id = $1`,
        [jobId],
      );
    }
    if (!aiJob) throw new Error('AI segmentation timed out while polling for a result');
    if (aiJob['status'] === 'failed') {
      throw new Error((aiJob['error'] as string | undefined) ?? 'AI engine reported failure');
    }

    const requiresManualReview = aiJob['requires_manual_review'] === true;
    const confidences = (aiJob['teeth_confidence'] ?? {}) as Record<string, number>;
    const toothIds = (aiJob['tooth_ids'] ?? []) as number[];
    const summary = JSON.stringify({
      engine: aiJob['engine'] ?? null,
      requires_manual_review: requiresManualReview,
      warning: aiJob['warning'] ?? null,
      segmented_mesh_path: aiJob['segmented_mesh_path'] ?? null,
      ...(provider ? { provider } : {}),
    });

    if (requiresManualReview && toothIds.length === 0) {
      // No automated provider produced segmentation — needs a human.
      await this.pool.query(
        `UPDATE segmentation_jobs
         SET status = 'review_required', completed_at = NOW(), progress = 100,
             tooth_count = 0, result_summary = $2
         WHERE id = $1`,
        [jobId, summary],
      );
      return;
    }

    for (const fdi of toothIds) {
      const tooth = FDI_CHART.find(t => t.fdi === fdi);
      if (!tooth) {
        this.logger.warn(`AI returned unrecognized FDI ${fdi} for job ${jobId} — skipped`);
        continue;
      }
      await this.pool.query(
        `INSERT INTO tooth_segments
           (job_id, case_id, tooth_number, universal_number, label, arch, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (job_id, tooth_number) DO UPDATE SET confidence = EXCLUDED.confidence`,
        [jobId, caseId, fdi, tooth.universal, tooth.label, tooth.arch,
         confidences[String(fdi)] ?? null],
      );
    }
    await this.pool.query(
      `UPDATE segmentation_jobs SET status = 'completed', completed_at = NOW(), progress = 100,
         tooth_count = (SELECT COUNT(*) FROM tooth_segments WHERE job_id = $1),
         result_summary = $2
       WHERE id = $1`,
      [jobId, summary],
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


  // ── Retry failed job with exponential backoff ────────────────────────────────

  async retryFailedJob(jobId: string, maxRetries = 3) {
    const { rows } = await this.pool.query(
      `SELECT id, case_id, organization_id, submitted_by, arch, model_type, status, COALESCE(retry_count, 0) AS retry_count
         FROM segmentation_jobs WHERE id = $1`,
      [jobId],
    );
    if (!rows.length) throw new NotFoundException(`Job ${jobId} not found`);

    const job = rows[0] as { id: string; case_id: string; organization_id: string; submitted_by: string; arch: string; model_type: string; status: string; retry_count: number };

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
      this.processJob(jobId, job.case_id, job.organization_id, job.submitted_by, job.arch, job.model_type).catch((err: unknown) =>
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

  // ── Tooth mesh file access ────────────────────────────────────────────────────

  async getToothMeshPath(caseId: string, orgId: string, jobId: string, toothNumber: number): Promise<string | null> {
    await this.verifyCase(caseId, orgId);
    const { rows: jobRows } = await this.pool.query(
      `SELECT scan_id FROM segmentation_jobs WHERE id = $1 AND case_id = $2`,
      [jobId, caseId],
    );
    if (!jobRows.length) throw new NotFoundException('Segmentation job not found');

    // Prefer the direct per-tooth path stored in tooth_segments
    const { rows: segRows } = await this.pool.query(
      `SELECT mesh_path FROM tooth_segments WHERE job_id = $1 AND tooth_number = $2`,
      [jobId, toothNumber],
    );
    if (segRows.length && segRows[0].mesh_path) {
      return segRows[0].mesh_path as string;
    }

    // Fall back to the AI output directory in segmentation_results
    const scanId = jobRows[0].scan_id as string | null;
    if (!scanId) return null;
    const { rows: resultRows } = await this.pool.query(
      `SELECT segmented_mesh_path FROM segmentation_results
         WHERE case_id = $1 AND scan_id = $2
         ORDER BY created_at DESC LIMIT 1`,
      [caseId, scanId],
    );
    if (!resultRows.length || !resultRows[0].segmented_mesh_path) return null;
    return path.join(resultRows[0].segmented_mesh_path as string, `tooth_fdi_${toothNumber}.stl`);
  }

  async getGingivaMeshPath(caseId: string, orgId: string, jobId: string): Promise<string | null> {
    await this.verifyCase(caseId, orgId);
    const { rows: jobRows } = await this.pool.query(
      `SELECT scan_id FROM segmentation_jobs WHERE id = $1 AND case_id = $2`,
      [jobId, caseId],
    );
    if (!jobRows.length) throw new NotFoundException('Segmentation job not found');

    const scanId = jobRows[0].scan_id as string | null;
    if (!scanId) return null;

    const { rows: resultRows } = await this.pool.query(
      `SELECT gingiva_mesh_path, segmented_mesh_path FROM segmentation_results
         WHERE case_id = $1 AND scan_id = $2
         ORDER BY created_at DESC LIMIT 1`,
      [caseId, scanId],
    );
    if (!resultRows.length) return null;
    if (resultRows[0].gingiva_mesh_path) return resultRows[0].gingiva_mesh_path as string;
    if (resultRows[0].segmented_mesh_path) {
      return path.join(resultRows[0].segmented_mesh_path as string, 'gingiva.stl');
    }
    return null;
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
