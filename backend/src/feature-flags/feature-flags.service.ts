import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface FeatureFlag {
  flagName: string; isEnabled: boolean; rolloutPercent: number;
  conditions: Record<string, unknown>; updatedAt: string;
}

@Injectable()
export class FeatureFlagsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listFlags(orgId: string): Promise<FeatureFlag[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM feature_flags WHERE organization_id=$1 OR organization_id IS NULL ORDER BY flag_name',
      [orgId],
    );
    return rows.map(this.map);
  }

  async getFlag(orgId: string, flagName: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT is_enabled, rollout_percent FROM feature_flags
       WHERE flag_name=$1 AND (organization_id=$2 OR organization_id IS NULL)
       ORDER BY organization_id NULLS LAST LIMIT 1`,
      [flagName, orgId],
    );
    if (!rows[0]) return false;
    if (!rows[0]['is_enabled']) return false;
    const rollout = rows[0]['rollout_percent'] as number;
    return rollout >= 100 || (Math.random() * 100) < rollout;
  }

  async setFlag(orgId: string, flagName: string, dto: {
    isEnabled: boolean; rolloutPercent?: number; conditions?: Record<string, unknown>;
  }): Promise<FeatureFlag> {
    const { rows } = await this.db.query(
      `INSERT INTO feature_flags (organization_id, flag_name, is_enabled, rollout_percent, conditions)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id, flag_name) DO UPDATE SET
         is_enabled=$3, rollout_percent=$4, conditions=$5, updated_at=now()
       RETURNING *`,
      [orgId, flagName, dto.isEnabled, dto.rolloutPercent ?? 100, JSON.stringify(dto.conditions ?? {})],
    );
    return this.map(rows[0]);
  }

  async evaluateFlags(orgId: string, flagNames: string[]): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    for (const name of flagNames) {
      result[name] = await this.getFlag(orgId, name);
    }
    return result;
  }

  private map(r: Record<string, unknown>): FeatureFlag {
    return {
      flagName: r['flag_name'] as string, isEnabled: r['is_enabled'] as boolean,
      rolloutPercent: r['rollout_percent'] as number,
      conditions: r['conditions'] as Record<string, unknown>,
      updatedAt: String(r['updated_at']),
    };
  }
}
