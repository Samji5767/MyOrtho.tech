import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ClinicalAnalysis {
  id: string;
  organization_id: string;
  case_id: string | null;
  stl_upload_id: string | null;
  bolton_anterior_ratio: number;
  bolton_overall_ratio: number;
  bolton_discrepancy_mm: number;
  arch_length_upper_mm: number | null;
  arch_length_lower_mm: number | null;
  arch_length_discrepancy_mm: number | null;
  crowding_upper_mm: number | null;
  crowding_lower_mm: number | null;
  spacing_upper_mm: number | null;
  spacing_lower_mm: number | null;
  overjet_mm: number | null;
  overbite_mm: number | null;
  overbite_percent: number | null;
  curve_of_spee_mm: number | null;
  midline_deviation_mm: number | null;
  midline_direction: string | null;
  angle_class: string | null;
  canine_relationship_right: string | null;
  canine_relationship_left: string | null;
  molar_relationship_right: string | null;
  molar_relationship_left: string | null;
  upper_arch_width_mm: number | null;
  lower_arch_width_mm: number | null;
  transverse_discrepancy_mm: number | null;
  occlusal_contacts: Record<string, unknown>;
  measurement_source: Record<string, string>;
  diagnostic_summary: string;
  confidence: number;
  created_at: string;
}

export interface GenerateAnalysisDto {
  caseId: string;
  uploadId?: string;
  /** Tooth widths in mm by FDI string key */
  toothWidths?: Record<string, number>;
  archLengthUpper?: number;
  archLengthLower?: number;
  crowdingUpper?: number;
  crowdingLower?: number;
  overjetMm?: number;
  overbite?: number;
  /**
   * Clinician-entered Angle classification.
   * Accepted values: 'Class I', 'Class II Division 1', 'Class II Division 2', 'Class III'
   */
  angleClass?: string;
  /** Midline deviation in mm — positive = left, negative = right */
  midlineDeviationMm?: number;
  /** Curve of Spee depth in mm (measured by clinician) */
  curveOfSpeeMm?: number;
  /** Upper inter-molar width in mm */
  upperArchWidthMm?: number;
  /** Lower inter-molar width in mm */
  lowerArchWidthMm?: number;
}

// ─── Bolton Norm Constants ─────────────────────────────────────────────────
// Bolton 1958: Disharmony in Tooth Size and Its Relation to the Analysis and Treatment of Malocclusion
const BOLTON_OVERALL_NORM = 91.3;   // ± 1.91 SD
const BOLTON_OVERALL_SD   = 1.91;
const BOLTON_ANTERIOR_NORM = 77.2;  // ± 1.65 SD
const BOLTON_ANTERIOR_SD   = 1.65;

// Standard tooth widths (mesio-distal) used as fallback when not measured (mm)
// Source: Moyers 1988 mixed dentition analysis tables (50th percentile)
const DEFAULT_UPPER_WIDTHS: Record<string, number> = {
  '11': 8.7, '12': 7.0, '13': 8.0, '14': 7.2, '15': 6.8, '16': 10.5, '17': 9.8, '18': 8.5,
  '21': 8.7, '22': 7.0, '23': 8.0, '24': 7.2, '25': 6.8, '26': 10.5, '27': 9.8, '28': 8.5,
};
const DEFAULT_LOWER_WIDTHS: Record<string, number> = {
  '31': 5.5, '32': 6.0, '33': 7.0, '34': 7.2, '35': 7.4, '36': 11.2, '37': 10.5, '38': 9.0,
  '41': 5.5, '42': 6.0, '43': 7.0, '44': 7.2, '45': 7.4, '46': 11.2, '47': 10.5, '48': 9.0,
};

/** Merge provided tooth widths over defaults */
function resolveWidths(
  provided: Record<string, number> | undefined,
  defaults: Record<string, number>,
): Record<string, number> {
  return { ...defaults, ...(provided ?? {}) };
}

/**
 * Bolton Overall Ratio:
 *   (sum of 12 mandibular widths / sum of 12 maxillary widths) × 100
 * Teeth included: all 12 from canine-to-canine and premolars and first molars
 * Strictly: FDI 13-23 upper (12 teeth) vs 33-43 lower (12 teeth)
 */
