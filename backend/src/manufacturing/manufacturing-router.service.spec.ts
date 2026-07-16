import { ManufacturingRouterService } from './manufacturing-router.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID     = 'org-aaaaaaaa';
const JOB_ID     = 'job-11111111';
const PRINTER_ID = 'printer-22222222';

function makePool(responses: Array<unknown[]>) {
  let i = 0;
  return {
    // Supports both sequential individual calls and Promise.all parallel calls
    query: jest.fn(async () => ({ rows: responses[i++] ?? [], rowCount: 1 })),
  };
}

function makeService(pool: ReturnType<typeof makePool>) {
  return new ManufacturingRouterService(pool as any);
}

// ─── routePrintJob ────────────────────────────────────────────────────────────

describe('ManufacturingRouterService.routePrintJob', () => {
  it('issues UPDATE with printer_id and status=queued', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);

    await svc.routePrintJob(JOB_ID, PRINTER_ID);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/UPDATE print_jobs/);
    expect(sql).toMatch(/status = 'queued'/);
    expect(params[0]).toBe(JOB_ID);
    expect(params[1]).toBe(PRINTER_ID);
  });

  it('binds jobId as $1 and printerId as $2', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);

    await svc.routePrintJob(JOB_ID, PRINTER_ID);

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(params[0]).toBe(JOB_ID);
    expect(params[1]).toBe(PRINTER_ID);
  });

  it('returns {routed: true, printerId}', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);

    const result = await svc.routePrintJob(JOB_ID, PRINTER_ID);

    expect(result.routed).toBe(true);
    expect(result.printerId).toBe(PRINTER_ID);
  });

  it('returns the printerId from the argument, not from DB', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);
    const result = await svc.routePrintJob(JOB_ID, 'printer-special');
    expect(result.printerId).toBe('printer-special');
  });

  it('SQL includes updated_at = now()', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);
    await svc.routePrintJob(JOB_ID, PRINTER_ID);
    const [sql] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/updated_at = now\(\)/);
  });
});

// ─── getProductionTelemetry ───────────────────────────────────────────────────

describe('ManufacturingRouterService.getProductionTelemetry', () => {
  it('returns parsed numeric telemetry from two parallel queries', async () => {
    // pool.query is called twice in parallel via Promise.all; the mock returns in sequence
    const pool = makePool([
      [{ total: '3', online: '2' }],              // printers query
      [{ queued: '5', processing: '1', completed_today: '12', failed_today: '0' }], // jobs query
    ]);
    const svc = makeService(pool);

    const result = await svc.getProductionTelemetry(ORG_ID);

    expect(result.totalPrinters).toBe(3);
    expect(result.onlinePrinters).toBe(2);
    expect(result.queuedJobs).toBe(5);
    expect(result.processingJobs).toBe(1);
    expect(result.completedToday).toBe(12);
    expect(result.failedToday).toBe(0);
  });

  it('defaults all counts to 0 when DB returns empty rows', async () => {
    const pool = makePool([[], []]);
    const svc = makeService(pool);

    const result = await svc.getProductionTelemetry(ORG_ID);

    expect(result.totalPrinters).toBe(0);
    expect(result.onlinePrinters).toBe(0);
    expect(result.queuedJobs).toBe(0);
    expect(result.processingJobs).toBe(0);
    expect(result.completedToday).toBe(0);
    expect(result.failedToday).toBe(0);
  });

  it('issues exactly two queries (printer + jobs)', async () => {
    const pool = makePool([
      [{ total: '1', online: '1' }],
      [{ queued: '0', processing: '0', completed_today: '0', failed_today: '0' }],
    ]);
    const svc = makeService(pool);

    await svc.getProductionTelemetry(ORG_ID);

    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('both queries include organization_id as the first bound parameter', async () => {
    const pool = makePool([
      [{ total: '1', online: '1' }],
      [{ queued: '0', processing: '0', completed_today: '0', failed_today: '0' }],
    ]);
    const svc = makeService(pool);

    await svc.getProductionTelemetry(ORG_ID);

    const calls = (pool.query as jest.Mock).mock.calls;
    expect(calls[0][1][0]).toBe(ORG_ID);
    expect(calls[1][1][0]).toBe(ORG_ID);
  });

  it('coerces string counts to numbers (pg returns COUNT as strings)', async () => {
    const pool = makePool([
      [{ total: '10', online: '8' }],
      [{ queued: '3', processing: '2', completed_today: '50', failed_today: '1' }],
    ]);
    const svc = makeService(pool);
    const result = await svc.getProductionTelemetry(ORG_ID);

    // All returned values are JS numbers, not strings
    expect(typeof result.totalPrinters).toBe('number');
    expect(typeof result.queuedJobs).toBe('number');
    expect(typeof result.completedToday).toBe('number');
  });

  it('printer query filters offline printers from online count', async () => {
    const pool = makePool([
      [{ total: '5', online: '3' }],
      [{ queued: '0', processing: '0', completed_today: '0', failed_today: '0' }],
    ]);
    const svc = makeService(pool);
    const result = await svc.getProductionTelemetry(ORG_ID);

    // total=5, online=3 implies 2 offline — the query uses FILTER (WHERE status != 'offline')
    expect(result.totalPrinters).toBe(5);
    expect(result.onlinePrinters).toBe(3);
  });
});
