import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface MaintenanceLog {
  id: string; printerId: string | null; maintenanceType: string; performedBy: string;
  performedAt: string; notes: string | null; nextDueDate: string | null; passed: boolean; createdAt: string;
}

@Injectable()
export class PrinterMaintenanceService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listLogs(orgId: string, printerId?: string): Promise<MaintenanceLog[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM printer_maintenance_logs WHERE organization_id=$1 ${printerId ? 'AND printer_id=$2' : ''} ORDER BY performed_at DESC LIMIT 100`,
      printerId ? [orgId, printerId] : [orgId],
    );
    return rows.map(this.map);
  }

  async logMaintenance(orgId: string, performedBy: string, dto: {
    printerId?: string; maintenanceType?: string; notes?: string;
    nextDueDate?: string; passed?: boolean; performedAt?: string;
  }): Promise<MaintenanceLog> {
    const { rows } = await this.db.query(
      `INSERT INTO printer_maintenance_logs
         (organization_id, printer_id, maintenance_type, performed_by, performed_at, notes, next_due_date, passed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, dto.printerId ?? null, dto.maintenanceType ?? 'routine', performedBy,
       dto.performedAt ? new Date(dto.performedAt) : new Date(),
       dto.notes ?? null, dto.nextDueDate ?? null, dto.passed ?? true],
    );
    return this.map(rows[0]);
  }

  async getDueForMaintenance(orgId: string): Promise<MaintenanceLog[]> {
    const { rows } = await this.db.query(
      `SELECT DISTINCT ON (printer_id) * FROM printer_maintenance_logs
       WHERE organization_id=$1 AND next_due_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY printer_id, performed_at DESC`,
      [orgId],
    );
    return rows.map(this.map);
  }

  private map(r: Record<string, unknown>): MaintenanceLog {
    return {
      id: r['id'] as string, printerId: r['printer_id'] as string | null,
      maintenanceType: r['maintenance_type'] as string, performedBy: r['performed_by'] as string,
      performedAt: String(r['performed_at']), notes: r['notes'] as string | null,
      nextDueDate: r['next_due_date'] ? String(r['next_due_date']) : null,
      passed: r['passed'] as boolean, createdAt: String(r['created_at']),
    };
  }
}