function computeBoltonOverall(
  upper: Record<string, number>,
  lower: Record<string, number>,
): { ratio: number; sumUpper12: number; sumLower12: number } {
  const upperKeys = ['13','12','11','21','22','23','14','15','24','25','16','26'];
  const lowerKeys = ['43','42','41','31','32','33','44','45','34','35','46','36'];

  const sumUpper12 = upperKeys.reduce((s, k) => s + (upper[k] ?? DEFAULT_UPPER_WIDTHS[k] ?? 0), 0);
  const sumLower12 = lowerKeys.reduce((s, k) => s + (lower[k] ?? DEFAULT_LOWER_WIDTHS[k] ?? 0), 0);

  const ratio = sumUpper12 > 0 ? parseFloat(((sumLower12 / sumUpper12) * 100).toFixed(3)) : 0;
  return { ratio, sumUpper12, sumLower12 };
}

/**
 * Bolton Anterior Ratio:
 *   (sum of 6 mandibular anterior widths / sum of 6 maxillary anterior widths) × 100
 * Teeth: upper 13,12,11,21,22,23 vs lower 43,42,41,31,32,33
 */
function computeBoltonAnterior(
  upper: Record<string, number>,
  lower: Record<string, number>,
): { ratio: number; sumUpper6: number; sumLower6: number } {
  const upperAnt = ['13','12','11','21','22','23'];
  const lowerAnt = ['43','42','41','31','32','33'];

  const sumUpper6 = upperAnt.reduce((s, k) => s + (upper[k] ?? DEFAULT_UPPER_WIDTHS[k] ?? 0), 0);
  const sumLower6 = lowerAnt.reduce((s, k) => s + (lower[k] ?? DEFAULT_LOWER_WIDTHS[k] ?? 0), 0);

  const ratio = sumUpper6 > 0 ? parseFloat(((sumLower6 / sumUpper6) * 100).toFixed(3)) : 0;
  return { ratio, sumUpper6, sumLower6 };
}

/**
 * Compute Bolton discrepancy in mm.
 * Positive value = lower jaw excess (mandibular teeth too wide → lower tooth reduction required)
 * Negative value = upper jaw excess (maxillary teeth too wide → upper tooth reduction required)
 *
 * For overall: expected lower sum = (upper12 × overall_norm) / 100
 * discrepancy_mm = actual_lower12 - expected_lower12
 */
function computeBoltonDiscrepancy(
  sumUpper12: number,
  sumLower12: number,
): number {
  const expectedLower = (sumUpper12 * BOLTON_OVERALL_NORM) / 100;
  return parseFloat((sumLower12 - expectedLower).toFixed(3));
}

/**
 * Arch length discrepancy = sum of tooth widths − available arch length
 * Positive = crowding (insufficient arch length)
 * Negative = spacing (excess arch length)
 */
function computeArchLengthDiscrepancy(
  totalToothWidths: number,
  availableArchLength: number,
): number {
  return parseFloat((totalToothWidths - availableArchLength).toFixed(3));
}

