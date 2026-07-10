import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ToothMovementsService } from './tooth-movements.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID   = 'org-aaaaaaaa';
const CASE_ID  = 'case-11111111';
const PLAN_ID  = 'plan-22222222';
const STAGE_ID = 'stage-33333333';
const FDI_11   = 11;
const FDI_48   = 48;
const ACTOR_EMAIL = 'tech@org.com';

function makeMovementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mv-1',
    stage_id: STAGE_ID,
    fdi_number: FDI_11,
    translate_x: 0,
    translate_y: 0,
    translate_z: 0,
    rotate_x: 0,
    rotate_y: 0,
    rotate_z: 0,
    tip: 0,
    torque: 0.5,
    intrusion: 0,
    extrusion: 0,
    is_locked: false,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makePool(rows: unknown[][]) {
  let i = 0;
  return {
    query: jest.fn(async () => ({
      rows: rows[i] ?? [],
      rowCount: (rows[i++] ?? []).length,
    })),
  };
}

function makeService(pool: ReturnType<typeof makePool>) {
  return new ToothMovementsService(pool as any);
}

// ─── verifyStageOwnership (tested implicitly) ─────────────────────────────────

describe('ToothMovementsService (stage ownership guard)', () => {
  it('throws NotFoundException when stage is not found for the given org', async () => {
    const pool = makePool([[]]); // ownership check → empty
    const svc = makeService(pool);
    await expect(
      svc.listForStage(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('verifyStageOwnership binds all four ids: stageId, planId, caseId, orgId', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);
    try { await svc.listForStage(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID); } catch { /* expected */ }
    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/WHERE ast\.id = \$1 AND tp\.id = \$2 AND c\.id = \$3 AND p\.organization_id = \$4/);
    expect(params).toEqual([STAGE_ID, PLAN_ID, CASE_ID, ORG_ID]);
  });
});

// ─── listForStage ─────────────────────────────────────────────────────────────

describe('ToothMovementsService.listForStage', () => {
  it('returns formatted movement list ordered by fdi_number', async () => {
    const pool = makePool([
      [{ id: STAGE_ID }], // ownership ok
      [makeMovementRow({ fdi_number: 11 }), makeMovementRow({ id: 'mv-2', fdi_number: 21 })],
    ]);
    const svc = makeService(pool);

    const results = await svc.listForStage(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].fdiNumber).toBe(11);
    expect(results[1].fdiNumber).toBe(21);
  });

  it('returns empty array when no movements exist', async () => {
    const pool = makePool([[{ id: STAGE_ID }], []]);
    const svc = makeService(pool);
    const results = await svc.listForStage(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('maps all numeric movement fields', async () => {
    const pool = makePool([
      [{ id: STAGE_ID }],
      [makeMovementRow({ translate_x: 1.5, torque: 2.3, tip: -0.5 })],
    ]);
    const svc = makeService(pool);

    const [mv] = await svc.listForStage(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID);

    expect(mv.translateX).toBe(1.5);
    expect(mv.torque).toBe(2.3);
    expect(mv.tip).toBe(-0.5);
  });
});

// ─── upsert ───────────────────────────────────────────────────────────────────

describe('ToothMovementsService.upsert', () => {
  it('inserts a tooth movement and returns formatted result', async () => {
    const pool = makePool([
      [{ id: STAGE_ID }], // ownership
      [makeMovementRow()], // UPSERT RETURNING
    ]);
    const svc = makeService(pool);

    const result = await svc.upsert(
      CASE_ID, PLAN_ID, STAGE_ID, ORG_ID,
      { fdiNumber: FDI_11, torque: 0.5 },
      ACTOR_EMAIL,
    );

    expect(result.fdiNumber).toBe(FDI_11);
    expect(result.stageId).toBe(STAGE_ID);
  });

  it('throws BadRequestException for fdiNumber below minimum (10)', async () => {
    const pool = makePool([[{ id: STAGE_ID }]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 10 }, ACTOR_EMAIL),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for fdiNumber above maximum (49)', async () => {
    const pool = makePool([[{ id: STAGE_ID }]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 49 }, ACTOR_EMAIL),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts minimum valid fdiNumber (11)', async () => {
    const pool = makePool([[{ id: STAGE_ID }], [makeMovementRow({ fdi_number: 11 })]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 11 }, ACTOR_EMAIL),
    ).resolves.not.toThrow();
  });

  it('accepts maximum valid fdiNumber (48)', async () => {
    const pool = makePool([[{ id: STAGE_ID }], [makeMovementRow({ fdi_number: 48 })]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 48 }, ACTOR_EMAIL),
    ).resolves.not.toThrow();
  });

  it('throws BadRequestException for non-integer fdiNumber', async () => {
    const pool = makePool([[{ id: STAGE_ID }]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 11.5 }, ACTOR_EMAIL),
    ).rejects.toThrow(BadRequestException);
  });

  it('uses SQL ON CONFLICT upsert pattern', async () => {
    const pool = makePool([[{ id: STAGE_ID }], [makeMovementRow()]]);
    const svc = makeService(pool);

    await svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: FDI_11 }, ACTOR_EMAIL);

    const [sql] = (pool.query as jest.Mock).mock.calls[1];
    expect(sql).toMatch(/ON CONFLICT/);
    expect(sql).toMatch(/DO UPDATE/);
  });

  it('defaults all numeric fields to 0 when not provided', async () => {
    const pool = makePool([[{ id: STAGE_ID }], [makeMovementRow()]]);
    const svc = makeService(pool);

    await svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: FDI_11 }, ACTOR_EMAIL);

    const [, params] = (pool.query as jest.Mock).mock.calls[1];
    // params[2..7] = translate_x/y/z, rotate_x/y/z (all default 0)
    expect(params[2]).toBe(0);
    expect(params[3]).toBe(0);
    expect(params[4]).toBe(0);
  });

  it('binds isLocked=false by default', async () => {
    const pool = makePool([[{ id: STAGE_ID }], [makeMovementRow()]]);
    const svc = makeService(pool);

    await svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: FDI_11 }, ACTOR_EMAIL);

    const [, params] = (pool.query as jest.Mock).mock.calls[1];
    // params[12] = is_locked
    expect(params[12]).toBe(false);
  });

  it('error message includes FDI range bounds', async () => {
    const pool = makePool([[{ id: STAGE_ID }]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 99 }, ACTOR_EMAIL),
    ).rejects.toThrow(/11.*48|48.*11/);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('ToothMovementsService.delete', () => {
  it('returns {deleted: true, fdiNumber} on success', async () => {
    const pool = makePool([
      [{ id: STAGE_ID }], // ownership
      [{}],               // DELETE → rowCount=1
    ]);
    const svc = makeService(pool);

    const result = await svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_11, ORG_ID, ACTOR_EMAIL);

    expect(result.deleted).toBe(true);
    expect(result.fdiNumber).toBe(FDI_11);
  });

  it('throws NotFoundException when no movement exists for the FDI number', async () => {
    const pool = makePool([
      [{ id: STAGE_ID }], // ownership ok
      [],                  // DELETE → rowCount=0
    ]);
    const svc = makeService(pool);
    await expect(
      svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_11, ORG_ID, ACTOR_EMAIL),
    ).rejects.toThrow(NotFoundException);
  });

  it('NotFoundException message includes the FDI number', async () => {
    const pool = makePool([[{ id: STAGE_ID }], []]);
    const svc = makeService(pool);
    await expect(
      svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_48, ORG_ID, ACTOR_EMAIL),
    ).rejects.toThrow(String(FDI_48));
  });

  it('DELETE SQL binds stage_id and fdi_number', async () => {
    const pool = makePool([[{ id: STAGE_ID }], [{}]]);
    const svc = makeService(pool);

    await svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_11, ORG_ID, ACTOR_EMAIL);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[1];
    expect(sql).toMatch(/DELETE FROM tooth_movements WHERE stage_id = \$1 AND fdi_number = \$2/);
    expect(params[0]).toBe(STAGE_ID);
    expect(params[1]).toBe(FDI_11);
  });

  it('throws NotFoundException before deletion when stage ownership fails', async () => {
    const pool = makePool([[]]); // ownership fails
    const svc = makeService(pool);
    await expect(
      svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_11, ORG_ID, ACTOR_EMAIL),
    ).rejects.toThrow(NotFoundException);
    // Only 1 query issued (ownership check), DELETE never called
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
