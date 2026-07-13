import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface PrinterUtilization {
  name: string;
  brand: string;
  completedJobs: number;
  totalJobs: number;
  utilizationRate: number;
}

export interface BatchEfficiencyRow {
  status: string;
  count: number;
  avgHours: number | null;
}

export interface FailureRate {
  failed: number;
  total: number;
  rate: number;
}

export interface QaRejectionRate {
  rejected: number;
  total: number;
  rate: number;
}

export interface TopInventoryItem {
  name: string;
  category: string;
  totalUsed: number;
}

export interface ThroughputByDay {
  day: string;
  completed: number;
  failed: number;
}

export interface ManufacturingMetrics {
  printerUtilization: PrinterUtilization[];
  batchEfficiency: BatchEfficiencyRow[];
  failureRate: FailureRate;
  qaRejectionRate: QaRejectionRate;
  topInventoryUsage: TopInventoryItem[];
  throughputByDay: ThroughputByDay[];
  periodDays: number;
}

type PrinterRow = {
  name: string;
  brand: string;
  completed_jobs: string;
  total_jobs: string;
};

type BatchRow = {
  status: string;
  count: string;
  avg_hours: string | null;
};

type FailureRow = {
  failed: string;
  total: string;
};

type QaRow = {
  rejected: string;
  total: string;
};

type InventoryRow = {
  name: string;
  category: string;
  total_used: string;
};

type ThroughputRow = {
  day: string;
  completed: string;
  failed: string;
};

@Injectable()
export class ManufacturingAnalyticsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getMetrics(orgId: string, days: number = 30): Promise<ManufacturingMetrics> {
    const [
      printerResult,
      batchResult,
      failureResult,
      qaResult,
      inventoryResult,
      throughputResult,
    ] = await Promise.all([
      // a) Printer utilization
      this.pool.query<PrinterRow>(
        `SELECT
           p.name,
           p.brand,
           COUNT(pj.id) FILTER (WHERE pj.status = 'completed') AS completed_jobs,
           COUNT(pj.id) AS total_jobs
         FROM printers p
         LEFT JOIN print_jobs pj
           ON pj.printer_id = p.id
           AND pj.created_at > NOW() - ($2 * INTERVAL '1 day')
         WHERE p.organization_id = $1
         GROUP BY p.id, p.name, p.brand`,
        [orgId, days],
      ),

      // b) Batch efficiency
      this.pool.query<BatchRow>(
        `SELECT
           status,
           COUNT(*) AS count,
           AVG(estimated_print_hours) AS avg_hours
         FROM manufacturing_batches
         WHERE organization_id = $1
           AND created_at > NOW() - ($2 * INTERVAL '1 day')
         GROUP BY status`,
        [orgId, days],
      ),

      // c) Failure rate
      this.pool.query<FailureRow>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'failed') AS failed,
           COUNT(*) AS total
         FROM print_jobs
         WHERE organization_id = $1
           AND created_at > NOW() - ($2 * INTERVAL '1 day')`,
        [orgId, days],
      ),

      // d) QA rejection rate
      this.pool.query<QaRow>(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('failed', 'requires_reprint')) AS rejected,
           COUNT(*) AS total
         FROM qa_inspections
         WHERE organization_id = $1
           AND created_at > NOW() - ($2 * INTERVAL '1 day')`,
        [orgId, days],
      ),

      // e) Inventory usage (top 10)
      this.pool.query<InventoryRow>(
        `SELECT
           ii.name,
           ii.category,
           SUM(ABS(it.quantity_delta)) AS total_used
         FROM inventory_transactions it
         JOIN inventory_items ii ON ii.id = it.item_id
         WHERE it.organization_id = $1
           AND it.transaction_type IN ('usage', 'waste')
           AND it.created_at > NOW() - ($2 * INTERVAL '1 day')
         GROUP BY ii.id, ii.name, ii.category
         ORDER BY total_used DESC
         LIMIT 10`,
        [orgId, days],
      ),

      // f) Throughput by day
      this.pool.query<ThroughputRow>(
        `SELECT
           DATE(created_at) AS day,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed
         FROM print_jobs
         WHERE organization_id = $1
           AND created_at > NOW() - ($2 * INTERVAL '1 day')
         GROUP BY DATE(created_at)
         ORDER BY day`,
        [orgId, days],
      ),
    ]);

    const printerUtilization: PrinterUtilization[] = printerResult.rows.map((r) => {
      const total = parseInt(r.total_jobs, 10);
      const completed = parseInt(r.completed_jobs, 10);
      return {
        name: r.name,
        brand: r.brand,
        completedJobs: completed,
        totalJobs: total,
        utilizationRate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
      };
    });

    const batchEfficiency: BatchEfficiencyRow[] = batchResult.rows.map((r) => ({
      status: r.status,
      count: parseInt(r.count, 10),
      avgHours: r.avg_hours != null ? Math.round(parseFloat(r.avg_hours) * 100) / 100 : null,
    }));

    const fr = failureResult.rows[0] ?? { failed: '0', total: '0' };
    const frTotal = parseInt(fr.total, 10);
    const frFailed = parseInt(fr.failed, 10);
    const failureRate: FailureRate = {
      failed: frFailed,
      total: frTotal,
      rate: frTotal > 0 ? Math.round((frFailed / frTotal) * 10000) / 100 : 0,
    };

    const qa = qaResult.rows[0] ?? { rejected: '0', total: '0' };
    const qaTotal = parseInt(qa.total, 10);
    const qaRejected = parseInt(qa.rejected, 10);
    const qaRejectionRate: QaRejectionRate = {
      rejected: qaRejected,
      total: qaTotal,
      rate: qaTotal > 0 ? Math.round((qaRejected / qaTotal) * 10000) / 100 : 0,
    };

    const topInventoryUsage: TopInventoryItem[] = inventoryResult.rows.map((r) => ({
      name: r.name,
      category: r.category,
      totalUsed: Math.round(parseFloat(r.total_used) * 100) / 100,
    }));

    const throughputByDay: ThroughputByDay[] = throughputResult.rows.map((r) => ({
      day: r.day,
      completed: parseInt(r.completed, 10),
      failed: parseInt(r.failed, 10),
    }));

    return {
      printerUtilization,
      batchEfficiency,
      failureRate,
      qaRejectionRate,
      topInventoryUsage,
      throughputByDay,
      periodDays: days,
    };
  }
}
