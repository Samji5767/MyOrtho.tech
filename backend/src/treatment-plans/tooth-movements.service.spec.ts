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

const STAGE_ROW = { id: STAGE_ID, doctor_approval: false };

function makeMovementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mv-1',
    stage_id: STAGE_ID,
    fdi_number: FDI_11,
    mesiodistal_mm: 0,
    buccolingual_mm: 0,
    occlusogingival_mm: 0,
    rotation_deg: 0,
    tip_deg: 0,
    torque_deg: 0.5,
    is_locked: false,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Mock pool whose data-bearing queries consume `rows` in sequence.
 * BEGIN/COMMIT/ROLLBACK do not consume. pool.connect() returns a client
 * sharing the same query mock, so transactional calls appear in dataCalls.
 */
function makePool(rows: unknown[][]) {
  let i = 0;
  const dataCalls: Array<[string, unknown[] | undefined]> = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 };
    dataCalls.push([sql, params]);
    const r = rows[i++] ?? [];
    return { rows: r, rowCount: r.length };
  });
  return {
    query,
    dataCalls,
    connect: jest.fn(async () => ({ query, release: jest.fn() })),
  };
}

function makeService(pool: ReturnType<typeof makePool>) {
  return new ToothMovementsService(pool as never);
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
    const [sql, params] = pool.dataCalls[0];
    expect(sql).toMatch(/WHERE ast\.id = \$1 AND tp\.id = \$2 AND c\.id = \$3 AND p\.organization_id = \$4/);
    expect(params).toEqual([STAGE_ID, PLAN_ID, CASE_ID, ORG_ID]);
  });
});

// ─── listForStage ─────────────────────────────────────────────────────────────

