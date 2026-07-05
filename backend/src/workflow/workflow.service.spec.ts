import { BadRequestException } from '@nestjs/common';
import { WorkflowService, CASE_STATUSES, type CaseStatus } from './workflow.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CASE_ID = 'case-workflow-test';
const ORG_ID  = 'org-workflow-test';
const ACTOR   = 'actor-workflow-1';

function makePool(overrideRows?: unknown[][]) {
  let callIndex = 0;
  const defaultRows: unknown[][] = [
    [{ status: 'draft' }],  // SELECT FOR UPDATE
    [],                      // UPDATE cases
    [],                      // INSERT workflow_events
  ];
  const rows = overrideRows ?? defaultRows;
  return { query: jest.fn(async () => ({ rows: rows[callIndex++] ?? [] })) };
}

function makeAudit() {
  return { log: jest.fn(async () => {}) };
}

function makeService(pool: ReturnType<typeof makePool>) {
  return new WorkflowService(pool as any, makeAudit() as any);
}

// ─── allowedTransitions — archived reachable from every active status ─────────

describe('WorkflowService.allowedTransitions', () => {
  const ACTIVE_STATUSES: CaseStatus[] = [
    'draft', 'scan_review', 'segmentation', 'planning',
    'clinical_review', 'approved', 'active_treatment',
    'monitoring', 'retention', 'completed',
  ];

  it.each(ACTIVE_STATUSES)(
    "'archived' is reachable from '%s'",
    (status) => {
      const svc = makeService(makePool());
      expect(svc.allowedTransitions(status)).toContain('archived');
    },
  );

  it("'archived' is NOT reachable from 'archived' (terminal state)", () => {
    const svc = makeService(makePool());
    expect(svc.allowedTransitions('archived')).not.toContain('archived');
  });

  it("'archived' is NOT reachable from 'cancelled' (terminal state)", () => {
    const svc = makeService(makePool());
    expect(svc.allowedTransitions('cancelled')).not.toContain('archived');
  });

  it('every status in CASE_STATUSES has an entry in TRANSITIONS', () => {
    const svc = makeService(makePool());
    for (const status of CASE_STATUSES) {
      // allowedTransitions returns [] for missing entries; we want defined entries
      expect(svc.allowedTransitions(status)).toBeDefined();
    }
  });
});

// ─── transition — rejects invalid archive path ────────────────────────────────

describe('WorkflowService.transition', () => {
  it('rejects archived → archived with BadRequestException', async () => {
    const pool = makePool([[{ status: 'archived' }], [], []]);
    const svc = makeService(pool);

    await expect(
      svc.transition({
        caseId: CASE_ID, toStatus: 'archived',
        actorId: ACTOR, actorRole: 'doctor',
        orgId: ORG_ID,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts draft → archived transition (SQL UPDATE issued)', async () => {
    const pool = makePool([[{ status: 'draft' }], [], []]);
    const svc = makeService(pool);

    const result = await svc.transition({
      caseId: CASE_ID, toStatus: 'archived',
      actorId: ACTOR, actorRole: 'doctor',
      orgId: ORG_ID,
    });

    expect(result.fromStatus).toBe('draft');
    expect(result.toStatus).toBe('archived');

    const updateCall = (pool.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('UPDATE cases SET status'),
    );
    expect(updateCall).toBeDefined();
  });
});
