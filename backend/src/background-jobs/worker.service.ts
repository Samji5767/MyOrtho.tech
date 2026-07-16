import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';
import { JobHandlerRegistry } from './job-handler.registry';

const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const LEASE_DURATION_MS = 120_000; // 2 minutes
const ABANDONED_JOB_THRESHOLD_MS = 150_000; // 2.5 minutes

@Injectable()
export class WorkerService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger(WorkerService.name);
  private readonly concurrency: number;
  private running = false;
  private activeJobs = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PG_POOL) private readonly db: Pool,
    private readonly registry: JobHandlerRegistry,
  ) {
    this.concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);
  }

  onModuleInit() {
    if (process.env.WORKER_ENABLED === 'false') {
      this.log.log('Worker disabled via WORKER_ENABLED=false');
      return;
    }
    this.running = true;
    this.log.log(`Worker ${WORKER_ID} starting (concurrency=${this.concurrency})`);
    this.schedulePoll();
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
    // Run abandoned job recovery once at startup
    this.recoverAbandonedJobs().catch(err =>
      this.log.error(`Abandoned job recovery error: ${(err as Error).message}`),
    );
  }

  async onApplicationShutdown(_signal?: string) {
    this.running = false;
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    this.log.log(`Worker ${WORKER_ID} shutting down (${this.activeJobs} active jobs will complete)`);

    // Wait up to 30s for active jobs to finish
    const deadline = Date.now() + 30_000;
    while (this.activeJobs > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500));
    }
    if (this.activeJobs > 0) {
      this.log.warn(`Shutdown with ${this.activeJobs} jobs still running — they will be recovered by next worker`);
    }
  }

  // ─── Polling ──────────────────────────────────────────────────────────────

  private schedulePoll() {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => this.poll(), POLL_INTERVAL_MS);
  }

  private async poll() {
    if (!this.running) return;
    try {
      while (this.running && this.activeJobs < this.concurrency) {
        const claimed = await this.claimJob();
        if (!claimed) break; // nothing to claim right now
        this.activeJobs++;
        this.executeJob(claimed).finally(() => {
          this.activeJobs--;
        });
      }
    } catch (err: unknown) {
      this.log.error(`Poll error: ${(err as Error).message}`);
    } finally {
      this.schedulePoll();
    }
  }

  // ─── Atomic claim ─────────────────────────────────────────────────────────

  private async claimJob(): Promise<{
    id: string;
    orgId: string | null;
    jobType: string;
    payload: Record<string, unknown>;
    attempts: number;
    maxAttempts: number;
  } | null> {
    const client: PoolClient = await this.db.connect();
    try {
      await client.query('BEGIN');
      const leaseExpiry = new Date(Date.now() + LEASE_DURATION_MS).toISOString();
      const { rows } = await client.query(
        `SELECT id, organization_id, job_type, payload_json, attempts, max_attempts
         FROM background_jobs
         WHERE status IN ('pending', 'retry_scheduled')
           AND run_at <= NOW()
           AND (retry_scheduled_at IS NULL OR retry_scheduled_at <= NOW())
         ORDER BY priority ASC, run_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const row = rows[0];
      await client.query(
        `UPDATE background_jobs
         SET status = 'running',
             worker_id = $2,
             claimed_at = NOW(),
             lease_expires_at = $3::timestamptz,
             heartbeat_at = NOW(),
             started_at = COALESCE(started_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, WORKER_ID, leaseExpiry],
      );
      await client.query('COMMIT');
      return {
        id: row.id as string,
        orgId: row.organization_id as string | null,
        jobType: row.job_type as string,
        payload: (row.payload_json as Record<string, unknown>) ?? {},
        attempts: Number(row.attempts),
        maxAttempts: Number(row.max_attempts),
      };
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ─── Execution ────────────────────────────────────────────────────────────

  private async executeJob(job: {
    id: string;
    orgId: string | null;
    jobType: string;
    payload: Record<string, unknown>;
    attempts: number;
    maxAttempts: number;
  }) {
    this.log.log(`Executing job ${job.id} (${job.jobType}) attempt ${job.attempts + 1}/${job.maxAttempts}`);
    const startMs = Date.now();

    let handler;
    try {
      handler = this.registry.resolve(job.jobType);
    } catch {
      // Unknown job types are non-retryable — send straight to dead_letter
      await this.failJob(job.id, `No handler for job type: ${job.jobType}`, 'UNKNOWN_JOB_TYPE', true);
      return;
    }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Job timed out after ${handler.timeoutMs}ms`)), handler.timeoutMs),
    );

    try {
      const result = await Promise.race([
        handler.execute(job.id, job.payload),
        timeout,
      ]);
      const durationMs = Date.now() - startMs;
      await this.completeJob(job.id, result as Record<string, unknown>, durationMs);
      this.log.log(`Job ${job.id} completed in ${durationMs}ms`);
    } catch (err: unknown) {
      const error = err as Error;
      const durationMs = Date.now() - startMs;
      const retryable = handler.isRetryable(error);
      const nextAttempt = job.attempts + 1;

      if (retryable && nextAttempt < job.maxAttempts) {
        const delayMs = Math.min(1000 * Math.pow(2, nextAttempt), 300_000); // exponential, max 5 min
        await this.scheduleRetry(job.id, error, nextAttempt, delayMs);
        this.log.warn(`Job ${job.id} failed (attempt ${nextAttempt}/${job.maxAttempts}), retry in ${delayMs}ms: ${error.message}`);
      } else {
        const toDlq = !retryable || nextAttempt >= job.maxAttempts;
        await this.failJob(job.id, error.message, 'EXECUTION_ERROR', toDlq, nextAttempt);
        this.log.error(`Job ${job.id} ${toDlq ? 'dead-lettered' : 'failed'} after ${durationMs}ms: ${error.message}`);
      }
    }
  }

  // ─── Status transitions ───────────────────────────────────────────────────

  private async completeJob(id: string, result: Record<string, unknown>, _durationMs: number) {
    await this.db.query(
      `UPDATE background_jobs
       SET status = 'completed',
           result_json = $2,
           completed_at = NOW(),
           worker_id = NULL,
           lease_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id, JSON.stringify(result)],
    );
  }

  private async failJob(
    id: string,
    errorMsg: string,
    errorCode: string,
    toDlq: boolean,
    attempts?: number,
  ) {
    await this.db.query(
      `UPDATE background_jobs
       SET status = $2,
           error = $3,
           last_error_code = $4,
           attempts = COALESCE($5, attempts + 1),
           worker_id = NULL,
           lease_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id, toDlq ? 'dead_letter' : 'failed', errorMsg, errorCode, attempts ?? null],
    );
  }

  private async scheduleRetry(id: string, error: Error, nextAttempt: number, delayMs: number) {
    const retryAt = new Date(Date.now() + delayMs).toISOString();
    await this.db.query(
      `UPDATE background_jobs
       SET status = 'retry_scheduled',
           error = $2,
           last_error_code = 'EXECUTION_ERROR',
           attempts = $3,
           retry_delay_ms = $4,
           retry_scheduled_at = $5::timestamptz,
           worker_id = NULL,
           lease_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id, error.message, nextAttempt, delayMs, retryAt],
    );
  }

  // ─── Heartbeat ────────────────────────────────────────────────────────────

  private async heartbeat() {
    if (!this.running || this.activeJobs === 0) return;
    try {
      const leaseExpiry = new Date(Date.now() + LEASE_DURATION_MS).toISOString();
      const { rowCount } = await this.db.query(
        `UPDATE background_jobs
         SET heartbeat_at = NOW(), lease_expires_at = $2::timestamptz, updated_at = NOW()
         WHERE worker_id = $1 AND status = 'running'`,
        [WORKER_ID, leaseExpiry],
      );
      if ((rowCount ?? 0) > 0) {
        this.log.debug(`Heartbeat refreshed ${rowCount} jobs`);
      }
    } catch (err: unknown) {
      this.log.error(`Heartbeat error: ${(err as Error).message}`);
    }
  }

  // ─── Abandoned job recovery ───────────────────────────────────────────────

  private async recoverAbandonedJobs() {
    const thresholdMs = ABANDONED_JOB_THRESHOLD_MS;
    const { rows } = await this.db.query(
      `UPDATE background_jobs
       SET status = 'pending',
           worker_id = NULL,
           claimed_at = NULL,
           lease_expires_at = NULL,
           heartbeat_at = NULL,
           error = 'Recovered: lease expired without heartbeat',
           last_error_code = 'LEASE_EXPIRED',
           updated_at = NOW()
       WHERE status = 'running'
         AND lease_expires_at < NOW() - ($1 || ' milliseconds')::interval
       RETURNING id`,
      [thresholdMs],
    );
    if (rows.length > 0) {
      this.log.warn(`Recovered ${rows.length} abandoned jobs: ${rows.map((r: Record<string, unknown>) => r['id']).join(', ')}`);
    }
  }

  // ─── Public stats ─────────────────────────────────────────────────────────

  getWorkerStats() {
    return {
      workerId: WORKER_ID,
      running: this.running,
      activeJobs: this.activeJobs,
      concurrency: this.concurrency,
      registeredJobTypes: this.registry.listTypes(),
    };
  }
}
