import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface IntegrationProvider {
  id: string;
  organizationId: string;
  providerType: string;
  name: string;
  vendor: string | null;
  version: string | null;
  configJson: Record<string, unknown>;
  healthStatus: string;
  lastCheckedAt: string | null;
  capabilitiesJson: unknown[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationHealthLog {
  id: string;
  organizationId: string;
  providerId: string;
  status: string;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

const VALID_PROVIDER_TYPES = [
  'dicom_pacs', 'hl7_fhir', 'pms', 'scanner',
  'printer', 'payment', 'email', 'sms', 'calendar',
];

const VALID_HEALTH_STATUSES = ['healthy', 'degraded', 'unhealthy', 'unknown'];

@Injectable()
export class IntegrationProvidersService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, type?: string): Promise<IntegrationProvider[]> {
    const hasType = type != null && type !== '';
    const { rows } = await this.db.query(
      `SELECT * FROM integration_providers
       WHERE organization_id = $1 ${hasType ? 'AND provider_type = $2' : ''}
       ORDER BY provider_type, name`,
      hasType ? [orgId, type] : [orgId],
    );
    return rows.map(this.map);
  }

  async get(id: string, orgId: string): Promise<IntegrationProvider> {
    const { rows } = await this.db.query(
      `SELECT * FROM integration_providers WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Integration provider not found');
    return this.map(rows[0]);
  }

  async create(
    orgId: string,
    createdBy: string,
    dto: {
      providerType: string;
      name: string;
      vendor?: string;
      version?: string;
      configJson?: Record<string, unknown>;
      capabilitiesJson?: unknown[];
      enabled?: boolean;
    },
  ): Promise<IntegrationProvider> {
    if (!VALID_PROVIDER_TYPES.includes(dto.providerType)) {
      throw new BadRequestException(
        `Invalid provider type. Valid types: ${VALID_PROVIDER_TYPES.join(', ')}`,
      );
    }
    const { rows } = await this.db.query(
      `INSERT INTO integration_providers
         (organization_id, provider_type, name, vendor, version, config_json, capabilities_json, enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        orgId,
        dto.providerType,
        dto.name,
        dto.vendor ?? null,
        dto.version ?? null,
        JSON.stringify(dto.configJson ?? {}),
        JSON.stringify(dto.capabilitiesJson ?? []),
        dto.enabled ?? true,
        createdBy,
      ],
    );
    return this.map(rows[0]);
  }

  async update(
    id: string,
    orgId: string,
    dto: Partial<{
      name: string;
      vendor: string;
      version: string;
      configJson: Record<string, unknown>;
      capabilitiesJson: unknown[];
      enabled: boolean;
    }>,
  ): Promise<IntegrationProvider> {
    const sets: string[] = [];
    const params: unknown[] = [id, orgId];

    if (dto.name !== undefined) { params.push(dto.name); sets.push(`name = $${params.length}`); }
    if (dto.vendor !== undefined) { params.push(dto.vendor); sets.push(`vendor = $${params.length}`); }
    if (dto.version !== undefined) { params.push(dto.version); sets.push(`version = $${params.length}`); }
    if (dto.configJson !== undefined) { params.push(JSON.stringify(dto.configJson)); sets.push(`config_json = $${params.length}`); }
    if (dto.capabilitiesJson !== undefined) { params.push(JSON.stringify(dto.capabilitiesJson)); sets.push(`capabilities_json = $${params.length}`); }
    if (dto.enabled !== undefined) { params.push(dto.enabled); sets.push(`enabled = $${params.length}`); }

    if (sets.length === 0) return this.get(id, orgId);

    sets.push(`updated_at = NOW()`);
    const { rows } = await this.db.query(
      `UPDATE integration_providers SET ${sets.join(', ')} WHERE id = $1 AND organization_id = $2 RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Integration provider not found');
    return this.map(rows[0]);
  }

  async recordHealthCheck(
    id: string,
    orgId: string,
    dto: { status: string; responseTimeMs?: number; errorMessage?: string },
  ): Promise<{ provider: IntegrationProvider; log: IntegrationHealthLog }> {
    if (!VALID_HEALTH_STATUSES.includes(dto.status)) {
      throw new BadRequestException(`Invalid status. Valid: ${VALID_HEALTH_STATUSES.join(', ')}`);
    }

    const [providerResult, logResult] = await Promise.all([
      this.db.query(
        `UPDATE integration_providers
         SET health_status = $3, last_checked_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND organization_id = $2
         RETURNING *`,
        [id, orgId, dto.status],
      ),
      this.db.query(
        `INSERT INTO integration_health_logs
           (organization_id, provider_id, status, response_time_ms, error_message)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [orgId, id, dto.status, dto.responseTimeMs ?? null, dto.errorMessage ?? null],
      ),
    ]);

    if (!providerResult.rows[0]) throw new NotFoundException('Integration provider not found');

    return {
      provider: this.map(providerResult.rows[0]),
      log: this.mapLog(logResult.rows[0]),
    };
  }

  async getHealthLogs(id: string, orgId: string, limit = 50): Promise<IntegrationHealthLog[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM integration_health_logs
       WHERE provider_id = $1 AND organization_id = $2
       ORDER BY checked_at DESC
       LIMIT $3`,
      [id, orgId, limit],
    );
    return rows.map(this.mapLog);
  }

  private map(r: Record<string, unknown>): IntegrationProvider {
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      providerType: r['provider_type'] as string,
      name: r['name'] as string,
      vendor: (r['vendor'] as string | null) ?? null,
      version: (r['version'] as string | null) ?? null,
      configJson: (r['config_json'] as Record<string, unknown>) ?? {},
      healthStatus: r['health_status'] as string,
      lastCheckedAt: r['last_checked_at'] ? String(r['last_checked_at']) : null,
      capabilitiesJson: (r['capabilities_json'] as unknown[]) ?? [],
      enabled: Boolean(r['enabled']),
      createdBy: r['created_by'] as string,
      createdAt: String(r['created_at']),
      updatedAt: String(r['updated_at']),
    };
  }

  private mapLog(r: Record<string, unknown>): IntegrationHealthLog {
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      providerId: r['provider_id'] as string,
      status: r['status'] as string,
      responseTimeMs: r['response_time_ms'] != null ? Number(r['response_time_ms']) : null,
      errorMessage: (r['error_message'] as string | null) ?? null,
      checkedAt: String(r['checked_at']),
    };
  }
}
