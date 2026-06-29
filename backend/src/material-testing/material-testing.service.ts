import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface MaterialTest {
  id: string; organizationId: string; materialName: string; lotNumber: string | null;
  testDate: string; testType: string; resultValue: number | null; resultUnit: string | null;
  passThreshold: number | null; passed: boolean | null; testedBy: string;
  notes: string | null; createdAt: string;
}

@Injectable()
export class MaterialTestingService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, materialName?: string): Promise<MaterialTest[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM material_tests WHERE organization_id=$1 ${materialName ? 'AND material_name=$2' : ''} ORDER BY test_date DESC`,
      materialName ? [orgId, materialName] : [orgId],
    );
    return rows.map(this.map);
  }

  async create(orgId: string, testedBy: string, dto: {
    materialName: string; lotNumber?: string; testDate: string; testType?: string;
    resultValue?: number; resultUnit?: string; passThreshold?: number; notes?: string;
  }): Promise<MaterialTest> {
    const passed = dto.resultValue !== undefined && dto.passThreshold !== undefined
      ? dto.resultValue >= dto.passThreshold
      : null;
    const { rows } = await this.db.query(
      `INSERT INTO material_tests (organization_id, material_name, lot_number, test_date, test_type, result_value, result_unit, pass_threshold, passed, tested_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [orgId, dto.materialName, dto.lotNumber ?? null, dto.testDate, dto.testType ?? 'hardness',
       dto.resultValue ?? null, dto.resultUnit ?? null, dto.passThreshold ?? null,
       passed, testedBy, dto.notes ?? null],
    );
    return this.map(rows[0]);
  }

  async getStats(orgId: string): Promise<{ byMaterial: Record<string, { total: number; passed: number; passRate: number }> }> {
    const { rows } = await this.db.query(
      `SELECT material_name,
         COUNT(*)::int AS total,
         COUNT(CASE WHEN passed=true THEN 1 END)::int AS passed
       FROM material_tests WHERE organization_id=$1 GROUP BY material_name`,
      [orgId],
    );
    const byMaterial: Record<string, { total: number; passed: number; passRate: number }> = {};
    for (const r of rows) {
      const total = r['total'] as number;
      const passed = r['passed'] as number;
      byMaterial[r['material_name'] as string] = { total, passed, passRate: total > 0 ? Math.round((passed / total) * 100) : 0 };
    }
    return { byMaterial };
  }

  private map(r: Record<string, unknown>): MaterialTest {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      materialName: r['material_name'] as string, lotNumber: r['lot_number'] as string | null,
      testDate: String(r['test_date']), testType: r['test_type'] as string,
      resultValue: r['result_value'] as number | null, resultUnit: r['result_unit'] as string | null,
      passThreshold: r['pass_threshold'] as number | null, passed: r['passed'] as boolean | null,
      testedBy: r['tested_by'] as string, notes: r['notes'] as string | null,
      createdAt: String(r['created_at']),
    };
  }
}
