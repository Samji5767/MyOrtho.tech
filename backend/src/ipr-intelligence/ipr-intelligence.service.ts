import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Enamel thickness estimates (Sheridan 1985, Ballard 1944) ────────────────
// Legacy per-type averages — kept for backward compatibility with existing code.
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

/** Legacy single-value lookup — used by the optimizeIpr loop (backward-compatible). */
function enamelThickness(fdi: number): number {
  return ENAMEL_BY_TYPE[toothType(fdi)] ?? 2.0;
}

// ─── Enhanced enamel thickness (Sheridan 1985 / Ballard 1944) ────────────────
// Per surface (mesial / distal) and per arch (upper / lower).
// Key observations:
//   - Mesial surfaces are consistently thicker than distal surfaces
//   - Maxillary teeth have greater enamel thickness than mandibular homologues
//   - Safety reserve: ≥0.5 mm must remain post-IPR (Sheridan safety limit)

interface EnamelProfile {
  mesialUpper: number;
  distalUpper: number;
  mesialLower: number;
  distalLower: number;
}

const ENAMEL_PROFILE_BY_POSITION: Record<number, EnamelProfile> = {
  1: { mesialUpper: 1.0, distalUpper: 0.9, mesialLower: 0.8, distalLower: 0.7 }, // central incisor
  2: { mesialUpper: 0.9, distalUpper: 0.8, mesialLower: 0.7, distalLower: 0.6 }, // lateral incisor
  3: { mesialUpper: 1.2, distalUpper: 1.1, mesialLower: 1.0, distalLower: 0.9 }, // canine
  4: { mesialUpper: 1.5, distalUpper: 1.4, mesialLower: 1.3, distalLower: 1.2 }, // first premolar
  5: { mesialUpper: 1.6, distalUpper: 1.5, mesialLower: 1.4, distalLower: 1.3 }, // second premolar
  6: { mesialUpper: 1.8, distalUpper: 1.7, mesialLower: 1.6, distalLower: 1.5 }, // first molar
  7: { mesialUpper: 1.8, distalUpper: 1.7, mesialLower: 1.6, distalLower: 1.5 }, // second molar
  8: { mesialUpper: 1.5, distalUpper: 1.4, mesialLower: 1.3, distalLower: 1.2 }, // third molar
};

/**
 * Enhanced enamel thickness estimate (Sheridan 1985 / Ballard 1944).
 *
 * @param fdi      FDI tooth number.
 * @param surface  'mesial' or 'distal' — mesial is thicker.
 * @param arch     'upper' or 'lower' — upper is thicker.
 * @returns Estimated enamel thickness in mm for the specified surface.
 */
