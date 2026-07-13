import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface Shipment {
  id: string;
  organizationId: string;
  batchId: string | null;
  courier: string | null;
  trackingNumber: string | null;
  carrierService: string | null;
  shippedAt: string | null;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  status: string;
  recipientName: string | null;
  recipientAddress: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ShipmentStatus =
  | 'pending'
  | 'label_printed'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'returned';

const VALID_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending: ['label_printed', 'exception'],
  label_printed: ['in_transit', 'exception'],
  in_transit: ['out_for_delivery', 'exception'],
  out_for_delivery: ['delivered', 'exception'],
  exception: ['in_transit', 'returned'],
  delivered: [],
  returned: [],
};

@Injectable()
export class LabShipmentsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async list(orgId: string, status?: string): Promise<Shipment[]> {
    const hasStatus = status != null && status !== '';
    const { rows } = await this.db.query(
      `SELECT * FROM shipments WHERE organization_id=$1${hasStatus ? ' AND status=$2' : ''} ORDER BY created_at DESC`,
      hasStatus ? [orgId, status] : [orgId],
    );
    return rows.map(this.mapShipment);
  }

  async create(
    orgId: string,
    createdBy: string,
    dto: {
      batchId?: string;
      courier?: string;
      trackingNumber?: string;
      carrierService?: string;
      estimatedDelivery?: string;
      recipientName?: string;
      recipientAddress?: string;
      notes?: string;
    },
  ): Promise<Shipment> {
    const { rows } = await this.db.query(
      `INSERT INTO shipments
         (organization_id, batch_id, courier, tracking_number, carrier_service,
          estimated_delivery, recipient_name, recipient_address, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        orgId,
        dto.batchId ?? null,
        dto.courier ?? null,
        dto.trackingNumber ?? null,
        dto.carrierService ?? null,
        dto.estimatedDelivery ?? null,
        dto.recipientName ?? null,
        dto.recipientAddress ?? null,
        dto.notes ?? null,
        createdBy,
      ],
    );
    return this.mapShipment(rows[0]);
  }

  async updateStatus(
    id: string,
    orgId: string,
    newStatus: string,
  ): Promise<Shipment> {
    const { rows: current } = await this.db.query(
      `SELECT status FROM shipments WHERE id=$1 AND organization_id=$2`,
      [id, orgId],
    );
    if (!current[0]) throw new NotFoundException('Shipment not found');

    const currentStatus = current[0]['status'] as ShipmentStatus;
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus as ShipmentStatus)) {
      throw new BadRequestException(
        `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const isDelivered = newStatus === 'delivered';
    const { rows } = await this.db.query(
      `UPDATE shipments
       SET status=$3,
           delivered_at=${isDelivered ? 'now()' : 'delivered_at'},
           updated_at=now()
       WHERE id=$1 AND organization_id=$2
       RETURNING *`,
      [id, orgId, newStatus],
    );
    if (!rows[0]) throw new NotFoundException('Shipment not found');
    return this.mapShipment(rows[0]);
  }

  async addTracking(
    id: string,
    orgId: string,
    dto: {
      courier: string;
      trackingNumber: string;
      carrierService?: string;
      estimatedDelivery?: string;
    },
  ): Promise<Shipment> {
    const { rows } = await this.db.query(
      `UPDATE shipments
       SET courier=$3,
           tracking_number=$4,
           carrier_service=$5,
           estimated_delivery=$6,
           updated_at=now()
       WHERE id=$1 AND organization_id=$2
       RETURNING *`,
      [
        id,
        orgId,
        dto.courier,
        dto.trackingNumber,
        dto.carrierService ?? null,
        dto.estimatedDelivery ?? null,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Shipment not found');
    return this.mapShipment(rows[0]);
  }

  async getShipmentHistory(
    orgId: string,
  ): Promise<(Shipment & { batchNumber: string | null })[]> {
    const { rows } = await this.db.query(
      `SELECT s.*, mb.batch_number
       FROM shipments s
       LEFT JOIN manufacturing_batches mb ON mb.id = s.batch_id
       WHERE s.organization_id=$1
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [orgId],
    );
    return rows.map((r) => ({
      ...this.mapShipment(r),
      batchNumber: (r['batch_number'] as string | null) ?? null,
    }));
  }

  private mapShipment(r: Record<string, unknown>): Shipment {
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      batchId: (r['batch_id'] as string | null) ?? null,
      courier: (r['courier'] as string | null) ?? null,
      trackingNumber: (r['tracking_number'] as string | null) ?? null,
      carrierService: (r['carrier_service'] as string | null) ?? null,
      shippedAt: r['shipped_at'] != null ? String(r['shipped_at']) : null,
      estimatedDelivery:
        r['estimated_delivery'] != null
          ? String(r['estimated_delivery'])
          : null,
      deliveredAt:
        r['delivered_at'] != null ? String(r['delivered_at']) : null,
      status: r['status'] as string,
      recipientName: (r['recipient_name'] as string | null) ?? null,
      recipientAddress: (r['recipient_address'] as string | null) ?? null,
      notes: (r['notes'] as string | null) ?? null,
      createdBy: r['created_by'] as string,
      createdAt: String(r['created_at']),
      updatedAt: String(r['updated_at']),
    };
  }
}
