import { withTenantContext } from './tenant.util';

const ORG_ID = 'org-abc-123';

function makeClient(queryResult = { rows: [{ id: 'r1' }], rowCount: 1 }) {
  return {
    query: jest.fn().mockResolvedValue(queryResult),
    release: jest.fn(),
  };
}

function makePool(client = makeClient()) {
  return { connect: jest.fn().mockResolvedValue(client) };
}

describe('withTenantContext', () => {
  it('wraps the callback in BEGIN / set_config / COMMIT', async () => {
    const client = makeClient();
    const pool   = makePool(client);

    await withTenantContext(pool as any, ORG_ID, async (c) => {
      await c.query('SELECT 1');
    });

    const calls: string[] = client.query.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls[0]).toBe('BEGIN');
    expect(calls[1]).toBe('SELECT set_config($1, $2, true)');
    expect(calls[calls.length - 1]).toBe('COMMIT');
  });

  it('passes orgId as the value argument to set_config', async () => {
    const client = makeClient();
    const pool   = makePool(client);

    await withTenantContext(pool as any, ORG_ID, async () => undefined);

    const setConfigCall = client.query.mock.calls.find(
      (c: unknown[]) => c[0] === 'SELECT set_config($1, $2, true)',
    ) as [string, string[]];
    expect(setConfigCall).toBeDefined();
    const [, params] = setConfigCall;
    expect(params[0]).toBe('app.current_org_id');
    expect(params[1]).toBe(ORG_ID);
  });

  it('releases the client on success', async () => {
    const client = makeClient();
    const pool   = makePool(client);
    await withTenantContext(pool as any, ORG_ID, async () => 42);
    expect(client.release).toHaveBeenCalled();
  });

  it('ROLLBACKs and releases on error', async () => {
    const client = makeClient();
    const pool   = makePool(client);

    await expect(
      withTenantContext(pool as any, ORG_ID, async () => {
        throw new Error('query failed');
      }),
    ).rejects.toThrow('query failed');

    const calls: string[] = client.query.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('returns the callback result', async () => {
    const client = makeClient();
    const pool   = makePool(client);
    const result = await withTenantContext(pool as any, ORG_ID, async () => 'hello');
    expect(result).toBe('hello');
  });

  it('passes the PoolClient to the callback', async () => {
    const client = makeClient();
    const pool   = makePool(client);
    const received: unknown[] = [];
    await withTenantContext(pool as any, ORG_ID, async (c) => { received.push(c); });
    expect(received[0]).toBe(client);
  });
});
