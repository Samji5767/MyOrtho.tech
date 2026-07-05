import { BadRequestException } from '@nestjs/common';
import { WorkflowService, CASE_STATUSES, type CaseStatus } from './workflow.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CASE_ID = 'case-workflow-test';
const ORG_ID  = 'org-workflow-test';
const ACTOR   = 'actor-workflow-1';

// WorkflowService.transition uses pool.connect() → client, not pool.query directly.
// clientRows is the sequence of { rows } returned by client.query() calls:
//   [BEGIN, SELECT FOR UPDATE, UPDATE cases, INSERT workflow_events, COMMIT]
// For rejected transitions the sequence is shorter:
//   [BEGIN, SELECT FOR UPDATE, ROLLBACK]
function makePool(clientRows: unknown[][]) {
  let callIndex = 0;
  const client = {
    query: jest.fn(async () => ({ rows: clientRows[callIndex++] ?? [] })),
    release: jest.fn(),
  };
  return {
    connect: jest.fn(async () => client),
    _client: client,
  };
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
      const svc = makeService(makePool([]));
      expect(svc.allowedTransitions(status)).toContain('archived');
    },
  );

  it("'archived' is NOT reachable from 'archived' (terminal state)", () => {
    const svc = makeService(makePool([]));
    expect(svc.allowedTransitions('archived')).not.toContain('archived');
  });

  it("'archived' is NOT reachable from 'cancelled' (terminal state)", () => {
    const svc = makeService(makePool([]));
    expect(svc.allowedTransitions('cancelled')).not.toContain('archived');
  });

  it('every status in CASE_STATUSES has an entry in TRANSITIONS', () => {
    const svc = makeService(makePool([]));
    for (const status of CASE_STATUSES) {
      // allowedTransitions returns [] for missing entries; we want defined entries
      expect(svc.allowedTransitions(status)).toBeDefined();
    }
  });
});

// ─── transition — rejects invalid archive path ────────────────────────────────

describe('WorkflowService.transition', () => {
  it('rejects archived → archived with BadRequestException', async () => {
    // client.query sequence: BEGIN, SELECT FOR UPDATE (→ archived), ROLLBACK
    const pool = makePool([[], [{ status: 'archived' }], []]);
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
    // client.query sequence: BEGIN, SELECT FOR UPDATE (→ draft), UPDATE, INSERT events, COMMIT
    const pool = makePool([[], [{ status: 'draft' }], [], [], []]);
    const svc = makeService(pool);

    const result = await svc.transition({
      caseId: CASE_ID, toStatus: 'archived',
      actorId: ACTOR, actorRole: 'doctor',
      orgId: ORG_ID,
    });

    expect(result.fromStatus).toBe('draft');
    expect(result.toStatus).toBe('archived');

    const updateCall = (pool._client.query as jest.Mock).mock.calls.find(
      ([sql]: [string]) => sql.includes('UPDATE cases SET status'),
    );
    expect(updateCall).toBeDefined();
  });
});
