import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TreatmentPlansService } from './treatment-plans.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID  = 'org-aaaaaaaa';
const CASE_ID = 'case-11111111';
const PLAN_ID = 'plan-22222222';
const STAGE_ID = 'stage-33333333';
const DOCTOR_ID = 'doc-1';

function makePlanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    case_id: CASE_ID,
    doctor_approval: false,
    doctor_signature: null,
    approved_at: null,
    estimated_stages: 12,
    ai_recommendation_notes: null,
    ipr_details: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeStageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STAGE_ID,
    treatment_plan_id: PLAN_ID,
    stage_number: 1,
    movement_data: {},
    created_at: new Date(),
    ...overrides,
  };
}

/** Simple sequential pool mock — each call returns the next row-set. */
function makePool(rows: unknown[][]) {
  let i = 0;
  return {
    query: jest.fn(async () => ({ rows: rows[i++] ?? [], rowCount: (rows[i - 1] ?? []).length })),
    connect: jest.fn(),
  };
}

/** Pool that also exposes a transactional client. */
function makeTransactionPool(poolRows: unknown[][], clientRows: unknown[][]) {
  let poolIdx = 0;
  let clientIdx = 0;
  const client = {
    query: jest.fn(async () => ({
      rows: clientRows[clientIdx] ?? [],
      rowCount: (clientRows[clientIdx++] ?? []).length,
    })),
    release: jest.fn(),
  };
  return {
    query: jest.fn(async () => ({ rows: poolRows[poolIdx++] ?? [], rowCount: 0 })),
    connect: jest.fn(async () => client),
    _client: client,
  };
}

const mockWorkflowService = { transition: jest.fn(async () => ({})) } as any;

function makeService(pool: ReturnType<typeof makePool> | ReturnType<typeof makeTransactionPool>) {
  return new TreatmentPlansService(pool as any, mockWorkflowService);
}

// ─── verifyCaseOwnership (tested implicitly through every public method) ───────

describe('TreatmentPlansService (case ownership guard)', () => {
  it('throws NotFoundException when case does not belong to the org', async () => {
    const pool = makePool([[]]); // empty → not found
    const svc = makeService(pool);
    await expect(svc.listPlans(CASE_ID, ORG_ID)).rejects.toThrow(NotFoundException);
  });

  it('ownership query binds caseId=$1 and orgId=$2', async () => {
    const pool = makePool([[]]); // empty on purpose
    const svc = makeService(pool);
    try { await svc.listPlans(CASE_ID, ORG_ID); } catch { /* expected */ }
    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE c\.id = \$1 AND p\.organization_id = \$2/);
    expect(params).toEqual([CASE_ID, ORG_ID]);
  });
});

// ─── createPlan ────────────────────────────────────────────────────────────────

describe('TreatmentPlansService.createPlan', () => {
  it('inserts a treatment plan and returns id + disclaimer', async () => {
    // pool calls: [verify ownership, INSERT plan]
    const pool = makePool([
      [{ id: CASE_ID }],         // ownership check
      [{ id: PLAN_ID, created_at: new Date() }], // INSERT result
    ]);
    const svc = makeService(pool);

    const result = await svc.createPlan(CASE_ID, ORG_ID, DOCTOR_ID, { estimatedStages: 10 });

    expect(result.id).toBe(PLAN_ID);
    expect(result.caseId).toBe(CASE_ID);
    expect(result.disclaimer).toMatch(/AI treatment planning recommendations/);
  });

  it('defaults estimatedStages to 0 when not provided', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],
      [{ id: PLAN_ID, created_at: new Date() }],
    ]);
    const svc = makeService(pool);

    await svc.createPlan(CASE_ID, ORG_ID, DOCTOR_ID, {});

    const [, params] = (pool.query as jest.Mock).mock.calls[1];
    expect(params[2]).toBe(0); // estimatedStages default
  });

  it('serializes iprDetails to JSON string', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],
      [{ id: PLAN_ID, created_at: new Date() }],
    ]);
    const svc = makeService(pool);

    await svc.createPlan(CASE_ID, ORG_ID, DOCTOR_ID, { iprDetails: { tooth: 11, amount: 0.3 } });

    const [, params] = (pool.query as jest.Mock).mock.calls[1];
    const parsed = JSON.parse(params[4] as string);
    expect(parsed.tooth).toBe(11);
  });

  it('throws NotFoundException when case is not in the org', async () => {
    const pool = makePool([[]]); // ownership fails
    const svc = makeService(pool);
    await expect(svc.createPlan(CASE_ID, ORG_ID, DOCTOR_ID, {})).rejects.toThrow(NotFoundException);
  });
});

