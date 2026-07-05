import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import { PG_POOL } from '../database/database.module';

const UPLOAD_DIR = process.env.UPLOADS_DIR ?? '/app/uploads';
const AI_ENGINE_URL = process.env.AI_ENGINE_URL ?? 'http://ai-engine:8000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? '';

const AI_ENGINE_HEADERS = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(INTERNAL_API_SECRET ? { 'X-Internal-Token': INTERNAL_API_SECRET } : {}),
});
const VALID_JAW_TYPES = ['maxillary', 'mandibular', 'both', 'auto'] as const;
const VALID_FORMATS = ['stl', 'obj', 'ply'] as const;

const SEG_DISCLAIMER =
  'AI segmentation is a workflow tool only. Not clinically validated. Not for diagnostic use. ' +
  'Output requires review by a licensed clinician before any clinical decision.';

const MODEL_NOTE = {
  modelName: 'MONAI-dental-seg',
  modelVersion: '1.0.0',
  validationStatus: 'research_use_only' as const,
};

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ── Magic byte validation ────────────────────────────────────────────────────

  private validateScanMagicBytes(file: Express.Multer.File, ext: string) {
    // Read first 256 bytes from the file on disk (multer writes to temp path)
    let header: Buffer;
    try {
      const fd = fs.openSync(file.path, 'r');
      header = Buffer.alloc(256);
      const bytesRead = fs.readSync(fd, header, 0, 256, 0);
      fs.closeSync(fd);
      header = header.subarray(0, bytesRead);
    } catch {
      fs.unlink(file.path, () => undefined);
      throw new BadRequestException('Could not read uploaded file');
    }

    const isPly = header.subarray(0, 3).toString('ascii') === 'ply';
    const isAsciiStl = /^solid\s/i.test(header.toString('ascii', 0, 80));
    // Binary STL: 80-byte header + uint32 triangle count (>0). No universal magic bytes,
    // but it must be at least 84 bytes and the triangle count must be non-zero.
    const isBinaryStl =
      header.length >= 84 &&
      header.readUInt32LE(80) > 0 &&
      header.length >= 84 + header.readUInt32LE(80) * 0; // structure check only
    // OBJ: ASCII lines starting with v, vt, vn, f, #, mtllib, o, g, usemtl
    const isObj = /^(#|v |vt |vn |f |o |g |mtllib|usemtl)/m.test(
      header.toString('ascii', 0, 256),
    );

    const valid =
      (ext === 'ply' && isPly) ||
      (ext === 'stl' && (isAsciiStl || isBinaryStl)) ||
      (ext === 'obj' && isObj);

    if (!valid) {
      fs.unlink(file.path, () => undefined);
      throw new BadRequestException(
        `File content does not match declared format .${ext}`,
      );
    }
  }

  // ── Scans ───────────────────────────────────────────────────────────────────

  async findByCaseId(caseId: string, orgId: string) {
    await this.verifyCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT id, case_id, jaw_type, original_filename, file_path, file_format,
              file_size_bytes, mesh_validation_metrics, created_at
       FROM scans WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      caseId: r.case_id as string,
      jawType: r.jaw_type as string,
      originalFilename: (r.original_filename ?? null) as string | null,
      filePath: r.file_path as string,
      fileFormat: r.file_format as string,
      fileSizeBytes: r.file_size_bytes as number,
      validationMetrics: r.mesh_validation_metrics as object,
      createdAt: r.created_at as Date,
    }));
  }

  async create(
    caseId: string,
    orgId: string,
    uploadedBy: string,
    file: Express.Multer.File,
    jawType: string,
    actorEmail: string,
  ) {
    await this.verifyCaseOwnership(caseId, orgId);

    if (!VALID_JAW_TYPES.includes(jawType as (typeof VALID_JAW_TYPES)[number])) {
      fs.unlink(file.path, () => undefined);
      throw new BadRequestException(`jawType must be one of: ${VALID_JAW_TYPES.join(', ')}`);
    }

    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (!VALID_FORMATS.includes(ext as (typeof VALID_FORMATS)[number])) {
      fs.unlink(file.path, () => undefined);
      throw new BadRequestException(`File format must be one of: ${VALID_FORMATS.join(', ')}`);
    }

    // Magic byte / file-content validation — reject files that don't match their declared extension
    this.validateScanMagicBytes(file, ext);

    // Move from multer temp dir to organised storage
    const destDir = path.join(UPLOAD_DIR, 'scans', orgId, caseId);
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, `${Date.now()}.${ext}`);
    fs.renameSync(file.path, destPath);

    const { rows } = await this.pool.query(
      `INSERT INTO scans
         (case_id, uploaded_by, jaw_type, original_filename, file_path, file_format, file_size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [caseId, uploadedBy, jawType, file.originalname, destPath, ext, file.size],
    );
    const scan = rows[0];

    // Advance case status draft → scan_review (no-op if already further along)
    await this.pool.query(
      `UPDATE cases SET status = 'scan_review', updated_at = now()
       WHERE id = $1 AND status = 'draft'`,
      [caseId],
    );

    this.logger.log(`Scan ${scan.id as string} uploaded for case ${caseId} by ${actorEmail}`);

    const result = {
      id: scan.id as string,
      caseId,
      jawType,
      originalFilename: file.originalname,
      fileFormat: ext,
      fileSizeBytes: file.size,
      createdAt: scan.created_at as Date,
    };

    // Auto-trigger segmentation immediately after upload (fire-and-forget)
    void this.triggerSegmentation(caseId, scan.id as string, orgId, actorEmail)
      .catch(err =>
        this.logger.warn(
          `Auto-segmentation enqueue failed for scan ${scan.id as string}: ${String(err)}`,
        ),
      );

    return result;
  }

  // ── Segmentation ────────────────────────────────────────────────────────────

  async triggerSegmentation(
    caseId: string,
    scanId: string,
    orgId: string,
    actorEmail: string,
  ) {
    await this.verifyCaseOwnership(caseId, orgId);

    const { rows: scanRows } = await this.pool.query(
      `SELECT s.id, s.file_path, s.jaw_type, p.organization_id
       FROM scans s
       JOIN cases c ON c.id = s.case_id
       JOIN patients p ON p.id = c.patient_id
       WHERE s.id = $1 AND s.case_id = $2`,
      [scanId, caseId],
    );
    if (!scanRows[0]) throw new NotFoundException('Scan not found in this case');
    const scan = scanRows[0];

    let aiJobId: string;
    try {
      // Translate backend jaw_type values to AI engine values:
      // 'both' → 'combined'  (legacy UI option; AI engine uses 'combined')
      // 'auto' → 'auto'      (geometry-based detection handled by AI engine)
      const aiJawType = scan.jaw_type === 'both' ? 'combined' : (scan.jaw_type as string);
      const res = await fetch(`${AI_ENGINE_URL}/ai/segment`, {
        method: 'POST',
        headers: AI_ENGINE_HEADERS(),
        body: JSON.stringify({
          case_id: caseId,
          scan_id: scanId,
          file_path: scan.file_path as string,
          jaw_type: aiJawType,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`AI engine HTTP ${res.status}: ${body}`);
      }
      const data = (await res.json()) as { job_id: string };
      aiJobId = data.job_id;
    } catch (err) {
      this.logger.error(`AI engine unreachable: ${String(err)}`);
      throw new InternalServerErrorException(
        'Segmentation engine is unavailable. Ensure the AI engine container is running.',
      );
    }

    // Persist job to DB (replaces in-memory map)
    await this.pool.query(
      `INSERT INTO segmentation_jobs
         (ai_job_id, case_id, scan_id, organization_id, status,
          model_name, model_version, validation_status, disclaimer)
       VALUES ($1, $2, $3, $4, 'queued', $5, $6, $7, $8)
       ON CONFLICT (ai_job_id) DO UPDATE
         SET status = 'queued', updated_at = now()`,
      [
        aiJobId,
        caseId,
        scanId,
        orgId,
        MODEL_NOTE.modelName,
        MODEL_NOTE.modelVersion,
        MODEL_NOTE.validationStatus,
        SEG_DISCLAIMER,
      ],
    );

    await this.pool.query(
      `UPDATE cases SET status = 'segmentation', updated_at = now()
       WHERE id = $1 AND status IN ('scan_review', 'draft')`,
      [caseId],
    );

    this.logger.log(
      `Segment job ${aiJobId} queued — case ${caseId} scan ${scanId} by ${actorEmail}`,
    );
    return {
      jobId: aiJobId,
      status: 'queued',
      message: 'Segmentation job submitted. Poll /api/segment-jobs/:jobId for status.',
      disclaimer: SEG_DISCLAIMER,
      ...MODEL_NOTE,
    };
  }

  async getJobStatus(jobId: string, orgId: string) {
    // Load from DB (persistent, survives restarts)
    const { rows } = await this.pool.query(
      `SELECT sj.*, s.jaw_type AS scan_jaw_type, s.original_filename AS scan_filename
       FROM segmentation_jobs sj
       LEFT JOIN scans s ON s.id = sj.scan_id
       WHERE sj.ai_job_id = $1 AND sj.organization_id = $2`,
      [jobId, orgId],
    );
    if (!rows[0]) {
      throw new NotFoundException(
        'Segmentation job not found. Jobs are scoped to your organization.',
      );
    }
    const dbJob = rows[0];

    // Poll AI engine for current status
    let aiStatus: Record<string, unknown> | null = null;
    try {
      const res = await fetch(`${AI_ENGINE_URL}/ai/jobs/${jobId}`, {
        headers: AI_ENGINE_HEADERS(),
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        aiStatus = (await res.json()) as Record<string, unknown>;
      }
    } catch {
      // Return DB state when AI engine is unreachable
      return this.formatJobRow(dbJob, null);
    }

    // Update DB with AI engine result
    if (aiStatus) {
      const aiStatusStr = aiStatus['status'] as string | undefined;
      const updates: unknown[] = [aiStatusStr ?? dbJob.status, jobId];
      let sql = `UPDATE segmentation_jobs SET status = $1, updated_at = now()`;

      if (aiStatusStr === 'processing' && !dbJob.started_at) {
        sql += ', started_at = now()';
      }
      if (aiStatusStr === 'completed' || aiStatusStr === 'failed') {
        sql += ', completed_at = COALESCE(completed_at, now())';
      }
      if (aiStatusStr === 'completed') {
        const teethDetected = aiStatus['teeth_detected'] as number | undefined;
        const confidenceScores = aiStatus['teeth_confidence'] ?? {};
        const missingTeeth = aiStatus['missing_teeth'] ?? [];
        sql += `, teeth_detected = $3, confidence_scores = $4, missing_teeth = $5::int[]`;
        updates.push(teethDetected ?? null, JSON.stringify(confidenceScores), missingTeeth);
      }
      if (aiStatusStr === 'failed') {
        sql += `, failure_reason = $3`;
        updates.push((aiStatus['error'] as string | undefined) ?? 'AI engine reported failure');
      }

      sql += ` WHERE ai_job_id = $2`;
      await this.pool.query(sql, updates).catch((e) =>
        this.logger.warn(`Failed to update segmentation job: ${String(e)}`),
      );

      // Write final result to segmentation_results table
      if (aiStatusStr === 'completed') {
        await this.pool
          .query(
            `INSERT INTO segmentation_results
               (case_id, scan_id, teeth_confidence_scores, missing_teeth, segmented_mesh_path)
             VALUES ($1, $2, $3, $4::int[], $5)
             ON CONFLICT DO NOTHING`,
            [
              dbJob.case_id as string,
              dbJob.scan_id as string,
              JSON.stringify(aiStatus['teeth_confidence'] ?? {}),
              aiStatus['missing_teeth'] ?? [],
              (aiStatus['segmented_mesh_path'] as string | null) ?? null,
            ],
          )
          .catch((e) =>
            this.logger.warn(`Failed to persist segmentation result: ${String(e)}`),
          );

        await this.pool
          .query(
            `UPDATE cases SET status = 'planning', updated_at = now()
             WHERE id = $1 AND status = 'segmentation'`,
            [dbJob.case_id as string],
          )
          .catch(() => undefined);
      }
    }

    return this.formatJobRow(dbJob, aiStatus);
  }

  async listJobsForCase(caseId: string, orgId: string) {
    await this.verifyCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT sj.*, s.jaw_type AS scan_jaw_type, s.original_filename AS scan_filename
       FROM segmentation_jobs sj
       LEFT JOIN scans s ON s.id = sj.scan_id
       WHERE sj.case_id = $1 AND sj.organization_id = $2
       ORDER BY sj.created_at DESC`,
      [caseId, orgId],
    );
    return rows.map((r) => this.formatJobRow(r, null));
  }

  async retryJob(jobId: string, orgId: string, actorEmail: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM segmentation_jobs WHERE ai_job_id = $1 AND organization_id = $2`,
      [jobId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Segmentation job not found');
    const dbJob = rows[0];

    if (dbJob.status !== 'failed') {
      throw new BadRequestException('Only failed jobs can be retried');
    }

    // Re-trigger AI engine
    const { rows: scanRows } = await this.pool.query(
      `SELECT file_path, jaw_type FROM scans WHERE id = $1`,
      [dbJob.scan_id as string],
    );
    if (!scanRows[0]) throw new NotFoundException('Scan not found');

    let newAiJobId: string;
    try {
      const res = await fetch(`${AI_ENGINE_URL}/ai/segment`, {
        method: 'POST',
        headers: AI_ENGINE_HEADERS(),
        body: JSON.stringify({
          case_id: dbJob.case_id as string,
          scan_id: dbJob.scan_id as string,
          file_path: scanRows[0].file_path as string,
          jaw_type: scanRows[0].jaw_type as string,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`AI engine HTTP ${res.status}`);
      const data = (await res.json()) as { job_id: string };
      newAiJobId = data.job_id;
    } catch (err) {
      throw new InternalServerErrorException(
        'Segmentation engine is unavailable for retry.',
      );
    }

    // Update the existing row with the new job ID
    await this.pool.query(
      `UPDATE segmentation_jobs
       SET ai_job_id = $1, status = 'queued', failure_reason = null,
           started_at = null, completed_at = null, updated_at = now()
       WHERE ai_job_id = $2`,
      [newAiJobId, jobId],
    );

    this.logger.log(`Seg job ${jobId} retried as ${newAiJobId} by ${actorEmail}`);
    return {
      jobId: newAiJobId,
      status: 'queued',
      disclaimer: SEG_DISCLAIMER,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private formatJobRow(
    r: Record<string, unknown>,
    ai: Record<string, unknown> | null,
  ) {
    const status = (ai?.['status'] as string | undefined) ?? (r['status'] as string);
    return {
      jobId: r['ai_job_id'] as string,
      caseId: r['case_id'] as string,
      scanId: r['scan_id'] as string,
      scanFilename: (r['scan_filename'] ?? null) as string | null,
      scanJawType: (r['scan_jaw_type'] ?? null) as string | null,
      status,
      failureReason: (ai?.['error'] as string | undefined) ?? (r['failure_reason'] as string | null),
      modelName: r['model_name'] as string | null,
      modelVersion: r['model_version'] as string | null,
      validationStatus: r['validation_status'] as string,
      teethDetected: (ai?.['teeth_detected'] as number | undefined) ?? (r['teeth_detected'] as number | null),
      missingTeeth: (ai?.['missing_teeth'] as number[] | undefined) ?? (r['missing_teeth'] as number[] | null),
      outputMetadata: r['output_metadata'] as Record<string, unknown>,
      queuedAt: r['queued_at'] as Date,
      startedAt: r['started_at'] as Date | null,
      completedAt: r['completed_at'] as Date | null,
      createdAt: r['created_at'] as Date,
      disclaimer: SEG_DISCLAIMER,
    };
  }

  async getScanFile(
    caseId: string,
    scanId: string,
    orgId: string,
  ): Promise<{ filePath: string; originalFilename: string; fileFormat: string }> {
    const { rows } = await this.pool.query(
      `SELECT s.file_path, s.original_filename, s.file_format, p.organization_id
       FROM scans s
       JOIN cases c ON c.id = s.case_id
       JOIN patients p ON p.id = c.patient_id
       WHERE s.id = $1 AND s.case_id = $2`,
      [scanId, caseId],
    );
    if (!rows[0] || (rows[0].organization_id as string) !== orgId) {
      throw new NotFoundException('Scan not found');
    }
    return {
      filePath: rows[0].file_path as string,
      originalFilename: ((rows[0].original_filename as string | null) ?? `scan-${scanId}`),
      fileFormat: rows[0].file_format as string,
    };
  }

  private async verifyCaseOwnership(caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT c.id
       FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Case not found');
  }
}
