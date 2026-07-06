import { NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_A = 'org-aaaaaaaa';
const ORG_B = 'org-bbbbbbbb';
const PAT_ID = 'pat-11111111';

function makeRow(orgId: string) {
  return {
    id: PAT_ID,
    first_name: 'enc:Alice',
    last_name: 'enc:Smith',
    date_of_birth: '1990-01-01',
    gender: 'enc:female',
    clinical_notes: null,
    organization_id: orgId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    case_count: 0,
  };
}

function makePool(rows: unknown[][]) {
  let callIndex = 0;
  return {
    query: jest.fn(async () => ({ rows: rows[callIndex++] ?? [] })),
  };
}

function makeCrypto() {
  return {
    encrypt: jest.fn((v: string | null) => (v ? `enc:${v}` : null)),
    decrypt: jest.fn((v: string | null) => (v ? v.replace('enc:', '') : null)),
  };
}

function makeAudit() {
  return { log: jest.fn(async () => {}) };
}

function makeService(pool: ReturnType<typeof makePool>) {
  return new PatientsService(
    pool as any,
    makeAudit() as any,
    makeCrypto() as any,
  );
}

// ─── update — TOCTOU fix ──────────────────────────────────────────────────────

describe('PatientsService.update', () => {
  it('UPDATE SQL includes AND organization_id clause to close TOCTOU window', async () => {
    // Sequence: findOne SELECT → UPDATE → findOne SELECT (post-update read)
    const pool = makePool([
      [makeRow(ORG_A)],   // findOne ownership check
      [],                  // UPDATE (pg returns empty rows on UPDATE)
      [makeRow(ORG_A)],   // findOne return value
    ]);
    const svc = makeService(pool);

    await svc.update(PAT_ID, ORG_A, 'actor-1', { firstName: 'Bob' });

    const updateCall = (pool.query as jest.Mock).mock.calls[1];
    const [sql, params] = updateCall;
    expect(sql).toMatch(/AND organization_id = \$\d+/);
    expect(params).toContain(ORG_A);
  });

  it('UPDATE SQL binds organization_id at index after id', async () => {
    const pool = makePool([
      [makeRow(ORG_A)],
      [],
      [makeRow(ORG_A)],
    ]);
    const svc = makeService(pool);

    await svc.update(PAT_ID, ORG_A, 'actor-1', { firstName: 'Bob', lastName: 'Jones' });

    const [, params] = (pool.query as jest.Mock).mock.calls[1];
    const idIndex = params.indexOf(PAT_ID);
    const orgIndex = params.indexOf(ORG_A);
    expect(idIndex).toBeGreaterThan(-1);
    expect(orgIndex).toBe(idIndex + 1);
  });

  it('returns unchanged patient when no fields provided', async () => {
    const pool = makePool([[makeRow(ORG_A)], [makeRow(ORG_A)]]);
    const svc = makeService(pool);

    const result = await svc.update(PAT_ID, ORG_A, 'actor-1', {});
    expect(pool.query).toHaveBeenCalledTimes(2); // two findOne SELECTs, no UPDATE
    expect(result.id).toBe(PAT_ID);
  });

  it('findOne throws NotFoundException on cross-org access', async () => {
    // SQL WHERE p.id=$1 AND p.organization_id=$2 returns no rows for cross-tenant
    const pool = makePool([[]]);
    const svc = makeService(pool);

    await expect(svc.update(PAT_ID, ORG_A, 'actor-1', { firstName: 'Hacker' }))
      .rejects.toThrow(NotFoundException);
  });
});
