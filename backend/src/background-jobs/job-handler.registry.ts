import { Injectable, Logger } from '@nestjs/common';
import type { JobHandler } from './job-handler.interface';

// ─── Built-in handlers ────────────────────────────────────────────────────────

class IntegrationHealthCheckHandler implements JobHandler<{ providerId: string }> {
  readonly jobType = 'integration.health_check';
  readonly timeoutMs = 30_000;
  readonly maxAttempts = 3;

  async execute(jobId: string, payload: { providerId: string }) {
    // Real health check is performed by IntegrationProvidersService.
    // This handler exists so the job queue can schedule health checks.
    // The IntegrationProvidersService.recordHealthCheck() call happens externally;
    // this job simply signals that a check was due.
    return { providerId: payload.providerId, scheduledAt: new Date().toISOString() };
  }

  isRetryable(error: Error) {
    return !error.message.includes('NOT_FOUND');
  }
}

class ReportGenerateHandler implements JobHandler<{ reportType: string; orgId: string; period?: string }> {
  readonly jobType = 'report.generate';
  readonly timeoutMs = 120_000;
  readonly maxAttempts = 2;

  async execute(_jobId: string, payload: { reportType: string; orgId: string; period?: string }) {
    // Report generation is async; the actual work is done by ReportsService.
    // This stub validates the payload and returns scheduling confirmation.
    if (!payload.reportType || !payload.orgId) {
      throw new Error('report.generate requires reportType and orgId');
    }
    return { reportType: payload.reportType, orgId: payload.orgId, period: payload.period ?? 'last_30_days' };
  }

  isRetryable(_error: Error) {
    return true;
  }
}

class CleanupExpiredFilesHandler implements JobHandler<{ olderThanDays: number }> {
  readonly jobType = 'cleanup.expired_files';
  readonly timeoutMs = 300_000;
  readonly maxAttempts = 2;

  async execute(_jobId: string, payload: { olderThanDays: number }) {
    const days = payload.olderThanDays ?? 30;
    if (days < 1) throw new Error('olderThanDays must be >= 1');
    return { olderThanDays: days };
  }

  isRetryable(_error: Error) {
    return true;
  }
}

class AiSegmentationHandler implements JobHandler<{ caseId: string; arch: string; modelType: string }> {
  readonly jobType = 'ai.segmentation';
  readonly timeoutMs = 600_000;
  readonly maxAttempts = 2;

  async execute(_jobId: string, payload: { caseId: string; arch: string; modelType: string }) {
    // Actual segmentation is managed by SegmentationService.processJob().
    // This handler validates the payload and returns a reference for the worker.
    if (!payload.caseId) throw new Error('ai.segmentation requires caseId');
    return { caseId: payload.caseId, arch: payload.arch ?? 'both', modelType: payload.modelType ?? 'cpu' };
  }

  isRetryable(error: Error) {
    return !error.message.includes('MANUAL_MODE');
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

@Injectable()
export class JobHandlerRegistry {
  private readonly log = new Logger(JobHandlerRegistry.name);
  private readonly handlers = new Map<string, JobHandler>();

  constructor() {
    this.register(new IntegrationHealthCheckHandler());
    this.register(new ReportGenerateHandler());
    this.register(new CleanupExpiredFilesHandler());
    this.register(new AiSegmentationHandler());
  }

  register(handler: JobHandler): void {
    this.handlers.set(handler.jobType, handler);
    this.log.log(`Registered handler: ${handler.jobType}`);
  }

  resolve(jobType: string): JobHandler {
    const handler = this.handlers.get(jobType);
    if (!handler) {
      throw new Error(`No handler registered for job type: ${jobType}`);
    }
    return handler;
  }

  has(jobType: string): boolean {
    return this.handlers.has(jobType);
  }

  listTypes(): string[] {
    return [...this.handlers.keys()];
  }
}
