import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ScannerIntegrationRecord {
  id: string; organizationId: string; vendor: string;
  apiEndpoint: string | null; isActive: boolean; createdAt: string;
}
import {
  ScannerConnector,
  ThreeShapeConnector,
  MeditLinkConnector,
  IteroConnector,
  Shining3DConnector,
  CarestreamConnector,
  ScanMetadata,
  CoordinateMap,
} from './connectors/scanner.connector';

@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly threeShapeConnector: ThreeShapeConnector,
    private readonly meditLinkConnector: MeditLinkConnector,
    private readonly iteroConnector: IteroConnector,
    private readonly shining3DConnector: Shining3DConnector,
    private readonly carestreamConnector: CarestreamConnector,
  ) {}

  getConnector(vendor: string): ScannerConnector {
    switch (vendor.toLowerCase()) {
      case '3shape':    return this.threeShapeConnector;
      case 'medit':     return this.meditLinkConnector;
      case 'itero':     return this.iteroConnector;
      case 'shining3d': return this.shining3DConnector;
      case 'carestream':return this.carestreamConnector;
      default:
        throw new NotFoundException(`Scanner connector vendor '${vendor}' is not supported.`);
    }
  }

  // ─── Integration CRUD ───────────────────────────────────────────────────────

  private normalizeVendor(v: string): string {
    const MAP: Record<string, string> = {
      '3shape': '3Shape', 'medit': 'Medit', 'itero': 'iTero',
      'shining3d': 'Shining3D', 'carestream': 'Carestream',
    };
    return MAP[v.toLowerCase()] ?? v;
  }

  async listIntegrations(orgId: string): Promise<ScannerIntegrationRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT id, organization_id, vendor, api_endpoint, is_active, created_at
       FROM scanner_integrations WHERE organization_id=$1 ORDER BY vendor`,
      [orgId],
    );
    return rows.map((r) => ({
      id: r.id as string, organizationId: r.organization_id as string,
      vendor: r.vendor as string, apiEndpoint: r.api_endpoint as string | null,
      isActive: r.is_active as boolean, createdAt: r.created_at as string,
    }));
  }

  async upsertIntegration(orgId: string, dto: {
    vendor: string; apiEndpoint?: string | null; authCredentials?: Record<string, string>; isActive?: boolean;
  }): Promise<ScannerIntegrationRecord> {
    const vendor = this.normalizeVendor(dto.vendor);
    const { rows } = await this.pool.query(
      `INSERT INTO scanner_integrations (organization_id, vendor, api_endpoint, auth_credentials, is_active)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id, vendor) DO UPDATE
         SET api_endpoint=EXCLUDED.api_endpoint,
             auth_credentials=COALESCE(EXCLUDED.auth_credentials, scanner_integrations.auth_credentials),
             is_active=EXCLUDED.is_active
       RETURNING id, organization_id, vendor, api_endpoint, is_active, created_at`,
      [orgId, vendor, dto.apiEndpoint ?? null, JSON.stringify(dto.authCredentials ?? {}), dto.isActive ?? true],
    );
    const r = rows[0];
    return { id: r.id as string, organizationId: r.organization_id as string, vendor: r.vendor as string, apiEndpoint: r.api_endpoint as string | null, isActive: r.is_active as boolean, createdAt: r.created_at as string };
  }

  async updateIntegration(id: string, orgId: string, dto: {
    apiEndpoint?: string | null; authCredentials?: Record<string, string>; isActive?: boolean;
  }): Promise<ScannerIntegrationRecord> {
    const { rows } = await this.pool.query(
      `UPDATE scanner_integrations
       SET api_endpoint=COALESCE($3,api_endpoint),
           auth_credentials=CASE WHEN $4::jsonb IS NOT NULL THEN $4::jsonb ELSE auth_credentials END,
           is_active=COALESCE($5,is_active)
       WHERE id=$1 AND organization_id=$2
       RETURNING id, organization_id, vendor, api_endpoint, is_active, created_at`,
      [id, orgId, dto.apiEndpoint ?? null, dto.authCredentials ? JSON.stringify(dto.authCredentials) : null, dto.isActive ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Integration not found');
    const r = rows[0];
    return { id: r.id as string, organizationId: r.organization_id as string, vendor: r.vendor as string, apiEndpoint: r.api_endpoint as string | null, isActive: r.is_active as boolean, createdAt: r.created_at as string };
  }

  async importScanFromDevice(
    organizationId: string,
    vendor: string,
    externalId: string,
  ): Promise<{ metadata: ScanMetadata; coordinates: CoordinateMap }> {
    this.logger.log(`Mesh import: org=${organizationId} vendor=${vendor} ext=${externalId}`);

    const { rows } = await this.pool.query(
      `SELECT client_id, client_secret, endpoint_url
       FROM scanner_integrations
       WHERE organization_id = $1 AND vendor = $2 AND is_active = true
       LIMIT 1`,
      [organizationId, vendor],
    );

    const config = rows[0] ?? {
      client_id: 'sandbox-client-id',
      client_secret: 'sandbox-client-secret',
      patient_id: 'ext-p-sandbox-1',
    };

    if (!rows[0]) {
      this.logger.warn(`No scanner integration found for org=${organizationId} vendor=${vendor}. Using sandbox bypass.`);
    }

    const connector = this.getConnector(vendor);
    await connector.authenticate(config);
    const metadata = await connector.getScanMetadata(externalId, config);
    const meshBinary = await connector.fetchMeshBinary(externalId, config);
    const coordinates = await connector.alignCoordinateSpace(meshBinary);

    return { metadata, coordinates };
  }
}
