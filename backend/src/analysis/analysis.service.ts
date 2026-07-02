import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface SaveAnalysisDto {
  boltonOverall?: number;
  boltonAnterior?: number;
  toothMeasurements?: Record<string, number>;
  angleClass?: string;
  overjetMm?: number;
  overbiteM?: number;
  upperCrowdingMm?: number;
  lowerCrowdingMm?: number;
  iprSchedule?: IprEntry[];
  complexityScore?: number;
  notes?: string;
  // Extended v2 fields
  archLengthDiscrepancyUpper?: number;
  archLengthDiscrepancyLower?: number;
  littlesIrregularityIndex?: number;
  treatmentDifficultyIndex?: number;
  spaceAnalysis?: Record<string, unknown>;
  crowdingSeverity?: 'none' | 'mild' | 'moderate' | 'severe';
}

export interface ExtendedAnalysisInput {
  toothMeasurements?: Record<string, number>;
  archPerimeterUpperMm?: number;
  archPerimeterLowerMm?: number;
  contactDisplacementsMm?: number[];
  angleClass?: string;
  overjetMm?: number;
  overbiteM?: number;
  boltonOverall?: number;
  boltonAnterior?: number;
}

export interface ArchLengthResult {
  upper: number | null;
  lower: number | null;
  upperSeverity: string;
  lowerSeverity: string;
}

export interface TdiComponents {
  crowding: number;
  angle: number;
  overjet: number;
  overbite: number;
  boltonDiscrepancy: number;
}

export interface TreatmentDifficultyResult {
  score: number;
  components: TdiComponents;
  classification: string;
}

export interface SpaceAnalysisResult {
  totalUpperWidthMm: number | null;
  totalLowerWidthMm: number | null;
  upperArchPerimeterMm: number | null;
  lowerArchPerimeterMm: number | null;
}

export interface ExtendedAnalysisResult {
  archLengthDiscrepancy: ArchLengthResult;
  littlesIrregularityIndex: number | null;
  treatmentDifficultyIndex: TreatmentDifficultyResult;
  spaceAnalysis: SpaceAnalysisResult;
}

export interface IprEntry {
  stage: number;
  toothA: string;
  toothB: string;
  amountMm: number;
}

