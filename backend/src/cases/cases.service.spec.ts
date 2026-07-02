import { ForbiddenException } from '@nestjs/common';
import { CasesService } from './cases.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_A = 'org-aaaaaaaa';
const ORG_B = 'org-bbbbbbbb';
const CASE_ID = 'case-11111111';
const PAT_ID = 'pat-22222222';

function makeRow(orgId: string) {
  return {
    id: CASE_ID,
    status: 'draft',
    notes: null,
    chief_complaint: null,
    malocclusion_class: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    patient_id: PAT_ID,
    first_name: 'Alice',
    last_name: 'Smith',
    date_of_birth: null,
    gender: null,
    patient_notes: null,
    organization_id: orgId,
    assigned_to_name: null,
    assigned_to_id: null,
    assigned_to_email: null,
  };
}

function makePool(rows: unknown[][]) {
  let callIndex = 0;
  return {
    query: jest.fn(async () => ({ rows: rows[callIndex++] ?? [] })),
  };
}

function makeWorkflow() {
  return {
    getHistory: jest.fn(async () => []),
    allowedTransitions: jest.fn(() => []),
    transition: jest.fn(async () => ({})),
  };
}

function makeAudit() {
  return { log: jest.fn(async () => {}) };
}

function makeService(pool: ReturnType<typeof makePool>) {
  return new CasesService(
    pool as any,
    makeAudit() as any,
    makeWorkflow() as any,
  );
}

// ─── update — TOCTOU fix ──────────────────────────────────────────────────────

describe('CasesService.update', () => {
  it('UPDATE SQL scopes by org via patient_id subquery to close TOCTOU window', async () => {
    // Sequence: findOne SELECT → linked resources SELECT → UPDATE → findOne SELECT → linked resources SELECT
    const pool = makePool([
      [makeRow(ORG_A)],  // findOne case+patient JOIN
      [{}],              // linked resources query
      [],                // UPDATE
      [makeRow(ORG_A)],  // findOne post-update
      [{}],              // linked resources post-update
    ]);
    const svc = makeService(pool);

    await svc.update(CASE_ID, ORG_A, 'actor-1', { notes: 'updated' });

    const updateCall = (pool.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('UPDATE cases SET'),
    );
    expect(updateCall).toBeDefined();
    const [sql, params] = updateCall!;
    expect(sql).toMatch(/AND patient_id IN \(SELECT id FROM patients WHERE organization_id = \$\d+\)/);
    expect(params).toContain(ORG_A);
  });

  it('binds orgId to the parameter after case id in the UPDATE', async () => {
    const pool = makePool([
      [makeRow(ORG_A)],
      [{}],
      [],
      [makeRow(ORG_A)],
      [{}],
    ]);
    const svc = makeService(pool);

    await svc.update(CASE_ID, ORG_A, 'actor-1', { chiefComplaint: 'spacing' });

    const updateCall = (pool.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('UPDATE cases SET'),
    );
    const [, params] = updateCall!;
    const idIndex = params.indexOf(CASE_ID);
    const orgIndex = params.indexOf(ORG_A);
    expect(idIndex).toBeGreaterThan(-1);
    expect(orgIndex).toBe(idIndex + 1);
  });

  it('returns unchanged case when no fields provided (no UPDATE issued)', async () => {
    const pool = makePool([
      [makeRow(ORG_A)],  // first findOne
      [{}],              // linked resources
      [makeRow(ORG_A)],  // second findOne (early return path)
      [{}],              // linked resources
    ]);
    const svc = makeService(pool);

    const result = await svc.update(CASE_ID, ORG_A, 'actor-1', {});
    const updateIssued = (pool.query as jest.Mock).mock.calls.some(
      ([sql]: [string]) => sql.includes('UPDATE cases SET'),
    );
    expect(updateIssued).toBe(false);
    expect(result.id).toBe(CASE_ID);
  });

  it('findOne throws ForbiddenException on cross-org access attempt', async () => {
    const pool = makePool([
      [makeRow(ORG_B)],  // row belongs to ORG_B
      [{}],
    ]);
    const svc = makeService(pool);

    await expect(svc.update(CASE_ID, ORG_A, 'actor-1', { notes: 'hack' }))
      .rejects.toThrow(ForbiddenException);
  });
});