function estimateEnamelThickness(
  fdi: number,
  surface: 'mesial' | 'distal' = 'mesial',
  arch: 'upper' | 'lower' = 'upper',
): number {
  const pos = fdi % 10;
  const profile = ENAMEL_PROFILE_BY_POSITION[pos];
  if (!profile) return enamelThickness(fdi); // fall back to legacy value
  if (surface === 'mesial' && arch === 'upper') return profile.mesialUpper;
  if (surface === 'distal' && arch === 'upper') return profile.distalUpper;
  if (surface === 'mesial' && arch === 'lower') return profile.mesialLower;
  return profile.distalLower;
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

// ─── Additional interfaces ────────────────────────────────────────────────────

/** A single interproximal reduction item from the treatment plan. */
export interface IprItem {
  fdiA: number;
  fdiB: number;
  amountMm: number;
  stageNumber?: number;
}

/** Input measurements for arch-length discrepancy analysis. */
export interface ArchMeasurement {
  /** FDI numbers of the teeth to include in the analysis. */
  fdiList: number[];
  /** Measured or estimated mesiodistal crown widths (mm) keyed by FDI. */
  toothWidthsMm: Record<number, number>;
  /** Available arch perimeter (mm) — measured along the dental arch. */
  archPerimeterMm: number;
  /** Which arch is being measured. */
  archType: 'upper' | 'lower';
}

export interface ArchLengthDiscrepancy {
  /** Sum of all mesiodistal crown widths in the measurement set (mm). */
  toothSizeSumMm: number;
  /** Measured arch perimeter (mm). */
  archPerimeterMm: number;
  /** Positive = crowding; negative = spacing (mm). */
  discrepancyMm: number;
  /**
   * Anterior Bolton discrepancy (Bolton 1958) — deviation from 77.2 % norm.
   * Null if anterior tooth widths for both arches are not available.
   */
  boltonDiscrepancy: number | null;
  /** True when arch perimeter can accommodate all tooth sizes without IPR. */
  spaceSufficientForMovements: boolean;
  recommendation: string;
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

  // ── Arch-length discrepancy analysis (Bolton 1958) ────────────────────────

  /**
   * Calculates the arch-length discrepancy and Bolton anterior ratio discrepancy.
   *
   * Bolton (1958) anterior norm: sumLower6 / sumUpper6 × 100 = 77.2 %
   * A positive Bolton discrepancy means lower teeth are relatively larger.
   */
  calculateArchLengthDiscrepancy(measurements: ArchMeasurement): ArchLengthDiscrepancy {
    const toothSizeSum = measurements.fdiList.reduce(
      (sum, fdi) => sum + (measurements.toothWidthsMm[fdi] ?? 0),
      0,
    );
    const discrepancyMm = toothSizeSum - measurements.archPerimeterMm;

    // Bolton anterior ratio — requires width data for upper and lower anteriors
    const upperAnteriorFdi = [11, 12, 13, 21, 22, 23];
    const lowerAnteriorFdi = [31, 32, 33, 41, 42, 43];
    const hasUpperAnterior = upperAnteriorFdi.every((f) => measurements.toothWidthsMm[f] != null);
    const hasLowerAnterior = lowerAnteriorFdi.every((f) => measurements.toothWidthsMm[f] != null);

    let boltonDiscrepancy: number | null = null;
    if (hasUpperAnterior && hasLowerAnterior) {
      const sumUpper = upperAnteriorFdi.reduce((s, f) => s + (measurements.toothWidthsMm[f] ?? 0), 0);
      const sumLower = lowerAnteriorFdi.reduce((s, f) => s + (measurements.toothWidthsMm[f] ?? 0), 0);
      if (sumUpper > 0) {
        const boltonRatio = (sumLower / sumUpper) * 100;
        boltonDiscrepancy = parseFloat((boltonRatio - 77.2).toFixed(2)); // deviation from norm
      }
    }

    const spaceSufficient = discrepancyMm <= 0;

    let recommendation: string;
    if (discrepancyMm <= 0) {
      recommendation =
        `Arch has ${Math.abs(discrepancyMm).toFixed(1)}mm excess space — ` +
        `no IPR required for space creation; spacing closure planned instead.`;
    } else if (discrepancyMm <= 3.0) {
      recommendation =
        `Mild crowding ${discrepancyMm.toFixed(1)}mm — ` +
        `IPR can resolve without extraction (total ≤ ${discrepancyMm.toFixed(1)}mm across contacts).`;
    } else if (discrepancyMm <= 6.0) {
      recommendation =
        `Moderate crowding ${discrepancyMm.toFixed(1)}mm — ` +
        `IPR (2–4mm total) combined with arch expansion and proclination may resolve.`;
    } else {
      recommendation =
        `Severe crowding ${discrepancyMm.toFixed(1)}mm — ` +
        `extraction or TAD-supported treatment likely required; IPR alone insufficient.`;
    }

    if (boltonDiscrepancy != null && Math.abs(boltonDiscrepancy) > 2.0) {
      recommendation +=
        ` Bolton discrepancy ${boltonDiscrepancy > 0 ? '+' : ''}${boltonDiscrepancy.toFixed(1)}% — ` +
        (boltonDiscrepancy > 0
          ? 'lower arch is relatively larger; upper IPR may be needed for ideal intercuspation.'
          : 'upper arch is relatively larger; lower IPR may improve occlusal interdigitation.');
    }

    return {
      toothSizeSumMm:             parseFloat(toothSizeSum.toFixed(2)),
      archPerimeterMm:            measurements.archPerimeterMm,
      discrepancyMm:              parseFloat(discrepancyMm.toFixed(2)),
      boltonDiscrepancy,
      spaceSufficientForMovements: spaceSufficient,
      recommendation,
    };
  }

  // ── IPR clinical justification ─────────────────────────────────────────────

  /**
   * Generates a structured clinical justification for a single IPR item.
   * References enamel thickness data (Sheridan 1985 / Ballard 1944) and
   * flags safety warnings when the planned removal approaches the safe limit.
   *
   * @param iprItem  The interproximal reduction item to justify.
   */
  generateIprClinicalJustification(iprItem: IprItem): string {
    const { fdiA, fdiB, amountMm } = iprItem;
    const archA = this.archForFdi(fdiA);
    const archB = this.archForFdi(fdiB);

    const enamelA = estimateEnamelThickness(fdiA, 'distal',  archA);
    const enamelB = estimateEnamelThickness(fdiB, 'mesial',  archB);
    const maxSafeA = enamelA - MIN_REMAINING_MM;
    const maxSafeB = enamelB - MIN_REMAINING_MM;
    const maxSafe  = parseFloat((maxSafeA + maxSafeB).toFixed(2));

    const lines: string[] = [];
    lines.push(
      `IPR at contact ${fdiA}–${fdiB}: ${amountMm.toFixed(2)}mm planned reduction.`,
    );
    lines.push(
      `Enamel thickness estimate (Sheridan 1985/Ballard 1944): ` +
      `tooth ${fdiA} distal surface ≈${enamelA.toFixed(1)}mm (${archA}), ` +
      `tooth ${fdiB} mesial surface ≈${enamelB.toFixed(1)}mm (${archB}).`,
    );
    lines.push(
      `Maximum safe removal per Sheridan tables: ${maxSafe.toFixed(2)}mm ` +
      `(preserving ≥${MIN_REMAINING_MM}mm enamel per surface).`,
    );

    if (amountMm > maxSafe) {
      lines.push(
        `SAFETY WARNING: planned ${amountMm.toFixed(2)}mm exceeds safe maximum ` +
        `${maxSafe.toFixed(2)}mm by ${(amountMm - maxSafe).toFixed(2)}mm. ` +
        `Reduce to ≤${maxSafe.toFixed(2)}mm or confirm actual enamel thickness ` +
        `radiographically before proceeding.`,
      );
    } else {
      const reserve     = parseFloat((maxSafe - amountMm).toFixed(2));
      const percentUsed = parseFloat(((amountMm / maxSafe) * 100).toFixed(0));
      lines.push(
        `Safety reserve: ${reserve}mm remaining capacity ` +
        `(${percentUsed}% of safe maximum used).`,
      );
    }

    if (iprItem.stageNumber != null) {
      lines.push(`Scheduled at stage ${iprItem.stageNumber}.`);
    }

    lines.push('[AI-assisted recommendation only — clinician verification required before IPR.]');
    return lines.join('\n');
  }

  /** Returns 'upper' or 'lower' arch for a given FDI number. */
  private archForFdi(fdi: number): 'upper' | 'lower' {
    return Math.floor(fdi / 10) <= 2 ? 'upper' : 'lower';
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