// ─── getPlan ──────────────────────────────────────────────────────────────────

describe('TreatmentPlansService.getPlan', () => {
  it('returns a formatted plan with disclaimer', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],
      [makePlanRow()],
    ]);
    const svc = makeService(pool);

    const result = await svc.getPlan(PLAN_ID, CASE_ID, ORG_ID);

    expect(result.id).toBe(PLAN_ID);
    expect(result.doctorApproval).toBe(false);
    expect(result.disclaimer).toMatch(/AI treatment planning/);
  });

  it('throws NotFoundException when plan does not exist', async () => {
    const pool = makePool([
      [{ id: CASE_ID }], // ownership ok
      [],                  // plan not found
    ]);
    const svc = makeService(pool);
    await expect(svc.getPlan(PLAN_ID, CASE_ID, ORG_ID)).rejects.toThrow(NotFoundException);
  });

  it('queries plan with both planId=$1 and caseId=$2', async () => {
    const pool = makePool([[{ id: CASE_ID }], []]);
    const svc = makeService(pool);
    try { await svc.getPlan(PLAN_ID, CASE_ID, ORG_ID); } catch { /* expected */ }
    const [sql, params] = (pool.query as jest.Mock).mock.calls[1];
    expect(sql).toMatch(/WHERE id = \$1 AND case_id = \$2/);
    expect(params[0]).toBe(PLAN_ID);
    expect(params[1]).toBe(CASE_ID);
  });
});

// ─── listPlans ────────────────────────────────────────────────────────────────

describe('TreatmentPlansService.listPlans', () => {
  it('returns all plans for a case with disclaimer on each', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],
      [makePlanRow(), makePlanRow({ id: 'plan-other' })],
    ]);
    const svc = makeService(pool);

    const plans = await svc.listPlans(CASE_ID, ORG_ID);

    expect(plans).toHaveLength(2);
    plans.forEach((p) => expect(p.disclaimer).toBeDefined());
  });

  it('returns empty array when no plans exist', async () => {
    const pool = makePool([[{ id: CASE_ID }], []]);
    const svc = makeService(pool);
    const plans = await svc.listPlans(CASE_ID, ORG_ID);
    expect(plans).toEqual([]);
  });
});

// ─── updatePlan ───────────────────────────────────────────────────────────────

