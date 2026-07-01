import { Injectable } from '@nestjs/common';

// FDI tooth groups for Bolton analysis (Proffit 2018)
const MAXILLARY_ANTERIOR = [13, 12, 11, 21, 22, 23] as const;
const MANDIBULAR_ANTERIOR = [43, 42, 41, 31, 32, 33] as const;
const MAXILLARY_ALL = [16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26] as const;
const MANDIBULAR_ALL = [46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36] as const;

// Reference norms (Proffit 2018)
export const BOLTON_NORMS = {
  anteriorRatio: 77.2,
  anteriorSd: 1.65,
  overallRatio: 91.3,
  overallSd: 1.91,
} as const;

export type BoltonInterpretation =
  | 'within_normal'
  | 'mandibular_excess'
  | 'maxillary_excess'
  | 'insufficient_data';

export interface BoltonInput {
  /** FDI tooth number → mesiodistal width in mm, e.g. { "11": 8.5, "21": 8.4 } */
  toothMeasurements: Record<string, number>;
}

export interface BoltonResult {
  anteriorRatio: number | null;
  overallRatio: number | null;
  anteriorDiscrepancyMm: number | null;
  overallDiscrepancyMm: number | null;
  anteriorInterpretation: BoltonInterpretation;
  overallInterpretation: BoltonInterpretation;
  missingTeeth: string[];
  clinicalGuidance: string[];
  normAnteriorRatio: number;
  normOverallRatio: number;
}

@Injectable()
export class BoltonService {
  /**
   * Compute Bolton anterior and overall tooth-size ratios from mesiodistal widths.
   *
   * Both ratios require complete measurements for their respective tooth groups.
   * If any width is missing or zero the corresponding ratio is null and the
   * missing FDI numbers are listed in ``missingTeeth``.
   *
   * Reference: Proffit WR, Fields HW, Sarver DM. Contemporary Orthodontics, 6th ed. 2018.
   */
  compute(input: BoltonInput): BoltonResult {
    const m = input.toothMeasurements;
    const allMissing: string[] = [];

    const sumGroup = (
      fdiList: readonly number[],
    ): { sum: number | null; missing: string[] } => {
      const missing: string[] = [];
      let sum = 0;
      for (const fdi of fdiList) {
        const key = String(fdi);
        const w = m[key];
        if (typeof w !== 'number' || w <= 0) {
          missing.push(key);
        } else {
          sum += w;
        }
      }
      if (missing.length > 0) {
        return { sum: null, missing };
      }
      return { sum, missing: [] };
    };

    // ── Anterior ratio ────────────────────────────────────────────────────────
    const maxAnt = sumGroup(MAXILLARY_ANTERIOR);
    const mandAnt = sumGroup(MANDIBULAR_ANTERIOR);

    allMissing.push(...maxAnt.missing, ...mandAnt.missing);

    let anteriorRatio: number | null = null;
    let anteriorDiscMm: number | null = null;
    let anteriorInterp: BoltonInterpretation = 'insufficient_data';

    if (maxAnt.sum !== null && mandAnt.sum !== null && maxAnt.sum > 0) {
      anteriorRatio = parseFloat(((mandAnt.sum / maxAnt.sum) * 100).toFixed(2));
      anteriorDiscMm = parseFloat(
        (mandAnt.sum - maxAnt.sum * (BOLTON_NORMS.anteriorRatio / 100)).toFixed(2),
      );
      if (anteriorRatio > BOLTON_NORMS.anteriorRatio + BOLTON_NORMS.anteriorSd) {
        anteriorInterp = 'mandibular_excess';
      } else if (anteriorRatio < BOLTON_NORMS.anteriorRatio - BOLTON_NORMS.anteriorSd) {
        anteriorInterp = 'maxillary_excess';
      } else {
        anteriorInterp = 'within_normal';
      }
    }

    // ── Overall ratio ─────────────────────────────────────────────────────────
    const maxAll = sumGroup(MAXILLARY_ALL);
    const mandAll = sumGroup(MANDIBULAR_ALL);

    allMissing.push(...maxAll.missing, ...mandAll.missing);

    let overallRatio: number | null = null;
    let overallDiscMm: number | null = null;
    let overallInterp: BoltonInterpretation = 'insufficient_data';

    if (maxAll.sum !== null && mandAll.sum !== null && maxAll.sum > 0) {
      overallRatio = parseFloat(((mandAll.sum / maxAll.sum) * 100).toFixed(2));
      overallDiscMm = parseFloat(
        (mandAll.sum - maxAll.sum * (BOLTON_NORMS.overallRatio / 100)).toFixed(2),
      );
      if (overallRatio > BOLTON_NORMS.overallRatio + BOLTON_NORMS.overallSd) {
        overallInterp = 'mandibular_excess';
      } else if (overallRatio < BOLTON_NORMS.overallRatio - BOLTON_NORMS.overallSd) {
        overallInterp = 'maxillary_excess';
      } else {
        overallInterp = 'within_normal';
      }
    }

    // ── Clinical guidance ─────────────────────────────────────────────────────
    const guidance: string[] = [];

    if (anteriorInterp === 'mandibular_excess' && anteriorDiscMm !== null) {
      guidance.push(
        `Anterior Bolton discrepancy: ${anteriorDiscMm.toFixed(2)} mm mandibular excess. ` +
          `Consider IPR on mandibular anteriors, or accept residual spacing after treatment.`,
      );
    } else if (anteriorInterp === 'maxillary_excess' && anteriorDiscMm !== null) {
      guidance.push(
        `Anterior Bolton discrepancy: ${Math.abs(anteriorDiscMm).toFixed(2)} mm maxillary excess. ` +
          `Consider IPR on maxillary anteriors, or expect mandibular spacing.`,
      );
    }

    if (overallInterp === 'mandibular_excess' && overallDiscMm !== null) {
      guidance.push(
        `Overall Bolton discrepancy: ${overallDiscMm.toFixed(2)} mm mandibular excess. ` +
          `Review posterior occlusion — residual spaces or Class I compromise may result.`,
      );
    } else if (overallInterp === 'maxillary_excess' && overallDiscMm !== null) {
      guidance.push(
        `Overall Bolton discrepancy: ${Math.abs(overallDiscMm).toFixed(2)} mm maxillary excess. ` +
          `Review posterior occlusion.`,
      );
    }

    if (anteriorInterp === 'within_normal' && overallInterp === 'within_normal') {
      guidance.push(
        'Tooth sizes are proportional (within 1 SD of Bolton norms). ' +
          'No discrepancy correction required.',
      );
    }

    if (anteriorInterp === 'insufficient_data' || overallInterp === 'insufficient_data') {
      guidance.push(
        'Incomplete tooth measurements — Bolton analysis requires mesiodistal widths for ' +
          'all teeth in both arches (FDI 13–23 and 33–43 for anterior; 16–26 and 36–46 for overall).',
      );
    }

    return {
      anteriorRatio,
      overallRatio,
      anteriorDiscrepancyMm: anteriorDiscMm,
      overallDiscrepancyMm: overallDiscMm,
      anteriorInterpretation: anteriorInterp,
      overallInterpretation: overallInterp,
      missingTeeth: [...new Set(allMissing)],
      clinicalGuidance: guidance,
      normAnteriorRatio: BOLTON_NORMS.anteriorRatio,
      normOverallRatio: BOLTON_NORMS.overallRatio,
    };
  }
}
