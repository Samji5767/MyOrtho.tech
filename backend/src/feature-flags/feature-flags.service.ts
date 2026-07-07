import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface FeatureFlag {
  id: string;
  flagName: string;
  description: string | null;
  enabled: boolean;
  rolloutPercent: number;
  organizationId: string | null;
  createdAt: string;
}

@Injectable()
export class FeatureFlagsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listFlags(orgId: string): Promise<FeatureFlag[]> {
    // DISTINCT ON (flag_name) picks org-specific override over global default when both exist
    const { rows } = await this.db.query(
      `SELECT DISTINCT ON (flag_name) * FROM feature_flags
       WHERE organization_id=$1 OR organization_id IS NULL
       ORDER BY flag_name, organization_id NULLS LAST`,
      [orgId],
    );
    return rows.map(r => this.map(r));
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

  async createFlag(orgId: string, dto: {
    flagName: string; description?: string; rolloutPercent?: number;
  }): Promise<FeatureFlag> {
    const { rows } = await this.db.query(
      `INSERT INTO feature_flags (organization_id, flag_name, description, is_enabled, rollout_percent)
       VALUES ($1,$2,$3,false,$4) RETURNING *`,
      [orgId, dto.flagName, dto.description ?? null, dto.rolloutPercent ?? 100],
    );
    return this.map(rows[0]);
  }

  async updateFlagById(id: string, orgId: string, dto: {
    enabled?: boolean; rolloutPercent?: number;
  }): Promise<FeatureFlag> {
    const sets: string[] = [];
    const vals: unknown[] = [id, orgId];
    if (dto.enabled !== undefined) { sets.push(`is_enabled=$${vals.length + 1}`); vals.push(dto.enabled); }
    if (dto.rolloutPercent !== undefined) { sets.push(`rollout_percent=$${vals.length + 1}`); vals.push(dto.rolloutPercent); }
    if (!sets.length) throw new BadRequestException('No fields to update');
    sets.push('updated_at=now()');
    const { rows } = await this.db.query(
      `UPDATE feature_flags SET ${sets.join(', ')} WHERE id=$1 AND organization_id=$2 RETURNING *`,
      vals,
    );
    if (!rows[0]) throw new NotFoundException('Feature flag not found');
    return this.map(rows[0]);
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
      id: r['id'] as string,
      flagName: r['flag_name'] as string,
      description: r['description'] as string | null,
      enabled: r['is_enabled'] as boolean,
      rolloutPercent: r['rollout_percent'] as number,
      organizationId: r['organization_id'] as string | null,
      createdAt: String(r['created_at']),
    };
  }
}
