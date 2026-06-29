import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Enamel thickness estimates (Sheridan 1985, Ballard 1944) ────────────────
// mm per mesial/distal surface; sum of both contacts = available IPR

const ENAMEL_BY_TYPE: Record<string, number> = {
  incisor:  1.8,
  canine:   2.2,
  premolar: 2.8,
  molar:    3.2,
};

function toothType(fdi: number): string {
  const n = fdi % 10;
  if (n === 1 || n === 2) return 'incisor';
  if (n === 3) return 'canine';
  if (n === 4 || n === 5) return 'premolar';
  return 'molar';
}

function enamelThickness(fdi: number): number {
  return ENAMEL_BY_TYPE[toothType(fdi)] ?? 2.0;
}

// Sheridan safety: 0.5mm minimum remaining enamel per surface
const MIN_REMAINING_MM = 0.5;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IprEnamelEstimate {
  fdiA: number;
  fdiB: number;
  enamelAMm: number;
  enamelBMm: number;
  availableIprMm: number;
  recommendedIprMm: number;
  remainingEnamelMm: number;
  isSafe: boolean;
  warning: string | null;
}

export interface IprClinicalWarning {
  fdiA: number;
  fdiB: number;
  warningType: 'enamel_thin' | 'near_pulp' | 'excessive_removal' | 'root_proximity' | 'restoration_present';
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface IprOptimizationResult {
  totalIprMm: number;
  pairsOptimized: number;
  enamelSafetyPassed: boolean;
  clinicalWarningCount: number;
  optimizedItems: Array<{
    fdiA: number;
    fdiB: number;
    originalMm: number;
    optimizedMm: number;
    reason: string;
  }>;
}

// Adjacent contact pairs eligible for IPR
const IPR_PAIRS: [number, number][] = [
  [11,12],[12,13],[13,14],[14,15],[15,16],
  [21,22],[22,23],[23,24],[24,25],[25,26],
  [31,32],[32,33],[33,34],[34,35],[35,36],
  [41,42],[42,43],[43,44],[44,45],[45,46],
];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class IprIntelligenceService {
  private readonly log = new Logger(IprIntelligenceService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async optimizeIpr(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
  ): Promise<IprOptimizationResult> {
    await this.verifyPlan(planId, caseId, orgId);

    // Load existing IPR plan items
    const iprRes = await this.db.query(
      `SELECT * FROM ipr_plan_items WHERE treatment_plan_id=$1`,
      [planId],
    );

    // Load movement prescriptions for context
    const prescRes = await this.db.query(
      `SELECT tooth_number, mesialization_mm, distalization_mm FROM movement_prescriptions WHERE plan_id=$1`,
      [planId],
    );
    const prescByFdi = new Map(prescRes.rows.map(r => [
      r['tooth_number'] as number,
      { mesial: r['mesialization_mm'] as number, distal: r['distalization_mm'] as number },
    ]));

    const optimizedItems: IprOptimizationResult['optimizedItems'] = [];
    let totalIpr = 0;
    let safetyPassed = true;
    const enamelEstimates: IprEnamelEstimate[] = [];

    for (const [a, b] of IPR_PAIRS) {
      const enamelA = enamelThickness(a);
      const enamelB = enamelThickness(b);
      const available = (enamelA - MIN_REMAINING_MM) + (enamelB - MIN_REMAINING_MM);
      const maxSafe = Math.min(available, 0.5); // clinical maximum per contact session

      // Demand from prescriptions: mesialization of A + distalization of B creates crowding
      const prescA = prescByFdi.get(a);
      const prescB = prescByFdi.get(b);
      const demand = ((prescA?.mesial ?? 0) * 0.6) + ((prescB?.distal ?? 0) * 0.6);

      // Also check existing IPR items
      const existingItem = iprRes.rows.find(r =>
        (r['tooth_fdi_a'] === a && r['tooth_fdi_b'] === b) ||
        (r['tooth_fdi_a'] === b && r['tooth_fdi_b'] === a),
      );
      const originalMm = (existingItem?.['amount_mm'] as number) ?? demand;
      const optimizedMm = Math.min(originalMm, maxSafe);

      if (optimizedMm !== originalMm && originalMm > 0) {
        optimizedItems.push({
          fdiA: a, fdiB: b,
          originalMm: parseFloat(originalMm.toFixed(3)),
          optimizedMm: parseFloat(optimizedMm.toFixed(3)),
          reason: optimizedMm < originalMm
            ? `Reduced to preserve minimum ${MIN_REMAINING_MM}mm enamel (available: ${available.toFixed(2)}mm)`
            : 'Within safe limits',
        });
      }

      if (optimizedMm > 0) {
        const remainingEnamel = ((enamelA + enamelB) - optimizedMm) / 2;
        const isSafe = remainingEnamel >= MIN_REMAINING_MM;
        if (!isSafe) safetyPassed = false;

        enamelEstimates.push({
          fdiA: a, fdiB: b,
          enamelAMm: enamelA, enamelBMm: enamelB,
          availableIprMm: parseFloat(available.toFixed(3)),
          recommendedIprMm: parseFloat(optimizedMm.toFixed(3)),
          remainingEnamelMm: parseFloat(remainingEnamel.toFixed(3)),
          isSafe,
          warning: !isSafe ? `Remaining enamel ${remainingEnamel.toFixed(2)}mm below ${MIN_REMAINING_MM}mm threshold` : null,
        });

        totalIpr += optimizedMm;
      }
    }

    // Persist enamel estimates
    for (const est of enamelEstimates) {
      await this.db.query(
        `INSERT INTO ipr_enamel_estimates
           (plan_id, fdi_a, fdi_b, enamel_a_mm, enamel_b_mm,
            available_ipr_mm, recommended_ipr_mm, remaining_enamel_mm, is_safe, warning)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (plan_id, fdi_a, fdi_b) DO UPDATE SET
           enamel_a_mm=EXCLUDED.enamel_a_mm, enamel_b_mm=EXCLUDED.enamel_b_mm,
           available_ipr_mm=EXCLUDED.available_ipr_mm, recommended_ipr_mm=EXCLUDED.recommended_ipr_mm,
           remaining_enamel_mm=EXCLUDED.remaining_enamel_mm, is_safe=EXCLUDED.is_safe,
           warning=EXCLUDED.warning`,
        [
          planId, est.fdiA, est.fdiB,
          est.enamelAMm, est.enamelBMm,
          est.availableIprMm, est.recommendedIprMm,
          est.remainingEnamelMm, est.isSafe, est.warning,
        ],
      );
    }

    const warnings = this.generateClinicalWarnings(enamelEstimates);

    // Persist optimization result
    await this.db.query(
      `INSERT INTO ipr_optimization_results
         (plan_id, total_ipr_mm, pairs_optimized, enamel_safety_passed,
          clinical_warning_count, optimized_items, optimized_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (plan_id) DO UPDATE SET
         total_ipr_mm=EXCLUDED.total_ipr_mm, pairs_optimized=EXCLUDED.pairs_optimized,
         enamel_safety_passed=EXCLUDED.enamel_safety_passed,
         clinical_warning_count=EXCLUDED.clinical_warning_count,
         optimized_items=EXCLUDED.optimized_items,
         optimized_by=EXCLUDED.optimized_by, optimized_at=now()`,
      [
        planId,
        parseFloat(totalIpr.toFixed(3)),
        enamelEstimates.length,
        safetyPassed,
        warnings.length,
        JSON.stringify(optimizedItems),
        userId,
      ],
    );

    this.log.log(`Phase 29 IPR optimize: plan ${planId} — ${enamelEstimates.length} pairs, ${totalIpr.toFixed(2)}mm total`);

    return {
      totalIprMm:           parseFloat(totalIpr.toFixed(3)),
      pairsOptimized:       enamelEstimates.length,
      enamelSafetyPassed:   safetyPassed,
      clinicalWarningCount: warnings.length,
      optimizedItems,
    };
  }

  async getEnamelAnalysis(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<IprEnamelEstimate[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM ipr_enamel_estimates WHERE plan_id=$1 ORDER BY fdi_a`,
      [planId],
    );
    return res.rows.map(r => ({
      fdiA:               r['fdi_a'] as number,
      fdiB:               r['fdi_b'] as number,
      enamelAMm:          r['enamel_a_mm'] as number,
      enamelBMm:          r['enamel_b_mm'] as number,
      availableIprMm:     r['available_ipr_mm'] as number,
      recommendedIprMm:   r['recommended_ipr_mm'] as number,
      remainingEnamelMm:  r['remaining_enamel_mm'] as number,
      isSafe:             r['is_safe'] as boolean,
      warning:            r['warning'] as string | null,
    }));
  }

  async getClinicalWarnings(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<IprClinicalWarning[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const estimates = await this.getEnamelAnalysis(caseId, orgId, planId);
    return this.generateClinicalWarnings(estimates);
  }

  private generateClinicalWarnings(estimates: IprEnamelEstimate[]): IprClinicalWarning[] {
    const warnings: IprClinicalWarning[] = [];
    for (const est of estimates) {
      if (!est.isSafe) {
        warnings.push({
          fdiA: est.fdiA, fdiB: est.fdiB,
          warningType: 'enamel_thin',
          message: `FDI ${est.fdiA}–${est.fdiB}: remaining enamel ${est.remainingEnamelMm.toFixed(2)}mm — below Sheridan 0.5mm minimum.`,
          severity: 'critical',
        });
      }
      if (est.recommendedIprMm > 0.8) {
        warnings.push({
          fdiA: est.fdiA, fdiB: est.fdiB,
          warningType: 'excessive_removal',
          message: `FDI ${est.fdiA}–${est.fdiB}: ${est.recommendedIprMm.toFixed(2)}mm IPR recommended — consider splitting over multiple visits.`,
          severity: 'warning',
        });
      }
      if (est.enamelAMm < 1.5 || est.enamelBMm < 1.5) {
        warnings.push({
          fdiA: est.fdiA, fdiB: est.fdiB,
          warningType: 'near_pulp',
          message: `FDI ${est.fdiA}–${est.fdiB}: thin enamel estimated — confirm radiographically before IPR.`,
          severity: 'warning',
        });
      }
    }
    return warnings;
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
