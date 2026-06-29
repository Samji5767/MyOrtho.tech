import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToothPosition {
  tx: number; ty: number; tz: number;  // translation mm
  rx: number; ry: number; rz: number;  // rotation degrees
}

export interface SimulationFrame {
  stageNum: number;
  toothPositions: Record<number, ToothPosition>;
  upperArchWidthMm: number | null;
  lowerArchWidthMm: number | null;
  overbiteM: number | null;
  overjetMm: number | null;
  midlineDeviationMm: number | null;
  isKeyframe: boolean;
}

export interface TreatmentSimulation {
  id: string;
  planId: string;
  totalFrames: number;
  archCoordinationScore: number | null;
  occlusionScore: number | null;
  smileArcScore: number | null;
  overjetInitialMm: number | null;
  overjetFinalMm: number | null;
  overbiteInitialMm: number | null;
  overbiteFinalmm: number | null;
  generationDurationMs: number | null;
  generatedAt: string;
}

// FDI groupings
const UPPER_FDI = [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28];
const LOWER_FDI = [31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48];
const INCISORS  = [11,12,21,22,31,32,41,42];

// Standard dental measurements (mm) — approximations for simulation
const ARCH_WIDTH_UPPER = 48.0; // molar-to-molar width mm
const ARCH_WIDTH_LOWER = 44.0;
const OVERJET_NORMAL   = 3.0;
const OVERBITE_NORMAL  = 2.5;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TreatmentSimulationService {
  private readonly log = new Logger(TreatmentSimulationService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async generateSimulation(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
  ): Promise<TreatmentSimulation> {
    const startMs = Date.now();
    await this.verifyPlan(planId, caseId, orgId);

    // Load prescriptions
    const prescRes = await this.db.query(
      `SELECT * FROM movement_prescriptions WHERE plan_id=$1 ORDER BY tooth_number`,
      [planId],
    );
    if (prescRes.rowCount === 0) throw new NotFoundException('No movement prescriptions found');

    // Load generation plan for stage count
    const genPlanRes = await this.db.query(
      `SELECT total_active_stages FROM aligner_generation_plans WHERE plan_id=$1`,
      [planId],
    );
    const totalStages = genPlanRes.rowCount && genPlanRes.rowCount > 0
      ? (genPlanRes.rows[0]['total_active_stages'] as number)
      : 20;

    const prescriptions = prescRes.rows;

    // Build final tooth positions from prescriptions
    const finalPositions = new Map<number, ToothPosition>();
    for (const p of prescriptions) {
      const fdi = p['tooth_number'] as number;
      finalPositions.set(fdi, {
        tx: ((p['translation_mesial_mm'] as number) - (p['translation_distal_mm'] as number)),
        ty: ((p['extrusion_mm'] as number) - (p['intrusion_mm'] as number)),
        tz: ((p['translation_buccal_mm'] as number) - (p['translation_lingual_mm'] as number)),
        rx: (p['rotation_deg'] as number),
        ry: (p['torque_deg'] as number),
        rz: ((p['tip_mesial_deg'] as number) - (p['tip_distal_deg'] as number)),
      });
    }

    // Compute overjet/overbite change from incisor movements
    const upperIncisorMovement = prescriptions
      .filter(p => [11,21].includes(p['tooth_number'] as number))
      .reduce((s, p) => s + (p['translation_distal_mm'] as number ?? 0), 0);
    const lowerIncisorMovement = prescriptions
      .filter(p => [31,41].includes(p['tooth_number'] as number))
      .reduce((s, p) => s + (p['translation_mesial_mm'] as number ?? 0), 0);

    const overjetInitial = OVERJET_NORMAL;
    const overjetFinal   = Math.max(0, OVERJET_NORMAL - upperIncisorMovement - lowerIncisorMovement * 0.5);
    const overbiteInitial = OVERBITE_NORMAL;
    const overbiteFinall  = Math.max(0, OVERBITE_NORMAL - prescriptions
      .filter(p => INCISORS.includes(p['tooth_number'] as number))
      .reduce((s, p) => s + (p['intrusion_mm'] as number ?? 0), 0) * 0.5);

    // Arch coordination: expansion prescriptions in upper vs lower
    const upperExpansion = prescriptions
      .filter(p => UPPER_FDI.includes(p['tooth_number'] as number))
      .reduce((s, p) => s + (p['expansion_mm'] as number ?? 0), 0);
    const lowerExpansion = prescriptions
      .filter(p => LOWER_FDI.includes(p['tooth_number'] as number))
      .reduce((s, p) => s + (p['expansion_mm'] as number ?? 0), 0);

    const archCoordScore = 1.0 - Math.min(Math.abs(upperExpansion - lowerExpansion) / 5.0, 1.0);

    // Occlusion score — based on overjet/overbite alignment
    const occlusionScore = Math.max(0, 1.0 - (Math.abs(overjetFinal - OVERJET_NORMAL) / 5.0 + Math.abs(overbiteFinall - OVERBITE_NORMAL) / 5.0));

    // Smile arc score — based on upper incisor vertical positions
    const smileArcScore = 0.85; // deterministic placeholder; real system uses 3D arc fitting

    // Delete old simulation frames
    const oldSim = await this.db.query(`SELECT id FROM treatment_simulations WHERE plan_id=$1`, [planId]);
    if (oldSim.rowCount && oldSim.rowCount > 0) {
      await this.db.query(`DELETE FROM simulation_frames WHERE simulation_id=$1`, [oldSim.rows[0]['id']]);
    }

    // Upsert simulation record
    const simRes = await this.db.query(
      `INSERT INTO treatment_simulations
         (plan_id, organization_id, total_frames, arch_coordination_score, occlusion_score,
          smile_arc_score, overjet_initial_mm, overjet_final_mm, overbite_initial_mm,
          overbite_final_mm, generation_duration_ms, generated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (plan_id) DO UPDATE SET
         total_frames=EXCLUDED.total_frames,
         arch_coordination_score=EXCLUDED.arch_coordination_score,
         occlusion_score=EXCLUDED.occlusion_score,
         smile_arc_score=EXCLUDED.smile_arc_score,
         overjet_initial_mm=EXCLUDED.overjet_initial_mm,
         overjet_final_mm=EXCLUDED.overjet_final_mm,
         overbite_initial_mm=EXCLUDED.overbite_initial_mm,
         overbite_final_mm=EXCLUDED.overbite_final_mm,
         generation_duration_ms=EXCLUDED.generation_duration_ms,
         generated_by=EXCLUDED.generated_by,
         generated_at=now()
       RETURNING *`,
      [
        planId, orgId, totalStages,
        parseFloat(archCoordScore.toFixed(3)),
        parseFloat(occlusionScore.toFixed(3)),
        parseFloat(smileArcScore.toFixed(3)),
        overjetInitial, parseFloat(overjetFinal.toFixed(3)),
        overbiteInitial, parseFloat(overbiteFinall.toFixed(3)),
        Date.now() - startMs,
        userId,
      ],
    );
    const simId = simRes.rows[0]['id'] as string;

    // Generate frames — store every stage (1 = initial, totalStages = final)
    // Keyframes: stage 1, 25%, 50%, 75%, final
    const keyframeStages = new Set([
      1,
      Math.round(totalStages * 0.25),
      Math.round(totalStages * 0.50),
      Math.round(totalStages * 0.75),
      totalStages,
    ]);

    for (let s = 1; s <= totalStages; s++) {
      const t = (s - 1) / Math.max(totalStages - 1, 1);
      const toothPositions: Record<number, ToothPosition> = {};

      for (const [fdi, final] of finalPositions) {
        toothPositions[fdi] = {
          tx: parseFloat(lerp(0, final.tx, t).toFixed(4)),
          ty: parseFloat(lerp(0, final.ty, t).toFixed(4)),
          tz: parseFloat(lerp(0, final.tz, t).toFixed(4)),
          rx: parseFloat(lerp(0, final.rx, t).toFixed(4)),
          ry: parseFloat(lerp(0, final.ry, t).toFixed(4)),
          rz: parseFloat(lerp(0, final.rz, t).toFixed(4)),
        };
      }

      const upperWidth = ARCH_WIDTH_UPPER + (upperExpansion * t);
      const lowerWidth = ARCH_WIDTH_LOWER + (lowerExpansion * t);
      const overbiteFrame = lerp(overbiteInitial, overbiteFinall, t);
      const overjetFrame  = lerp(overjetInitial, overjetFinal, t);

      // Midline deviation: from net mesialization of left vs right incisors
      const leftMesial  = prescriptions.filter(p => [12,22].includes(p['tooth_number'] as number)).reduce((s, p) => s + (p['mesialization_mm'] as number ?? 0), 0);
      const rightMesial = prescriptions.filter(p => [11,21].includes(p['tooth_number'] as number)).reduce((s, p) => s + (p['mesialization_mm'] as number ?? 0), 0);
      const midlineDev  = (leftMesial - rightMesial) * t;

      await this.db.query(
        `INSERT INTO simulation_frames
           (simulation_id, stage_num, tooth_positions, upper_arch_width_mm, lower_arch_width_mm,
            overbite_mm, overjet_mm, midline_deviation_mm, is_keyframe)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (simulation_id, stage_num) DO UPDATE SET
           tooth_positions=EXCLUDED.tooth_positions,
           upper_arch_width_mm=EXCLUDED.upper_arch_width_mm,
           lower_arch_width_mm=EXCLUDED.lower_arch_width_mm,
           overbite_mm=EXCLUDED.overbite_mm, overjet_mm=EXCLUDED.overjet_mm,
           midline_deviation_mm=EXCLUDED.midline_deviation_mm,
           is_keyframe=EXCLUDED.is_keyframe`,
        [
          simId, s,
          JSON.stringify(toothPositions),
          parseFloat(upperWidth.toFixed(2)),
          parseFloat(lowerWidth.toFixed(2)),
          parseFloat(overbiteFrame.toFixed(3)),
          parseFloat(overjetFrame.toFixed(3)),
          parseFloat(midlineDev.toFixed(3)),
          keyframeStages.has(s),
        ],
      );
    }

    const durationMs = Date.now() - startMs;
    await this.db.query(
      `UPDATE treatment_simulations SET generation_duration_ms=$1 WHERE id=$2`,
      [durationMs, simId],
    );

    this.log.log(`Phase 30 simulation: plan ${planId} — ${totalStages} frames in ${durationMs}ms`);
    return this.rowToSim(simRes.rows[0]);
  }

  async getSimulation(caseId: string, orgId: string, planId: string): Promise<TreatmentSimulation> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM treatment_simulations WHERE plan_id=$1`, [planId],
    );
    if (res.rowCount === 0) throw new NotFoundException('No simulation found — run /generate first');
    return this.rowToSim(res.rows[0]);
  }

  async getFrame(
    caseId: string,
    orgId: string,
    planId: string,
    stageNum: number,
  ): Promise<SimulationFrame> {
    await this.verifyPlan(planId, caseId, orgId);
    const simRes = await this.db.query(
      `SELECT id FROM treatment_simulations WHERE plan_id=$1`, [planId],
    );
    if (simRes.rowCount === 0) throw new NotFoundException('No simulation found');
    const simId = simRes.rows[0]['id'] as string;

    // Find exact stage or nearest available
    const res = await this.db.query(
      `SELECT * FROM simulation_frames
       WHERE simulation_id=$1
       ORDER BY ABS(stage_num - $2) LIMIT 1`,
      [simId, stageNum],
    );
    if (res.rowCount === 0) throw new NotFoundException('Frame not found');
    const r = res.rows[0];

    return {
      stageNum:           r['stage_num'] as number,
      toothPositions:     r['tooth_positions'] as Record<number, ToothPosition>,
      upperArchWidthMm:   r['upper_arch_width_mm'] as number | null,
      lowerArchWidthMm:   r['lower_arch_width_mm'] as number | null,
      overbiteM:          r['overbite_mm'] as number | null,
      overjetMm:          r['overjet_mm'] as number | null,
      midlineDeviationMm: r['midline_deviation_mm'] as number | null,
      isKeyframe:         r['is_keyframe'] as boolean,
    };
  }

  async getArchCoordination(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<{
    score: number;
    upperExpansionMm: number;
    lowerExpansionMm: number;
    imbalanceMm: number;
    recommendation: string;
  }> {
    await this.verifyPlan(planId, caseId, orgId);
    const sim = await this.getSimulation(caseId, orgId, planId);
    const prescRes = await this.db.query(
      `SELECT tooth_number, expansion_mm FROM movement_prescriptions WHERE plan_id=$1`,
      [planId],
    );
    const prescriptions = prescRes.rows;

    const upperExp = prescriptions
      .filter(p => UPPER_FDI.includes(p['tooth_number'] as number))
      .reduce((s, p) => s + (p['expansion_mm'] as number ?? 0), 0);
    const lowerExp = prescriptions
      .filter(p => LOWER_FDI.includes(p['tooth_number'] as number))
      .reduce((s, p) => s + (p['expansion_mm'] as number ?? 0), 0);

    const imbalance = Math.abs(upperExp - lowerExp);
    const recommendation = imbalance < 1.0
      ? 'Arch widths are well coordinated — no adjustment needed'
      : imbalance < 2.5
      ? 'Minor arch width discrepancy — consider differential expansion of 0.5–1.0mm'
      : 'Significant arch width imbalance — staged coordinated expansion recommended';

    return {
      score:            sim.archCoordinationScore ?? 0,
      upperExpansionMm: parseFloat(upperExp.toFixed(3)),
      lowerExpansionMm: parseFloat(lowerExp.toFixed(3)),
      imbalanceMm:      parseFloat(imbalance.toFixed(3)),
      recommendation,
    };
  }

  private rowToSim(r: Record<string, unknown>): TreatmentSimulation {
    return {
      id:                     r['id'] as string,
      planId:                 r['plan_id'] as string,
      totalFrames:            r['total_frames'] as number,
      archCoordinationScore:  r['arch_coordination_score'] as number | null,
      occlusionScore:         r['occlusion_score'] as number | null,
      smileArcScore:          r['smile_arc_score'] as number | null,
      overjetInitialMm:       r['overjet_initial_mm'] as number | null,
      overjetFinalMm:         r['overjet_final_mm'] as number | null,
      overbiteInitialMm:      r['overbite_initial_mm'] as number | null,
      overbiteFinalmm:        r['overbite_final_mm'] as number | null,
      generationDurationMs:   r['generation_duration_ms'] as number | null,
      generatedAt:            r['generated_at'] as string,
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
