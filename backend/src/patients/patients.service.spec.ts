import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { type AccessScope } from '../common/access-scope';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_A = 'org-aaaaaaaa';
const ORG_B = 'org-bbbbbbbb';
const PAT_ID = 'pat-11111111';
const ACTOR_ID = 'actor-1';

function makeRow(orgId: string = ORG_A, overrides: Record<string, unknown> = {}) {
  return {
    id: PAT_ID,
    first_name: 'enc:Alice',
    last_name: 'enc:Smith',
    date_of_birth: null,
    dob_encrypted: null,
    gender: null,
    clinical_notes: null,
    organization_id: orgId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    case_count: 0,
    ...overrides,
  };
}

function makePool(rows: unknown[][]) {
  let callIndex = 0;
  return {
    query: jest.fn(async () => ({ rows: rows[callIndex++] ?? [], rowCount: (rows[callIndex - 1] ?? []).length })),
  };
}

function makeCrypto() {
  return {
    encrypt: jest.fn((v: string | null | undefined) => (v != null ? `enc:${v}` : null)),
    decrypt: jest.fn((v: string | null | undefined) => (v != null ? String(v).replace('enc:', '') : null)),
  };
}

function makeAudit() {
  return { log: jest.fn(async () => {}) };
}

function makeService(pool: ReturnType<typeof makePool>, crypto = makeCrypto(), audit = makeAudit()) {
  return new PatientsService(pool as any, audit as any, crypto as any);
}

// ─── create ────────────────────────────────────────────────────────────────────