describe('TreatmentPlansService.updatePlan', () => {
  it('updates estimatedStages and returns {id, updated: true}', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],          // ownership
      [{ id: PLAN_ID }],          // UPDATE result
    ]);
    const svc = makeService(pool);

    const result = await svc.updatePlan(PLAN_ID, CASE_ID, ORG_ID, { estimatedStages: 20 });

    expect(result.id).toBe(PLAN_ID);
    expect(result.updated).toBe(true);
  });

  it('throws Error when dto has no fields', async () => {
    const pool = makePool([[{ id: CASE_ID }]]);
    const svc = makeService(pool);
    await expect(svc.updatePlan(PLAN_ID, CASE_ID, ORG_ID, {})).rejects.toThrow('Nothing to update');
  });

  it('throws NotFoundException when plan is not found or already approved', async () => {
    const pool = makePool([
      [{ id: CASE_ID }], // ownership ok
      [],                  // UPDATE returns no rows (plan already approved or not found)
    ]);
    const svc = makeService(pool);
    await expect(
      svc.updatePlan(PLAN_ID, CASE_ID, ORG_ID, { estimatedStages: 5 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('UPDATE SQL includes WHERE doctor_approval = false', async () => {
    const pool = makePool([[{ id: CASE_ID }], []]);
    const svc = makeService(pool);
    try { await svc.updatePlan(PLAN_ID, CASE_ID, ORG_ID, { estimatedStages: 5 }); } catch { /* expected */ }
    const [sql] = (pool.query as jest.Mock).mock.calls[1];
    expect(sql).toMatch(/doctor_approval = false/);
  });
});

// ─── approvePlan ──────────────────────────────────────────────────────────────

describe('TreatmentPlansService.approvePlan', () => {
  it('throws BadRequestException when simulated stages are present', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],    // ownership
      [{ id: STAGE_ID }],   // simulated stage found
    ]);
    const svc = makeService(pool);
    await expect(
      svc.approvePlan(PLAN_ID, CASE_ID, ORG_ID, DOCTOR_ID, 'orthodontist', 'doctor@test.example', 'sig-abc'),
    ).rejects.toThrow(BadRequestException);
  });

  it('BadRequestException message mentions simulated scaffold stages', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],
      [{ id: STAGE_ID }],
    ]);
    const svc = makeService(pool);
    await expect(
      svc.approvePlan(PLAN_ID, CASE_ID, ORG_ID, DOCTOR_ID, 'orthodontist', 'doctor@test.example', 'sig-abc'),
    ).rejects.toThrow(/simulated scaffold stages/);
  });

  it('approves a plan transactionally and returns id + doctorApproval + approvedAt', async () => {
    const approvedAt = new Date();
    const txPool = makeTransactionPool(
      [[{ id: CASE_ID }], []], // pool: ownership check, simulated-stages check (empty)
      [                        // client: BEGIN, UPDATE plan, UPDATE cases, COMMIT
        [],                    // BEGIN
        [{ id: PLAN_ID, doctor_approval: true, approved_at: approvedAt }], // UPDATE plans
        [],                    // UPDATE cases
        [],                    // COMMIT
      ],
    );
    const svc = makeService(txPool);

    const result = await svc.approvePlan(PLAN_ID, CASE_ID, ORG_ID, DOCTOR_ID, 'orthodontist', 'doctor@test.example', 'Dr. Signature');

    expect(result.id).toBe(PLAN_ID);
    expect(result.doctorApproval).toBe(true);
    expect(result.approvedAt).toBe(approvedAt);
  });

  it('client.BEGIN is called before the UPDATE', async () => {
    const approvedAt = new Date();
    const txPool = makeTransactionPool(
      [[{ id: CASE_ID }], []],
      [[], [{ id: PLAN_ID, doctor_approval: true, approved_at: approvedAt }], [], []],
    );
    const svc = makeService(txPool);

    await svc.approvePlan(PLAN_ID, CASE_ID, ORG_ID, DOCTOR_ID, 'orthodontist', 'doctor@test.example', 'sig');

    const calls = txPool._client.query.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls[0]).toBe('BEGIN');
  });

  it('client.COMMIT is called on success', async () => {
    const approvedAt = new Date();
    const txPool = makeTransactionPool(
      [[{ id: CASE_ID }], []],
      [[], [{ id: PLAN_ID, doctor_approval: true, approved_at: approvedAt }], [], []],
    );
    const svc = makeService(txPool);

    await svc.approvePlan(PLAN_ID, CASE_ID, ORG_ID, DOCTOR_ID, 'orthodontist', 'doctor@test.example', 'sig');

    const calls = txPool._client.query.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls[calls.length - 1]).toBe('COMMIT');
  });

  it('client.release() is called after successful approval', async () => {
    const approvedAt = new Date();
    const txPool = makeTransactionPool(
      [[{ id: CASE_ID }], []],
      [[], [{ id: PLAN_ID, doctor_approval: true, approved_at: approvedAt }], [], []],
    );
    const svc = makeService(txPool);
    await svc.approvePlan(PLAN_ID, CASE_ID, ORG_ID, DOCTOR_ID, 'orthodontist', 'doctor@test.example', 'sig');
    expect(txPool._client.release).toHaveBeenCalled();
  });

  it('throws NotFoundException when plan is already approved (UPDATE returns empty)', async () => {
    const txPool = makeTransactionPool(
      [[{ id: CASE_ID }], []],
      [[], [], [], []], // BEGIN, UPDATE plan → empty (already approved), ROLLBACK, (release)
    );
    const svc = makeService(txPool);
    await expect(
      svc.approvePlan(PLAN_ID, CASE_ID, ORG_ID, DOCTOR_ID, 'orthodontist', 'doctor@test.example', 'sig'),
    ).rejects.toThrow(NotFoundException);
  });

  it('client.release() is called even when approval fails', async () => {
    const txPool = makeTransactionPool(
      [[{ id: CASE_ID }], []],
      [[], [], [], []],
    );
    const svc = makeService(txPool);
    try { await svc.approvePlan(PLAN_ID, CASE_ID, ORG_ID, DOCTOR_ID, 'orthodontist', 'doctor@test.example', 'sig'); } catch { /* expected */ }
    expect(txPool._client.release).toHaveBeenCalled();
  });
});

