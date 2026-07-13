import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface InventoryItem {
  id: string;
  organizationId: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string | null;
  unitCostCents: number | null;
  reorderThreshold: number;
  quantityOnHand: number;
  notes: string | null;
  belowReorder: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  organizationId: string;
  itemId: string;
  transactionType: 'receipt' | 'usage' | 'adjustment' | 'waste';
  quantityDelta: number;
  quantityAfter: number;
  caseId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

@Injectable()
export class LabInventoryService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listItems(orgId: string, category?: string): Promise<InventoryItem[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM inventory_items WHERE organization_id=$1${category ? ' AND category=$2' : ''} ORDER BY category, name`,
      category ? [orgId, category] : [orgId],
    );
    return rows.map(this.mapItem);
  }

  async getItem(id: string, orgId: string): Promise<InventoryItem> {
    const { rows } = await this.db.query(
      `SELECT * FROM inventory_items WHERE id=$1 AND organization_id=$2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Inventory item not found');
    return this.mapItem(rows[0]);
  }

  async createItem(
    orgId: string,
    dto: {
      name: string;
      sku?: string;
      category?: string;
      unit?: string;
      unitCostCents?: number;
      reorderThreshold?: number;
      quantityOnHand?: number;
      notes?: string;
    },
  ): Promise<InventoryItem> {
    const { rows } = await this.db.query(
      `INSERT INTO inventory_items
         (organization_id, name, sku, category, unit, unit_cost_cents, reorder_threshold, quantity_on_hand, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        orgId,
        dto.name,
        dto.sku ?? null,
        dto.category ?? null,
        dto.unit ?? null,
        dto.unitCostCents ?? null,
        dto.reorderThreshold ?? 0,
        dto.quantityOnHand ?? 0,
        dto.notes ?? null,
      ],
    );
    return this.mapItem(rows[0]);
  }

  async updateItem(
    id: string,
    orgId: string,
    dto: Partial<{
      name: string;
      sku: string;
      category: string;
      unit: string;
      unitCostCents: number;
      reorderThreshold: number;
      notes: string;
    }>,
  ): Promise<InventoryItem> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      sku: 'sku',
      category: 'category',
      unit: 'unit',
      unitCostCents: 'unit_cost_cents',
      reorderThreshold: 'reorder_threshold',
      notes: 'notes',
    };

    const sets: string[] = [];
    const values: unknown[] = [id, orgId];

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in dto) {
        values.push((dto as Record<string, unknown>)[key] ?? null);
        sets.push(`${col}=$${values.length}`);
      }
    }

    if (sets.length === 0) {
      return this.getItem(id, orgId);
    }

    const { rows } = await this.db.query(
      `UPDATE inventory_items SET ${sets.join(', ')}, updated_at=now()
       WHERE id=$1 AND organization_id=$2
       RETURNING *`,
      values,
    );
    if (!rows[0]) throw new NotFoundException('Inventory item not found');
    return this.mapItem(rows[0]);
  }

  async recordTransaction(
    orgId: string,
    createdBy: string,
    dto: {
      itemId: string;
      transactionType: 'receipt' | 'usage' | 'adjustment' | 'waste';
      quantityDelta: number;
      caseId?: string;
      notes?: string;
    },
  ): Promise<{ item: InventoryItem; transaction: InventoryTransaction }> {
    const client: PoolClient = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Lock the row to prevent concurrent quantity races
      const { rows: lockRows } = await client.query(
        `SELECT quantity_on_hand FROM inventory_items WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
        [dto.itemId, orgId],
      );
      if (!lockRows[0]) {
        await client.query('ROLLBACK');
        throw new NotFoundException('Inventory item not found');
      }

      const currentQty = lockRows[0]['quantity_on_hand'] as number;
      const newQty = currentQty + dto.quantityDelta;

      const { rows: txRows } = await client.query(
        `INSERT INTO inventory_transactions
           (organization_id, item_id, transaction_type, quantity_delta, quantity_after, case_id, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          orgId,
          dto.itemId,
          dto.transactionType,
          dto.quantityDelta,
          newQty,
          dto.caseId ?? null,
          dto.notes ?? null,
          createdBy,
        ],
      );

      const { rows: itemRows } = await client.query(
        `UPDATE inventory_items SET quantity_on_hand=$3, updated_at=now()
         WHERE id=$1 AND organization_id=$2
         RETURNING *`,
        [dto.itemId, orgId, newQty],
      );

      await client.query('COMMIT');

      return {
        item: this.mapItem(itemRows[0]),
        transaction: this.mapTransaction(txRows[0]),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getReorderAlerts(orgId: string): Promise<InventoryItem[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM inventory_items
       WHERE organization_id=$1 AND quantity_on_hand <= reorder_threshold
       ORDER BY category, name`,
      [orgId],
    );
    return rows.map(this.mapItem);
  }

  private mapItem(r: Record<string, unknown>): InventoryItem {
    const qoh = r['quantity_on_hand'] as number;
    const threshold = r['reorder_threshold'] as number;
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      name: r['name'] as string,
      sku: (r['sku'] as string | null) ?? null,
      category: (r['category'] as string | null) ?? null,
      unit: (r['unit'] as string | null) ?? null,
      unitCostCents: r['unit_cost_cents'] != null ? Number(r['unit_cost_cents']) : null,
      reorderThreshold: Number(threshold),
      quantityOnHand: Number(qoh),
      notes: (r['notes'] as string | null) ?? null,
      belowReorder: Number(qoh) <= Number(threshold),
      createdAt: String(r['created_at']),
      updatedAt: String(r['updated_at']),
    };
  }

  private mapTransaction(r: Record<string, unknown>): InventoryTransaction {
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      itemId: r['item_id'] as string,
      transactionType: r['transaction_type'] as InventoryTransaction['transactionType'],
      quantityDelta: Number(r['quantity_delta']),
      quantityAfter: Number(r['quantity_after']),
      caseId: (r['case_id'] as string | null) ?? null,
      notes: (r['notes'] as string | null) ?? null,
      createdBy: r['created_by'] as string,
      createdAt: String(r['created_at']),
    };
  }
}
