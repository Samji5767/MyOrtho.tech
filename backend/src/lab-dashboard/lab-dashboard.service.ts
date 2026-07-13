import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface StatusCount {
  status: string;
  count: number;
}

export interface DailyMetric {
  day: string;
  jobsCreated: number;
  jobsCompleted: number;
}

export interface LabDashboard {
  printJobsByStatus: StatusCount[];
  batchesByStatus: StatusCount[];
  printersByStatus: StatusCount[];
  failedJobsToday: number;
  qaInspectionsByStatus: StatusCount[];
  shipmentsByStatus: StatusCount[];
  inventoryAlerts: number;
  dailyMetrics: DailyMetric[];
}

type StatusCountRow = { status: string; count: string };
type ScalarCountRow = { count: string };
type DailyMetricRow = { day: string; jobs_created: string; jobs_completed: string };

@Injectable()
export class LabDashboardService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getDashboard(orgId: string): Promise<LabDashboard> {
    const [
      printJobsResult,
      batchesResult,
      printersResult,
      failedJobsResult,
      qaResult,
      shipmentsResult,
      inventoryResult,
      dailyResult,
    ] = await Promise.all([
      // a) Print jobs by status
      this.pool.query<StatusCountRow>(
        `SELECT status, COUNT(*) FROM print_jobs
         WHERE organization_id=$1
         GROUP BY status`,
        [orgId],
      ),
      // b) Manufacturing batches by status
      this.pool.query<StatusCountRow>(
        `SELECT status, COUNT(*) FROM manufacturing_batches
         WHERE organization_id=$1
         GROUP BY status`,
        [orgId],
      ),
      // c) Active printers by status
      this.pool.query<StatusCountRow>(
        `SELECT status, COUNT(*) FROM printers
         WHERE organization_id=$1
         GROUP BY status`,
        [orgId],
      ),
      // d) Failed jobs in the last 24 hours
      this.pool.query<ScalarCountRow>(
        `SELECT COUNT(*) FROM print_jobs
         WHERE organization_id=$1
           AND status='failed'
           AND updated_at > NOW()-INTERVAL '24 hours'`,
        [orgId],
      ),
      // e) QA inspections by status
      this.pool.query<StatusCountRow>(
        `SELECT status, COUNT(*) FROM qa_inspections
         WHERE organization_id=$1
         GROUP BY status`,
        [orgId],
      ),
      // f) Shipments by status
      this.pool.query<StatusCountRow>(
        `SELECT status, COUNT(*) FROM shipments
         WHERE organization_id=$1
         GROUP BY status`,
        [orgId],
      ),
      // g) Inventory alerts — items at or below reorder threshold
      this.pool.query<ScalarCountRow>(
        `SELECT COUNT(*) FROM inventory_items
         WHERE organization_id=$1
           AND quantity_on_hand <= reorder_threshold`,
        [orgId],
      ),
      // h) Daily metrics for the last 7 days
      this.pool.query<DailyMetricRow>(
        `SELECT
           DATE(created_at) AS day,
           COUNT(*) AS jobs_created,
           SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS jobs_completed
         FROM print_jobs
         WHERE organization_id=$1
           AND created_at > NOW()-INTERVAL '7 days'
         GROUP BY DATE(created_at)
         ORDER BY day`,
        [orgId],
      ),
    ]);

    return {
      printJobsByStatus: printJobsResult.rows.map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10),
      })),
      batchesByStatus: batchesResult.rows.map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10),
      })),
      printersByStatus: printersResult.rows.map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10),
      })),
      failedJobsToday: parseInt(failedJobsResult.rows[0]?.count ?? '0', 10),
      qaInspectionsByStatus: qaResult.rows.map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10),
      })),
      shipmentsByStatus: shipmentsResult.rows.map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10),
      })),
      inventoryAlerts: parseInt(inventoryResult.rows[0]?.count ?? '0', 10),
      dailyMetrics: dailyResult.rows.map((r) => ({
        day: r.day,
        jobsCreated: parseInt(r.jobs_created, 10),
        jobsCompleted: parseInt(r.jobs_completed, 10),
      })),
    };
  }
}