// ─── listStages ───────────────────────────────────────────────────────────────

describe('TreatmentPlansService.listStages', () => {
  it('returns formatted stage list', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],
      [makeStageRow(), makeStageRow({ id: 'stage-2', stage_number: 2 })],
    ]);
    const svc = makeService(pool);

    const stages = await svc.listStages(PLAN_ID, CASE_ID, ORG_ID);

    expect(stages).toHaveLength(2);
    expect(stages[0].planId).toBe(PLAN_ID);
    expect(stages[1].stageNumber).toBe(2);
  });
});

// ─── createStage ──────────────────────────────────────────────────────────────

describe('TreatmentPlansService.createStage', () => {
  it('inserts a stage and returns id, planId, stageNumber', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],   // ownership
      [{ id: PLAN_ID }],   // plan exists check
      [{ id: STAGE_ID, stage_number: 1, created_at: new Date() }], // INSERT
    ]);
    const svc = makeService(pool);

    const result = await svc.createStage(PLAN_ID, CASE_ID, ORG_ID, { stageNumber: 1 });

    expect(result.id).toBe(STAGE_ID);
    expect(result.planId).toBe(PLAN_ID);
    expect(result.stageNumber).toBe(1);
  });

  it('throws ForbiddenException when plan does not belong to case', async () => {
    const pool = makePool([
      [{ id: CASE_ID }], // ownership ok
      [],                  // plan check fails
    ]);
    const svc = makeService(pool);
    await expect(
      svc.createStage(PLAN_ID, CASE_ID, ORG_ID, { stageNumber: 1 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('SQL uses ON CONFLICT to upsert existing stage number', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],
      [{ id: PLAN_ID }],
      [{ id: STAGE_ID, stage_number: 1, created_at: new Date() }],
    ]);
    const svc = makeService(pool);

    await svc.createStage(PLAN_ID, CASE_ID, ORG_ID, { stageNumber: 1 });

    const [sql] = (pool.query as jest.Mock).mock.calls[2];
    expect(sql).toMatch(/ON CONFLICT/);
    expect(sql).toMatch(/DO UPDATE/);
  });

  it('serializes movements to JSON string', async () => {
    const movements = { 11: { mesialMm: 0.1 } };
    const pool = makePool([
      [{ id: CASE_ID }],
      [{ id: PLAN_ID }],
      [{ id: STAGE_ID, stage_number: 1, created_at: new Date() }],
    ]);
    const svc = makeService(pool);

    await svc.createStage(PLAN_ID, CASE_ID, ORG_ID, { stageNumber: 1, movements });

    const [, params] = (pool.query as jest.Mock).mock.calls[2];
    const parsed = JSON.parse(params[3] as string);
    expect(parsed['11'].mesialMm).toBe(0.1);
  });
});

