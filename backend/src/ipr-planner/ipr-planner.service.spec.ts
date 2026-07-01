import { NotFoundException } from '@nestjs/common';
import { IprPlannerService } from './ipr-planner.service';

// ─── Pool factory ─────────────────────────────────────────────────────────────

/**
 * Minimal pool mock. Each entry in `responses` is returned in order for
 * successive pool.query() calls within a single test.
 */
function makePool(responses: { rows?: Record<string, unknown>[]; rowCount?: number }[]): any {
  let idx = 0;
  return {
    query: jest.fn(async () => {
      const r = responses[idx] ?? { rows: [], rowCount: 0 };
      idx++;
      return { rows: r.rows ?? [], rowCount: r.rowCount ?? r.rows?.length ?? 0 };
    }),
  };
}

/** Ownership check always succeeds (rows: [{}]) */
function ownsRow(): { rows: Record<string, unknown>[]; rowCount?: number } {
  return { rows: [{ id: 'case-1' }] };
}

const CASE_ID = 'case-1';
const PLAN_ID = 'plan-1';
const ORG_ID  = 'org-1';
const USER_ID = 'user-1';

// ─── iprSafetyStatus (via addItem) ───────────────────────────────────────────

describe('IprPlannerService — IPR safety logic', () => {
  it('marks safe when remaining enamel ≥ 0.5 mm on both teeth', async () => {
    // FDI 11 enamel = 1.1 mm; amount 0.2 mm → remaining = 1.0 mm (safe)
    const dbRow = {
      id: 'item-1', case_id: CASE_ID, treatment_plan_id: PLAN_ID,
      tooth_a_fdi: 11, tooth_b_fdi: 12,
      amount_mm: '0.20', before_stage: 3,
      remaining_enamel_a: '1.00', remaining_enamel_b: '0.80',
      safety_status: 'safe', is_auto_recommended: false, notes: null,
      created_at: new Date(), updated_at: new Date(),
    };
    const pool = makePool([ownsRow(), { rows: [dbRow] }]);
    const svc = new IprPlannerService(pool);

    const result = await svc.addItem(PLAN_ID, CASE_ID, ORG_ID,
      { toothAFdi: 11, toothBFdi: 12, amountMm: 0.20, beforeStage: 3 }, USER_ID);
    expect(result.safetyStatus).toBe('safe');
    expect(result.amountMm).toBeCloseTo(0.20);
  });

  it('passes warning status through when remaining enamel < 0.5 mm', async () => {
    // FDI 18 enamel = 0.5 mm; amount 0.2 mm → remaining = 0.4 mm (warning)
    const dbRow = {
      id: 'item-2', case_id: CASE_ID, treatment_plan_id: PLAN_ID,
      tooth_a_fdi: 18, tooth_b_fdi: 17,
      amount_mm: '0.20', before_stage: 3,
      remaining_enamel_a: '0.40', remaining_enamel_b: '0.50',
      safety_status: 'warning', is_auto_recommended: false, notes: null,
      created_at: new Date(), updated_at: new Date(),
    };
    const pool = makePool([ownsRow(), { rows: [dbRow] }]);
    const svc = new IprPlannerService(pool);

    const result = await svc.addItem(PLAN_ID, CASE_ID, ORG_ID,
      { toothAFdi: 18, toothBFdi: 17, amountMm: 0.20, beforeStage: 3 }, USER_ID);
    // The DB row carries the status computed before insert; we read it back
    expect(result.safetyStatus).toBe('warning');
  });

  it('stores notes when provided', async () => {
    const dbRow = {
      id: 'item-3', case_id: CASE_ID, treatment_plan_id: PLAN_ID,
      tooth_a_fdi: 12, tooth_b_fdi: 13,
      amount_mm: '0.25', before_stage: 4,
      remaining_enamel_a: '0.775', remaining_enamel_b: '0.675',
      safety_status: 'safe', is_auto_recommended: false,
      notes: 'check again at stage 4',
      created_at: new Date(), updated_at: new Date(),
    };
    const pool = makePool([ownsRow(), { rows: [dbRow] }]);
    const svc = new IprPlannerService(pool);

    const result = await svc.addItem(PLAN_ID, CASE_ID, ORG_ID,
      { toothAFdi: 12, toothBFdi: 13, amountMm: 0.25, beforeStage: 4, notes: 'check again at stage 4' }, USER_ID);
    expect(result.notes).toBe('check again at stage 4');
  });
});

// ─── listItems ────────────────────────────────────────────────────────────────