/** Build clinical diagnostic summary from computed values — handles null fields gracefully */
function buildDiagnosticSummary(params: {
  angleClass: string | null;
  crowdingUpper: number | null;
  crowdingLower: number | null;
  spacingUpper: number | null;
  spacingLower: number | null;
  overjet: number | null;
  overbite: number | null;
  overbitePercent: number | null;
  boltonAnteriorRatio: number;
  boltonOverallRatio: number;
  boltonDiscrepancyMm: number;
  midlineDeviation: number | null;
  midlineDirection: string | null;
  transverseDiscrepancy: number | null;
  curveOfSpee: number | null;
  canineRight: string | null;
  canineLeft: string | null;
  molarRight: string | null;
  molarLeft: string | null;
}): string {
  const {
    angleClass, crowdingUpper, crowdingLower, spacingUpper, spacingLower,
    overjet, overbite, overbitePercent, boltonAnteriorRatio, boltonOverallRatio,
    boltonDiscrepancyMm, midlineDeviation, midlineDirection,
    transverseDiscrepancy, curveOfSpee, canineRight, canineLeft, molarRight, molarLeft,
  } = params;

  const lines: string[] = [];

  // Skeletal/Molar class
  if (angleClass !== null) {
    const molarStr = molarRight && molarLeft ? ` (right: ${molarRight}, left: ${molarLeft})` : '';
    const canineStr = canineRight && canineLeft
      ? ` with ${canineRight} canine relationship on the right and ${canineLeft} canine relationship on the left`
      : '';
    lines.push(`Skeletal and Dental Classification: The patient presents with an ${angleClass} molar relationship bilaterally${molarStr}${canineStr}.`);
  } else {
    lines.push('Skeletal and Dental Classification: Angle classification not recorded — clinician entry required.');
  }

  // Crowding/Spacing
  if (crowdingUpper !== null || crowdingLower !== null) {
    const upperArch = crowdingUpper !== null
      ? (crowdingUpper > 0
        ? `${crowdingUpper.toFixed(1)} mm of crowding`
        : (spacingUpper !== null && spacingUpper < 0
          ? `${Math.abs(spacingUpper).toFixed(1)} mm of generalized spacing`
          : 'adequate arch length'))
      : 'not measured';
    const lowerArch = crowdingLower !== null
      ? (crowdingLower > 0
        ? `${crowdingLower.toFixed(1)} mm of crowding`
        : (spacingLower !== null && spacingLower < 0
          ? `${Math.abs(spacingLower).toFixed(1)} mm of generalized spacing`
          : 'adequate arch length'))
      : 'not measured';
    lines.push(`Space Analysis: The maxillary arch demonstrates ${upperArch}. The mandibular arch demonstrates ${lowerArch}.`);
  } else {
    lines.push('Space Analysis: Arch length and crowding measurements not provided. Bolton analysis completed from tooth width data.');
  }

  // Overjet/Overbite
  if (overjet !== null && overbite !== null && overbitePercent !== null) {
    lines.push(`Vertical and Horizontal Assessment: Overjet measures ${overjet.toFixed(1)} mm (norm: 2–3 mm). Overbite measures ${overbite.toFixed(1)} mm (${overbitePercent.toFixed(0)}% of lower incisor height; norm: 20–30%).`);
  } else {
    lines.push('Vertical and Horizontal Assessment: Overjet and overbite measurements not provided — clinician measurement required.');
  }

  // Curve of Spee
  if (curveOfSpee !== null) {
    if (curveOfSpee > 2) {
      lines.push(`Curve of Spee: A deep curve of Spee of ${curveOfSpee.toFixed(1)} mm is noted and will require leveling, increasing arch length demand by approximately ${(curveOfSpee * 0.5).toFixed(1)} mm per quadrant.`);
    } else {
      lines.push(`Curve of Spee: The curve of Spee measures ${curveOfSpee.toFixed(1)} mm, within the normal range (≤2 mm).`);
    }
  } else {
    lines.push('Curve of Spee: Not measured — clinician measurement required.');
  }

  // Bolton analysis
  const boltonAntDiff = boltonAnteriorRatio - BOLTON_ANTERIOR_NORM;
  const boltonOvDiff  = boltonOverallRatio  - BOLTON_OVERALL_NORM;
  if (Math.abs(boltonDiscrepancyMm) >= 1.5) {
    const excess = boltonDiscrepancyMm > 0 ? 'mandibular' : 'maxillary';
    lines.push(`Bolton Tooth Size Analysis: Bolton Overall Ratio = ${boltonOverallRatio.toFixed(1)} (norm: ${BOLTON_OVERALL_NORM} ± ${BOLTON_OVERALL_SD}). Bolton Anterior Ratio = ${boltonAnteriorRatio.toFixed(1)} (norm: ${BOLTON_ANTERIOR_NORM} ± ${BOLTON_ANTERIOR_SD}). A significant ${excess} tooth size excess of ${Math.abs(boltonDiscrepancyMm).toFixed(1)} mm is present and will impact final occlusal settling. IPR or tooth size modification may be indicated.`);
  } else {
    lines.push(`Bolton Tooth Size Analysis: Bolton Overall Ratio = ${boltonOverallRatio.toFixed(1)} (norm: ${BOLTON_OVERALL_NORM}; diff: ${boltonOvDiff > 0 ? '+' : ''}${boltonOvDiff.toFixed(1)}%). Bolton Anterior Ratio = ${boltonAnteriorRatio.toFixed(1)} (norm: ${BOLTON_ANTERIOR_NORM}; diff: ${boltonAntDiff > 0 ? '+' : ''}${boltonAntDiff.toFixed(1)}%). No clinically significant tooth size discrepancy detected.`);
  }

  // Midline
  if (midlineDeviation !== null && midlineDirection !== null) {
    if (Math.abs(midlineDeviation) >= 1.0) {
      lines.push(`Midline Assessment: The dental midline is deviated ${Math.abs(midlineDeviation).toFixed(1)} mm to the ${midlineDirection}. Midline correction should be incorporated into the treatment plan.`);
    } else {
      lines.push(`Midline Assessment: Dental midlines are coincident with the facial midline within clinical tolerance.`);
    }
  } else {
    lines.push('Midline Assessment: Not measured — clinician measurement required.');
  }

  // Transverse
  if (transverseDiscrepancy !== null && Math.abs(transverseDiscrepancy) >= 2.0) {
    const direction = transverseDiscrepancy > 0 ? 'maxillary constriction' : 'mandibular constriction';
    lines.push(`Transverse Assessment: Inter-arch transverse discrepancy of ${Math.abs(transverseDiscrepancy).toFixed(1)} mm (${direction}). Transverse correction may be required.`);
  }

  return lines.join(' ');
}