// ─── generateStages ───────────────────────────────────────────────────────────

describe('TreatmentPlansService.generateStages', () => {
  const savedAiUrl = process.env['TREATMENT_PLAN_AI_URL'];
  const savedFallback = process.env['TREATMENT_PLAN_STAGE_FALLBACK_ENABLED'];

  beforeEach(() => {
    delete process.env['TREATMENT_PLAN_AI_URL'];
    delete process.env['TREATMENT_PLAN_STAGE_FALLBACK_ENABLED'];
  });

  afterEach(() => {
    if (savedAiUrl !== undefined) process.env['TREATMENT_PLAN_AI_URL'] = savedAiUrl;
    else delete process.env['TREATMENT_PLAN_AI_URL'];
    if (savedFallback !== undefined) process.env['TREATMENT_PLAN_STAGE_FALLBACK_ENABLED'] = savedFallback;
    else delete process.env['TREATMENT_PLAN_STAGE_FALLBACK_ENABLED'];
  });

  it('throws ServiceUnavailableException when neither AI URL nor fallback is configured', async () => {
    const pool = makePool([[{ id: CASE_ID }]]);
    const svc = makeService(pool);
    await expect(svc.generateStages(PLAN_ID, CASE_ID, ORG_ID)).rejects.toThrow(ServiceUnavailableException);
  });

  it('generates stages via fallback and returns is_simulated=true', async () => {
    process.env['TREATMENT_PLAN_STAGE_FALLBACK_ENABLED'] = 'true';
    const pool = makePool([
      [{ id: CASE_ID }],                              // ownership
      [{ id: PLAN_ID, estimated_stages: 5 }],         // plan
      [{ upper_crowding_mm: 3, lower_crowding_mm: 2 }], // case analysis
      [],                                              // batch INSERT
    ]);
    const svc = makeService(pool);

    const result = await svc.generateStages(PLAN_ID, CASE_ID, ORG_ID, 5);

    expect(result.is_simulated).toBe(true);
    expect(result.generated).toBe(5);
    expect(result.planId).toBe(PLAN_ID);
  });

  it('batch INSERT embeds _is_simulated=true in each stage movement_data param', async () => {
    process.env['TREATMENT_PLAN_STAGE_FALLBACK_ENABLED'] = 'true';
    const pool = makePool([
      [{ id: CASE_ID }],
      [{ id: PLAN_ID, estimated_stages: 3 }],
      [],  // no case analysis
      [],  // batch INSERT
    ]);
    const svc = makeService(pool);

    await svc.generateStages(PLAN_ID, CASE_ID, ORG_ID, 3);

    const insertCall = (pool.query as jest.Mock).mock.calls.find(
      (c: unknown[]) => (c[0] as string).includes('INSERT INTO aligner_stages'),
    );
    expect(insertCall).toBeDefined();
    const [, params] = insertCall!;
    // params[2] = stage_number for stage 1, params[3] = movement_data JSON for stage 1
    const firstMovementData = JSON.parse(params[3] as string);
    expect(firstMovementData._is_simulated).toBe(true);
  });

  it('clamps generated stage count to max 60', async () => {
    process.env['TREATMENT_PLAN_STAGE_FALLBACK_ENABLED'] = 'true';
    const pool = makePool([
      [{ id: CASE_ID }],
      [{ id: PLAN_ID, estimated_stages: 100 }], // asks for 100
      [],
      [],
    ]);
    const svc = makeService(pool);
    const result = await svc.generateStages(PLAN_ID, CASE_ID, ORG_ID, 100);
    expect(result.generated).toBe(60);
  });

  it('throws NotFoundException when plan is not found', async () => {
    process.env['TREATMENT_PLAN_STAGE_FALLBACK_ENABLED'] = 'true';
    const pool = makePool([
      [{ id: CASE_ID }],
      [], // plan not found
    ]);
    const svc = makeService(pool);
    await expect(svc.generateStages(PLAN_ID, CASE_ID, ORG_ID)).rejects.toThrow(NotFoundException);
  });
});
