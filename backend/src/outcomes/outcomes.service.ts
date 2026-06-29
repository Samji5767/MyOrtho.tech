import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface TreatmentOutcome {
  id: string; caseId: string; outcomeDate: string; recordedBy: string;
  finalOverjetMm: number | null; finalOverbiteJm: number | null;
  finalMidlineDeviationMm: number | null; archCoordinationAchieved: boolean | null;
  totalAlignersUsed: number | null; refinementsCount: number;
  treatmentDurationDays: number | null; patientSatisfaction: number | null;
  clinicianSatisfaction: number | null; notes: string | null; createdAt: string;
}

@Injectable()
export class OutcomesService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async getOutcome(caseId: string, orgId: string): Promise<TreatmentOutcome | null> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      'SELECT * FROM treatment_outcomes WHERE case_id=$1 AND organization_id=$2',
      [caseId, orgId],
    );
    return rows[0] ? this.map(rows[0]) : null;
  }

  async recordOutcome(caseId: string, orgId: string, recordedBy: string, dto: {
    outcomeDate: string; finalOverjetMm?: number; finalOverbiteJm?: number;
    finalMidlineDeviationMm?: number; archCoordinationAchieved?: boolean;
    totalAlignersUsed?: number; refinementsCount?: number;
    treatmentDurationDays?: number; patientSatisfaction?: number;
    clinicianSatisfaction?: number; notes?: string;
  }): Promise<TreatmentOutcome> {
    await this.verifyCase(caseId, orgId);
    const { rows: existing } = await this.db.query(
      'SELECT id FROM treatment_outcomes WHERE case_id=$1', [caseId],
    );
    if (existing[0]) throw new ConflictException('Outcome already recorded. Use update instead.');

    const { rows } = await this.db.query(
      `INSERT INTO treatment_outcomes
         (organization_id, case_id, recorded_by, outcome_date, final_overjet_mm, final_overbite_mm,
          final_midline_deviation_mm, arch_coordination_achieved, total_aligners_used,
          refinements_count, treatment_duration_days, patient_satisfaction, clinician_satisfaction, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [orgId, caseId, recordedBy, dto.outcomeDate,
       dto.finalOverjetMm ?? null, dto.finalOverbiteJm ?? null, dto.finalMidlineDeviationMm ?? null,
       dto.archCoordinationAchieved ?? null, dto.totalAlignersUsed ?? null,
       dto.refinementsCount ?? 0, dto.treatmentDurationDays ?? null,
       dto.patientSatisfaction ?? null, dto.clinicianSatisfaction ?? null, dto.notes ?? null],
    );
    return this.map(rows[0]);
  }

  async listOrgOutcomes(orgId: string): Promise<TreatmentOutcome[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM treatment_outcomes WHERE organization_id=$1 ORDER BY outcome_date DESC LIMIT 200',
      [orgId],
    );
    return rows.map(r => this.map(r));
  }

  async getOutcomeStats(orgId: string): Promise<Record<string, unknown>> {
    const { rows } = await this.db.query(
      `SELECT
         COUNT(*)::int AS total_completed,
         AVG(final_overjet_mm)::numeric(4,2) AS avg_final_overjet,
         AVG(final_overbite_mm)::numeric(4,2) AS avg_final_overbite,
         AVG(refinements_count)::numeric(4,2) AS avg_refinements,
         AVG(treatment_duration_days)::numeric(6,1) AS avg_duration_days,
         AVG(patient_satisfaction)::numeric(3,2) AS avg_patient_satisfaction,
         AVG(clinician_satisfaction)::numeric(3,2) AS avg_clinician_satisfaction,
         COUNT(CASE WHEN arch_coordination_achieved THEN 1 END)::int AS arch_coord_count
       FROM treatment_outcomes WHERE organization_id=$1`,
      [orgId],
    );
    return rows[0];
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.db.query('SELECT id FROM cases WHERE id=$1 AND organization_id=$2', [caseId, orgId]);
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private map(r: Record<string, unknown>): TreatmentOutcome {
    return {
      id: r['id'] as string, caseId: r['case_id'] as string,
      outcomeDate: String(r['outcome_date']), recordedBy: r['recorded_by'] as string,
      finalOverjetMm: r['final_overjet_mm'] != null ? Number(r['final_overjet_mm']) : null,
      finalOverbiteJm: r['final_overbite_mm'] != null ? Number(r['final_overbite_mm']) : null,
      finalMidlineDeviationMm: r['final_midline_deviation_mm'] != null ? Number(r['final_midline_deviation_mm']) : null,
      archCoordinationAchieved: r['arch_coordination_achieved'] as boolean | null,
      totalAlignersUsed: r['total_aligners_used'] as number | null,
      refinementsCount: r['refinements_count'] as number,
      treatmentDurationDays: r['treatment_duration_days'] as number | null,
      patientSatisfaction: r['patient_satisfaction'] as number | null,
      clinicianSatisfaction: r['clinician_satisfaction'] as number | null,
      notes: r['notes'] as string | null,
      createdAt: String(r['created_at']),
    };
  }
}
