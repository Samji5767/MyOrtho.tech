import { AuditService } from './audit.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-aaaaaaaa';
const ACTOR_ID = 'actor-1';
const RES_ID = 'res-11111111-1111-1111-1111-111111111111';

function makePool(rows: unknown[][] = []) {
  let callIndex = 0;
  return {
    query: jest.fn(async () => ({ rows: rows[callIndex++] ?? [], rowCount: 1 })),
  };
}

function makeService(pool: ReturnType<typeof makePool>) {
  return new AuditService(pool as any);
}

// ─── log ─────────────────────────────────────────────────────────────────────

describe('AuditService.log', () => {
  it('issues INSERT into audit_events with correct column order', async () => {
    const pool = makePool();
    const svc = makeService(pool);

    await svc.log({
      organizationId: ORG_ID,
      actorId: ACTOR_ID,
      actorEmail: 'doc@org.com',
      resourceType: 'patient',
      resourceId: RES_ID,
      action: 'patient.created',
      details: { patientId: RES_ID },
      ipAddress: '127.0.0.1',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/INSERT INTO audit_events/);
    expect(params[0]).toBe(ORG_ID);
    expect(params[1]).toBe(ACTOR_ID);
    expect(params[2]).toBe('doc@org.com');
    expect(params[3]).toBe('patient');
    expect(params[4]).toBe(RES_ID);
    expect(params[5]).toBe('patient.created');
  });

  it('serializes details to a JSON string', async () => {
    const pool = makePool();
    const svc = makeService(pool);

    await svc.log({
      resourceType: 'case',
      action: 'case.updated',
      details: { fields: ['status'], previousStatus: 'new' },
    });

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    const detailsParam = params[6];
    expect(typeof detailsParam).toBe('string');
    const parsed = JSON.parse(detailsParam);
    expect(parsed.fields).toEqual(['status']);
    expect(parsed.previousStatus).toBe('new');
  });

  it('coerces optional fields to null when omitted', async () => {
    const pool = makePool();
    const svc = makeService(pool);

    await svc.log({ resourceType: 'case', action: 'case.viewed' });

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(params[0]).toBeNull(); // organizationId
    expect(params[1]).toBeNull(); // actorId
    expect(params[2]).toBeNull(); // actorEmail
    expect(params[4]).toBeNull(); // resourceId
    expect(params[7]).toBeNull(); // ipAddress
  });

  it('defaults details to {} when not provided', async () => {
    const pool = makePool();
    const svc = makeService(pool);

    await svc.log({ resourceType: 'patient', action: 'patient.viewed' });

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(JSON.parse(params[6])).toEqual({});
  });

  it('does NOT rethrow when the DB query fails (non-fatal)', async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error('DB down')),
    };
    const svc = makeService(pool as any);

    // Must NOT throw — audit failures are swallowed
    await expect(
      svc.log({ resourceType: 'patient', action: 'patient.created' }),
    ).resolves.toBeUndefined();
  });

  it('returns undefined on success (void method)', async () => {
    const pool = makePool();
    const svc = makeService(pool);
    const result = await svc.log({ resourceType: 'patient', action: 'patient.created' });
    expect(result).toBeUndefined();
  });

  it('action string is bound verbatim (not JSON-encoded)', async () => {
    const pool = makePool();
    const svc = makeService(pool);

    await svc.log({ resourceType: 'patient', action: 'patient.deleted' });

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(params[5]).toBe('patient.deleted');
  });
});

// ─── findByOrg ────────────────────────────────────────────────────────────────

describe('AuditService.findByOrg', () => {
  it('queries audit_events filtered by organization_id', async () => {
    const pool = makePool([[{ id: 'ev-1', action: 'patient.created' }]]);
    const svc = makeService(pool);

    const rows = await svc.findByOrg(ORG_ID);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE organization_id = \$1/);
    expect(params[0]).toBe(ORG_ID);
    expect(rows).toHaveLength(1);
  });

  it('uses default limit 50 and offset 0', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);

    await svc.findByOrg(ORG_ID);

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(params[1]).toBe(50);
    expect(params[2]).toBe(0);
  });

  it('accepts custom limit and offset', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);

    await svc.findByOrg(ORG_ID, { limit: 10, offset: 20 });

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(params[1]).toBe(10);
    expect(params[2]).toBe(20);
  });

  it('orders results by created_at DESC', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);
    await svc.findByOrg(ORG_ID);
    const [sql] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/ORDER BY created_at DESC/);
  });
});

// ─── findByResource ───────────────────────────────────────────────────────────

describe('AuditService.findByResource', () => {
  it('queries by organization_id, resource_type, and resource_id', async () => {
    const pool = makePool([[{ id: 'ev-2', action: 'patient.updated' }]]);
    const svc = makeService(pool);

    const rows = await svc.findByResource('patient', RES_ID, ORG_ID);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE organization_id=\$1 AND resource_type=\$2 AND resource_id=\$3/);
    expect(params[0]).toBe(ORG_ID);
    expect(params[1]).toBe('patient');
    expect(params[2]).toBe(RES_ID);
    expect(rows).toHaveLength(1);
  });

  it('returns empty array when no events match', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);
    const rows = await svc.findByResource('patient', RES_ID, ORG_ID);
    expect(rows).toEqual([]);
  });
});

// ─── findByActor ─────────────────────────────────────────────────────────────

describe('AuditService.findByActor', () => {
  it('queries by organization_id and actor_id with a limit', async () => {
    const pool = makePool([[{ id: 'ev-3' }, { id: 'ev-4' }]]);
    const svc = makeService(pool);

    const rows = await svc.findByActor(ACTOR_ID, ORG_ID, 25);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE organization_id=\$1 AND actor_id=\$2/);
    expect(params[0]).toBe(ORG_ID);
    expect(params[1]).toBe(ACTOR_ID);
    expect(params[2]).toBe(25);
    expect(rows).toHaveLength(2);
  });
});

// ─── getRecentCount ───────────────────────────────────────────────────────────

describe('AuditService.getRecentCount', () => {
  it('returns parsed integer count from DB', async () => {
    const pool = makePool([[{ cnt: '42' }]]);
    const svc = makeService(pool);

    const count = await svc.getRecentCount(ORG_ID, 24);

    expect(count).toBe(42);
  });

  it('queries with organization_id and hours as bound parameters', async () => {
    const pool = makePool([[{ cnt: '0' }]]);
    const svc = makeService(pool);

    await svc.getRecentCount(ORG_ID, 12);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE organization_id=\$1/);
    expect(params[0]).toBe(ORG_ID);
    expect(params[1]).toBe(12);
  });

  it('returns 0 when count is "0"', async () => {
    const pool = makePool([[{ cnt: '0' }]]);
    const svc = makeService(pool);
    expect(await svc.getRecentCount(ORG_ID, 1)).toBe(0);
  });
});
