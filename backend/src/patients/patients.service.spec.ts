import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';

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
