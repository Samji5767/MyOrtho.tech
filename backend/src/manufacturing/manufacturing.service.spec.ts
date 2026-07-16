import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ManufacturingService } from './manufacturing.service';

// ─── Pool helpers ─────────────────────────────────────────────────────────────

type QueryMap = Record<string, unknown[]>;

function makePool(queryMap: QueryMap) {
  return {
    query: jest.fn(async (sql: string) => {
      const key = Object.keys(queryMap).find((k) => sql.includes(k));
      return { rows: key ? queryMap[key] : [], rowCount: key ? (queryMap[key] as unknown[]).length : 0 };
    }),
    connect: jest.fn(async () => ({
      query: jest.fn(async (sql: string) => {
        const key = Object.keys(queryMap).find((k) => sql.includes(k));
        return { rows: key ? queryMap[key] : [], rowCount: 1 };
      }),
      release: jest.fn(),
    })),
  };
}

function makeService(pool: ReturnType<typeof makePool>) {
  return new ManufacturingService(pool as any);
}

const ORG = 'org-mfg-test';
const ACTOR = 'user-mfg-test';
const STAGE_ID = 'stage-001';

// ─── createJob approval gate ───────────────────────────────────────────────────

describe('ManufacturingService.createJob — approval gate', () => {
  it('throws NotFoundException when stage not found in org', async () => {
    const svc = makeService(makePool({ 'FROM aligner_stages ast': [] }));
    await expect(
      svc.createJob(ORG, ACTOR, { stageId: STAGE_ID }, 'actor@test.com'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when treatment plan not yet approved', async () => {
    const svc = makeService(makePool({
      'FROM aligner_stages ast': [{ doctor_approval: false }],
    }));
    await expect(
      svc.createJob(ORG, ACTOR, { stageId: STAGE_ID }, 'actor@test.com'),
    ).rejects.toThrow(BadRequestException);
  });

  it('proceeds to connector check when treatment plan is approved', async () => {
    // No printer specified — insert path executes with approved plan
    const svc = makeService(makePool({
      'FROM aligner_stages ast': [{ doctor_approval: true }],
      'INSERT INTO print_jobs': [{ id: 'job-1', status: 'queued', created_at: new Date() }],
    }));
    const result = await svc.createJob(ORG, ACTOR, { stageId: STAGE_ID }, 'actor@test.com');
    expect(result.id).toBe('job-1');
    expect(result.status).toBe('queued');
  });

  it('skips approval check when no stageId provided', async () => {
    const svc = makeService(makePool({
      'INSERT INTO print_jobs': [{ id: 'job-2', status: 'queued', created_at: new Date() }],
    }));
    const result = await svc.createJob(ORG, ACTOR, {}, 'actor@test.com');
    expect(result.id).toBe('job-2');
  });
});
