import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ProductionTelemetry {
  totalPrinters: number;
  onlinePrinters: number;
  queuedJobs: number;
  processingJobs: number;
  completedToday: number;
  failedToday: number;
}

@Injectable()
export class ManufacturingRouterService {
  private readonly logger = new Logger(ManufacturingRouterService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async routePrintJob(jobId: string, printerId: string): Promise<{ routed: boolean; printerId: string }> {
    this.logger.log(`Routing print job ${jobId} to printer ${printerId}`);
    await this.pool.query(
      `UPDATE print_jobs SET printer_id = $2, status = 'queued', updated_at = now()
       WHERE id = $1`,
      [jobId, printerId],
    );
    return { routed: true, printerId };
  }

  async getProductionTelemetry(orgId: string): Promise<ProductionTelemetry> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ rows: printerRows }, { rows: jobRows }] = await Promise.all([
      this.pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status != 'offline') as online,
           COUNT(*) as total
         FROM printers WHERE organization_id = $1`,
        [orgId],
      ),
      this.pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE pj.status = 'queued') as queued,
           COUNT(*) FILTER (WHERE pj.status = 'printing') as processing,
           COUNT(*) FILTER (WHERE pj.status = 'completed' AND pj.completed_at >= $2) as completed_today,
           COUNT(*) FILTER (WHERE pj.status = 'failed' AND pj.created_at >= $2) as failed_today
         FROM print_jobs pj
         JOIN printers pr ON pr.id = pj.printer_id
         WHERE pr.organization_id = $1`,
        [orgId, today],
      ),
    ]);

    const pr = printerRows[0] ?? {};
    const jr = jobRows[0] ?? {};
    return {
      totalPrinters: Number(pr.total ?? 0),
      onlinePrinters: Number(pr.online ?? 0),
      queuedJobs: Number(jr.queued ?? 0),
      processingJobs: Number(jr.processing ?? 0),
      completedToday: Number(jr.completed_today ?? 0),
      failedToday: Number(jr.failed_today ?? 0),
    };
  }
}
