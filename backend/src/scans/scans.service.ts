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
const VALID_JAW_TYPES = ['maxillary', 'mandibular', 'both'] as const;
const VALID_FORMATS = ['stl', 'obj', 'ply'] as const;

interface SegmentJob {
  jobId: string;
  caseId: string;
  scanId: string;
  orgId: string;
  queuedAt: Date;
}

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);
  // In-memory job store — lost on restart. Use Redis for production.
  private readonly segmentJobs = new Map<string, SegmentJob>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByCaseId(caseId: string, orgId: string) {
    await this.verifyCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT id, case_id, jaw_type, file_path, file_format, file_size_bytes,
              mesh_validation_metrics, created_at
       FROM scans WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      caseId: r.case_id as string,
      jawType: r.jaw_type as string,
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

    // Move from multer temp dir to organised storage
    const destDir = path.join(UPLOAD_DIR, 'scans', orgId, caseId);
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, `${Date.now()}.${ext}`);
    fs.renameSync(file.path, destPath);

    const { rows } = await this.pool.query(
      `INSERT INTO scans (case_id, uploaded_by, jaw_type, file_path, file_format, file_size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [caseId, uploadedBy, jawType, destPath, ext, file.size],
    );
    const scan = rows[0];

    // Advance case status draft → scan_uploaded (no-op if already further along)
    await this.pool.query(
      `UPDATE cases SET status = 'scan_uploaded', updated_at = now()
       WHERE id = $1 AND status = 'draft'`,
      [caseId],
    );

    this.logger.log(`Scan ${scan.id as string} uploaded for case ${caseId} by ${actorEmail}`);
    return {
      id: scan.id as string,
      caseId,
      jawType,
      fileFormat: ext,
      fileSizeBytes: file.size,
      createdAt: scan.created_at as Date,
    };
  }

  async triggerSegmentation(
    caseId: string,
    scanId: string,
    orgId: string,
    actorEmail: string,
  ) {
    await this.verifyCaseOwnership(caseId, orgId);

    const { rows: scanRows } = await this.pool.query(
      `SELECT id, file_path, jaw_type FROM scans WHERE id = $1 AND case_id = $2`,
      [scanId, caseId],
    );
    if (!scanRows[0]) throw new NotFoundException('Scan not found in this case');
    const scan = scanRows[0];

    let aiJobId: string;
    try {
      const res = await fetch(`${AI_ENGINE_URL}/ai/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          scan_id: scanId,
          file_path: scan.file_path as string,
          jaw_type: scan.jaw_type as string,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`AI engine HTTP ${res.status}: ${body}`);
      }
      const data = await res.json() as { job_id: string };
      aiJobId = data.job_id;
    } catch (err) {
      this.logger.error(`AI engine unreachable: ${String(err)}`);
      throw new InternalServerErrorException(
        'Segmentation engine is unavailable. Ensure the AI engine container is running.',
      );
    }

    this.segmentJobs.set(aiJobId, {
      jobId: aiJobId,
      caseId,
      scanId,
      orgId,
      queuedAt: new Date(),
    });

    await this.pool.query(
      `UPDATE cases SET status = 'segmenting', updated_at = now()
       WHERE id = $1 AND status IN ('scan_uploaded', 'draft')`,
      [caseId],
    );

    this.logger.log(
      `Segment job ${aiJobId} queued — case ${caseId} scan ${scanId} by ${actorEmail}`,
    );
    return {
      jobId: aiJobId,
      status: 'queued',
      message: 'Segmentation job submitted. Poll /api/segment-jobs/:jobId for status.',
      disclaimer:
        'AI segmentation is a workflow tool only. Not clinically validated. Not for diagnostic use.',
    };
  }

  async getJobStatus(jobId: string, orgId: string) {
    const job = this.segmentJobs.get(jobId);
    if (!job)
      throw new NotFoundException(
        'Job not found. In-memory jobs are lost on backend restart.',
      );
    if (job.orgId !== orgId) throw new NotFoundException('Job not found');

    let aiStatus: Record<string, unknown>;
    try {
      const res = await fetch(`${AI_ENGINE_URL}/ai/jobs/${jobId}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      aiStatus = (await res.json()) as Record<string, unknown>;
    } catch {
      return {
        jobId,
        caseId: job.caseId,
        scanId: job.scanId,
        status: 'unknown',
        error: 'AI engine unreachable',
        disclaimer: 'AI segmentation is not clinically validated.',
      };
    }

    // Write to DB when completed
    if (aiStatus['status'] === 'completed') {
      await this.pool
        .query(
          `INSERT INTO segmentation_results
             (case_id, scan_id, teeth_confidence_scores, missing_teeth)
           VALUES ($1, $2, $3, $4::int[])
           ON CONFLICT DO NOTHING`,
          [
            job.caseId,
            job.scanId,
            JSON.stringify(aiStatus['teeth_confidence'] ?? {}),
            aiStatus['missing_teeth'] ?? [],
          ],
        )
        .catch((e) =>
          this.logger.warn(`Failed to persist segmentation result: ${String(e)}`),
        );

      await this.pool.query(
        `UPDATE cases SET status = 'planning', updated_at = now()
         WHERE id = $1 AND status = 'segmenting'`,
        [job.caseId],
      ).catch(() => undefined);
    }

    return {
      jobId,
      caseId: job.caseId,
      scanId: job.scanId,
      ...aiStatus,
      disclaimer:
        'AI segmentation is a workflow tool only. Not clinically validated. Not for diagnostic use.',
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
