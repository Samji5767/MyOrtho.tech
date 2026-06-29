import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface OcclusionAnalysis {
  id: string; organizationId: string; caseId: string; analysisDate: string;
  angleClass: string | null; overjetMm: number | null; overbitemm: number | null;
  midlineShiftMm: number | null; crossbiteTeeth: number[]; openBiteTeeth: number[];
  crowdingUpperMm: number | null; crowdingLowerMm: number | null;
  tmjFindings: string | null; notes: string | null; recordedBy: string; createdAt: string;
}

@Injectable()
export class OcclusionAnalysisService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(caseId: string, orgId: string): Promise<OcclusionAnalysis[]> {
    const { rows } = await this.db.query(
      `SELECT o.* FROM occlusion_analyses o
       JOIN cases c ON c.id=o.case_id
       WHERE o.case_id=$1 AND c.organization_id=$2
       ORDER BY o.analysis_date DESC`,
      [caseId, orgId],
    );
    return rows.map(this.map);
  }

  async create(caseId: string, orgId: string, recordedBy: string, dto: {
    analysisDate: string; angleClass?: string; overjetMm?: number; overbitemm?: number;
    midlineShiftMm?: number; crossbiteTeeth?: number[]; openBiteTeeth?: number[];
    crowdingUpperMm?: number; crowdingLowerMm?: number; tmjFindings?: string; notes?: string;
  }): Promise<OcclusionAnalysis> {
    const { rows: caseRows } = await this.db.query(
      `SELECT id FROM cases WHERE id=$1 AND organization_id=$2`, [caseId, orgId],
    );
    if (!caseRows[0]) throw new NotFoundException('Case not found');
    const { rows } = await this.db.query(
      `INSERT INTO occlusion_analyses
         (organization_id, case_id, analysis_date, angle_class, overjet_mm, overbite_mm,
          midline_shift_mm, crossbite_teeth, open_bite_teeth, crowding_upper_mm, crowding_lower_mm,
          tmj_findings, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [orgId, caseId, dto.analysisDate, dto.angleClass ?? null, dto.overjetMm ?? null,
       dto.overbitemm ?? null, dto.midlineShiftMm ?? null,
       dto.crossbiteTeeth ?? [], dto.openBiteTeeth ?? [],
       dto.crowdingUpperMm ?? null, dto.crowdingLowerMm ?? null,
       dto.tmjFindings ?? null, dto.notes ?? null, recordedBy],
    );
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): OcclusionAnalysis {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      caseId: r['case_id'] as string, analysisDate: String(r['analysis_date']),
      angleClass: r['angle_class'] as string | null,
      overjetMm: r['overjet_mm'] as number | null, overbitemm: r['overbite_mm'] as number | null,
      midlineShiftMm: r['midline_shift_mm'] as number | null,
      crossbiteTeeth: (r['crossbite_teeth'] as number[]) ?? [],
      openBiteTeeth: (r['open_bite_teeth'] as number[]) ?? [],
      crowdingUpperMm: r['crowding_upper_mm'] as number | null,
      crowdingLowerMm: r['crowding_lower_mm'] as number | null,
      tmjFindings: r['tmj_findings'] as string | null, notes: r['notes'] as string | null,
      recordedBy: r['recorded_by'] as string, createdAt: String(r['created_at']),
    };
  }
}
