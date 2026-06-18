import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { 
  ScannerConnector, 
  ThreeShapeConnector, 
  MeditLinkConnector, 
  IteroConnector, 
  Shining3DConnector,
  CarestreamConnector,
  ScanMetadata,
  CoordinateMap
} from './connectors/scanner.connector';

@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name);
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'placeholder'
  );

  constructor(
    private readonly threeShapeConnector: ThreeShapeConnector,
    private readonly meditLinkConnector: MeditLinkConnector,
    private readonly iteroConnector: IteroConnector,
    private readonly shining3DConnector: Shining3DConnector,
    private readonly carestreamConnector: CarestreamConnector,
  ) {}

  /**
   * Resolves scanner connector class matching a given vendor string.
   */
  getConnector(vendor: string): ScannerConnector {
    switch (vendor.toLowerCase()) {
      case '3shape':
        return this.threeShapeConnector;
      case 'medit':
        return this.meditLinkConnector;
      case 'itero':
        return this.iteroConnector;
      case 'shining3d':
        return this.shining3DConnector;
      case 'carestream':
        return this.carestreamConnector;
      default:
        throw new NotFoundException(`Scanner connector vendor '${vendor}' is not supported.`);
    }
  }

  /**
   * Orchestrates pulling scans from physical scanner devices and registering them to patient cases.
   */
  async importScanFromDevice(
    organizationId: string,
    vendor: string,
    externalId: string
  ): Promise<{ metadata: ScanMetadata; coordinates: CoordinateMap }> {
    this.logger.log(`Initiating mesh import: Org: ${organizationId}, Vendor: ${vendor}, ExtId: ${externalId}`);
    
    // 1. Fetch credentials/config from scanner_integrations DB table
    let config: any = null;
    try {
      const { data, error } = await this.supabase
        .from('scanner_integrations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('vendor', vendor)
        .eq('is_active', true)
        .single();
      
      if (!error && data) {
        config = data;
      }
    } catch (err) {
      this.logger.warn(`Database query failed for scanner integrations: ${err.message}. Using bypass credentials.`);
    }

    if (!config) {
      this.logger.warn(`No active scanner credentials found in database for Org: ${organizationId}, Vendor: ${vendor}. Running in developer bypass mode.`);
      config = {
        client_id: 'sandbox-client-id',
        client_secret: 'sandbox-client-secret',
        patient_id: 'ext-p-mock-1'
      };
    }

    const connector = this.getConnector(vendor);
    
    // 2. Perform authentication handshake
    await connector.authenticate(config);

    // 3. Fetch scan case files metadata
    const metadata = await connector.getScanMetadata(externalId, config);

    // 4. Download actual binary mesh files
    const meshBinary = await connector.fetchMeshBinary(externalId, config);

    // 5. Align coordinate maps to standard orthodontic Cartesian plane
    const coordinates = await connector.alignCoordinateSpace(meshBinary);

    return {
      metadata,
      coordinates,
    };
  }
}
