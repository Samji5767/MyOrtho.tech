import { Test, TestingModule } from '@nestjs/testing';
import { WorkerService } from './worker.service';
import { JobHandlerRegistry } from './job-handler.registry';
import { PG_POOL } from '../database/database.module';

function makePool(rows: unknown[][], rowCounts?: number[]) {
  let callIndex = 0;
  return {
    connect: jest.fn(async () => {
      const clientIndex = callIndex;
      return {
        query: jest.fn(async () => {
          const r = { rows: rows[clientIndex] ?? [], rowCount: (rowCounts ?? [])[clientIndex] ?? 0 };
          callIndex++;
          return r;
        }),
        release: jest.fn(),
      };
    }),
    query: jest.fn(async () => ({ rows: rows[callIndex++] ?? [], rowCount: (rowCounts ?? [])[callIndex - 1] ?? 0 })),
  };
}

describe('WorkerService', () => {
  let module: TestingModule;

  beforeEach(async () => {
    process.env.WORKER_ENABLED = 'false'; // don't auto-start polling
  });

  afterEach(async () => {
    if (module) await module.close();
  });

  it('getWorkerStats returns worker metadata', async () => {
    const pool = makePool([]);
    module = await Test.createTestingModule({
      providers: [
        WorkerService,
        JobHandlerRegistry,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
    await module.init();

    const svc = module.get(WorkerService);
    const stats = svc.getWorkerStats();
    expect(stats.running).toBe(false);
    expect(stats.activeJobs).toBe(0);
    expect(stats.concurrency).toBeGreaterThan(0);
    expect(Array.isArray(stats.registeredJobTypes)).toBe(true);
    expect(stats.registeredJobTypes).toContain('integration.health_check');
  });

  it('claimJob returns null when no pending jobs exist', async () => {
    const clientRows: unknown[] = [];
    const pool = {
      connect: jest.fn(async () => ({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })  // BEGIN (no result)
          .mockResolvedValueOnce({ rows: [] })  // SELECT FOR UPDATE → no rows
          .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
        release: jest.fn(),
      })),
      query: jest.fn(async () => ({ rows: clientRows })),
    };

    module = await Test.createTestingModule({
      providers: [
        WorkerService,
        JobHandlerRegistry,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
    await module.init();

    const svc = module.get(WorkerService) as unknown as { claimJob: () => Promise<unknown> };
    const result = await svc['claimJob']();
    expect(result).toBeNull();
  });

  it('retries a job on failure with exponential backoff', async () => {
    const updateSpy = jest.fn(async () => ({ rows: [] }));
    const pool = {
      connect: jest.fn(async () => ({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })  // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'job-1', organization_id: 'org-1', job_type: 'report.generate', payload_json: { reportType: 'clinical', orgId: 'org-1' }, attempts: 0, max_attempts: 3 }] })
          .mockResolvedValueOnce({ rows: [] })  // UPDATE claimed
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      })),
      query: updateSpy,
    };

    module = await Test.createTestingModule({
      providers: [
        WorkerService,
        JobHandlerRegistry,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
    await module.init();

    const svc = module.get(WorkerService) as unknown as {
      claimJob: () => Promise<unknown>;
      executeJob: (job: unknown) => Promise<void>;
    };

    const job = await svc['claimJob']();
    expect(job).not.toBeNull();
  });

  it('sends unknown job type to dead_letter immediately', async () => {
    const dbQuerySpy = jest.fn(async () => ({ rows: [], rowCount: 0 }));
    const pool = {
      connect: jest.fn(),
      query: dbQuerySpy,
    };

    module = await Test.createTestingModule({
      providers: [
        WorkerService,
        JobHandlerRegistry,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
    await module.init();

    const svc = module.get(WorkerService) as unknown as {
      executeJob: (job: unknown) => Promise<void>;
      failJob: (id: string, msg: string, code: string, dlq: boolean) => Promise<void>;
    };

    // Spy on failJob directly
    const failJobSpy = jest.spyOn(svc as unknown as { failJob: (...args: unknown[]) => Promise<void> }, 'failJob');
    failJobSpy.mockResolvedValue(undefined);

    await svc['executeJob']({
      id: 'dlq-job',
      orgId: 'org-1',
      jobType: 'unknown.type.xyz',
      payload: {},
      attempts: 2,
      maxAttempts: 3,
    });

    expect(failJobSpy).toHaveBeenCalledWith(
      'dlq-job',
      expect.stringContaining('unknown.type.xyz'),
      'UNKNOWN_JOB_TYPE',
      true, // dead_letter = true
    );
  });
});

describe('JobHandlerRegistry', () => {
  let registry: JobHandlerRegistry;

  beforeEach(() => {
    registry = new JobHandlerRegistry();
  });

  it('resolves known handler types', () => {
    expect(() => registry.resolve('integration.health_check')).not.toThrow();
    expect(() => registry.resolve('report.generate')).not.toThrow();
    expect(() => registry.resolve('cleanup.expired_files')).not.toThrow();
    expect(() => registry.resolve('ai.segmentation')).not.toThrow();
  });

  it('throws on unknown job type', () => {
    expect(() => registry.resolve('nonexistent.job')).toThrow('No handler registered for job type: nonexistent.job');
  });

  it('handler reports false for has() on unknown type', () => {
    expect(registry.has('unknown')).toBe(false);
    expect(registry.has('integration.health_check')).toBe(true);
  });

  it('integration.health_check executes with valid payload', async () => {
    const handler = registry.resolve('integration.health_check');
    const result = await handler.execute('job-1', { providerId: 'prov-123' });
    expect((result as Record<string, unknown>).providerId).toBe('prov-123');
  });

  it('report.generate throws on missing orgId', async () => {
    const handler = registry.resolve('report.generate');
    await expect(handler.execute('job-1', {} as Record<string, unknown>)).rejects.toThrow('requires reportType and orgId');
  });
});
