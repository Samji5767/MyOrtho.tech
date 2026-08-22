import { NotFoundException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { type AccessScope } from '../common/access-scope';

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

function makeNotifications() {
  return { create: jest.fn(async () => {}) };
}

function makeService(pool: ReturnType<typeof makePool>) {
  return new CasesService(
    pool as any,
    makeAudit() as any,
    makeWorkflow() as any,
    { encrypt: (v: unknown) => v, decrypt: (v: unknown) => v } as any,
    makeNotifications() as any,
  );
}

function makeTransactionService(pool: ReturnType<typeof makeTransactionPool>) {
  return new CasesService(
    pool as any,
    makeAudit() as any,
    makeWorkflow() as any,
    { encrypt: (v: unknown) => v, decrypt: (v: unknown) => v } as any,
    makeNotifications() as any,
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
    // client.query sequence: BEGIN, patient ownership SELECT, workspace lookup, INSERT cases, COMMIT
    // pool.query sequence: findOne JOIN, linked resources
    const pool = makeTransactionPool(
      [[], [{ id: PAT_ID2 }], [{ workspace_id: null }], [{ id: CASE_ID }], []],
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
      [[], [{ id: PAT_ID2 }], [{ workspace_id: null }], [{ id: CASE_ID }], []],
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

// ─── Scope-based methods — cross-workspace isolation ──────────────────────────

const WS_A = 'ws-aaaaaaaa';
const WS_B = 'ws-bbbbbbbb';

const SCOPE_WS_A: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_A };
const SCOPE_ORG_A: AccessScope = { kind: 'org', orgId: ORG_A };

function makeWsRow(workspaceId: string) {
  return { ...makeRow(ORG_A), workspace_id: workspaceId };
}

describe('CasesService.findOneByScope', () => {
  it('SELECT uses c.workspace_id predicate for workspace scope', async () => {
    const pool = makePool([[makeWsRow(WS_A)], [{}]]);
    const svc = makeService(pool);

    await svc.findOneByScope(CASE_ID, SCOPE_WS_A);

    const selectCall = (pool.query as jest.Mock).mock.calls[0];
    const [sql, params] = selectCall;
    expect(sql).toMatch(/c\.workspace_id = \$2/);
    expect(params[1]).toBe(WS_A);
  });

  it('SELECT uses p.organization_id predicate for org scope', async () => {
    const pool = makePool([[makeRow(ORG_A)], [{}]]);
    const svc = makeService(pool);

    await svc.findOneByScope(CASE_ID, SCOPE_ORG_A);

    const selectCall = (pool.query as jest.Mock).mock.calls[0];
    const [sql, params] = selectCall;
    expect(sql).toMatch(/p\.organization_id = \$2/);
    expect(params[1]).toBe(ORG_A);
  });

  it('throws NotFoundException for cross-workspace access', async () => {
    const pool = makePool([[]]); // no rows returned
    const svc = makeService(pool);

    await expect(svc.findOneByScope(CASE_ID, SCOPE_WS_A)).rejects.toThrow(NotFoundException);
  });
});

describe('CasesService.findAll (scope-based)', () => {
  it('SELECT uses c.workspace_id = $1 for workspace scope', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);

    await svc.findAll(SCOPE_WS_A, 10, 0);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/c\.workspace_id = \$1/);
    expect(params[0]).toBe(WS_A);
  });

  it('SELECT uses p.organization_id = $1 for org scope', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);

    await svc.findAll(SCOPE_ORG_A, 10, 0);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/p\.organization_id = \$1/);
    expect(params[0]).toBe(ORG_A);
  });
});

describe('CasesService.updateByScope', () => {
  it('UPDATE uses workspace_id predicate for workspace scope', async () => {
    const pool = makePool([
      [makeWsRow(WS_A)], [{}],  // findOneByScope
      [],                         // UPDATE
      [makeWsRow(WS_A)], [{}],  // findOneByScope post-update
    ]);
    const svc = makeService(pool);

    await svc.updateByScope(CASE_ID, SCOPE_WS_A, 'actor-1', { notes: 'updated' });

    const updateCall = (pool.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('UPDATE cases SET'),
    );
    expect(updateCall).toBeDefined();
    const [sql, params] = updateCall!;
    expect(sql).toMatch(/WHERE id = \$\d+ AND workspace_id = \$\d+/);
    expect(params).toContain(WS_A);
  });

  it('throws NotFoundException on cross-workspace update attempt', async () => {
    const pool = makePool([[]]); // findOneByScope returns no rows
    const svc = makeService(pool);

    await expect(
      svc.updateByScope(CASE_ID, SCOPE_WS_A, 'actor-1', { notes: 'hack' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CasesService.transitionByScope', () => {
  it('passes workspaceId to workflowService.transition', async () => {
    const pool = makePool([[makeWsRow(WS_A)], [{}]]); // findOneByScope
    const workflow = makeWorkflow();
    const svc = new CasesService(
      pool as any, makeAudit() as any, workflow as any,
      { encrypt: (v: unknown) => v, decrypt: (v: unknown) => v } as any,
      makeNotifications() as any,
    );

    await svc.transitionByScope(CASE_ID, SCOPE_WS_A, 'actor-1', 'orthodontist', 'archived');

    expect(workflow.transition).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WS_A, orgId: ORG_A }),
    );
  });

  it('passes null workspaceId for org scope', async () => {
    const pool = makePool([[makeRow(ORG_A)], [{}]]);
    const workflow = makeWorkflow();
    const svc = new CasesService(
      pool as any, makeAudit() as any, workflow as any,
      { encrypt: (v: unknown) => v, decrypt: (v: unknown) => v } as any,
      makeNotifications() as any,
    );

    await svc.transitionByScope(CASE_ID, SCOPE_ORG_A, 'actor-1', 'admin', 'archived');

    expect(workflow.transition).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: null, orgId: ORG_A }),
    );
  });
});

