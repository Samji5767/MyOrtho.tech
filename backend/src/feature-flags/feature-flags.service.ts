import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { createHash } from 'crypto';

export interface FeatureFlag {
  id: string;
  flagKey: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  allowedOrgIds: string[];
  createdAt: string;
}

@Injectable()
export class FeatureFlagsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listFlags(orgId: string): Promise<FeatureFlag[]> {
    // Return flags that are global (empty allowed_org_ids) OR include this org
    const { rows } = await this.db.query(
      `SELECT * FROM feature_flags
       WHERE array_length(allowed_org_ids, 1) IS NULL
          OR $1::uuid = ANY(allowed_org_ids)
       ORDER BY flag_key`,
      [orgId],
    );
    return rows.map(r => this.map(r));
  }

  async getFlag(orgId: string, flagKey: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT enabled, rollout_percentage FROM feature_flags
       WHERE flag_key=$1
         AND (array_length(allowed_org_ids, 1) IS NULL OR $2::uuid = ANY(allowed_org_ids))
       LIMIT 1`,
      [flagKey, orgId],
    );
    if (!rows[0]) return false;
    if (!rows[0]['enabled']) return false;
    const rollout = rows[0]['rollout_percentage'] as number;
    return rollout >= 100 || this.rolloutBucket(orgId, flagKey) < rollout;
  }

  async createFlag(orgId: string, dto: {
    flagKey: string; description?: string; rolloutPercentage?: number; forOrg?: boolean;
  }): Promise<FeatureFlag> {
    const allowedOrgs = dto.forOrg ? `ARRAY[$1::uuid]` : `'{}'::uuid[]`;
    const params = dto.forOrg
      ? [orgId, dto.flagKey, dto.description ?? null, dto.rolloutPercentage ?? 100]
      : [dto.flagKey, dto.description ?? null, dto.rolloutPercentage ?? 100];
    const { rows } = await this.db.query(
      dto.forOrg
        ? `INSERT INTO feature_flags (flag_key, description, enabled, rollout_percentage, allowed_org_ids)
           VALUES ($2,$3,false,$4,ARRAY[$1::uuid]) RETURNING *`
        : `INSERT INTO feature_flags (flag_key, description, enabled, rollout_percentage, allowed_org_ids)
           VALUES ($1,$2,false,$3,'{}') RETURNING *`,
      params,
    );
    return this.map(rows[0]);
  }

  async updateFlagById(id: string, _orgId: string, dto: {
    enabled?: boolean; rolloutPercentage?: number;
  }): Promise<FeatureFlag> {
    const sets: string[] = [];
    const vals: unknown[] = [id];
    if (dto.enabled !== undefined) { sets.push(`enabled=$${vals.length + 1}`); vals.push(dto.enabled); }
    if (dto.rolloutPercentage !== undefined) { sets.push(`rollout_percentage=$${vals.length + 1}`); vals.push(dto.rolloutPercentage); }
    if (!sets.length) throw new BadRequestException('No fields to update');
    sets.push('updated_at=now()');
    const { rows } = await this.db.query(
      `UPDATE feature_flags SET ${sets.join(', ')} WHERE id=$1 RETURNING *`,
      vals,
    );
    if (!rows[0]) throw new NotFoundException('Feature flag not found');
    return this.map(rows[0]);
  }

  async setFlag(orgId: string, flagKey: string, dto: {
    isEnabled: boolean; rolloutPercentage?: number;
  }): Promise<FeatureFlag> {
    const { rows } = await this.db.query(
      `INSERT INTO feature_flags (flag_key, enabled, rollout_percentage, allowed_org_ids)
       VALUES ($1,$2,$3,ARRAY[$4::uuid])
       ON CONFLICT (flag_key) DO UPDATE SET
         enabled=$2, rollout_percentage=$3, updated_at=now()
       RETURNING *`,
      [flagKey, dto.isEnabled, dto.rolloutPercentage ?? 100, orgId],
    );
    return this.map(rows[0]);
  }

  async evaluateFlags(orgId: string, flagKeys: string[]): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    for (const key of flagKeys) {
      result[key] = await this.getFlag(orgId, key);
    }
    return result;
  }

  /**
   * Returns a deterministic rollout bucket in [0, 100) for a given org + flag combination.
   * Using SHA-256 instead of Math.random() ensures the same org always falls in the same
   * bucket, making flag evaluation sticky across requests (consistent user experience).
   */
  private rolloutBucket(orgId: string, flagKey: string): number {
    const hash = createHash('sha256').update(`${flagKey}:${orgId}`).digest();
    return (hash.readUInt32BE(0) / 0xFFFFFFFF) * 100;
  }

  private map(r: Record<string, unknown>): FeatureFlag {
    return {
      id: r['id'] as string,
      flagKey: r['flag_key'] as string,
      description: r['description'] as string | null,
      enabled: r['enabled'] as boolean,
      rolloutPercentage: r['rollout_percentage'] as number,
      allowedOrgIds: (r['allowed_org_ids'] as string[]) ?? [],
      createdAt: String(r['created_at']),
    };
  }
}
