import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
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

    if (!rows[0]) {
      throw new NotFoundException(
        `No active scanner integration found for vendor '${vendor}'. ` +
        `Configure an integration under Settings → Scanner Integrations.`,
      );
    }

    const config = rows[0];

    const connector = this.getConnector(vendor);
    await connector.authenticate(config);
    const metadata = await connector.getScanMetadata(externalId, config);
    const meshBinary = await connector.fetchMeshBinary(externalId, config);
    const coordinates = await connector.alignCoordinateSpace(meshBinary);

    return { metadata, coordinates };
  }
}
