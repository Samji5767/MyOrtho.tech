import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// Enamel thickness estimates per tooth type (mm) — used for safety validation.
// Minimum safe remaining enamel: 0.5 mm (Sheridan guideline).
const ENAMEL_THICKNESS: Record<number, number> = {
  // Upper
  11: 1.1, 12: 0.9, 13: 0.8, 14: 0.7, 15: 0.7, 16: 0.6, 17: 0.6, 18: 0.5,
  21: 1.1, 22: 0.9, 23: 0.8, 24: 0.7, 25: 0.7, 26: 0.6, 27: 0.6, 28: 0.5,
  // Lower
  31: 0.9, 32: 0.9, 33: 0.8, 34: 0.7, 35: 0.7, 36: 0.6, 37: 0.6, 38: 0.5,
  41: 0.9, 42: 0.9, 43: 0.8, 44: 0.7, 45: 0.7, 46: 0.6, 47: 0.6, 48: 0.5,
};

const MIN_REMAINING_ENAMEL = 0.5; // mm

function iprSafetyStatus(
  amountMm: number,
  toothAFdi: number,
  toothBFdi: number,
): { status: 'safe' | 'warning' | 'unsafe'; remainingA: number; remainingB: number } {
  const halfAmount = amountMm / 2;
  const enamelA = ENAMEL_THICKNESS[toothAFdi] ?? 0.7;
  const enamelB = ENAMEL_THICKNESS[toothBFdi] ?? 0.7;
  const remainingA = enamelA - halfAmount;
  const remainingB = enamelB - halfAmount;

  let status: 'safe' | 'warning' | 'unsafe' = 'safe';
  if (remainingA < 0 || remainingB < 0) {
    status = 'unsafe';
  } else if (remainingA < MIN_REMAINING_ENAMEL || remainingB < MIN_REMAINING_ENAMEL) {
    status = 'warning';
  }
  return { status, remainingA, remainingB };
}

export interface CreateIprItemDto {
  toothAFdi: number;
  toothBFdi: number;
  amountMm: number;
  beforeStage: number;
  notes?: string | null;
}

// Adjacent pairs for auto-recommendation (by FDI)
const ADJACENT_PAIRS: [number, number][] = [
  [11,12],[12,13],[13,14],[14,15],[15,16],[16,17],
  [21,22],[22,23],[23,24],[24,25],[25,26],[26,27],
  [31,32],[32,33],[33,34],[34,35],[35,36],[36,37],
  [41,42],[42,43],[43,44],[44,45],[45,46],[46,47],
  // midline
  [11,21],[31,41],
];

