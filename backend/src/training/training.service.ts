import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface CpdActivity {
  id: string; userId: string; title: string; provider: string | null;
  activityType: string; cpdHours: number; completionDate: string;
  certificateUrl: string | null; notes: string | null; verified: boolean; createdAt: string;
}

@Injectable()
export class TrainingService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listActivities(orgId: string, userId: string): Promise<CpdActivity[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM cpd_activities WHERE organization_id=$1 AND user_id=$2 ORDER BY completion_date DESC',
      [orgId, userId],
    );
    return rows.map(this.map);
  }

  async listOrgActivities(orgId: string): Promise<CpdActivity[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM cpd_activities WHERE organization_id=$1 ORDER BY completion_date DESC LIMIT 500',
      [orgId],
    );
    return rows.map(this.map);
  }

  async logActivity(orgId: string, userId: string, dto: {
    title: string; provider?: string; activityType?: string;
    cpdHours: number; completionDate: string; certificateUrl?: string; notes?: string;
  }): Promise<CpdActivity> {
    const { rows } = await this.db.query(
      `INSERT INTO cpd_activities
         (organization_id, user_id, title, provider, activity_type, cpd_hours,
          completion_date, certificate_url, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [orgId, userId, dto.title, dto.provider ?? null, dto.activityType ?? 'course',
       dto.cpdHours, dto.completionDate, dto.certificateUrl ?? null, dto.notes ?? null],
    );
    return this.map(rows[0]);
  }

  async verifyActivity(activityId: string, orgId: string): Promise<CpdActivity> {
    const { rows } = await this.db.query(
      'UPDATE cpd_activities SET verified=TRUE, updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *',
      [activityId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('CPD activity not found');
    return this.map(rows[0]);
  }

  async getCpdSummary(orgId: string, userId: string): Promise<{
    totalHours: number; verifiedHours: number; activitiesByType: Record<string, number>;
    requirement: { periodStart: string; periodEnd: string; requiredHours: number } | null;
  }> {
    const { rows } = await this.db.query(
      `SELECT
         SUM(cpd_hours)::numeric(6,1) AS total,
         SUM(CASE WHEN verified THEN cpd_hours ELSE 0 END)::numeric(6,1) AS verified_total,
         json_object_agg(activity_type, type_hours) AS by_type
       FROM (
         SELECT activity_type, SUM(cpd_hours) AS type_hours
         FROM cpd_activities WHERE organization_id=$1 AND user_id=$2
         GROUP BY activity_type
       ) t`,
      [orgId, userId],
    );

    const { rows: req } = await this.db.query(
      `SELECT period_start, period_end, required_hours FROM cpd_requirements
       WHERE organization_id=$1 AND user_id=$2 AND period_end >= CURRENT_DATE ORDER BY period_start LIMIT 1`,
      [orgId, userId],
    );

    const r = rows[0];
    return {
      totalHours: r['total'] ? Number(r['total']) : 0,
      verifiedHours: r['verified_total'] ? Number(r['verified_total']) : 0,
      activitiesByType: (r['by_type'] as Record<string, number>) ?? {},
      requirement: req[0] ? {
        periodStart: String(req[0]['period_start']),
        periodEnd: String(req[0]['period_end']),
        requiredHours: Number(req[0]['required_hours']),
      } : null,
    };
  }

  async setRequirement(orgId: string, userId: string, dto: {
    periodStart: string; periodEnd: string; requiredHours: number;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO cpd_requirements (organization_id, user_id, period_start, period_end, required_hours)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id, user_id, period_start) DO UPDATE SET required_hours=$5, period_end=$4`,
      [orgId, userId, dto.periodStart, dto.periodEnd, dto.requiredHours],
    );
  }

  private map(r: Record<string, unknown>): CpdActivity {
    return {
      id: r['id'] as string, userId: r['user_id'] as string, title: r['title'] as string,
      provider: r['provider'] as string | null, activityType: r['activity_type'] as string,
      cpdHours: Number(r['cpd_hours']), completionDate: String(r['completion_date']),
      certificateUrl: r['certificate_url'] as string | null, notes: r['notes'] as string | null,
      verified: r['verified'] as boolean, createdAt: String(r['created_at']),
    };
  }
}
