import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArchCoordinationPlan {
  id: string;
  planId: string;
  strategy: 'simultaneous' | 'upper_first' | 'lower_first' | 'alternating';
  upperTotalStages: number | null;
  lowerTotalStages: number | null;
  synchronizedStages: number | null;
  phaseOffsetStages: number;
  expansionCoordination: boolean;
  archWidthDiscrepancyMm: number | null;
  coordinationScore: number | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArchCheckpoint {
  id: string;
  coordinationId: string;
  checkpointStage: number;
  checkpointType: string;
  description: string;
  targetMetric: string | null;
  targetValueMm: number | null;
  toleranceMm: number | null;
  isMandatory: boolean;
  clinicalNote: string | null;
  status: 'pending' | 'passed' | 'failed' | 'deferred';
  evaluatedAt: string | null;
}

export interface ArchSyncAllocation {
  id: string;
  arch: 'upper' | 'lower';
  stageNum: number;
  synchronizedStage: number;
  toothFdi: number;
  movementType: string;
  amountMmOrDeg: number;
  isActive: boolean;
}

export interface CoordinatePlanDto {
  strategy: 'simultaneous' | 'upper_first' | 'lower_first' | 'alternating';
  expansionCoordination?: boolean;
}

// ─── FDI helpers ─────────────────────────────────────────────────────────────

const UPPER_FDI = new Set([11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28]);
const LOWER_FDI = new Set([31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48]);

// Movement axes included in synchronization analysis
const TRANSLATION_AXES = [
  'translation_mesial_mm', 'translation_distal_mm',
  'translation_buccal_mm', 'translation_lingual_mm',
  'intrusion_mm', 'extrusion_mm', 'expansion_mm', 'mesialization_mm',
];

// Strategy phase offsets (upper starts first by N stages in upper_first, etc.)
const STRATEGY_OFFSET: Record<string, number> = {
  simultaneous: 0,
  upper_first:  3,
  lower_first: -3,
  alternating:  0,
};

// Checkpoint types scheduled at different stage percentages
interface CheckpointSpec {
  type: string;
  pct: number;          // fraction of total stages
  description: string;
  isMandatory: boolean;
  targetMetric?: string;
  targetValueMm?: number;
  toleranceMm?: number;
}

const CHECKPOINT_SPECS: CheckpointSpec[] = [
  {
    type: 'arch_width_check',
    pct: 0.25,
    description: 'Verify upper/lower arch widths are expanding proportionally.',
    isMandatory: true,
    targetMetric: 'arch_width_discrepancy_mm',
    targetValueMm: 1.0,
    toleranceMm: 0.5,
  },
  {
    type: 'midline_check',
    pct: 0.33,
    description: 'Check upper and lower dental midlines are aligning within 1mm.',
    isMandatory: true,
    targetMetric: 'midline_deviation_mm',
    targetValueMm: 1.0,
    toleranceMm: 0.5,
  },
  {
    type: 'overjet_check',
    pct: 0.5,
    description: 'Verify overjet is tracking toward 2–4mm at mid-treatment.',
    isMandatory: true,
    targetMetric: 'overjet_mm',
    targetValueMm: 3.0,
    toleranceMm: 1.5,
  },
  {
    type: 'overbite_check',
    pct: 0.5,
    description: 'Verify overbite is within 1–3mm at mid-treatment.',
    isMandatory: true,
    targetMetric: 'overbite_mm',
    targetValueMm: 2.0,
    toleranceMm: 1.0,
  },
  {
    type: 'bolton_check',
    pct: 0.66,
    description: 'Bolton ratio evaluation — verify space closure is proportionate.',
    isMandatory: false,
  },
  {
    type: 'occlusion_check',
    pct: 0.75,
    description: 'Clinical occlusion check: assess interdigitation and centric contacts.',
    isMandatory: true,
  },
  {
    type: 'expansion_sync',
    pct: 1.0,
    description: 'Final arch width coordination — upper and lower widths should be within 1mm.',
    isMandatory: true,
    targetMetric: 'arch_width_discrepancy_mm',
    targetValueMm: 1.0,
    toleranceMm: 0.5,
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ArchCoordinationService {
  private readonly log = new Logger(ArchCoordinationService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async coordinatePlan(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
    dto: CoordinatePlanDto,
  ): Promise<ArchCoordinationPlan> {
    await this.verifyPlan(planId, caseId, orgId);

    // Load prescriptions
    const prescRes = await this.db.query(
      `SELECT * FROM movement_prescriptions WHERE plan_id=$1`, [planId],
    );
    if (prescRes.rowCount === 0) throw new NotFoundException('No prescriptions found for this plan');

    const upper = prescRes.rows.filter(r => UPPER_FDI.has(r['tooth_number'] as number));
    const lower = prescRes.rows.filter(r => LOWER_FDI.has(r['tooth_number'] as number));

    // Load aligner plan for stage counts
    const genRes = await this.db.query(
      `SELECT total_active_stages FROM aligner_generation_plans WHERE plan_id=$1`, [planId],
    );
    const totalStages = genRes.rowCount && genRes.rowCount > 0
      ? (genRes.rows[0]['total_active_stages'] as number)
      : 20;

    // Compute per-arch stage estimates from maximum single-axis movement / limit
    const LIMITS: Record<string, number> = {
      translation_mesial_mm: 0.30, translation_distal_mm: 0.30,
      expansion_mm: 0.30, intrusion_mm: 0.40, extrusion_mm: 0.75,
      rotation_deg: 3.0, torque_deg: 3.5,
    };

    function stagesForArch(rows: Record<string, unknown>[]): number {
      let maxStages = 0;
      for (const p of rows) {
        for (const [axis, limit] of Object.entries(LIMITS)) {
          const val = Math.abs(p[axis] as number ?? 0);
          if (val > 0) maxStages = Math.max(maxStages, Math.ceil(val / limit));
        }
      }
      return Math.max(maxStages, 1);
    }

    const upperStages = stagesForArch(upper);
    const lowerStages = stagesForArch(lower);
    const offset = STRATEGY_OFFSET[dto.strategy];
    const synchronizedStages = Math.max(upperStages, lowerStages) + Math.abs(offset);

    // Arch width discrepancy: expansion totals
    const upperExp = upper.reduce((s, r) => s + ((r['expansion_mm'] as number) ?? 0), 0);
    const lowerExp = lower.reduce((s, r) => s + ((r['expansion_mm'] as number) ?? 0), 0);
    const discrepancy = Math.abs(upperExp - lowerExp);

    // Coordination score: 0=worst, 1=best
    const stageBalance = 1 - Math.abs(upperStages - lowerStages) / Math.max(upperStages, lowerStages, 1);
    const expBalance = 1 - Math.min(discrepancy / 5.0, 1.0);
    const coordinationScore = parseFloat(((stageBalance + expBalance) / 2).toFixed(3));

    // Upsert arch coordination plan
    const coordRes = await this.db.query(
      `INSERT INTO arch_coordination_plans
         (organization_id, plan_id, strategy, upper_total_stages, lower_total_stages,
          synchronized_stages, phase_offset_stages, expansion_coordination,
          arch_width_discrepancy_mm, coordination_score, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (plan_id) DO UPDATE SET
         strategy=EXCLUDED.strategy,
         upper_total_stages=EXCLUDED.upper_total_stages,
         lower_total_stages=EXCLUDED.lower_total_stages,
         synchronized_stages=EXCLUDED.synchronized_stages,
         phase_offset_stages=EXCLUDED.phase_offset_stages,
         expansion_coordination=EXCLUDED.expansion_coordination,
         arch_width_discrepancy_mm=EXCLUDED.arch_width_discrepancy_mm,
         coordination_score=EXCLUDED.coordination_score,
         updated_at=now()
       RETURNING *`,
      [
        orgId, planId, dto.strategy,
        upperStages, lowerStages, synchronizedStages,
        Math.abs(offset), dto.expansionCoordination ?? true,
        parseFloat(discrepancy.toFixed(3)),
        coordinationScore, userId,
      ],
    );
    const coordId = coordRes.rows[0]['id'] as string;

    // Build sync allocations
    await this.buildSyncAllocations(coordId, orgId, upper, lower, dto.strategy, Math.abs(offset));

    // Build checkpoints based on synchronized stage count
    await this.buildCheckpoints(coordId, orgId, synchronizedStages, dto.strategy);

    this.log.log(`Phase 32 coordination: plan ${planId} — ${dto.strategy}, ${synchronizedStages} sync stages`);
    return this.rowToCoord(coordRes.rows[0]);
  }

  async getCoordinationPlan(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<ArchCoordinationPlan> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM arch_coordination_plans WHERE plan_id=$1`, [planId],
    );
    if (res.rowCount === 0) throw new NotFoundException('No coordination plan found — run /coordinate first');
    return this.rowToCoord(res.rows[0]);
  }

  async getCheckpoints(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<ArchCheckpoint[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const coord = await this.db.query(
      `SELECT id FROM arch_coordination_plans WHERE plan_id=$1`, [planId],
    );
    if (coord.rowCount === 0) throw new NotFoundException('No coordination plan found');
    const res = await this.db.query(
      `SELECT * FROM arch_checkpoints WHERE coordination_id=$1 ORDER BY checkpoint_stage, checkpoint_type`,
      [coord.rows[0]['id']],
    );
    return res.rows.map(r => this.rowToCheckpoint(r));
  }

  async evaluateCheckpoint(
    caseId: string,
    orgId: string,
    planId: string,
    checkpointId: string,
    status: 'passed' | 'failed' | 'deferred',
    clinicalNote?: string,
  ): Promise<ArchCheckpoint> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `UPDATE arch_checkpoints SET status=$1, clinical_note=$2, evaluated_at=now()
       WHERE id=$3 AND organization_id=$4 RETURNING *`,
      [status, clinicalNote ?? null, checkpointId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Checkpoint not found');
    return this.rowToCheckpoint(res.rows[0]);
  }

  async getSyncAllocations(
    caseId: string,
    orgId: string,
    planId: string,
    arch?: 'upper' | 'lower',
  ): Promise<ArchSyncAllocation[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const coord = await this.db.query(
      `SELECT id FROM arch_coordination_plans WHERE plan_id=$1`, [planId],
    );
    if (coord.rowCount === 0) throw new NotFoundException('No coordination plan found');
    const res = await this.db.query(
      arch
        ? `SELECT * FROM arch_sync_allocations WHERE coordination_id=$1 AND arch=$2 ORDER BY synchronized_stage, tooth_fdi`
        : `SELECT * FROM arch_sync_allocations WHERE coordination_id=$1 ORDER BY synchronized_stage, arch, tooth_fdi`,
      arch ? [coord.rows[0]['id'], arch] : [coord.rows[0]['id']],
    );
    return res.rows.map(r => this.rowToAllocation(r));
  }

  async approvePlan(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
  ): Promise<ArchCoordinationPlan> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `UPDATE arch_coordination_plans SET approved_by=$1, approved_at=now(), updated_at=now()
       WHERE plan_id=$2 AND organization_id=$3 RETURNING *`,
      [userId, planId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Coordination plan not found');
    return this.rowToCoord(res.rows[0]);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async buildSyncAllocations(
    coordId: string,
    orgId: string,
    upper: Record<string, unknown>[],
    lower: Record<string, unknown>[],
    strategy: string,
    offset: number,
  ): Promise<void> {
    // Delete old allocations
    await this.db.query(
      `DELETE FROM arch_sync_allocations WHERE coordination_id=$1`, [coordId],
    );

    const LIMITS: Record<string, number> = {
      translation_mesial_mm: 0.30, translation_distal_mm: 0.30,
      expansion_mm: 0.30, intrusion_mm: 0.40, extrusion_mm: 0.75,
      rotation_deg: 3.0, torque_deg: 3.5,
    };

    const upperOffset = strategy === 'upper_first' ? 0 : strategy === 'lower_first' ? offset : 0;
    const lowerOffset = strategy === 'lower_first' ? 0 : strategy === 'upper_first' ? offset : 0;

    const buildAllocsForArch = (
      rows: Record<string, unknown>[],
      arch: 'upper' | 'lower',
      archOffset: number,
    ) => {
      const allocs: Array<[string, string, number, number, number, string, number]> = [];
      for (const p of rows) {
        const fdi = p['tooth_number'] as number;
        for (const [axis, limit] of Object.entries(LIMITS)) {
          const val = p[axis] as number ?? 0;
          if (Math.abs(val) < 0.001) continue;
          const stagesNeeded = Math.ceil(Math.abs(val) / limit);
          const perStage = val / stagesNeeded;
          for (let s = 1; s <= stagesNeeded; s++) {
            allocs.push([coordId, orgId, s, s + archOffset, fdi, axis, parseFloat(perStage.toFixed(4))]);
          }
        }
      }
      return allocs.map(a => ({ arch, stage: a[2], sync: a[3], fdi: a[4], mt: a[5], amt: a[6] }));
    };

    const upperAllocs = buildAllocsForArch(upper, 'upper', upperOffset);
    const lowerAllocs = buildAllocsForArch(lower, 'lower', lowerOffset);

    for (const a of [...upperAllocs, ...lowerAllocs]) {
      await this.db.query(
        `INSERT INTO arch_sync_allocations
           (coordination_id, organization_id, arch, stage_num, synchronized_stage,
            tooth_fdi, movement_type, amount_mm_or_deg)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (coordination_id, arch, stage_num, tooth_fdi, movement_type) DO UPDATE SET
           synchronized_stage=EXCLUDED.synchronized_stage,
           amount_mm_or_deg=EXCLUDED.amount_mm_or_deg`,
        [coordId, orgId, a.arch, a.stage, a.sync, a.fdi, a.mt, a.amt],
      );
    }
  }

  private async buildCheckpoints(
    coordId: string,
    orgId: string,
    totalStages: number,
    strategy: string,
  ): Promise<void> {
    for (const spec of CHECKPOINT_SPECS) {
      const stage = Math.max(1, Math.round(totalStages * spec.pct));
      await this.db.query(
        `INSERT INTO arch_checkpoints
           (coordination_id, organization_id, checkpoint_stage, checkpoint_type,
            description, target_metric, target_value_mm, tolerance_mm, is_mandatory)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (coordination_id, checkpoint_stage, checkpoint_type) DO UPDATE SET
           description=EXCLUDED.description,
           target_metric=EXCLUDED.target_metric,
           target_value_mm=EXCLUDED.target_value_mm,
           tolerance_mm=EXCLUDED.tolerance_mm,
           is_mandatory=EXCLUDED.is_mandatory,
           status='pending', evaluated_at=null`,
        [
          coordId, orgId, stage, spec.type,
          spec.description,
          spec.targetMetric ?? null,
          spec.targetValueMm ?? null,
          spec.toleranceMm ?? null,
          spec.isMandatory,
        ],
      );
    }
  }

  private rowToCoord(r: Record<string, unknown>): ArchCoordinationPlan {
    return {
      id:                    r['id'] as string,
      planId:                r['plan_id'] as string,
      strategy:              r['strategy'] as ArchCoordinationPlan['strategy'],
      upperTotalStages:      r['upper_total_stages'] as number | null,
      lowerTotalStages:      r['lower_total_stages'] as number | null,
      synchronizedStages:    r['synchronized_stages'] as number | null,
      phaseOffsetStages:     r['phase_offset_stages'] as number,
      expansionCoordination: r['expansion_coordination'] as boolean,
      archWidthDiscrepancyMm: r['arch_width_discrepancy_mm'] as number | null,
      coordinationScore:     r['coordination_score'] as number | null,
      approvedAt:            r['approved_at'] as string | null,
      createdAt:             r['created_at'] as string,
      updatedAt:             r['updated_at'] as string,
    };
  }

  private rowToCheckpoint(r: Record<string, unknown>): ArchCheckpoint {
    return {
      id:              r['id'] as string,
      coordinationId:  r['coordination_id'] as string,
      checkpointStage: r['checkpoint_stage'] as number,
      checkpointType:  r['checkpoint_type'] as string,
      description:     r['description'] as string,
      targetMetric:    r['target_metric'] as string | null,
      targetValueMm:   r['target_value_mm'] as number | null,
      toleranceMm:     r['tolerance_mm'] as number | null,
      isMandatory:     r['is_mandatory'] as boolean,
      clinicalNote:    r['clinical_note'] as string | null,
      status:          r['status'] as ArchCheckpoint['status'],
      evaluatedAt:     r['evaluated_at'] as string | null,
    };
  }

  private rowToAllocation(r: Record<string, unknown>): ArchSyncAllocation {
    return {
      id:               r['id'] as string,
      arch:             r['arch'] as 'upper' | 'lower',
      stageNum:         r['stage_num'] as number,
      synchronizedStage: r['synchronized_stage'] as number,
      toothFdi:         r['tooth_fdi'] as number,
      movementType:     r['movement_type'] as string,
      amountMmOrDeg:    r['amount_mm_or_deg'] as number,
      isActive:         r['is_active'] as boolean,
    };
  }

  private async verifyPlan(planId: string, caseId: string, orgId: string): Promise<void> {
    const res = await this.db.query(
      `SELECT tp.id FROM treatment_plans tp JOIN cases c ON c.id=tp.case_id
       WHERE tp.id=$1 AND tp.case_id=$2 AND c.organization_id=$3`,
      [planId, caseId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Treatment plan not found');
  }
}
