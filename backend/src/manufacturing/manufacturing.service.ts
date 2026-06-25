import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type { CreatePrintJobDto, JobStatus, CancelJobDto } from './manufacturing.dto';
import { ConnectorError, getConnector } from '../printers/connectors/printer.connector';

const CONNECTOR_DISCLAIMER =
  'Real-time printer control requires a vendor connector (Formlabs Dashboard / SprintRay Cloud). ' +
  'Connector not configured — status reflects database records only.';

@Injectable()
export class ManufacturingService {
  private readonly logger = new Logger(ManufacturingService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ── Print Jobs ──────────────────────────────────────────────────────────────

  async listJobs(orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT
         pj.id, pj.status, pj.gcode_path, pj.quality_score, pj.qc_notes,
         pj.failure_reason, pj.retry_count,
         pj.started_at, pj.completed_at, pj.created_at, pj.updated_at,
         pr.name AS printer_name, pr.brand AS printer_brand, pr.model AS printer_model,
         pr.status AS printer_status,
         pr.connector_status AS printer_connector_status,
         ast.stage_number
       FROM print_jobs pj
       LEFT JOIN printers pr ON pr.id = pj.printer_id
       LEFT JOIN aligner_stages ast ON ast.id = pj.stage_id
       WHERE pj.organization_id = $1
       ORDER BY pj.created_at DESC`,
      [orgId],
    );
    return rows.map((r) => this.formatJob(r));
  }

  async createJob(
    orgId: string,
    createdBy: string,
    dto: CreatePrintJobDto,
    actorEmail: string,
  ) {
    // Check connector state before queuing
    if (dto.printerId) {
      const { rows: printerRows } = await this.pool.query(
        `SELECT brand, connector_status FROM printers WHERE id = $1 AND organization_id = $2`,
        [dto.printerId, orgId],
      );
      if (!printerRows[0]) throw new NotFoundException('Printer not found');
      const brand = printerRows[0].brand as string;
      const connectorStatus = (printerRows[0].connector_status as string) ?? 'not_configured';

      if (connectorStatus === 'not_configured' || connectorStatus === 'connector_required') {
        const connector = getConnector(brand);
        try {
          await connector.sendPrintJob('', { jobId: '', gcodeUrl: '', sliceCount: 0, materialVolumeMl: 0 });
        } catch (err) {
          if (err instanceof ConnectorError) {
            throw new BadRequestException(
              `${CONNECTOR_DISCLAIMER}\n\nConnector error: ${err.message}`,
            );
          }
        }
      }
    }

    const { rows } = await this.pool.query(
      `INSERT INTO print_jobs
         (organization_id, printer_id, stage_id, gcode_path, status, qc_notes, created_by)
       VALUES ($1, $2, $3, $4, 'queued', $5, $6)
       RETURNING id, status, created_at`,
      [orgId, dto.printerId ?? null, dto.stageId ?? null, dto.gcodePath ?? null, dto.qcNotes ?? null, createdBy],
    );
    const job = rows[0];
    this.logger.log(`Print job ${job.id as string} created by ${actorEmail}`);
    return {
      id: job.id as string,
      status: job.status as string,
      createdAt: job.created_at as Date,
      connectorNote: CONNECTOR_DISCLAIMER,
    };
  }

  async getJob(id: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT
         pj.id, pj.status, pj.gcode_path, pj.quality_score, pj.qc_notes,
         pj.failure_reason, pj.retry_count,
         pj.started_at, pj.completed_at, pj.created_at, pj.updated_at,
         pr.name AS printer_name, pr.brand AS printer_brand, pr.model AS printer_model,
         pr.connector_status AS printer_connector_status,
         ast.stage_number
       FROM print_jobs pj
       LEFT JOIN printers pr ON pr.id = pj.printer_id
       LEFT JOIN aligner_stages ast ON ast.id = pj.stage_id
       WHERE pj.id = $1 AND pj.organization_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Print job not found');
    return { ...this.formatJob(rows[0]), connectorNote: CONNECTOR_DISCLAIMER };
  }

  async updateJobStatus(
    id: string,
    orgId: string,
    status: JobStatus,
    actorEmail: string,
    failureReason?: string,
  ) {
    const now = new Date();
    const startedAt = status === 'printing' ? now : null;
    const completedAt = ['completed', 'failed'].includes(status) ? now : null;

    const { rows } = await this.pool.query(
      `UPDATE print_jobs
       SET status = $1,
           started_at    = COALESCE($2, started_at),
           completed_at  = COALESCE($3, completed_at),
           failure_reason = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE failure_reason END,
           updated_at    = now()
       WHERE id = $5 AND organization_id = $6
       RETURNING id, status, updated_at`,
      [status, startedAt, completedAt, failureReason ?? null, id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Print job not found');
    this.logger.log(`Print job ${id} → ${status} by ${actorEmail}`);
    return {
      id: rows[0].id as string,
      status: rows[0].status as string,
      updatedAt: rows[0].updated_at as Date,
      connectorNote: CONNECTOR_DISCLAIMER,
    };
  }

  async retryJob(id: string, orgId: string, actorEmail: string) {
    const { rows } = await this.pool.query(
      `SELECT status FROM print_jobs WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Print job not found');
    if (rows[0].status !== 'failed') {
      throw new BadRequestException('Only failed jobs can be retried');
    }

    const { rows: updated } = await this.pool.query(
      `UPDATE print_jobs
       SET status = 'queued', failure_reason = null,
           retry_count = retry_count + 1,
           started_at = null, completed_at = null, updated_at = now()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, status, retry_count, updated_at`,
      [id, orgId],
    );
    this.logger.log(`Print job ${id} retried by ${actorEmail}`);
    return {
      id: updated[0].id as string,
      status: updated[0].status as string,
      retryCount: updated[0].retry_count as number,
      updatedAt: updated[0].updated_at as Date,
      connectorNote: CONNECTOR_DISCLAIMER,
    };
  }

  async cancelJob(id: string, orgId: string, dto: CancelJobDto, actorEmail: string) {
    const { rows } = await this.pool.query(
      `SELECT status FROM print_jobs WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Print job not found');
    const current = rows[0].status as string;
    if (['completed', 'failed'].includes(current)) {
      throw new BadRequestException('Cannot cancel a completed or failed job');
    }

    const { rows: updated } = await this.pool.query(
      `UPDATE print_jobs
       SET status = 'failed',
           failure_reason = $1,
           completed_at = now(),
           updated_at = now()
       WHERE id = $2 AND organization_id = $3
       RETURNING id, status, updated_at`,
      [dto.reason ?? 'Cancelled by user', id, orgId],
    );
    this.logger.log(`Print job ${id} cancelled by ${actorEmail}`);
    return {
      id: updated[0].id as string,
      status: updated[0].status as string,
      updatedAt: updated[0].updated_at as Date,
    };
  }

  // ── Printer Registry ────────────────────────────────────────────────────────

  async listPrinters(orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, name, brand, model, status, ip_address, firmware_version,
              material_type, material_volume_ml,
              connector_status, api_endpoint,
              created_at, updated_at
       FROM printers
       WHERE organization_id = $1
       ORDER BY name`,
      [orgId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      brand: r.brand as string,
      model: r.model as string,
      status: r.status as string,
      ipAddress: r.ip_address as string | null,
      firmwareVersion: r.firmware_version as string | null,
      materialType: r.material_type as string | null,
      materialVolumeMl: r.material_volume_ml as number,
      connectorStatus: (r.connector_status as string | null) ?? 'not_configured',
      apiEndpoint: r.api_endpoint as string | null,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
      connectorNote: CONNECTOR_DISCLAIMER,
    }));
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private formatJob(r: Record<string, unknown>) {
    return {
      id: r['id'] as string,
      status: r['status'] as string,
      gcodePath: r['gcode_path'] as string | null,
      qualityScore: r['quality_score'] as number | null,
      qcNotes: r['qc_notes'] as string | null,
      failureReason: r['failure_reason'] as string | null,
      retryCount: (r['retry_count'] as number) ?? 0,
      startedAt: r['started_at'] as Date | null,
      completedAt: r['completed_at'] as Date | null,
      createdAt: r['created_at'] as Date,
      updatedAt: r['updated_at'] as Date,
      printer: r['printer_name']
        ? {
            name: r['printer_name'] as string,
            brand: r['printer_brand'] as string,
            model: r['printer_model'] as string,
            status: r['printer_status'] as string,
            connectorStatus: (r['printer_connector_status'] as string | null) ?? 'not_configured',
          }
        : null,
      stageNumber: r['stage_number'] as number | null,
    };
  }
}