describe('PatientsService.create', () => {
  it('inserts with encrypted PHI fields and returns formatted patient', async () => {
    // Sequence: INSERT → findOne SELECT
    const pool = makePool([[{ id: PAT_ID }], [makeRow()]]);
    const crypto = makeCrypto();
    const audit = makeAudit();
    const svc = makeService(pool, crypto, audit);

    const result = await svc.create(ORG_A, ACTOR_ID, {
      firstName: 'Alice',
      lastName: 'Smith',
    });

    expect(result.id).toBe(PAT_ID);
    // Verify PHI was encrypted before INSERT
    expect(crypto.encrypt).toHaveBeenCalledWith('Alice');
    expect(crypto.encrypt).toHaveBeenCalledWith('Smith');
    // SQL should reference patients table
    const [sql] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/INSERT INTO patients/);
  });

  it('includes organization_id as the first bound parameter', async () => {
    const pool = makePool([[{ id: PAT_ID }], [makeRow()]]);
    const svc = makeService(pool);

    await svc.create(ORG_A, ACTOR_ID, { firstName: 'Bob', lastName: 'Jones' });

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(params[0]).toBe(ORG_A);
  });

  it('encrypts dateOfBirth and stores only in dob_encrypted (no plaintext dob column)', async () => {
    const pool = makePool([[{ id: PAT_ID }], [makeRow()]]);
    const crypto = makeCrypto();
    const svc = makeService(pool, crypto);

    await svc.create(ORG_A, ACTOR_ID, {
      firstName: 'Carol',
      lastName: 'Lee',
      dateOfBirth: '1990-06-15',
    });

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    // only the encrypted value is bound — plaintext dob dual-write was removed
    expect(params).toContain('enc:1990-06-15');
    expect(params).not.toContain('1990-06-15');
  });

  it('encrypts optional gender and clinicalNotes', async () => {
    const pool = makePool([[{ id: PAT_ID }], [makeRow()]]);
    const crypto = makeCrypto();
    const svc = makeService(pool, crypto);

    await svc.create(ORG_A, ACTOR_ID, {
      firstName: 'Dave',
      lastName: 'Kim',
      gender: 'male',
      clinicalNotes: 'Class II malocclusion',
    });

    expect(crypto.encrypt).toHaveBeenCalledWith('male');
    expect(crypto.encrypt).toHaveBeenCalledWith('Class II malocclusion');
  });

  it('logs an audit event after insert', async () => {
    const pool = makePool([[{ id: PAT_ID }], [makeRow()]]);
    const audit = makeAudit();
    const svc = makeService(pool, makeCrypto(), audit);

    await svc.create(ORG_A, ACTOR_ID, { firstName: 'Eve', lastName: 'Fox' });

    expect(audit.log).toHaveBeenCalledTimes(1);
    const logged = (audit.log as jest.Mock).mock.calls[0][0];
    expect(logged.action).toBe('patient.created');
    expect(logged.organizationId).toBe(ORG_A);
    expect(logged.actorId).toBe(ACTOR_ID);
    expect(logged.resourceType).toBe('patient');
  });

  it('audit event details must not contain PHI field values', async () => {
    const pool = makePool([[{ id: PAT_ID }], [makeRow()]]);
    const audit = makeAudit();
    const svc = makeService(pool, makeCrypto(), audit);

    await svc.create(ORG_A, ACTOR_ID, { firstName: 'SECRET', lastName: 'PHI' });

    const logged = (audit.log as jest.Mock).mock.calls[0][0];
    const detailsStr = JSON.stringify(logged.details ?? {});
    expect(detailsStr).not.toContain('SECRET');
    expect(detailsStr).not.toContain('PHI');
  });

  it('throws BadRequestException for invalid dateOfBirth format', async () => {
    const pool = makePool([]);
    const svc = makeService(pool);
    await expect(
      svc.create(ORG_A, ACTOR_ID, { firstName: 'F', lastName: 'L', dateOfBirth: 'not-a-date' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for dob year below 1900', async () => {
    const pool = makePool([]);
    const svc = makeService(pool);
    await expect(
      svc.create(ORG_A, ACTOR_ID, { firstName: 'F', lastName: 'L', dateOfBirth: '1899-01-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for dob year in the future', async () => {
    const pool = makePool([]);
    const svc = makeService(pool);
    const futureYear = new Date().getFullYear() + 1;
    await expect(
      svc.create(ORG_A, ACTOR_ID, { firstName: 'F', lastName: 'L', dateOfBirth: `${futureYear}-01-01` }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts valid dob boundary (1900-01-01)', async () => {
    const pool = makePool([[{ id: PAT_ID }], [makeRow()]]);
    const svc = makeService(pool);
    await expect(
      svc.create(ORG_A, ACTOR_ID, { firstName: 'F', lastName: 'L', dateOfBirth: '1900-01-01' }),
    ).resolves.not.toThrow();
  });
});

// ─── findAllByOrg ──────────────────────────────────────────────────────────────

describe('PatientsService.findAllByOrg', () => {
  it('queries with organization_id, limit, and offset', async () => {
    const pool = makePool([[makeRow(), makeRow(ORG_A, { id: 'pat-22222222' })]]);
    const svc = makeService(pool);

    const results = await svc.findAllByOrg(ORG_A, 10, 5);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE p\.organization_id = \$1/);
    expect(params).toEqual([ORG_A, 10, 5]);
    expect(results).toHaveLength(2);
  });

  it('defaults limit to 100 and offset to 0', async () => {
    const pool = makePool([[makeRow()]]);
    const svc = makeService(pool);

    await svc.findAllByOrg(ORG_A);

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(params[1]).toBe(100);
    expect(params[2]).toBe(0);
  });

  it('decrypts PHI fields on each returned row', async () => {
    const pool = makePool([[makeRow(ORG_A, { first_name: 'enc:Alice', last_name: 'enc:Smith' })]]);
    const crypto = makeCrypto();
    const svc = makeService(pool, crypto);

    const results = await svc.findAllByOrg(ORG_A);

    expect(crypto.decrypt).toHaveBeenCalled();
    expect(results[0].firstName).toBe('Alice');
    expect(results[0].lastName).toBe('Smith');
  });

  it('returns empty array when no patients found', async () => {
    const pool = makePool([[]]); // empty result
    const svc = makeService(pool);
    const results = await svc.findAllByOrg(ORG_A);
    expect(results).toEqual([]);
  });

  it('fullName is trimmed concatenation of firstName and lastName', async () => {
    const pool = makePool([[makeRow(ORG_A, { first_name: 'enc:María', last_name: 'enc:García' })]]);
    const svc = makeService(pool);
    const [patient] = await svc.findAllByOrg(ORG_A);
    expect(patient.fullName).toBe('María García');
  });
});

// ─── findOne ──────────────────────────────────────────────────────────────────

describe('PatientsService.findOne', () => {
  it('queries with id AND organization_id to enforce org isolation', async () => {
    const pool = makePool([[makeRow()]]);
    const svc = makeService(pool);

    await svc.findOne(PAT_ID, ORG_A);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE p\.id = \$1 AND p\.organization_id = \$2/);
    expect(params).toEqual([PAT_ID, ORG_A]);
  });

  it('throws NotFoundException when patient is not found', async () => {
    const pool = makePool([[]]); // empty
    const svc = makeService(pool);
    await expect(svc.findOne(PAT_ID, ORG_A)).rejects.toThrow(NotFoundException);
  });

  it('cross-org access returns NotFoundException (not the row)', async () => {
    const pool = makePool([[]]); // org_id mismatch → 0 rows
    const svc = makeService(pool);
    await expect(svc.findOne(PAT_ID, ORG_B)).rejects.toThrow(NotFoundException);
  });

  it('decrypts dob_encrypted when present', async () => {
    const row = makeRow(ORG_A, { dob_encrypted: 'enc:1985-07-22', date_of_birth: '1985-07-22' });
    const pool = makePool([[row]]);
    const svc = makeService(pool);

    const patient = await svc.findOne(PAT_ID, ORG_A);
    expect(patient.dateOfBirth).toBe('1985-07-22');
  });

  it('returns decoded clinical notes', async () => {
    const row = makeRow(ORG_A, { clinical_notes: 'enc:Class II' });
    const pool = makePool([[row]]);
    const svc = makeService(pool);

    const patient = await svc.findOne(PAT_ID, ORG_A);
    expect(patient.clinicalNotes).toBe('Class II');
  });
});

// ─── update — TOCTOU fix ──────────────────────────────────────────────────────

describe('PatientsService.update', () => {
  it('UPDATE SQL includes AND organization_id clause to close TOCTOU window', async () => {
    const pool = makePool([
      [makeRow(ORG_A)],   // findOne ownership check
      [],                  // UPDATE
      [makeRow(ORG_A)],   // findOne return value
    ]);
    const svc = makeService(pool);

    await svc.update(PAT_ID, ORG_A, ACTOR_ID, { firstName: 'Bob' });

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

    await svc.update(PAT_ID, ORG_A, ACTOR_ID, { firstName: 'Bob', lastName: 'Jones' });

    const [, params] = (pool.query as jest.Mock).mock.calls[1];
    const idIndex = params.indexOf(PAT_ID);
    const orgIndex = params.indexOf(ORG_A);
    expect(idIndex).toBeGreaterThan(-1);
    expect(orgIndex).toBe(idIndex + 1);
  });

  it('returns unchanged patient when no fields provided', async () => {
    const pool = makePool([[makeRow(ORG_A)], [makeRow(ORG_A)]]);
    const svc = makeService(pool);

    const result = await svc.update(PAT_ID, ORG_A, ACTOR_ID, {});
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(result.id).toBe(PAT_ID);
  });

  it('findOne throws NotFoundException on cross-org access', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);
    await expect(svc.update(PAT_ID, ORG_A, ACTOR_ID, { firstName: 'Hacker' }))
      .rejects.toThrow(NotFoundException);
  });

  it('encrypts updated PHI fields before writing to DB', async () => {
    const pool = makePool([[makeRow(ORG_A)], [], [makeRow(ORG_A)]]);
    const crypto = makeCrypto();
    const svc = makeService(pool, crypto);

    await svc.update(PAT_ID, ORG_A, ACTOR_ID, { firstName: 'NewName', gender: 'female' });

    expect(crypto.encrypt).toHaveBeenCalledWith('NewName');
    expect(crypto.encrypt).toHaveBeenCalledWith('female');
  });

  it('logs an audit event with field names but not PHI values', async () => {
    const pool = makePool([[makeRow(ORG_A)], [], [makeRow(ORG_A)]]);
    const audit = makeAudit();
    const svc = makeService(pool, makeCrypto(), audit);

    await svc.update(PAT_ID, ORG_A, ACTOR_ID, { firstName: 'SECRET' });

    expect(audit.log).toHaveBeenCalledTimes(1);
    const logged = (audit.log as jest.Mock).mock.calls[0][0];
    expect(logged.action).toBe('patient.updated');
    expect(JSON.stringify(logged.details ?? {})).not.toContain('SECRET');
    expect(JSON.stringify(logged.details ?? {})).toContain('firstName');
  });

  it('throws BadRequestException when updating with invalid dob', async () => {
    const pool = makePool([]);
    const svc = makeService(pool);
    await expect(
      svc.update(PAT_ID, ORG_A, ACTOR_ID, { dateOfBirth: '99/99/9999' }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── Workspace-scoped methods (Phase 5 IDOR protection) ────────────────────────

const WS_A = 'ws-aaaaaaaa';
const WS_B = 'ws-bbbbbbbb';

function makeWsRow(workspaceId: string = WS_A, overrides: Record<string, unknown> = {}) {
  return {
    ...makeRow(ORG_A),
    workspace_id: workspaceId,
    status: 'active',
    archived_at: null,
    ...overrides,
  };
}

// ─── findAllByWorkspace ───────────────────────────────────────────────────────

describe('PatientsService.findAllByWorkspace', () => {
  it('queries with workspace_id, limit, and offset', async () => {
    const pool = makePool([[makeWsRow(), makeWsRow(WS_A, { id: 'pat-22222222' })]]);
    const svc = makeService(pool);

    const results = await svc.findAllByWorkspace(WS_A, 10, 5);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE p\.workspace_id = \$1/);
    expect(params[0]).toBe(WS_A);
    expect(params[1]).toBe(10);
    expect(params[2]).toBe(5);
    expect(results).toHaveLength(2);
  });

  it('excludes archived patients by default', async () => {
    const pool = makePool([[makeWsRow()]]);
    const svc = makeService(pool);

    await svc.findAllByWorkspace(WS_A);

    const [sql] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/status != 'archived'/);
  });

  it('includes archived patients when includeArchived=true', async () => {
    const pool = makePool([[makeWsRow(WS_A, { status: 'archived' })]]);
    const svc = makeService(pool);

    await svc.findAllByWorkspace(WS_A, 100, 0, true);

    const [sql] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).not.toMatch(/status != 'archived'/);
  });

  it('does not leak rows from other workspaces', async () => {
    // Simulate DB returning only rows that match WS_A (the WHERE clause enforces this)
    const pool = makePool([[makeWsRow(WS_A)]]);
    const svc = makeService(pool);

    const results = await svc.findAllByWorkspace(WS_A);

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    // Only WS_A is passed — the DB WHERE clause is the isolation boundary
    expect(params[0]).toBe(WS_A);
    expect(params[0]).not.toBe(WS_B);
    expect(results).toHaveLength(1);
  });

  it('returns status and archivedAt fields', async () => {
    const archivedAt = new Date('2024-01-15').toISOString();
    const pool = makePool([[makeWsRow(WS_A, { status: 'archived', archived_at: archivedAt })]]);
    const svc = makeService(pool);

    const [result] = await svc.findAllByWorkspace(WS_A, 100, 0, true);
    expect(result.status).toBe('archived');
    expect(result.archivedAt).toBe(archivedAt);
  });

  it('returns empty array when workspace has no patients', async () => {
    const pool = makePool([[]]); // empty result
    const svc = makeService(pool);
    const results = await svc.findAllByWorkspace(WS_A);
    expect(results).toEqual([]);
  });

  it('decrypts PHI fields on each returned row', async () => {
    const pool = makePool([[makeWsRow(WS_A, { first_name: 'enc:Jane', last_name: 'enc:Doe' })]]);
    const crypto = makeCrypto();
    const svc = makeService(pool, crypto);

    const [result] = await svc.findAllByWorkspace(WS_A);
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Doe');
  });
});

// ─── findOneByWorkspace ──────────────────────────────────────────────────────

describe('PatientsService.findOneByWorkspace', () => {
  it('queries with id AND workspace_id for IDOR isolation', async () => {
    const pool = makePool([[makeWsRow()]]);
    const svc = makeService(pool);

    await svc.findOneByWorkspace(PAT_ID, WS_A);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE p\.id = \$1 AND p\.workspace_id = \$2/);
    expect(params).toEqual([PAT_ID, WS_A]);
  });

  it('throws NotFoundException when patient not found in workspace', async () => {
    const pool = makePool([[]]); // 0 rows
    const svc = makeService(pool);
    await expect(svc.findOneByWorkspace(PAT_ID, WS_A)).rejects.toThrow(NotFoundException);
  });

  it('cross-workspace access returns NotFoundException, not the row', async () => {
    // Attacker uses WS_B to access a patient belonging to WS_A
    const pool = makePool([[]]); // workspace_id mismatch → 0 rows
    const svc = makeService(pool);
    await expect(svc.findOneByWorkspace(PAT_ID, WS_B)).rejects.toThrow(NotFoundException);
  });

  it('does not throw ForbiddenException (prevents ID enumeration)', async () => {
    const pool = makePool([[]]); // cross-workspace miss
    const svc = makeService(pool);
    await expect(svc.findOneByWorkspace(PAT_ID, WS_B))
      .rejects.toThrow(NotFoundException);
    await expect(svc.findOneByWorkspace(PAT_ID, WS_B))
      .rejects.not.toThrow(ForbiddenException);
  });

  it('decrypts clinical_notes when present', async () => {
    const pool = makePool([[makeWsRow(WS_A, { clinical_notes: 'enc:Class III' })]]);
    const svc = makeService(pool);
    const result = await svc.findOneByWorkspace(PAT_ID, WS_A);
    expect(result.clinicalNotes).toBe('Class III');
  });

  it('returns workspaceId in response', async () => {
    const pool = makePool([[makeWsRow(WS_A)]]);
    const svc = makeService(pool);
    const result = await svc.findOneByWorkspace(PAT_ID, WS_A);
    expect(result.workspaceId).toBe(WS_A);
  });
});

// ─── archive ─────────────────────────────────────────────────────────────────

describe('PatientsService.archive', () => {
  it('throws NotFoundException when patient not in workspace (IDOR block)', async () => {
    // findOneByWorkspace returns empty → NotFoundException before UPDATE runs
    const pool = makePool([[]]); // IDOR check fails
    const svc = makeService(pool);
    await expect(svc.archive(PAT_ID, WS_B, ACTOR_ID)).rejects.toThrow(NotFoundException);
    // UPDATE should never have been called
    expect((pool.query as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('sets status=archived and archived_at on the correct workspace_id row', async () => {
    const archivedRow = makeWsRow(WS_A, { status: 'archived', archived_at: new Date().toISOString() });
    // Sequence: findOneByWorkspace (IDOR) → UPDATE → findOneByWorkspace (return)
    const pool = makePool([[makeWsRow()], [], [archivedRow]]);
    const svc = makeService(pool);

    const result = await svc.archive(PAT_ID, WS_A, ACTOR_ID);

    const updateCall = (pool.query as jest.Mock).mock.calls[1];
    const [sql, params] = updateCall;
    expect(sql).toMatch(/UPDATE patients SET status = 'archived'/);
    expect(sql).toMatch(/WHERE id = \$1 AND workspace_id = \$2/);
    expect(params[0]).toBe(PAT_ID);
    expect(params[1]).toBe(WS_A);
    expect(result.status).toBe('archived');
  });

  it('logs an audit event with action patient.archived', async () => {
    const archivedRow = makeWsRow(WS_A, { status: 'archived', archived_at: new Date().toISOString() });
    const pool = makePool([[makeWsRow()], [], [archivedRow]]);
    const audit = makeAudit();
    const svc = makeService(pool, makeCrypto(), audit);

    await svc.archive(PAT_ID, WS_A, ACTOR_ID);

    expect(audit.log).toHaveBeenCalledTimes(1);
    const logged = (audit.log as jest.Mock).mock.calls[0][0];
    expect(logged.action).toBe('patient.archived');
    expect(logged.actorId).toBe(ACTOR_ID);
    expect(logged.resourceType).toBe('patient');
  });

  it('cross-workspace archive attempt does not modify any row', async () => {
    const pool = makePool([[]]); // IDOR check on WS_B fails
    const svc = makeService(pool);

    await expect(svc.archive(PAT_ID, WS_B, ACTOR_ID)).rejects.toThrow(NotFoundException);
    // Only 1 query ran (the IDOR check) — no UPDATE
    expect((pool.query as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});

// ─── restore ──────────────────────────────────────────────────────────────────

describe('PatientsService.restore', () => {
  it('throws NotFoundException when patient not in workspace (IDOR block)', async () => {
    const pool = makePool([[]]); // existence check fails
    const svc = makeService(pool);
    await expect(svc.restore(PAT_ID, WS_B, ACTOR_ID)).rejects.toThrow(NotFoundException);
    expect((pool.query as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('sets status=active and archived_at=NULL for correct workspace row', async () => {
    const activeRow = makeWsRow(WS_A, { status: 'active', archived_at: null });
    // Sequence: SELECT (existence check) → UPDATE → findOneByWorkspace (return)
    const pool = makePool(
      [[{ id: PAT_ID, organization_id: ORG_A }], [], [activeRow]],
    );
    const svc = makeService(pool);

    const result = await svc.restore(PAT_ID, WS_A, ACTOR_ID);

    const updateCall = (pool.query as jest.Mock).mock.calls[1];
    const [sql, params] = updateCall;
    expect(sql).toMatch(/UPDATE patients SET status = 'active'/);
    expect(sql).toMatch(/archived_at = NULL/);
    expect(sql).toMatch(/WHERE id = \$1 AND workspace_id = \$2/);
    expect(params[0]).toBe(PAT_ID);
    expect(params[1]).toBe(WS_A);
    expect(result.status).toBe('active');
  });

  it('logs an audit event with action patient.restored', async () => {
    const activeRow = makeWsRow(WS_A, { status: 'active', archived_at: null });
    const pool = makePool(
      [[{ id: PAT_ID, organization_id: ORG_A }], [], [activeRow]],
    );
    const audit = makeAudit();
    const svc = makeService(pool, makeCrypto(), audit);

    await svc.restore(PAT_ID, WS_A, ACTOR_ID);

    expect(audit.log).toHaveBeenCalledTimes(1);
    const logged = (audit.log as jest.Mock).mock.calls[0][0];
    expect(logged.action).toBe('patient.restored');
    expect(logged.actorId).toBe(ACTOR_ID);
    expect(logged.resourceType).toBe('patient');
  });

  it('cross-workspace restore attempt does not modify any row', async () => {
    const pool = makePool([[]]); // existence check using WS_B fails
    const svc = makeService(pool);

    await expect(svc.restore(PAT_ID, WS_B, ACTOR_ID)).rejects.toThrow(NotFoundException);
    expect((pool.query as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});

// ─── Scope-based methods — cross-workspace isolation (Phase 5 remediation) ────

describe('PatientsService.findOneByScope', () => {
  it('dispatches to findOneByWorkspace with workspace_id predicate', async () => {
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_A };
    const pool = makePool([[makeWsRow()]]);
    const svc = makeService(pool);

    await svc.findOneByScope(PAT_ID, scope);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE p\.id = \$1 AND p\.workspace_id = \$2/);
    expect(params[1]).toBe(WS_A);
  });

  it('dispatches to findOne with organization_id predicate for org scope', async () => {
    const scope: AccessScope = { kind: 'org', orgId: ORG_A };
    const pool = makePool([[makeRow()]]);
    const svc = makeService(pool);

    await svc.findOneByScope(PAT_ID, scope);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE p\.id = \$1 AND p\.organization_id = \$2/);
    expect(params[1]).toBe(ORG_A);
  });

  it('throws NotFoundException for cross-workspace access (no ID enumeration)', async () => {
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_B };
    const pool = makePool([[]]); // workspace mismatch → no rows
    const svc = makeService(pool);

    await expect(svc.findOneByScope(PAT_ID, scope)).rejects.toThrow(NotFoundException);
  });
});

describe('PatientsService.updateByScope', () => {
  it('UPDATE uses workspace_id predicate for workspace scope', async () => {
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_A };
    const pool = makePool([
      [makeWsRow()],  // findOneByScope → ownership check
      [],              // UPDATE
      [makeWsRow()],  // findOneByScope → return value
    ]);
    const svc = makeService(pool);

    await svc.updateByScope(PAT_ID, scope, ACTOR_ID, { firstName: 'Updated' });

    const updateCall = (pool.query as jest.Mock).mock.calls[1];
    const [sql, params] = updateCall;
    expect(sql).toMatch(/WHERE id = \$\d+ AND workspace_id = \$\d+/);
    expect(params).toContain(WS_A);
    expect(params).toContain(PAT_ID);
  });

  it('UPDATE uses organization_id predicate for org scope', async () => {
    const scope: AccessScope = { kind: 'org', orgId: ORG_A };
    const pool = makePool([
      [makeRow()],
      [],
      [makeRow()],
    ]);
    const svc = makeService(pool);

    await svc.updateByScope(PAT_ID, scope, ACTOR_ID, { firstName: 'Updated' });

    const [sql, params] = (pool.query as jest.Mock).mock.calls[1];
    expect(sql).toMatch(/WHERE id = \$\d+ AND organization_id = \$\d+/);
    expect(params).toContain(ORG_A);
  });

  it('throws NotFoundException for cross-workspace update attempt', async () => {
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_B };
    const pool = makePool([[]]); // findOneByScope returns no rows
    const svc = makeService(pool);

    await expect(svc.updateByScope(PAT_ID, scope, ACTOR_ID, { firstName: 'Hack' }))
      .rejects.toThrow(NotFoundException);
  });
});

describe('PatientsService.getTimelineByScope', () => {
  it('cases query uses c.workspace_id for workspace scope', async () => {
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_A };
    const pool = makePool([
      [makeWsRow()],  // findOneByScope
      [],              // cases query (index 1)
      [],              // scans
      [],              // appointments
      [],              // notes
    ]);
    const svc = makeService(pool);

    await svc.getTimelineByScope(PAT_ID, scope);

    const [casesSql, casesParams] = (pool.query as jest.Mock).mock.calls[1];
    expect(casesSql).toMatch(/c\.workspace_id = \$2/);
    expect(casesParams[1]).toBe(WS_A);
  });

  it('notes query uses organization_id (no workspace_id column in notes table)', async () => {
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_A };
    const pool = makePool([
      [makeWsRow()], [], [], [], [],
    ]);
    const svc = makeService(pool);

    await svc.getTimelineByScope(PAT_ID, scope);

    const [notesSql, notesParams] = (pool.query as jest.Mock).mock.calls[4];
    expect(notesSql).toMatch(/patient_timeline_notes/);
    expect(notesSql).toMatch(/organization_id = \$2/);
    expect(notesParams[1]).toBe(ORG_A);
  });

  it('throws NotFoundException for cross-workspace timeline access', async () => {
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_B };
    const pool = makePool([[]]); // findOneByScope returns no rows
    const svc = makeService(pool);

    await expect(svc.getTimelineByScope(PAT_ID, scope)).rejects.toThrow(NotFoundException);
  });
});

describe('PatientsService.addTimelineNoteByScope', () => {
  const noteRow = {
    id: 'note-001',
    event_type: 'note',
    note: 'Clinical observation',
    case_id: null,
    event_at: new Date().toISOString(),
  };

  it('inserts note after verifying patient is in scope', async () => {
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_A };
    const pool = makePool([
      [makeWsRow()],  // findOneByScope
      [noteRow],       // INSERT
    ]);
    const svc = makeService(pool);

    const result = await svc.addTimelineNoteByScope(PAT_ID, scope, ACTOR_ID, { note: 'Test note' });

    expect(result.type).toBe('note');
    const [insertSql] = (pool.query as jest.Mock).mock.calls[1];
    expect(insertSql).toMatch(/INSERT INTO patient_timeline_notes/);
  });

  it('validates caseId belongs to same patient and workspace', async () => {
    const LINKED_CASE = 'case-linked-001';
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_A };
    const pool = makePool([
      [makeWsRow()],       // findOneByScope
      [{ '?column?': 1 }], // case ownership check → found
      [noteRow],            // INSERT
    ]);
    const svc = makeService(pool);

    await svc.addTimelineNoteByScope(PAT_ID, scope, ACTOR_ID, {
      note: 'Linked note',
      caseId: LINKED_CASE,
    });

    const [caseCheckSql, caseCheckParams] = (pool.query as jest.Mock).mock.calls[1];
    expect(caseCheckSql).toMatch(/FROM cases WHERE id = \$1 AND patient_id = \$2 AND workspace_id = \$3/);
    expect(caseCheckParams[0]).toBe(LINKED_CASE);
    expect(caseCheckParams[1]).toBe(PAT_ID);
    expect(caseCheckParams[2]).toBe(WS_A);
  });

  it('throws NotFoundException when caseId belongs to a different workspace', async () => {
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_A };
    const pool = makePool([
      [makeWsRow()],  // patient found in WS_A
      [],              // case check → 0 rows (case is in WS_B)
    ]);
    const svc = makeService(pool);

    await expect(
      svc.addTimelineNoteByScope(PAT_ID, scope, ACTOR_ID, {
        note: 'Cross-workspace note attempt',
        caseId: 'case-in-ws-b',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException for cross-workspace patient access', async () => {
    const scope: AccessScope = { kind: 'workspace', orgId: ORG_A, workspaceId: WS_B };
    const pool = makePool([[]]); // patient not in WS_B
    const svc = makeService(pool);

    await expect(
      svc.addTimelineNoteByScope(PAT_ID, scope, ACTOR_ID, { note: 'Hack' }),
    ).rejects.toThrow(NotFoundException);
  });
});
