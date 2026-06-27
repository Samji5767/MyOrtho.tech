import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { PrinterConnector, FormlabsConnector, SprintRayConnector } from './connectors/printer.connector';

@Injectable()
export class PrintersService {
  private readonly logger = new Logger(PrintersService.name);
  private readonly connectors: Map<string, PrinterConnector> = new Map();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    this.connectors.set('formlabs', new FormlabsConnector());
    this.connectors.set('sprintray', new SprintRayConnector());
  }

  async getTelemetry(printerId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, name, brand, status, api_endpoint, material_volume_ml
       FROM printers WHERE id = $1 AND organization_id = $2`,
      [printerId, orgId],
    );
    const printer = rows[0];
    if (!printer) throw new NotFoundException('Printer not found');

    const connector = this.connectors.get((printer.brand as string).toLowerCase());
    if (!connector || !printer.api_endpoint) {
      return { status: printer.status, materialVolumeMl: printer.material_volume_ml, connectorStatus: 'disconnected' };
    }
    try {
      await connector.connect(printer.api_endpoint as string);
      return await connector.getTelemetry(printer.api_endpoint as string);
    } catch {
      return { status: 'offline', connectorStatus: 'error' };
    }
  }

  async submitJob(printerId: string, orgId: string, jobDetails: { id: string; gcodePath?: string; materialVolumeMl?: number }) {
    const { rows } = await this.pool.query(
      `SELECT id, brand, api_endpoint FROM printers WHERE id = $1 AND organization_id = $2`,
      [printerId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Printer not found');
    const printer = rows[0];

    const connector = this.connectors.get((printer.brand as string).toLowerCase());
    if (!connector || !printer.api_endpoint) {
      await this.pool.query(
        `UPDATE print_jobs SET status = 'queued', updated_at = now() WHERE id = $1`,
        [jobDetails.id],
      );
      return { success: true, connectorNote: 'Connector not configured — job queued in database' };
    }
    await connector.connect(printer.api_endpoint as string);
    const ok = await connector.sendPrintJob(printer.api_endpoint as string, {
      jobId: jobDetails.id,
      gcodeUrl: jobDetails.gcodePath ?? '',
      sliceCount: 500,
      materialVolumeMl: jobDetails.materialVolumeMl ?? 12.5,
    });
    if (ok) {
      await this.pool.query(
        `UPDATE print_jobs SET status = 'printing', started_at = now(), printer_id = $2, updated_at = now() WHERE id = $1`,
        [jobDetails.id, printerId],
      );
    }
    return { success: ok };
  }

  async rerouteFailedJob(jobId: string, orgId: string): Promise<{ success: boolean; newPrinterId?: string; error?: string }> {
    const { rows: jobRows } = await this.pool.query(
      `SELECT pj.id, pj.printer_id FROM print_jobs pj
       JOIN printers pr ON pr.id = pj.printer_id
       WHERE pj.id = $1 AND pr.organization_id = $2`,
      [jobId, orgId],
    );
    if (!jobRows[0]) return { success: false, error: 'Job not found' };

    const { rows: candidates } = await this.pool.query(
      `SELECT id FROM printers
       WHERE organization_id = $1 AND status = 'idle' AND id != $2
       LIMIT 1`,
      [orgId, jobRows[0].printer_id],
    );
    if (!candidates[0]) {
      await this.pool.query(`UPDATE print_jobs SET status = 'failed', updated_at = now() WHERE id = $1`, [jobId]);
      return { success: false, error: 'No idle printer available' };
    }
    const result = await this.submitJob(candidates[0].id as string, orgId, { id: jobId });
    if (result.success) return { success: true, newPrinterId: candidates[0].id as string };
    return { success: false, error: 'Reroute submission failed' };
  }
}
