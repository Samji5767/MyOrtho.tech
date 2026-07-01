import { Injectable, Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL ?? 'http://ai-engine:8000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? '';

/**
 * Thin wrapper used by other modules to trigger segmentation.
 * The primary segmentation API surface is in ScansModule (scans.service.ts).
 * This service exists for backwards compatibility.
 */
@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Submits a segmentation job to the AI engine and returns the job_id.
   * Advances case status to 'segmenting' in the database.
   *
   * Disclaimer: AI output is not clinically validated.
   */
  async triggerToothSegmentation(
    caseId: string,
    scanId: string,
    filePath: string,
    jawType: string,
  ): Promise<{ jobId: string; status: string }> {
    this.logger.log(`Submitting segmentation job — case ${caseId} scan ${scanId}`);

    let jobId: string;
    try {
      const res = await fetch(`${AI_ENGINE_URL}/ai/segment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(INTERNAL_API_SECRET ? { 'X-Internal-Token': INTERNAL_API_SECRET } : {}),
        },
        body: JSON.stringify({ case_id: caseId, scan_id: scanId, file_path: filePath, jaw_type: jawType }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        throw new Error(`AI engine returned HTTP ${res.status}`);
      }
      const data = await res.json() as { job_id: string };
      jobId = data.job_id;
    } catch (err) {
      this.logger.error(`AI engine unreachable: ${String(err)}`);
      throw new InternalServerErrorException(
        'AI segmentation engine is unavailable.',
      );
    }

    await this.pool
      .query(
        `UPDATE cases SET status = 'segmenting', updated_at = now()
         WHERE id = $1 AND status IN ('scan_uploaded', 'draft')`,
        [caseId],
      )
      .catch((e) => this.logger.warn(`Failed to advance case status: ${String(e)}`));

    this.logger.log(`Segmentation job ${jobId} queued for case ${caseId}`);
    return { jobId, status: 'queued' };
  }
}
