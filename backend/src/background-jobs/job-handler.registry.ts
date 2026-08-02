import { Injectable, Logger } from '@nestjs/common';
import type { JobHandler } from './job-handler.interface';

// ─── Built-in handlers ────────────────────────────────────────────────────────
//
// Job types whose real work is not yet wired to the queue fail honestly with
// NOT_IMPLEMENTED instead of echoing the payload and being recorded as
// completed — a queue must never report success for work that never ran.

class NotImplementedHandler implements JobHandler<Record<string, unknown>> {
  readonly timeoutMs = 30_000;
  readonly maxAttempts = 1;

  constructor(
    readonly jobType: string,
    private readonly hint: string,
  ) {}

  async execute(_jobId: string, _payload: Record<string, unknown>): Promise<never> {
    throw new Error(
      `NOT_IMPLEMENTED: job type "${this.jobType}" has no production handler. ${this.hint}`,
    );
  }

  isRetryable(_error: Error) {
    return false;
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

@Injectable()
export class JobHandlerRegistry {
  private readonly log = new Logger(JobHandlerRegistry.name);
  private readonly handlers = new Map<string, JobHandler>();

  constructor() {
    this.register(new NotImplementedHandler(
      'integration.health_check',
      'Health checks run via IntegrationProvidersService, not the job queue.',
    ));
    this.register(new NotImplementedHandler(
      'report.generate',
      'Report generation is not wired to the job queue.',
    ));
    this.register(new NotImplementedHandler(
      'cleanup.expired_files',
      'File cleanup is not wired to the job queue.',
    ));
    this.register(new NotImplementedHandler(
      'ai.segmentation',
      'Segmentation runs via the scan upload pipeline (ScansService → AI engine).',
    ));
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
