import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

interface SurveyQuestion { id: string; type: 'text' | 'rating' | 'yes_no' | 'multiple_choice'; label: string; options?: string[]; required?: boolean }
export interface Survey { id: string; title: string; questions: SurveyQuestion[]; isActive: boolean; createdAt: string }
export interface SurveyResponse { id: string; surveyId: string; patientId: string | null; caseId: string | null; answers: Record<string, unknown>; submittedAt: string }

@Injectable()
export class SurveysService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listSurveys(orgId: string): Promise<Survey[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM surveys WHERE organization_id=$1 AND is_active=TRUE ORDER BY created_at DESC', [orgId],
    );
    return rows.map(this.mapSurvey);
  }

  async createSurvey(orgId: string, createdBy: string, dto: { title: string; questions: SurveyQuestion[] }): Promise<Survey> {
    const { rows } = await this.db.query(
      `INSERT INTO surveys (organization_id, title, questions, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [orgId, dto.title, JSON.stringify(dto.questions), createdBy],
    );
    return this.mapSurvey(rows[0]);
  }

  async submitResponse(orgId: string, surveyId: string, dto: {
    patientId?: string; caseId?: string; answers: Record<string, unknown>;
  }): Promise<SurveyResponse> {
    const { rows: s } = await this.db.query(
      'SELECT id FROM surveys WHERE id=$1 AND organization_id=$2 AND is_active=TRUE', [surveyId, orgId],
    );
    if (!s[0]) throw new NotFoundException('Survey not found');

    const { rows } = await this.db.query(
      `INSERT INTO survey_responses (organization_id, survey_id, patient_id, case_id, answers)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [orgId, surveyId, dto.patientId ?? null, dto.caseId ?? null, JSON.stringify(dto.answers)],
    );
    return this.mapResponse(rows[0]);
  }

  async listResponses(orgId: string, surveyId: string): Promise<SurveyResponse[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM survey_responses WHERE survey_id=$1 AND organization_id=$2 ORDER BY submitted_at DESC LIMIT 200',
      [surveyId, orgId],
    );
    return rows.map(this.mapResponse);
  }

  async getSurveyStats(orgId: string, surveyId: string): Promise<{ totalResponses: number; ratingAverages: Record<string, number> }> {
    const { rows } = await this.db.query(
      'SELECT answers FROM survey_responses WHERE survey_id=$1 AND organization_id=$2', [surveyId, orgId],
    );
    const ratingTotals: Record<string, { sum: number; count: number }> = {};
    for (const r of rows) {
      const ans = r['answers'] as Record<string, unknown>;
      for (const [k, v] of Object.entries(ans)) {
        if (typeof v === 'number') {
          if (!ratingTotals[k]) ratingTotals[k] = { sum: 0, count: 0 };
          ratingTotals[k].sum += v;
          ratingTotals[k].count += 1;
        }
      }
    }
    const ratingAverages: Record<string, number> = {};
    for (const [k, { sum, count }] of Object.entries(ratingTotals)) {
      ratingAverages[k] = Math.round((sum / count) * 10) / 10;
    }
    return { totalResponses: rows.length, ratingAverages };
  }

  private mapSurvey(r: Record<string, unknown>): Survey {
    return {
      id: r['id'] as string, title: r['title'] as string,
      questions: (r['questions'] as SurveyQuestion[]) ?? [],
      isActive: r['is_active'] as boolean, createdAt: String(r['created_at']),
    };
  }

  private mapResponse(r: Record<string, unknown>): SurveyResponse {
    return {
      id: r['id'] as string, surveyId: r['survey_id'] as string,
      patientId: r['patient_id'] as string | null, caseId: r['case_id'] as string | null,
      answers: r['answers'] as Record<string, unknown>, submittedAt: String(r['submitted_at']),
    };
  }
}
