import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface DeviceBatch {
  id: string; organizationId: string; batchCode: string; deviceType: string;
  materialLot: string | null; manufactureDate: string | null; expiryDate: string | null;
  caseIds: string[]; status: string; recallReason: string | null;
  recalledAt: string | null; createdAt: string;
}

@Injectable()
export class DeviceTrackingService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, status?: string): Promise<DeviceBatch[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM device_batches WHERE organization_id=$1 ${status ? 'AND status=$2' : ''} ORDER BY created_at DESC`,
      status ? [orgId, status] : [orgId],
    );
    return rows.map(this.map);
  }

  async create(orgId: string, dto: {
    batchCode: string; deviceType?: string; materialLot?: string;
    manufactureDate?: string; expiryDate?: string; caseIds?: string[];
  }): Promise<DeviceBatch> {
    const { rows } = await this.db.query(
      `INSERT INTO device_batches (organization_id, batch_code, device_type, material_lot, manufacture_date, expiry_date, case_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [orgId, dto.batchCode, dto.deviceType ?? 'aligner', dto.materialLot ?? null,
       dto.manufactureDate ?? null, dto.expiryDate ?? null, dto.caseIds ?? []],
    );
    return this.map(rows[0]);
  }

  async recall(id: string, orgId: string, reason: string): Promise<DeviceBatch> {
    const { rows } = await this.db.query(
      `UPDATE device_batches SET status='recalled', recall_reason=$3, recalled_at=now()
       WHERE id=$1 AND organization_id=$2 AND status='active' RETURNING *`,
      [id, orgId, reason],
    );
    if (!rows[0]) throw new NotFoundException('Batch not found or not active');
    return this.map(rows[0]);
  }

  async quarantine(id: string, orgId: string): Promise<DeviceBatch> {
    const { rows } = await this.db.query(
      `UPDATE device_batches SET status='quarantined' WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Batch not found');
    return this.map(rows[0]);
  }

  async addCases(id: string, orgId: string, caseIds: string[]): Promise<DeviceBatch> {
    const { rows } = await this.db.query(
      `UPDATE device_batches SET case_ids=array(SELECT DISTINCT unnest(case_ids || $3))
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, caseIds],
    );
    if (!rows[0]) throw new NotFoundException('Batch not found');
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): DeviceBatch {
    return {
      id: r['id'] as string, organizationId: r['organization_id'] as string,
      batchCode: r['batch_code'] as string, deviceType: r['device_type'] as string,
      materialLot: r['material_lot'] as string | null,
      manufactureDate: r['manufacture_date'] ? String(r['manufacture_date']) : null,
      expiryDate: r['expiry_date'] ? String(r['expiry_date']) : null,
      caseIds: (r['case_ids'] as string[]) ?? [], status: r['status'] as string,
      recallReason: r['recall_reason'] as string | null,
      recalledAt: r['recalled_at'] ? String(r['recalled_at']) : null,
      createdAt: String(r['created_at']),
    };
  }
}