describe('IprPlannerService.listItems', () => {
  it('returns formatted rows from the database', async () => {
    const rows = [
      { id: 'r1', case_id: CASE_ID, treatment_plan_id: PLAN_ID,
        tooth_a_fdi: 12, tooth_b_fdi: 13, amount_mm: '0.20', before_stage: 3,
        remaining_enamel_a: '0.80', remaining_enamel_b: '0.70',
        safety_status: 'safe', is_auto_recommended: false, notes: null,
        created_at: new Date(), updated_at: new Date() },
    ];
    const pool = makePool([ownsRow(), { rows }]);
    const svc = new IprPlannerService(pool);

    const result = await svc.listItems(PLAN_ID, CASE_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0].toothAFdi).toBe(12);
    expect(result[0].toothBFdi).toBe(13);
    expect(result[0].amountMm).toBeCloseTo(0.20);
  });

  it('returns an empty array when no items exist', async () => {
    const pool = makePool([ownsRow(), { rows: [] }]);
    const svc = new IprPlannerService(pool);

    const result = await svc.listItems(PLAN_ID, CASE_ID, ORG_ID);
    expect(result).toEqual([]);
  });
});

// ─── deleteItem ───────────────────────────────────────────────────────────────

describe('IprPlannerService.deleteItem', () => {
  it('returns { deleted: true } on success', async () => {
    const pool = makePool([ownsRow(), { rows: [], rowCount: 1 }]);
    const svc = new IprPlannerService(pool);

    const result = await svc.deleteItem('item-1', PLAN_ID, CASE_ID, ORG_ID);
    expect(result).toEqual({ deleted: true });
  });

  it('throws NotFoundException when item does not exist', async () => {
    const pool = makePool([ownsRow(), { rows: [], rowCount: 0 }]);
    const svc = new IprPlannerService(pool);

    await expect(
      svc.deleteItem('no-such-item', PLAN_ID, CASE_ID, ORG_ID),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── ownership guard ─────────────────────────────────────────────────────────

describe('IprPlannerService — ownership guard', () => {
  it('throws NotFoundException when case does not belong to the org', async () => {
    // verifyOwnership returns no rows → throws
    const pool = makePool([{ rows: [], rowCount: 0 }]);
    const svc = new IprPlannerService(pool);

    await expect(
      svc.listItems(PLAN_ID, CASE_ID, 'wrong-org'),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── autoRecommend ────────────────────────────────────────────────────────────

describe('IprPlannerService.autoRecommend', () => {
  it('returns { recommended: 0, items: [] } when crowding < 2 mm on both arches', async () => {
    const pool = makePool([
      ownsRow(),
      { rows: [{ upper_crowding_mm: 1.5, lower_crowding_mm: 1.0 }] }, // analysis
      { rows: [{ cnt: '22' }] },                                        // stage count
    ]);
    const svc = new IprPlannerService(pool);

    const result = await svc.autoRecommend(PLAN_ID, CASE_ID, ORG_ID, USER_ID);
    expect(result.recommended).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('returns recommendations when upper crowding ≥ 2 mm', async () => {
    // Pool: ownership + analysis + stage count + N INSERT queries (one per pair)
    // We pre-load many "inserted row" responses for adjacent pair loop
    const insertedRow = (a: number, b: number) => ({
      rows: [{
        id: `auto_${a}_${b}`, case_id: CASE_ID, treatment_plan_id: PLAN_ID,
        tooth_a_fdi: a, tooth_b_fdi: b,
        amount_mm: '0.12', before_stage: 6,
        remaining_enamel_a: '0.94', remaining_enamel_b: '0.84',
        safety_status: 'safe', is_auto_recommended: true, notes: null,
        created_at: new Date(), updated_at: new Date(),
      }],
    });

    const pairCount = 26; // ADJACENT_PAIRS has 26 entries
    const dbResponses = [
      ownsRow(),
      { rows: [{ upper_crowding_mm: 3.0, lower_crowding_mm: 0.5 }] },
      { rows: [{ cnt: '22' }] },
      ...Array.from({ length: pairCount }, (_, i) => {
        // upper pairs: 0-11 → [11,12]...[21,22], midline [11,21] = 12 upper + 1 midline = 13
        // lower pairs: 12-23 → [31,32]...[41,47] = 12 lower + 1 midline = 13 total
        // Only upper + upper midline should be inserted (doUpper=true, doLower=false)
        return insertedRow(i, i + 1);
      }),
    ];

    const pool = makePool(dbResponses);
    const svc = new IprPlannerService(pool);

    const result = await svc.autoRecommend(PLAN_ID, CASE_ID, ORG_ID, USER_ID);
    // At least one upper pair should be recommended
    expect(result.recommended).toBeGreaterThan(0);
  });
});
