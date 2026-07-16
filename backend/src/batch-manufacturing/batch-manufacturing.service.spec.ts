import { BadRequestException } from '@nestjs/common';
import { BatchManufacturingService } from './batch-manufacturing.service';

// ─── Pool helpers ─────────────────────────────────────────────────────────────

type QueryMap = Record<string, unknown[]>;

function makePool(queryMap: QueryMap) {
  return {
    query: jest.fn(async (sql: string) => {
      const key = Object.keys(queryMap).find((k) => sql.includes(k));
      return { rows: key ? queryMap[key] : [], rowCount: key ? (queryMap[key] as unknown[]).length : 0 };
    }),
  };
}

function makeSvc(pool: ReturnType<typeof makePool>) {
  return new BatchManufacturingService(pool as any);
}

const ORG = 'org-batch-test';
const ACTOR = 'actor-batch-1';

// ─── create — approval gate ───────────────────────────────────────────────────

describe('BatchManufacturingService.create — approval gate', () => {
  it('throws BadRequestException when a case has no approved plan', async () => {
    const svc = makeSvc(makePool({
      // unnest query returns one unapproved case id
      'FROM unnest': [{ id: 'case-unapproved' }],
    }));
    await expect(
      svc.create(ORG, ACTOR, { caseIds: ['case-unapproved'] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('proceeds when all cases have approved plans', async () => {
    const svc = makeSvc(makePool({
      // unnest query returns empty (all cases pass)
      'FROM unnest': [],
      // batch insert
      'INSERT INTO manufacturing_batches': [{
        id: 'batch-1',
        organization_id: ORG,
        batch_number: 'BATCH-00001',
        status: 'staging',
        case_ids: ['case-approved'],
        scheduled_date: null,
        shipped_at: null,
        resin_type: null,
        priority: 5,
        notes: null,
        created_by: ACTOR,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
    }));
    const batch = await svc.create(ORG, ACTOR, { caseIds: ['case-approved'] });
    expect(batch.id).toBe('batch-1');
    expect(batch.status).toBe('staging');
  });

  it('skips approval check when no caseIds provided', async () => {
    const svc = makeSvc(makePool({
      'INSERT INTO manufacturing_batches': [{
        id: 'batch-2',
        organization_id: ORG,
        batch_number: 'BATCH-00002',
        status: 'staging',
        case_ids: [],
        scheduled_date: null,
        shipped_at: null,
        resin_type: null,
        priority: 5,
        notes: null,
        created_by: ACTOR,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
    }));
    const batch = await svc.create(ORG, ACTOR, {});
    expect(batch.id).toBe('batch-2');
  });
});