@Injectable()
export class AnalysisService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getLatest(caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT ca.*, u.email AS created_by_email
         FROM case_analyses ca
         LEFT JOIN auth_users u ON u.id = ca.created_by
         WHERE ca.case_id = $1
         ORDER BY ca.created_at DESC
         LIMIT 1`,
      [caseId],
    );
    return rows[0] ? this.format(rows[0]) : null;
  }

  async list(caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT ca.id, ca.case_id, ca.bolton_overall, ca.bolton_anterior,
              ca.angle_class, ca.overjet_mm, ca.overbite_mm,
              ca.upper_crowding_mm, ca.lower_crowding_mm,
              ca.complexity_score, ca.notes, ca.created_at,
              u.email AS created_by_email
         FROM case_analyses ca
         LEFT JOIN auth_users u ON u.id = ca.created_by
         WHERE ca.case_id = $1
         ORDER BY ca.created_at DESC`,
      [caseId],
    );
    return rows.map(this.format);
  }

  async create(caseId: string, orgId: string, userId: string, dto: SaveAnalysisDto) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `INSERT INTO case_analyses
         (case_id, created_by, bolton_overall, bolton_anterior, tooth_measurements,
          angle_class, overjet_mm, overbite_mm, upper_crowding_mm, lower_crowding_mm,
          ipr_schedule, complexity_score, notes,
          arch_length_discrepancy_upper, arch_length_discrepancy_lower,
          littles_irregularity_index, treatment_difficulty_index,
          space_analysis, crowding_severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        caseId, userId,
        dto.boltonOverall ?? null,
        dto.boltonAnterior ?? null,
        JSON.stringify(dto.toothMeasurements ?? {}),
        dto.angleClass ?? null,
        dto.overjetMm ?? null,
        dto.overbiteM ?? null,
        dto.upperCrowdingMm ?? null,
        dto.lowerCrowdingMm ?? null,
        JSON.stringify(dto.iprSchedule ?? []),
        dto.complexityScore ?? null,
        dto.notes ?? null,
        dto.archLengthDiscrepancyUpper ?? null,
        dto.archLengthDiscrepancyLower ?? null,
        dto.littlesIrregularityIndex ?? null,
        dto.treatmentDifficultyIndex ?? null,
        dto.spaceAnalysis != null ? JSON.stringify(dto.spaceAnalysis) : null,
        dto.crowdingSeverity ?? null,
      ],
    );
    return this.format(rows[0]);
  }

  async update(id: string, caseId: string, orgId: string, dto: SaveAnalysisDto) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `UPDATE case_analyses SET
         bolton_overall   = COALESCE($1, bolton_overall),
         bolton_anterior  = COALESCE($2, bolton_anterior),
         tooth_measurements = COALESCE($3::jsonb, tooth_measurements),
         angle_class      = COALESCE($4, angle_class),
         overjet_mm       = COALESCE($5, overjet_mm),
         overbite_mm      = COALESCE($6, overbite_mm),
         upper_crowding_mm= COALESCE($7, upper_crowding_mm),
         lower_crowding_mm= COALESCE($8, lower_crowding_mm),
         ipr_schedule     = COALESCE($9::jsonb, ipr_schedule),
         complexity_score = COALESCE($10, complexity_score),
         notes            = COALESCE($11, notes),
         updated_at       = now()
       WHERE id = $12 AND case_id = $13
       RETURNING *`,
      [
        dto.boltonOverall ?? null,
        dto.boltonAnterior ?? null,
        dto.toothMeasurements ? JSON.stringify(dto.toothMeasurements) : null,
        dto.angleClass ?? null,
        dto.overjetMm ?? null,
        dto.overbiteM ?? null,
        dto.upperCrowdingMm ?? null,
        dto.lowerCrowdingMm ?? null,
        dto.iprSchedule ? JSON.stringify(dto.iprSchedule) : null,
        dto.complexityScore ?? null,
        dto.notes ?? null,
        id,
        caseId,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Analysis record not found');
    return this.format(rows[0]);
  }

  computeExtendedAnalysis(dto: ExtendedAnalysisInput): ExtendedAnalysisResult {
    const measurements: Record<string, number> = dto.toothMeasurements ?? {};

    // -------------------------------------------------------------------------
    // FDI tooth groups for space analysis
    // -------------------------------------------------------------------------
    const UPPER_SPACE_FDIS = ['13', '12', '11', '21', '22', '23', '14', '15', '24', '25'];
    const LOWER_SPACE_FDIS = ['43', '42', '41', '31', '32', '33', '44', '45', '34', '35'];

    const sumWidths = (fdis: string[]): number | null => {
      const present = fdis.filter((fdi) => measurements[fdi] != null);
      if (present.length === 0) return null;
      return present.reduce((acc, fdi) => acc + (measurements[fdi] as number), 0);
    };

    const totalUpperWidthMm = sumWidths(UPPER_SPACE_FDIS);
    const totalLowerWidthMm = sumWidths(LOWER_SPACE_FDIS);

    // -------------------------------------------------------------------------
    // Arch-length discrepancy (ALD = archPerimeter - sum of tooth widths)
    // Negative ALD = crowding; positive = spacing.
    // -------------------------------------------------------------------------
    const aldUpper: number | null =
      dto.archPerimeterUpperMm != null && totalUpperWidthMm != null
        ? dto.archPerimeterUpperMm - totalUpperWidthMm
        : null;

    const aldLower: number | null =
      dto.archPerimeterLowerMm != null && totalLowerWidthMm != null
        ? dto.archPerimeterLowerMm - totalLowerWidthMm
        : null;

    const aldSeverity = (ald: number | null): string => {
      if (ald == null) return 'unknown';
      if (ald > 0) return 'spacing';
      if (ald >= -1) return 'none';
      if (ald >= -4) return 'mild';
      if (ald >= -8) return 'moderate';
      return 'severe';
    };

    // -------------------------------------------------------------------------
    // Little's Irregularity Index (LII) — sum of 5 contact displacements
    // -------------------------------------------------------------------------
    let littlesIrregularityIndex: number | null = null;
    if (dto.contactDisplacementsMm != null && dto.contactDisplacementsMm.length > 0) {
      littlesIrregularityIndex = dto.contactDisplacementsMm.reduce(
        (acc: number, v: number) => acc + v,
        0,
      );
    }

    // -------------------------------------------------------------------------
    // Treatment Difficulty Index (TDI)
    // -------------------------------------------------------------------------
    // Crowding component — derive from lower ALD if available
    const crowdingMm = aldLower != null ? Math.abs(Math.min(aldLower, 0)) : 0;
    let crowdingScore = 0;
    let crowdingSeverity: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
    if (crowdingMm === 0) {
      crowdingScore = 0;
      crowdingSeverity = 'none';
    } else if (crowdingMm < 4) {
      crowdingScore = 10;
      crowdingSeverity = 'mild';
    } else if (crowdingMm <= 8) {
      crowdingScore = 25;
      crowdingSeverity = 'moderate';
    } else {
      crowdingScore = 40;
      crowdingSeverity = 'severe';
    }

    // Angle class component
    const angleClassRaw = (dto.angleClass ?? '').trim().toUpperCase();
    let angleScore = 0;
    if (angleClassRaw === 'II_DIV1' || angleClassRaw === 'II DIV 1' || angleClassRaw === 'IIDIV1') {
      angleScore = 15;
    } else if (angleClassRaw === 'II_DIV2' || angleClassRaw === 'II DIV 2' || angleClassRaw === 'IIDIV2') {
      angleScore = 10;
    } else if (angleClassRaw === 'III') {
      angleScore = 20;
    } else {
      // Class I or unspecified
      angleScore = 0;
    }

    // Overjet component
    const overjet = dto.overjetMm ?? 0;
    let overjetScore = 0;
    if (overjet <= 3) {
      overjetScore = 0;
    } else if (overjet <= 6) {
      overjetScore = 5;
    } else if (overjet <= 9) {
      overjetScore = 10;
    } else {
      overjetScore = 20;
    }

    // Overbite component
    const overbite = dto.overbiteM ?? 0;
    let overbiteScore = 0;
    if (overbite < 0) {
      overbiteScore = 15; // anterior open bite / negative overbite
    } else if (overbite <= 3) {
      overbiteScore = 0;
    } else if (overbite <= 5) {
      overbiteScore = 5;
    } else {
      overbiteScore = 10;
    }

    // Bolton discrepancy component
    let boltonScore = 0;
    const hasBolton = dto.boltonOverall != null || dto.boltonAnterior != null;
    if (hasBolton) {
      // Normal Bolton overall ~91.3%, anterior ~77.2%.
      // Discrepancy present if provided values differ from norms by >=2 mm equivalent.
      // The DTO carries the ratio (%), not an mm value; apply heuristic threshold.
      const overallDelta = dto.boltonOverall != null ? Math.abs(dto.boltonOverall - 91.3) : 0;
      const anteriorDelta = dto.boltonAnterior != null ? Math.abs(dto.boltonAnterior - 77.2) : 0;
      const maxDelta = Math.max(overallDelta, anteriorDelta);
      if (maxDelta < 1) {
        boltonScore = 0;  // no clinically relevant discrepancy
      } else if (maxDelta < 3) {
        boltonScore = 5;  // <2 mm equivalent
      } else {
        boltonScore = 10; // >=2 mm equivalent
      }
    }

    const tdiScore = crowdingScore + angleScore + overjetScore + overbiteScore + boltonScore;

    let tdiClassification: string;
    if (tdiScore < 20) {
      tdiClassification = 'simple';
    } else if (tdiScore < 40) {
      tdiClassification = 'moderate';
    } else if (tdiScore < 60) {
      tdiClassification = 'complex';
    } else {
      tdiClassification = 'severe';
    }

    return {
      archLengthDiscrepancy: {
        upper: aldUpper,
        lower: aldLower,
        upperSeverity: aldSeverity(aldUpper),
        lowerSeverity: aldSeverity(aldLower),
      },
      littlesIrregularityIndex,
      treatmentDifficultyIndex: {
        score: tdiScore,
        components: {
          crowding: crowdingScore,
          angle: angleScore,
          overjet: overjetScore,
          overbite: overbiteScore,
          boltonDiscrepancy: boltonScore,
        },
        classification: tdiClassification,
      },
      spaceAnalysis: {
        totalUpperWidthMm,
        totalLowerWidthMm,
        upperArchPerimeterMm: dto.archPerimeterUpperMm ?? null,
        lowerArchPerimeterMm: dto.archPerimeterLowerMm ?? null,
      },
    };
  }

  // expose crowdingSeverity helper for callers that persist results
  getCrowdingSeverityFromAld(
    aldMm: number | null,
  ): 'none' | 'mild' | 'moderate' | 'severe' | null {
    if (aldMm == null) return null;
    const crowding = Math.abs(Math.min(aldMm, 0));
    if (crowding === 0) return 'none';
    if (crowding < 4) return 'mild';
    if (crowding <= 8) return 'moderate';
    return 'severe';
  }

  private async verifyCase(caseId: string, orgId: string) {
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
      id: r['id'],
      caseId: r['case_id'],
      boltonOverall: r['bolton_overall'] != null ? parseFloat(String(r['bolton_overall'])) : null,
      boltonAnterior: r['bolton_anterior'] != null ? parseFloat(String(r['bolton_anterior'])) : null,
      toothMeasurements: r['tooth_measurements'] as Record<string, number>,
      angleClass: r['angle_class'],
      overjetMm: r['overjet_mm'] != null ? parseFloat(String(r['overjet_mm'])) : null,
      overbiteM: r['overbite_mm'] != null ? parseFloat(String(r['overbite_mm'])) : null,
      upperCrowdingMm: r['upper_crowding_mm'] != null ? parseFloat(String(r['upper_crowding_mm'])) : null,
      lowerCrowdingMm: r['lower_crowding_mm'] != null ? parseFloat(String(r['lower_crowding_mm'])) : null,
      iprSchedule: r['ipr_schedule'] as IprEntry[],
      complexityScore: r['complexity_score'],
      createdByEmail: r['created_by_email'],
      notes: r['notes'],
      createdAt: r['created_at'],
      updatedAt: r['updated_at'],
      // Extended v2 fields
      archLengthDiscrepancyUpper: r['arch_length_discrepancy_upper'] != null
        ? parseFloat(String(r['arch_length_discrepancy_upper'])) : null,
      archLengthDiscrepancyLower: r['arch_length_discrepancy_lower'] != null
        ? parseFloat(String(r['arch_length_discrepancy_lower'])) : null,
      littlesIrregularityIndex: r['littles_irregularity_index'] != null
        ? parseFloat(String(r['littles_irregularity_index'])) : null,
      treatmentDifficultyIndex: r['treatment_difficulty_index'] != null
        ? parseInt(String(r['treatment_difficulty_index']), 10) : null,
      spaceAnalysis: r['space_analysis'] as Record<string, unknown> | null,
      crowdingSeverity: r['crowding_severity'] as string | null,
    };
  }
}
