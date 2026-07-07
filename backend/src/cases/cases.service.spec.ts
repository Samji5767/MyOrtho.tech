import { NotFoundException } from '@nestjs/common';
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

// Pool for non-transactional methods (update, findOne) — pool.query only
function makePool(rows: unknown[][]) {
  let callIndex = 0;
  return {
    query: jest.fn(async () => ({ rows: rows[callIndex++] ?? [] })),
  };
}

// Pool for transactional methods (create, createWithNewPatient) —
// pool.connect() returns a client; pool.query is used by findOne after commit.
function makeTransactionPool(clientRows: unknown[][], poolRows: unknown[][]) {
  let clientIdx = 0;
  let poolIdx = 0;
  const client = {
    query: jest.fn(async () => ({ rows: clientRows[clientIdx++] ?? [] })),
    release: jest.fn(),
  };
  return {
    connect: jest.fn(async () => client),
    query: jest.fn(async () => ({ rows: poolRows[poolIdx++] ?? [] })),
    _client: client,
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
    { encrypt: (v: unknown) => v, decrypt: (v: unknown) => v } as any,
  );
}

function makeTransactionService(pool: ReturnType<typeof makeTransactionPool>) {
  return new CasesService(
    pool as any,
    makeAudit() as any,
    makeWorkflow() as any,
    { encrypt: (v: unknown) => v, decrypt: (v: unknown) => v } as any,
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

  it('findOne throws NotFoundException on cross-org access attempt', async () => {
    // SQL WHERE c.id=$1 AND p.organization_id=$2 returns no rows for cross-tenant
    const pool = makePool([[]]);
    const svc = makeService(pool);

    await expect(svc.update(CASE_ID, ORG_A, 'actor-1', { notes: 'hack' }))
      .rejects.toThrow(NotFoundException);
  });
});

// ─── create — organization_id fix (migration 034) ─────────────────────────────

describe('CasesService.create', () => {
  it('INSERT includes organization_id as the 3rd bound parameter', async () => {
    const PAT_ID2 = 'pat-33333333';
    // client.query sequence: BEGIN, patient ownership SELECT, INSERT cases, COMMIT
    // pool.query sequence: findOne JOIN, linked resources
    const pool = makeTransactionPool(
      [[], [{ id: PAT_ID2 }], [{ id: CASE_ID }], []],
      [[], [], [makeRow(ORG_A)], [{}]],
    );
    const svc = makeTransactionService(pool);

    await svc.create(ORG_A, 'actor-1', { patientId: PAT_ID2 });

    const insertCall = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO cases'),
    );
    expect(insertCall).toBeDefined();
    const [sql, params] = insertCall!;
    // organization_id must appear in the column list
    expect(sql).toMatch(/organization_id/);
    // orgId must be in the bound params
    expect(params).toContain(ORG_A);
  });

  it('INSERT binds orgId before chiefComplaint (position 3)', async () => {
    const PAT_ID2 = 'pat-33333333';
    const COMPLAINT = 'Test complaint';
    const pool = makeTransactionPool(
      [[], [{ id: PAT_ID2 }], [{ id: CASE_ID }], []],
      [[], [], [makeRow(ORG_A)], [{}]],
    );
    const svc = makeTransactionService(pool);

    await svc.create(ORG_A, 'actor-1', { patientId: PAT_ID2, chiefComplaint: COMPLAINT });

    const insertCall = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO cases'),
    );
    const [, params] = insertCall!;
    const orgIndex = params.indexOf(ORG_A);
    const complaintIndex = params.indexOf(COMPLAINT);
    // orgId must appear before chiefComplaint in the param array
    expect(orgIndex).toBeGreaterThan(-1);
    expect(complaintIndex).toBeGreaterThan(orgIndex);
  });
});

// ─── createWithNewPatient — organization_id fix (migration 034) ────────────────

describe('CasesService.createWithNewPatient', () => {
  it('INSERT INTO cases includes organization_id', async () => {
    const NEW_PAT_ID = 'pat-44444444';
    // client.query sequence: BEGIN, INSERT patients, INSERT cases, COMMIT
    // pool.query sequence: findOne JOIN, linked resources
    const pool = makeTransactionPool(
      [[], [{ id: NEW_PAT_ID }], [{ id: CASE_ID }], []],
      [[], [], [makeRow(ORG_A)], [{}]],
    );
    const svc = makeTransactionService(pool);

    await svc.createWithNewPatient(ORG_A, 'actor-1', {
      patient: { firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1990-01-01' },
    });

    const caseInsert = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO cases'),
    );
    expect(caseInsert).toBeDefined();
    const [sql, params] = caseInsert!;
    expect(sql).toMatch(/organization_id/);
    expect(params).toContain(ORG_A);
  });

  it('patient INSERT and case INSERT both use the same orgId', async () => {
    const NEW_PAT_ID = 'pat-44444444';
    const pool = makeTransactionPool(
      [[], [{ id: NEW_PAT_ID }], [{ id: CASE_ID }], []],
      [[], [], [makeRow(ORG_A)], [{}]],
    );
    const svc = makeTransactionService(pool);

    await svc.createWithNewPatient(ORG_A, 'actor-1', {
      patient: { firstName: 'Jane', lastName: 'Doe' },
    });

    const patInsert = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO patients'),
    );
    const caseInsert = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO cases'),
    );
    expect((patInsert![1] as unknown[]).includes(ORG_A)).toBe(true);
    expect((caseInsert![1] as unknown[]).includes(ORG_A)).toBe(true);
  });
});