@Injectable()
export class IprPlannerService {
  private readonly logger = new Logger(IprPlannerService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listItems(planId: string, caseId: string, orgId: string, limit = 200, offset = 0) {
    await this.verifyOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT *, COUNT(*) OVER() AS _total
       FROM ipr_plan_items
       WHERE treatment_plan_id = $1
       ORDER BY before_stage, tooth_a_fdi
       LIMIT $2 OFFSET $3`,
      [planId, limit, offset],
    );
    const total = rows.length > 0 ? Number(rows[0]['_total']) : 0;
    const items = rows.map((r) => {
      const row = Object.assign({}, r) as Record<string, unknown>;
      delete row['_total'];
      return this.format(row);
    });
    return { items, total, limit, offset };
  }

  async addItem(planId: string, caseId: string, orgId: string, dto: CreateIprItemDto, userId: string) {
    await this.verifyOwnership(caseId, orgId);
    const { status, remainingA, remainingB } = iprSafetyStatus(dto.amountMm, dto.toothAFdi, dto.toothBFdi);

    const { rows } = await this.pool.query(
      `INSERT INTO ipr_plan_items
         (case_id, treatment_plan_id, tooth_a_fdi, tooth_b_fdi,
          amount_mm, before_stage, remaining_enamel_a, remaining_enamel_b,
          safety_status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (treatment_plan_id, tooth_a_fdi, tooth_b_fdi)
       DO UPDATE SET amount_mm = EXCLUDED.amount_mm,
                     before_stage = EXCLUDED.before_stage,
                     remaining_enamel_a = EXCLUDED.remaining_enamel_a,
                     remaining_enamel_b = EXCLUDED.remaining_enamel_b,
                     safety_status = EXCLUDED.safety_status,
                     notes = EXCLUDED.notes,
                     updated_at = now()
       RETURNING *`,
      [
        caseId, planId, dto.toothAFdi, dto.toothBFdi,
        dto.amountMm, dto.beforeStage,
        remainingA.toFixed(2), remainingB.toFixed(2),
        status, dto.notes ?? null, userId,
      ],
    );
    return this.format(rows[0]);
  }

  async deleteItem(itemId: string, planId: string, caseId: string, orgId: string) {
    await this.verifyOwnership(caseId, orgId);
    const { rowCount } = await this.pool.query(
      `DELETE FROM ipr_plan_items WHERE id = $1 AND treatment_plan_id = $2 AND case_id = $3`,
      [itemId, planId, caseId],
    );
    if (!rowCount) throw new NotFoundException('IPR item not found');
    return { deleted: true };
  }

  async autoRecommend(planId: string, caseId: string, orgId: string, userId: string) {
    await this.verifyOwnership(caseId, orgId);

    // Pull crowding from case_analyses
    const { rows: analysisRows } = await this.pool.query(
      `SELECT upper_crowding_mm, lower_crowding_mm
       FROM case_analyses WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [caseId],
    );
    const upperCrowding = (analysisRows[0]?.['upper_crowding_mm'] as number | null) ?? 0;
    const lowerCrowding = (analysisRows[0]?.['lower_crowding_mm'] as number | null) ?? 0;

    // Minimum crowding for IPR recommendation: 2 mm per arch
    const doUpper = upperCrowding >= 2.0;
    const doLower = lowerCrowding >= 2.0;

    if (!doUpper && !doLower) return { recommended: 0, items: [] };

    // Get stage count to distribute IPR across early stages
    const { rows: stageCntRows } = await this.pool.query(
      `SELECT COUNT(*) AS cnt FROM aligner_stages WHERE treatment_plan_id = $1`,
      [planId],
    );
    const totalStages = Number(stageCntRows[0]?.['cnt'] ?? 10);

    const beforeStage = Math.max(1, Math.round(totalStages * 0.25));

    // Compute candidates in memory to avoid N+1 DB round-trips
    type Candidate = { a: number; b: number; amountMm: number; remA: string; remB: string; status: string };
    const candidates: Candidate[] = [];
    for (const [a, b] of ADJACENT_PAIRS) {
      const isUpper = a < 30;
      if (isUpper && !doUpper) continue;
      if (!isUpper && !doLower) continue;

      const crowding = isUpper ? upperCrowding : lowerCrowding;
      // Distribute IPR amount: ~0.25 mm per contact site, cap at 0.5 mm
      const amountMm = Math.min(0.5, crowding * 0.04);
      if (amountMm < 0.1) continue;

      const { status, remainingA, remainingB } = iprSafetyStatus(amountMm, a, b);
      if (status === 'unsafe') continue; // skip if enamel would be violated

      candidates.push({ a, b, amountMm, remA: remainingA.toFixed(2), remB: remainingB.toFixed(2), status });
    }

    if (candidates.length === 0) return { recommended: 0, items: [] };

    // Single batched INSERT using UNNEST — one round-trip regardless of candidate count
    const { rows } = await this.pool.query(
      `INSERT INTO ipr_plan_items
         (case_id, treatment_plan_id, tooth_a_fdi, tooth_b_fdi,
          amount_mm, before_stage, remaining_enamel_a, remaining_enamel_b,
          safety_status, is_auto_recommended, created_by)
       SELECT $1, $2,
         UNNEST($3::int[]), UNNEST($4::int[]),
         UNNEST($5::numeric[]), $6,
         UNNEST($7::numeric[]), UNNEST($8::numeric[]),
         UNNEST($9::text[]), true, $10
       ON CONFLICT (treatment_plan_id, tooth_a_fdi, tooth_b_fdi) DO NOTHING
       RETURNING *`,
      [
        caseId, planId,
        candidates.map((c) => c.a),
        candidates.map((c) => c.b),
        candidates.map((c) => c.amountMm),
        beforeStage,
        candidates.map((c) => c.remA),
        candidates.map((c) => c.remB),
        candidates.map((c) => c.status),
        userId,
      ],
    );

    const items = rows.map(this.format);
    this.logger.log(`Auto-recommended ${items.length} IPR items for plan ${planId}`);
    return { recommended: items.length, items };
  }

  async refineRecommendations(planId: string, caseId: string, orgId: string, userId: string) {
    await this.verifyOwnership(caseId, orgId);

    // Read movement prescriptions to compute per-contact mesio-distal space demand
    const { rows: prescRows } = await this.pool.query(
      `SELECT tooth_number, translation_mesial_mm, translation_distal_mm,
              mesialization_mm, distalization_mm, rotation_deg
       FROM movement_prescriptions WHERE plan_id = $1`,
      [planId],
    );

    if (!prescRows.length) return { recommended: 0, items: [], note: 'No prescriptions found — run standard recommend first' };

    const byFdi = new Map<number, Record<string, number>>(
      prescRows.map((r) => [r['tooth_number'] as number, r as Record<string, number>]),
    );

    const { rows: stageCntRows } = await this.pool.query(
      `SELECT COUNT(*) AS cnt FROM aligner_stages WHERE treatment_plan_id = $1`,
      [planId],
    );
    const totalStages = Number(stageCntRows[0]?.['cnt'] ?? 10);
    const beforeStage = Math.max(1, Math.round(totalStages * 0.25));

    type Candidate = { a: number; b: number; amountMm: number; remA: string; remB: string; status: string };
    const candidates: Candidate[] = [];

    for (const [a, b] of ADJACENT_PAIRS) {
      const pA = byFdi.get(a);
      const pB = byFdi.get(b);
      if (!pA && !pB) continue;

      // Net mesial movement of tooth A (toward B) + net distal movement of tooth B (toward A)
      const mesialMovA = (pA?.['translation_mesial_mm'] ?? 0) + (pA?.['mesialization_mm'] ?? 0);
      const distalMovB = (pB?.['translation_distal_mm']  ?? 0) + (pB?.['distalization_mm']  ?? 0);
      const convergence = mesialMovA + distalMovB;

      // Rotation contribution: rotating tooth widens mesio-distal contact footprint
      const rotA = Math.abs(pA?.['rotation_deg'] ?? 0);
      const rotationFactor = rotA > 5 ? 0.1 : 0;

      const totalDemand = convergence + rotationFactor;
      if (totalDemand < 0.1) continue;

      // Scale: not all convergence needs IPR (80% efficiency), cap at Sheridan max
      const amountMm = Math.min(0.5, totalDemand * 0.8);
      if (amountMm < 0.1) continue;

      const { status, remainingA, remainingB } = iprSafetyStatus(amountMm, a, b);
      if (status === 'unsafe') continue;

      candidates.push({ a, b, amountMm, remA: remainingA.toFixed(2), remB: remainingB.toFixed(2), status });
    }

    if (!candidates.length) return { recommended: 0, items: [], method: 'prescription_based' };

    const { rows } = await this.pool.query(
      `INSERT INTO ipr_plan_items
         (case_id, treatment_plan_id, tooth_a_fdi, tooth_b_fdi,
          amount_mm, before_stage, remaining_enamel_a, remaining_enamel_b,
          safety_status, is_auto_recommended, created_by)
       SELECT $1, $2,
         UNNEST($3::int[]), UNNEST($4::int[]),
         UNNEST($5::numeric[]), $6,
         UNNEST($7::numeric[]), UNNEST($8::numeric[]),
         UNNEST($9::text[]), true, $10
       ON CONFLICT (treatment_plan_id, tooth_a_fdi, tooth_b_fdi)
       DO UPDATE SET amount_mm            = EXCLUDED.amount_mm,
                     before_stage         = EXCLUDED.before_stage,
                     remaining_enamel_a   = EXCLUDED.remaining_enamel_a,
                     remaining_enamel_b   = EXCLUDED.remaining_enamel_b,
                     safety_status        = EXCLUDED.safety_status,
                     updated_at           = now()
       RETURNING *`,
      [
        caseId, planId,
        candidates.map((c) => c.a),
        candidates.map((c) => c.b),
        candidates.map((c) => c.amountMm),
        beforeStage,
        candidates.map((c) => c.remA),
        candidates.map((c) => c.remB),
        candidates.map((c) => c.status),
        userId,
      ],
    );

    const items = rows.map(this.format);
    this.logger.log(`Prescription-based IPR refinement: ${items.length} items for plan ${planId}`);
    return { recommended: items.length, items, method: 'prescription_based' };
  }

  private async verifyOwnership(caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT c.id FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private format(r: Record<string, unknown>) {
    return {
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      planId: r['treatment_plan_id'] as string,
      toothAFdi: r['tooth_a_fdi'] as number,
      toothBFdi: r['tooth_b_fdi'] as number,
      amountMm: Number(r['amount_mm']),
      beforeStage: r['before_stage'] as number,
      remainingEnamelA: r['remaining_enamel_a'] != null ? Number(r['remaining_enamel_a']) : null,
      remainingEnamelB: r['remaining_enamel_b'] != null ? Number(r['remaining_enamel_b']) : null,
      safetyStatus: r['safety_status'] as string,
      isAutoRecommended: r['is_auto_recommended'] as boolean,
      notes: r['notes'] as string | null,
      createdAt: r['created_at'] as Date,
      updatedAt: r['updated_at'] as Date,
    };
  }
}