@Injectable()
export class ClinicalAnalysisDeepService {
  private readonly logger = new Logger(ClinicalAnalysisDeepService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async generateAnalysis(
    orgId: string,
    dto: GenerateAnalysisDto,
  ): Promise<ClinicalAnalysis> {
    const upper = resolveWidths(
      Object.fromEntries(
        Object.entries(dto.toothWidths ?? {}).filter(([k]) => parseInt(k, 10) <= 29),
      ),
      DEFAULT_UPPER_WIDTHS,
    );
    const lower = resolveWidths(
      Object.fromEntries(
        Object.entries(dto.toothWidths ?? {}).filter(([k]) => parseInt(k, 10) >= 30),
      ),
      DEFAULT_LOWER_WIDTHS,
    );

    // ── Bolton Overall ──────────────────────────────────────────────────────
    const { ratio: boltonOverall, sumUpper12, sumLower12 } = computeBoltonOverall(upper, lower);
    const boltonDiscrepancyMm = computeBoltonDiscrepancy(sumUpper12, sumLower12);

    // ── Bolton Anterior ─────────────────────────────────────────────────────
    const { ratio: boltonAnterior } = computeBoltonAnterior(upper, lower);

    // ── Arch Lengths ────────────────────────────────────────────────────────
    // Total tooth widths for each arch (all 14 teeth each side)
    const upperAllKeys = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
    const lowerAllKeys = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];
    const totalUpperWidths = upperAllKeys.reduce((s, k) => s + (upper[k] ?? 0), 0);
    const totalLowerWidths = lowerAllKeys.reduce((s, k) => s + (lower[k] ?? 0), 0);

    // Arch length requires direct clinical measurement; cannot be derived from tooth widths alone.
    const archLengthUpper: number | null = dto.archLengthUpper ?? null;
    const archLengthLower: number | null = dto.archLengthLower ?? null;

    // ── Crowding / Spacing ──────────────────────────────────────────────────
    let crowdingUpper: number | null = null;
    let crowdingLower: number | null = null;
    let spacingUpper: number | null = null;
    let spacingLower: number | null = null;

    if (dto.crowdingUpper !== undefined) {
      crowdingUpper = dto.crowdingUpper;
      spacingUpper = 0;
    } else if (archLengthUpper !== null) {
      const disc = computeArchLengthDiscrepancy(totalUpperWidths, archLengthUpper);
      crowdingUpper = Math.max(0, parseFloat(disc.toFixed(2)));
      spacingUpper  = Math.min(0, parseFloat(disc.toFixed(2)));
    }

    if (dto.crowdingLower !== undefined) {
      crowdingLower = dto.crowdingLower;
      spacingLower = 0;
    } else if (archLengthLower !== null) {
      const disc = computeArchLengthDiscrepancy(totalLowerWidths, archLengthLower);
      crowdingLower = Math.max(0, parseFloat(disc.toFixed(2)));
      spacingLower  = Math.min(0, parseFloat(disc.toFixed(2)));
    }

    const archLengthDiscrepancy: number | null =
      archLengthUpper !== null && archLengthLower !== null
        ? parseFloat(
            (computeArchLengthDiscrepancy(totalUpperWidths, archLengthUpper)
              + computeArchLengthDiscrepancy(totalLowerWidths, archLengthLower)).toFixed(3),
          )
        : null;

    // ── Overjet / Overbite ──────────────────────────────────────────────────
    // Must be measured clinically; cannot be derived from any provided input.
    const overjet: number | null = dto.overjetMm ?? null;
    const overbite: number | null = dto.overbite ?? null;
    const lowerCentralHeight = 9.0; // norm (mm)
    const overbitePercent: number | null =
      overbite !== null ? parseFloat(((overbite / lowerCentralHeight) * 100).toFixed(2)) : null;

    // ── Curve of Spee ───────────────────────────────────────────────────────
    // Requires clinical measurement with a brass wire or digital caliper.
    const curveOfSpee: number | null = dto.curveOfSpeeMm ?? null;

    // ── Midline ─────────────────────────────────────────────────────────────
    const midlineDeviation: number | null = dto.midlineDeviationMm ?? null;
    const midlineDirection: string | null =
      midlineDeviation === null ? null
        : midlineDeviation > 0.3 ? 'left'
        : midlineDeviation < -0.3 ? 'right'
        : 'coincident';

    // ── Angle Classification ────────────────────────────────────────────────
    // Must be entered by the clinician via direct examination.
    const angleClass: string | null = dto.angleClass ?? null;

    // Molar and canine relationships derived deterministically from Angle class when provided.
    const molRel = (cls: string | null): string | null => {
      if (!cls) return null;
      if (cls.startsWith('Class I'))   return 'Class I';
      if (cls.startsWith('Class II'))  return 'Class II';
      if (cls.startsWith('Class III')) return 'Class III';
      return null;
    };
    const molarRight  = molRel(angleClass);
    const molarLeft   = molRel(angleClass);
    const canineRight = molRel(angleClass);
    const canineLeft  = molRel(angleClass);

    // ── Transverse ──────────────────────────────────────────────────────────
    // Inter-molar widths must be measured clinically with a digital caliper.
    const upperArchWidth: number | null = dto.upperArchWidthMm ?? null;
    const lowerArchWidth: number | null = dto.lowerArchWidthMm ?? null;
    const transverseDiscrepancy: number | null =
      upperArchWidth !== null && lowerArchWidth !== null
        ? parseFloat((upperArchWidth - lowerArchWidth - 4.0).toFixed(3))
        : null;

    // ── Occlusal Contacts ───────────────────────────────────────────────────
    const occlusalContacts: Record<string, unknown> =
      overjet !== null && overbite !== null
        ? {
            right_posterior: 'stable',
            left_posterior: 'stable',
            anterior: overjet <= 3.0 && overbite >= 1.0 ? 'present' : 'reduced',
            canine_guidance: canineRight === 'Class I' ? 'functional' : 'absent',
          }
        : { note: 'Cannot be determined without overjet/overbite measurements' };

    // ── Measurement Source ──────────────────────────────────────────────────
    // Records which fields were clinician-provided vs. computed vs. not available.
    const toothWidthSource = dto.toothWidths && Object.keys(dto.toothWidths).length > 0
      ? 'clinician_measured' : 'moyers_1988_norms';
    const measurementSource: Record<string, string> = {
      bolton_ratios: toothWidthSource,
      arch_length_upper: archLengthUpper !== null ? 'clinician_measured' : 'not_available',
      arch_length_lower: archLengthLower !== null ? 'clinician_measured' : 'not_available',
      crowding_upper: crowdingUpper !== null ? (dto.crowdingUpper !== undefined ? 'clinician_measured' : 'computed_from_arch_length') : 'not_available',
      crowding_lower: crowdingLower !== null ? (dto.crowdingLower !== undefined ? 'clinician_measured' : 'computed_from_arch_length') : 'not_available',
      overjet: overjet !== null ? 'clinician_measured' : 'not_available',
      overbite: overbite !== null ? 'clinician_measured' : 'not_available',
      curve_of_spee: curveOfSpee !== null ? 'clinician_measured' : 'not_available',
      midline_deviation: midlineDeviation !== null ? 'clinician_measured' : 'not_available',
      angle_class: angleClass !== null ? 'clinician_entered' : 'not_available',
      arch_widths: upperArchWidth !== null ? 'clinician_measured' : 'not_available',
    };

    // ── Confidence ──────────────────────────────────────────────────────────
    // Computed deterministically from the fraction of measurements actually provided.
    const measuredFields = [
      overjet !== null, overbite !== null, curveOfSpee !== null,
      midlineDeviation !== null, angleClass !== null,
      archLengthUpper !== null, archLengthLower !== null,
      upperArchWidth !== null, lowerArchWidth !== null,
    ];
    const measuredCount = measuredFields.filter(Boolean).length;
    const toothWidthCount = dto.toothWidths ? Object.keys(dto.toothWidths).length : 0;
    const widthBonus = Math.min(toothWidthCount / 28, 1) * 0.15;
    const confidence = parseFloat(
      Math.min(0.95, 0.40 + (measuredCount / measuredFields.length) * 0.45 + widthBonus).toFixed(3),
    );

    // ── Diagnostic Summary ──────────────────────────────────────────────────
    const diagnosticSummary = buildDiagnosticSummary({
      angleClass,
      crowdingUpper,
      crowdingLower,
      spacingUpper,
      spacingLower,
      overjet,
      overbite,
      overbitePercent,
      boltonAnteriorRatio: boltonAnterior,
      boltonOverallRatio: boltonOverall,
      boltonDiscrepancyMm,
      midlineDeviation,
      midlineDirection,
      transverseDiscrepancy,
      curveOfSpee,
      canineRight,
      canineLeft,
      molarRight,
      molarLeft,
    });

    const { rows } = await this.pool.query<ClinicalAnalysis>(
      `INSERT INTO clinical_analyses (
         organization_id, case_id, stl_upload_id,
         bolton_anterior_ratio, bolton_overall_ratio, bolton_discrepancy_mm,
         arch_length_upper_mm, arch_length_lower_mm, arch_length_discrepancy_mm,
         crowding_upper_mm, crowding_lower_mm, spacing_upper_mm, spacing_lower_mm,
         overjet_mm, overbite_mm, overbite_percent, curve_of_spee_mm,
         midline_deviation_mm, midline_direction,
         angle_class,
         canine_relationship_right, canine_relationship_left,
         molar_relationship_right, molar_relationship_left,
         upper_arch_width_mm, lower_arch_width_mm, transverse_discrepancy_mm,
         occlusal_contacts, measurement_source, diagnostic_summary, confidence
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6,
         $7, $8, $9,
         $10, $11, $12, $13,
         $14, $15, $16, $17,
         $18, $19,
         $20,
         $21, $22,
         $23, $24,
         $25, $26, $27,
         $28, $29, $30, $31
       )
       RETURNING *`,
      [
        orgId,
        dto.caseId ?? null,
        dto.uploadId ?? null,
        boltonAnterior,
        boltonOverall,
        boltonDiscrepancyMm,
        archLengthUpper,
        archLengthLower,
        archLengthDiscrepancy,
        crowdingUpper,
        crowdingLower,
        spacingUpper,
        spacingLower,
        overjet,
        overbite,
        overbitePercent,
        curveOfSpee,
        midlineDeviation,
        midlineDirection,
        angleClass,
        canineRight,
        canineLeft,
        molarRight,
        molarLeft,
        upperArchWidth,
        lowerArchWidth,
        transverseDiscrepancy,
        JSON.stringify(occlusalContacts),
        JSON.stringify(measurementSource),
        diagnosticSummary,
        confidence,
      ],
    );

    this.logger.log(
      `Clinical analysis generated: case=${dto.caseId} bolton_overall=${boltonOverall} crowding_upper=${crowdingUpper ?? 'not_measured'}mm crowding_lower=${crowdingLower ?? 'not_measured'}mm`,
    );
    return rows[0];
  }

  async getAnalysis(orgId: string, caseId: string): Promise<ClinicalAnalysis | null> {
    const { rows } = await this.pool.query<ClinicalAnalysis>(
      `SELECT * FROM clinical_analyses
       WHERE organization_id = $1 AND case_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId, caseId],
    );
    return rows[0] ?? null;
  }

  async getAnalysisByUpload(orgId: string, uploadId: string): Promise<ClinicalAnalysis | null> {
    const { rows } = await this.pool.query<ClinicalAnalysis>(
      `SELECT * FROM clinical_analyses
       WHERE organization_id = $1 AND stl_upload_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId, uploadId],
    );
    return rows[0] ?? null;
  }
}
