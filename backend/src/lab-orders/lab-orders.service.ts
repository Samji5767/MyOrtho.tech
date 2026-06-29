import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface LabOrder {
  id: string;
  caseId: string;
  orderNumber: string;
  labName: string;
  status: string;
  priority: string;
  dueDate: string | null;
  specialInstructions: string | null;
  submittedAt: string | null;
  deliveredAt: string | null;
  items: LabOrderItem[];
  createdAt: string;
}

export interface LabOrderItem {
  id: string;
  itemType: string;
  arch: string | null;
  quantity: number;
  stageFrom: number | null;
  stageTo: number | null;
  material: string | null;
  notes: string | null;
}

@Injectable()
export class LabOrdersService {
  private readonly log = new Logger(LabOrdersService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  private async nextOrderNumber(orgId: string): Promise<string> {
    const { rows } = await this.db.query(
      `SELECT COUNT(*)+1 as num FROM lab_orders WHERE organization_id=$1`, [orgId],
    );
    const num = parseInt(rows[0]?.num ?? '1', 10);
    return `LO-${num.toString().padStart(4, '0')}`;
  }

  async listOrders(caseId: string, orgId: string): Promise<LabOrder[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      `SELECT lo.*,
              COALESCE(
                json_agg(loi.* ORDER BY loi.created_at) FILTER (WHERE loi.id IS NOT NULL),
                '[]'
              ) as items
       FROM lab_orders lo
       LEFT JOIN lab_order_items loi ON loi.order_id = lo.id
       WHERE lo.case_id=$1 AND lo.organization_id=$2
       GROUP BY lo.id ORDER BY lo.created_at DESC`,
      [caseId, orgId],
    );
    return rows.map(this.mapOrder);
  }

  async createOrder(caseId: string, orgId: string, dto: {
    labName?: string;
    priority?: string;
    dueDate?: string;
    specialInstructions?: string;
    items?: Array<{ itemType: string; arch?: string; quantity?: number; stageFrom?: number; stageTo?: number; material?: string; notes?: string }>;
  }): Promise<LabOrder> {
    await this.verifyCase(caseId, orgId);
    const orderNumber = await this.nextOrderNumber(orgId);
    const { rows } = await this.db.query(
      `INSERT INTO lab_orders (organization_id, case_id, order_number, lab_name, priority, due_date, special_instructions)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [orgId, caseId, orderNumber, dto.labName ?? 'In-House Lab', dto.priority ?? 'standard', dto.dueDate ?? null, dto.specialInstructions ?? null],
    );
    const order = rows[0];

    const items: LabOrderItem[] = [];
    for (const item of dto.items ?? []) {
      const { rows: itemRows } = await this.db.query(
        `INSERT INTO lab_order_items (order_id, item_type, arch, quantity, stage_from, stage_to, material, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [order['id'], item.itemType, item.arch ?? null, item.quantity ?? 1, item.stageFrom ?? null, item.stageTo ?? null, item.material ?? null, item.notes ?? null],
      );
      items.push(this.mapItem(itemRows[0]));
    }
    return this.mapOrder({ ...order, items });
  }

  async submitOrder(orderId: string, orgId: string): Promise<LabOrder> {
    const { rows } = await this.db.query(
      `UPDATE lab_orders SET status='submitted', submitted_at=now(), updated_at=now()
       WHERE id=$1 AND organization_id=$2 AND status='draft'
       RETURNING *`,
      [orderId, orgId],
    );
    if (!rows[0]) throw new BadRequestException('Order not found or not in draft status');
    const items = await this.getItems(orderId);
    return this.mapOrder({ ...rows[0], items });
  }

  async updateStatus(orderId: string, orgId: string, status: string): Promise<LabOrder> {
    const valid = ['draft','submitted','in_production','quality_check','shipped','delivered','rejected'];
    if (!valid.includes(status)) throw new BadRequestException('Invalid status');
    const { rows } = await this.db.query(
      `UPDATE lab_orders SET status=$2,
        delivered_at=CASE WHEN $2='delivered' THEN now() ELSE delivered_at END,
        updated_at=now()
       WHERE id=$1 AND organization_id=$3 RETURNING *`,
      [orderId, status, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Order not found');
    const items = await this.getItems(orderId);
    return this.mapOrder({ ...rows[0], items });
  }

  async addRevision(orderId: string, orgId: string, reason: string, requestedBy: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT id, organization_id FROM lab_orders WHERE id=$1 AND organization_id=$2`, [orderId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Order not found');
    const { rows: revRows } = await this.db.query(
      `SELECT COUNT(*)+1 as num FROM lab_revisions WHERE order_id=$1`, [orderId],
    );
    const revNum = parseInt(revRows[0]?.num ?? '1', 10);
    await this.db.query(
      `INSERT INTO lab_revisions (order_id, revision_number, reason, requested_by) VALUES ($1,$2,$3,$4)`,
      [orderId, revNum, reason, requestedBy],
    );
  }

  private async getItems(orderId: string): Promise<LabOrderItem[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM lab_order_items WHERE order_id=$1 ORDER BY created_at`, [orderId],
    );
    return rows.map(this.mapItem);
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.db.query(`SELECT id FROM cases WHERE id=$1 AND organization_id=$2`, [caseId, orgId]);
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private mapOrder(r: Record<string, unknown>): LabOrder {
    const rawItems = r['items'];
    const items: LabOrderItem[] = Array.isArray(rawItems)
      ? rawItems.map(i => (typeof i === 'object' && i !== null ? this.mapItem(i as Record<string, unknown>) : i as unknown as LabOrderItem))
      : [];
    return {
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      orderNumber: r['order_number'] as string,
      labName: r['lab_name'] as string,
      status: r['status'] as string,
      priority: r['priority'] as string,
      dueDate: r['due_date'] ? String(r['due_date']) : null,
      specialInstructions: r['special_instructions'] as string | null,
      submittedAt: r['submitted_at'] ? String(r['submitted_at']) : null,
      deliveredAt: r['delivered_at'] ? String(r['delivered_at']) : null,
      items,
      createdAt: String(r['created_at']),
    };
  }

  private mapItem(r: Record<string, unknown>): LabOrderItem {
    return {
      id: r['id'] as string,
      itemType: r['item_type'] as string,
      arch: r['arch'] as string | null,
      quantity: r['quantity'] as number,
      stageFrom: r['stage_from'] as number | null,
      stageTo: r['stage_to'] as number | null,
      material: r['material'] as string | null,
      notes: r['notes'] as string | null,
    };
  }
}
