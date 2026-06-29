import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface Vendor { id: string; name: string; contactName: string | null; email: string | null; phone: string | null; active: boolean; createdAt: string }
export interface PurchaseOrder { id: string; vendorId: string; poNumber: string; status: string; orderedAt: string | null; expectedDate: string | null; receivedAt: string | null; totalCents: number | null; notes: string | null; createdAt: string; items: PoItem[] }
interface PoItem { id: string; description: string; quantity: number; receivedQuantity: number; unitPriceCents: number | null }

let poSeq = 1;
function genPoNumber() { return `PO-${String(poSeq++).padStart(5, '0')}`; }

@Injectable()
export class SupplyChainService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listVendors(orgId: string): Promise<Vendor[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM vendors WHERE organization_id=$1 AND active=TRUE ORDER BY name', [orgId],
    );
    return rows.map(this.mapVendor);
  }

  async createVendor(orgId: string, dto: { name: string; contactName?: string; email?: string; phone?: string; website?: string; notes?: string }): Promise<Vendor> {
    const { rows } = await this.db.query(
      `INSERT INTO vendors (organization_id, name, contact_name, email, phone, website, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [orgId, dto.name, dto.contactName ?? null, dto.email ?? null, dto.phone ?? null, dto.website ?? null, dto.notes ?? null],
    );
    return this.mapVendor(rows[0]);
  }

  async listOrders(orgId: string, status?: string): Promise<PurchaseOrder[]> {
    const { rows } = await this.db.query(
      `SELECT po.*, json_agg(poi ORDER BY poi.id) AS items
       FROM purchase_orders po
       LEFT JOIN purchase_order_items poi ON poi.purchase_order_id=po.id
       WHERE po.organization_id=$1 ${status ? 'AND po.status=$2' : ''}
       GROUP BY po.id ORDER BY po.created_at DESC LIMIT 100`,
      status ? [orgId, status] : [orgId],
    );
    return rows.map(r => this.mapOrder(r));
  }

  async createOrder(orgId: string, createdBy: string, dto: {
    vendorId: string; orderedAt?: string; expectedDate?: string; notes?: string;
    items: { description: string; quantity: number; unitPriceCents?: number; inventoryItemId?: string }[];
  }): Promise<PurchaseOrder> {
    const { rows: v } = await this.db.query('SELECT id FROM vendors WHERE id=$1 AND organization_id=$2', [dto.vendorId, orgId]);
    if (!v[0]) throw new NotFoundException('Vendor not found');
    if (!dto.items?.length) throw new BadRequestException('At least one item required');

    const poNumber = genPoNumber();
    const { rows: [po] } = await this.db.query(
      `INSERT INTO purchase_orders (organization_id, vendor_id, po_number, ordered_at, expected_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [orgId, dto.vendorId, poNumber, dto.orderedAt ?? null, dto.expectedDate ?? null, dto.notes ?? null, createdBy],
    );

    for (const item of dto.items) {
      await this.db.query(
        `INSERT INTO purchase_order_items (purchase_order_id, description, quantity, unit_price_cents, inventory_item_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [po['id'], item.description, item.quantity, item.unitPriceCents ?? null, item.inventoryItemId ?? null],
      );
    }
    return (await this.listOrders(orgId)).find(o => o.id === po['id'])!;
  }

  async updateOrderStatus(orderId: string, orgId: string, status: string): Promise<PurchaseOrder> {
    const valid = ['draft','sent','confirmed','received','cancelled'];
    if (!valid.includes(status)) throw new BadRequestException('Invalid status');
    const updates: Record<string, string> = { received: 'received_at=CURRENT_DATE,' };
    const { rows } = await this.db.query(
      `UPDATE purchase_orders SET status=$2, ${updates[status] ?? ''}updated_at=now() WHERE id=$1 AND organization_id=$3 RETURNING *`,
      [orderId, status, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Purchase order not found');
    const orders = await this.listOrders(orgId);
    return orders.find(o => o.id === orderId)!;
  }

  private mapVendor(r: Record<string, unknown>): Vendor {
    return {
      id: r['id'] as string, name: r['name'] as string, contactName: r['contact_name'] as string | null,
      email: r['email'] as string | null, phone: r['phone'] as string | null, active: r['active'] as boolean,
      createdAt: String(r['created_at']),
    };
  }

  private mapOrder(r: Record<string, unknown>): PurchaseOrder {
    const rawItems = r['items'] as Record<string, unknown>[] | null;
    const items: PoItem[] = (rawItems ?? []).filter(i => i && i['id']).map(i => ({
      id: i['id'] as string, description: i['description'] as string,
      quantity: i['quantity'] as number, receivedQuantity: i['received_quantity'] as number,
      unitPriceCents: i['unit_price_cents'] as number | null,
    }));
    return {
      id: r['id'] as string, vendorId: r['vendor_id'] as string,
      poNumber: r['po_number'] as string, status: r['status'] as string,
      orderedAt: r['ordered_at'] ? String(r['ordered_at']) : null,
      expectedDate: r['expected_date'] ? String(r['expected_date']) : null,
      receivedAt: r['received_at'] ? String(r['received_at']) : null,
      totalCents: r['total_cents'] as number | null, notes: r['notes'] as string | null,
      createdAt: String(r['created_at']), items,
    };
  }
}