describe('ToothMovementsService.listForStage', () => {
  it('returns formatted movement list ordered by fdi_number', async () => {
    const pool = makePool([
      [STAGE_ROW], // ownership ok
      [makeMovementRow({ fdi_number: 11 }), makeMovementRow({ id: 'mv-2', fdi_number: 21 })],
    ]);
    const svc = makeService(pool);

    const results = await svc.listForStage(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].fdiNumber).toBe(11);
    expect(results[1].fdiNumber).toBe(21);
  });

  it('returns empty array when no movements exist', async () => {
    const pool = makePool([[STAGE_ROW], []]);
    const svc = makeService(pool);
    const results = await svc.listForStage(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('maps all canonical movement fields', async () => {
    const pool = makePool([
      [STAGE_ROW],
      [makeMovementRow({ mesiodistal_mm: 1.5, torque_deg: 2.3, tip_deg: -0.5 })],
    ]);
    const svc = makeService(pool);

    const [mv] = await svc.listForStage(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID);

    expect(mv.mesiodistalMm).toBe(1.5);
    expect(mv.torqueDeg).toBe(2.3);
    expect(mv.tipDeg).toBe(-0.5);
  });
});

// ─── upsert ───────────────────────────────────────────────────────────────────

describe('ToothMovementsService.upsert', () => {
  it('inserts a tooth movement and returns formatted result', async () => {
    const pool = makePool([
      [STAGE_ROW],         // ownership
      [makeMovementRow()], // UPSERT RETURNING
      [],                  // stage JSON mirror UPDATE
    ]);
    const svc = makeService(pool);

    const result = await svc.upsert(
      CASE_ID, PLAN_ID, STAGE_ID, ORG_ID,
      { fdiNumber: FDI_11, torqueDeg: 0.5 },
      ACTOR_EMAIL,
    );

    expect(result.fdiNumber).toBe(FDI_11);
    expect(result.stageId).toBe(STAGE_ID);
  });

  it('rejects edits when the plan is already approved', async () => {
    const pool = makePool([[{ id: STAGE_ID, doctor_approval: true }]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: FDI_11 }, ACTOR_EMAIL),
    ).rejects.toThrow(/approved/i);
  });

  it('throws BadRequestException for fdiNumber below minimum (10)', async () => {
    const pool = makePool([[STAGE_ROW]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 10 }, ACTOR_EMAIL),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for fdiNumber above maximum (49)', async () => {
    const pool = makePool([[STAGE_ROW]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 49 }, ACTOR_EMAIL),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for FDI numbers with invalid position digit (e.g. 19, 20, 30)', async () => {
    for (const bad of [19, 20, 30, 39, 40]) {
      const pool = makePool([[STAGE_ROW]]);
      const svc = makeService(pool);
      await expect(
        svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: bad }, ACTOR_EMAIL),
      ).rejects.toThrow(BadRequestException);
    }
  });

  it('accepts minimum valid fdiNumber (11)', async () => {
    const pool = makePool([[STAGE_ROW], [makeMovementRow({ fdi_number: 11 })], []]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 11 }, ACTOR_EMAIL),
    ).resolves.not.toThrow();
  });

  it('accepts maximum valid fdiNumber (48)', async () => {
    const pool = makePool([[STAGE_ROW], [makeMovementRow({ fdi_number: 48 })], []]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 48 }, ACTOR_EMAIL),
    ).resolves.not.toThrow();
  });

  it('throws BadRequestException for non-integer fdiNumber', async () => {
    const pool = makePool([[STAGE_ROW]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 11.5 }, ACTOR_EMAIL),
    ).rejects.toThrow(BadRequestException);
  });

  it('uses SQL ON CONFLICT upsert pattern', async () => {
    const pool = makePool([[STAGE_ROW], [makeMovementRow()], []]);
    const svc = makeService(pool);

    await svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: FDI_11 }, ACTOR_EMAIL);

    const [sql] = pool.dataCalls[1];
    expect(sql).toMatch(/ON CONFLICT/);
    expect(sql).toMatch(/DO UPDATE/);
  });

  it('mirrors the movement into the stage movement_data JSON in the same transaction', async () => {
    const pool = makePool([[STAGE_ROW], [makeMovementRow()], []]);
    const svc = makeService(pool);

    await svc.upsert(
      CASE_ID, PLAN_ID, STAGE_ID, ORG_ID,
      { fdiNumber: FDI_11, mesiodistalMm: 1.2 },
      ACTOR_EMAIL,
    );

    const [sql, params] = pool.dataCalls[2];
    expect(sql).toMatch(/UPDATE aligner_stages/);
    expect(sql).toMatch(/jsonb_set/);
    expect(params?.[0]).toBe(STAGE_ID);
    expect(params?.[1]).toBe(String(FDI_11));
    expect(JSON.parse(params?.[2] as string)).toMatchObject({ mesiodistalMm: 1.2 });
  });

  it('defaults all numeric fields to 0 when not provided', async () => {
    const pool = makePool([[STAGE_ROW], [makeMovementRow()], []]);
    const svc = makeService(pool);

    await svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: FDI_11 }, ACTOR_EMAIL);

    const [, params] = pool.dataCalls[1];
    // params[2..7] = mesiodistal, buccolingual, occlusogingival, rotation, tip, torque
    for (const idx of [2, 3, 4, 5, 6, 7]) {
      expect(params?.[idx]).toBe(0);
    }
  });

  it('binds isLocked=false by default', async () => {
    const pool = makePool([[STAGE_ROW], [makeMovementRow()], []]);
    const svc = makeService(pool);

    await svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: FDI_11 }, ACTOR_EMAIL);

    const [, params] = pool.dataCalls[1];
    // params[8] = is_locked
    expect(params?.[8]).toBe(false);
  });

  it('error message describes FDI notation for invalid numbers', async () => {
    const pool = makePool([[STAGE_ROW]]);
    const svc = makeService(pool);
    await expect(
      svc.upsert(CASE_ID, PLAN_ID, STAGE_ID, ORG_ID, { fdiNumber: 99 }, ACTOR_EMAIL),
    ).rejects.toThrow(/FDI/);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('ToothMovementsService.delete', () => {
  it('returns {deleted: true, fdiNumber} on success', async () => {
    const pool = makePool([
      [STAGE_ROW], // ownership
      [{}],        // DELETE → rowCount=1
      [],          // stage JSON mirror UPDATE
    ]);
    const svc = makeService(pool);

    const result = await svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_11, ORG_ID, ACTOR_EMAIL);

    expect(result.deleted).toBe(true);
    expect(result.fdiNumber).toBe(FDI_11);
  });

  it('removes the tooth key from the stage movement_data JSON', async () => {
    const pool = makePool([[STAGE_ROW], [{}], []]);
    const svc = makeService(pool);

    await svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_11, ORG_ID, ACTOR_EMAIL);

    const [sql, params] = pool.dataCalls[2];
    expect(sql).toMatch(/UPDATE aligner_stages/);
    expect(sql).toMatch(/- \$2::text/);
    expect(params?.[1]).toBe(String(FDI_11));
  });

  it('throws NotFoundException when no movement exists for the FDI number', async () => {
    const pool = makePool([
      [STAGE_ROW], // ownership ok
      [],          // DELETE → rowCount=0
    ]);
    const svc = makeService(pool);
    await expect(
      svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_11, ORG_ID, ACTOR_EMAIL),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects deletion when the plan is already approved', async () => {
    const pool = makePool([[{ id: STAGE_ID, doctor_approval: true }]]);
    const svc = makeService(pool);
    await expect(
      svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_11, ORG_ID, ACTOR_EMAIL),
    ).rejects.toThrow(/approved/i);
  });

  it('NotFoundException message includes the FDI number', async () => {
    const pool = makePool([[STAGE_ROW], []]);
    const svc = makeService(pool);
    await expect(
      svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_48, ORG_ID, ACTOR_EMAIL),
    ).rejects.toThrow(String(FDI_48));
  });

  it('DELETE SQL binds stage_id and fdi_number', async () => {
    const pool = makePool([[STAGE_ROW], [{}], []]);
    const svc = makeService(pool);

    await svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_11, ORG_ID, ACTOR_EMAIL);

    const [sql, params] = pool.dataCalls[1];
    expect(sql).toMatch(/DELETE FROM tooth_movements WHERE stage_id = \$1 AND fdi_number = \$2/);
    expect(params?.[0]).toBe(STAGE_ID);
    expect(params?.[1]).toBe(FDI_11);
  });

  it('throws NotFoundException before deletion when stage ownership fails', async () => {
    const pool = makePool([[]]); // ownership fails
    const svc = makeService(pool);
    await expect(
      svc.delete(CASE_ID, PLAN_ID, STAGE_ID, FDI_11, ORG_ID, ACTOR_EMAIL),
    ).rejects.toThrow(NotFoundException);
    // Only 1 data query issued (ownership check), DELETE never called
    expect(pool.dataCalls).toHaveLength(1);
  });
});