describe('CasesService.createByScope', () => {
  it('patient ownership check uses workspace_id for workspace scope', async () => {
    const PAT_ID2 = 'pat-55555555';
    const pool = makeTransactionPool(
      [[], [{ id: PAT_ID2 }], [{ id: CASE_ID }], []],
      [[], [], [makeWsRow(WS_A)], [{}]],
    );
    const svc = makeTransactionService(pool);

    await svc.createByScope(SCOPE_WS_A, 'actor-1', { patientId: PAT_ID2 });

    const patientCheck = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('SELECT id FROM patients'),
    );
    expect(patientCheck).toBeDefined();
    const [checkSql, checkParams] = patientCheck!;
    expect(checkSql).toMatch(/workspace_id = \$2/);
    expect(checkParams[1]).toBe(WS_A);
  });

  it('throws NotFoundException when patient is in a different workspace', async () => {
    const pool = makeTransactionPool(
      [[], [], []],  // BEGIN, patient check → no rows, ROLLBACK
      [],
    );
    const svc = makeTransactionService(pool);

    await expect(
      svc.createByScope(SCOPE_WS_A, 'actor-1', { patientId: PAT_ID }),
    ).rejects.toThrow(NotFoundException);
  });

  it('INSERT INTO cases includes workspace_id from scope', async () => {
    const PAT_ID2 = 'pat-55555555';
    const pool = makeTransactionPool(
      [[], [{ id: PAT_ID2 }], [{ id: CASE_ID }], []],
      [[], [], [makeWsRow(WS_A)], [{}]],
    );
    const svc = makeTransactionService(pool);

    await svc.createByScope(SCOPE_WS_A, 'actor-1', { patientId: PAT_ID2 });

    const insertCall = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO cases'),
    );
    expect(insertCall).toBeDefined();
    const [, params] = insertCall!;
    expect(params).toContain(WS_A);
    expect(params).toContain(ORG_A);
  });
});

describe('CasesService.createWithNewPatientByScope', () => {
  it('both patient and case INSERT use workspace_id from scope', async () => {
    const NEW_PAT = 'pat-66666666';
    const pool = makeTransactionPool(
      [[], [{ id: NEW_PAT }], [{ id: CASE_ID }], []],
      [[], [], [makeWsRow(WS_A)], [{}]],
    );
    const svc = makeTransactionService(pool);

    await svc.createWithNewPatientByScope(SCOPE_WS_A, 'actor-1', {
      patient: { firstName: 'Test', lastName: 'User' },
    });

    const patInsert = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO patients'),
    );
    const caseInsert = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO cases'),
    );
    expect((patInsert![1] as unknown[]).includes(WS_A)).toBe(true);
    expect((caseInsert![1] as unknown[]).includes(WS_A)).toBe(true);
    // Both also carry the org
    expect((patInsert![1] as unknown[]).includes(ORG_A)).toBe(true);
    expect((caseInsert![1] as unknown[]).includes(ORG_A)).toBe(true);
  });

  it('org scope sets null workspace_id on both patient and case', async () => {
    const NEW_PAT = 'pat-77777777';
    const pool = makeTransactionPool(
      [[], [{ id: NEW_PAT }], [{ id: CASE_ID }], []],
      [[], [], [makeRow(ORG_A)], [{}]],
    );
    const svc = makeTransactionService(pool);

    await svc.createWithNewPatientByScope(SCOPE_ORG_A, 'actor-1', {
      patient: { firstName: 'Admin', lastName: 'User' },
    });

    const patInsert = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO patients'),
    );
    const caseInsert = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO cases'),
    );
    // workspaceId param should be null at index 1
    expect((patInsert![1] as unknown[])[1]).toBeNull();
    expect((caseInsert![1] as unknown[])[3]).toBeNull();
  });
});

describe('CasesService.getAnalyticsSummaryByScope', () => {
  it('uses workspace_id = $1 for workspace scope', async () => {
    const pool = makePool([[{ total_cases: '0', active_cases: '0', pending_review: '0',
      completed_this_month: '0', manufacturing_queue: '0', archived_cases: '0', draft_cases: '0' }]]);
    const svc = makeService(pool);

    await svc.getAnalyticsSummaryByScope(SCOPE_WS_A);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE workspace_id = \$1/);
    expect(params[0]).toBe(WS_A);
  });

  it('uses organization_id = $1 for org scope', async () => {
    const pool = makePool([[{ total_cases: '0', active_cases: '0', pending_review: '0',
      completed_this_month: '0', manufacturing_queue: '0', archived_cases: '0', draft_cases: '0' }]]);
    const svc = makeService(pool);

    await svc.getAnalyticsSummaryByScope(SCOPE_ORG_A);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE organization_id = \$1/);
    expect(params[0]).toBe(ORG_A);
  });
});
