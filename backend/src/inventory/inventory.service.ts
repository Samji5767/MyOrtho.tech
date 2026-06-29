import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface InventoryItem {
  id: string; name: string; sku: string | null; category: string; unit: string;
  unitCostCents: number | null; reorderThreshold: number; currentStock: number; notes: string | null;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listItems(orgId: string, category?: string): Promise<InventoryItem[]> {
    const { rows } = await this.db.query(
      `SELECT i.*,
         COALESCE((SELECT SUM(quantity_delta) FROM inventory_transactions t WHERE t.item_id=i.id),0) AS current_stock
       FROM inventory_items i
       WHERE i.organization_id=$1 ${category ? 'AND i.category=$2' : ''}
       ORDER BY i.name`,
      category ? [orgId, category] : [orgId],
    );
    return rows.map(r => ({
      id: r['id'] as string, name: r['name'] as string, sku: r['sku'] as string | null,
      category: r['category'] as string, unit: r['unit'] as string,
      unitCostCents: r['unit_cost_cents'] as number | null,
      reorderThreshold: r['reorder_threshold'] as number,
      currentStock: Number(r['current_stock']),
      notes: r['notes'] as string | null,
    }));
  }

  async getLowStockItems(orgId: string): Promise<InventoryItem[]> {
    const all = await this.listItems(orgId);
    return all.filter(i => i.currentStock <= i.reorderThreshold);
  }

  async createItem(orgId: string, dto: {
    name: string; sku?: string; category?: string; unit?: string;
    unitCostCents?: number; reorderThreshold?: number; notes?: string;
  }): Promise<InventoryItem> {
    const { rows } = await this.db.query(
      `INSERT INTO inventory_items
         (organization_id, name, sku, category, unit, unit_cost_cents, reorder_threshold, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, dto.name, dto.sku ?? null, dto.category ?? 'material',
       dto.unit ?? 'unit', dto.unitCostCents ?? null, dto.reorderThreshold ?? 10, dto.notes ?? null],
    );
    return { ...this.mapItem(rows[0]), currentStock: 0 };
  }

  async recordTransaction(orgId: string, itemId: string, createdBy: string, dto: {
    transactionType: 'receipt' | 'usage' | 'adjustment' | 'waste';
    quantityDelta: number; caseId?: string; notes?: string;
  }): Promise<{ item: InventoryItem; transactionId: string }> {
    const item = await this.getItemWithStock(orgId, itemId);
    const newStock = item.currentStock + dto.quantityDelta;
    if (newStock < 0) throw new BadRequestException('Insufficient stock');

    const { rows } = await this.db.query(
      `INSERT INTO inventory_transactions
         (organization_id, item_id, transaction_type, quantity_delta, quantity_after, case_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [orgId, itemId, dto.transactionType, dto.quantityDelta, newStock, dto.caseId ?? null, dto.notes ?? null, createdBy],
    );
    const updated = await this.getItemWithStock(orgId, itemId);
    return { item: updated, transactionId: rows[0]['id'] as string };
  }

  async getItemHistory(orgId: string, itemId: string): Promise<Record<string, unknown>[]> {
    await this.getItemWithStock(orgId, itemId);
    const { rows } = await this.db.query(
      `SELECT * FROM inventory_transactions WHERE item_id=$1 AND organization_id=$2 ORDER BY created_at DESC LIMIT 100`,
      [itemId, orgId],
    );
    return rows.map(r => ({
      id: r['id'], transactionType: r['transaction_type'], quantityDelta: r['quantity_delta'],
      quantityAfter: r['quantity_after'], caseId: r['case_id'], notes: r['notes'], createdAt: r['created_at'],
    }));
  }

  private async getItemWithStock(orgId: string, itemId: string): Promise<InventoryItem> {
    const { rows } = await this.db.query(
      `SELECT i.*,
         COALESCE((SELECT SUM(quantity_delta) FROM inventory_transactions t WHERE t.item_id=i.id),0) AS current_stock
       FROM inventory_items i WHERE i.id=$1 AND i.organization_id=$2`,
      [itemId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Inventory item not found');
    return { ...this.mapItem(rows[0]), currentStock: Number(rows[0]['current_stock']) };
  }

  private mapItem(r: Record<string, unknown>): Omit<InventoryItem, 'currentStock'> & { currentStock: number } {
    return {
      id: r['id'] as string, name: r['name'] as string, sku: r['sku'] as string | null,
      category: r['category'] as string, unit: r['unit'] as string,
      unitCostCents: r['unit_cost_cents'] as number | null,
      reorderThreshold: r['reorder_threshold'] as number, currentStock: 0,
      notes: r['notes'] as string | null,
    };
  }
}
