import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface GrowthPrediction {
  id: string; organizationId: string; patientId: string; predictionDate: string;
  skeletalAgeYears: number | null; cervicalMaturationStage: string | null;
  growthPotential: string | null; mandibularGrowthRemainingMm: number | null;
  predictedAdultClass: string | null; recommendations: string | null;
  recordedBy: string; createdAt: string;
}

@Injectable()
export class GrowthPredictionService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(patientId: string, orgId: string): Promise<GrowthPrediction[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM growth_predictions WHERE patient_id=$1 AND organization_id=$2 ORDER BY prediction_date DESC`,
      [patientId, orgId],
    );
    return rows.map(this.map);
  }

  async create(orgId: string, recordedBy: string, dto: {
    patientId: string; predictionDate: string; skeletalAgeYears?: number;
    cervicalMaturationStage?: string; growthPotential?: string;
    mandibularGrowthRemainingMm?: number; predictedAdultClass?: string; recommendations?: string;
  }): Promise<GrowthPrediction> {
    const { rows: pRows } = await this.db.query(
      `SELECT id FROM patients WHERE id=$1 AND organization_id=$2`, [dto.patientId, orgId],
    );
    if (!pRows[0]) throw new NotFoundException('Patient not found');
    const { rows } = await this.db.query(
      `INSERT INTO growth_predictions
         (organization_id, patient_id, prediction_date, skeletal_age_years,
          cervical_maturation_stage, growth_potential, mandibular_growth_remaining_mm,
          predicted_adult_class, recommendations, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [orgId, dto.patientId, dto.predictionDate, dto.skeletalAgeYears ?? null,
       dto.cervicalMaturationStage ?? null, dto.growthPotential ?? null,
       dto.mandibularGrowthRemainingMm ?? null, dto.predictedAdultClass ?? null,
       dto.recommendations ?? null, recordedBy],
    );
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): GrowthPrediction {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      patientId: r['patient_id'] as string, predictionDate: String(r['prediction_date']),
      skeletalAgeYears: r['skeletal_age_years'] as number | null,
      cervicalMaturationStage: r['cervical_maturation_stage'] as string | null,
      growthPotential: r['growth_potential'] as string | null,
      mandibularGrowthRemainingMm: r['mandibular_growth_remaining_mm'] as number | null,
      predictedAdultClass: r['predicted_adult_class'] as string | null,
      recommendations: r['recommendations'] as string | null,
      recordedBy: r['recorded_by'] as string, createdAt: String(r['created_at']),
    };
  }
}
