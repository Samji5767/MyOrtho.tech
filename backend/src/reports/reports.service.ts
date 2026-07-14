import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Injectable()
export class ReportsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async getPracticeSummary(orgId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [cases, patients, locations] = await Promise.all([
      this.db.query(
        `SELECT status, created_at FROM cases WHERE organization_id=$1`,
        [orgId],
      ),
      this.db.query(
        `SELECT id, created_at FROM patients WHERE organization_id=$1`,
        [orgId],
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS count FROM org_locations WHERE organization_id=$1 AND active=true`,
        [orgId],
      ),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of cases.rows) {
      byStatus[row.status as string] = (byStatus[row.status as string] ?? 0) + 1;
    }

    const completedThisMonth = cases.rows.filter(
      (r) => (r.status as string) === 'completed' && new Date(r.created_at as string) >= new Date(since),
    ).length;

    const newThisMonth = cases.rows.filter(
      (r) => new Date(r.created_at as string) >= new Date(since),
    ).length;

    const newPatients = patients.rows.filter(
      (r) => new Date(r.created_at as string) >= new Date(since),
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      period: { from: since, to: new Date().toISOString() },
      cases: { total: cases.rows.length, byStatus, completedThisMonth, newThisMonth },
      patients: { total: patients.rows.length, newThisMonth: newPatients },
      locations: (locations.rows[0]?.count as number) ?? 0,
    };
  }

  async getClinicalKpis(orgId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [caseFlow, qaStats, treatmentTypes] = await Promise.all([
      this.db.query(
        `SELECT status, COUNT(*)::int AS count
         FROM cases WHERE organization_id=$1 AND created_at >= $2
         GROUP BY status`,
        [orgId, since],
      ),
      this.db.query(
        `SELECT status, COUNT(*)::int AS count
         FROM qa_inspections WHERE organization_id=$1 AND created_at >= $2
         GROUP BY status`,
        [orgId, since],
      ),
      this.db.query(
        `SELECT chief_complaint, COUNT(*)::int AS count
         FROM cases WHERE organization_id=$1 AND chief_complaint IS NOT NULL AND created_at >= $2
         GROUP BY chief_complaint ORDER BY count DESC LIMIT 10`,
        [orgId, since],
      ),
    ]);

    const casesByStatus: Record<string, number> = {};
    for (const r of caseFlow.rows) casesByStatus[r.status as string] = r.count as number;

    const qaByStatus: Record<string, number> = {};
    for (const r of qaStats.rows) qaByStatus[r.status as string] = r.count as number;

    const total = Object.values(qaByStatus).reduce((a, b) => a + b, 0);
    const passed = qaByStatus['passed'] ?? 0;
    const qaPassRate = total > 0 ? Math.round((passed / total) * 100) : null;

    return {
      generatedAt: new Date().toISOString(),
      period: { days, from: since },
      casesByStatus,
      qaPassRate,
      qaByStatus,
      topComplaintTypes: treatmentTypes.rows.map((r) => ({
        complaint: r.chief_complaint as string,
        count: r.count as number,
      })),
    };
  }

  async getManufacturingKpis(orgId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [batches, inventory, shipments] = await Promise.all([
      this.db.query(
        `SELECT status, COUNT(*)::int AS count
         FROM manufacturing_batches WHERE organization_id=$1 AND created_at >= $2
         GROUP BY status`,
        [orgId, since],
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS total,
                SUM(CASE WHEN quantity_on_hand <= reorder_threshold THEN 1 ELSE 0 END)::int AS below_reorder
         FROM inventory_items WHERE organization_id=$1`,
        [orgId],
      ),
      this.db.query(
        `SELECT status, COUNT(*)::int AS count
         FROM shipments WHERE organization_id=$1 AND created_at >= $2
         GROUP BY status`,
        [orgId, since],
      ),
    ]);

    const batchesByStatus: Record<string, number> = {};
    for (const r of batches.rows) batchesByStatus[r.status as string] = r.count as number;

    const shipmentsByStatus: Record<string, number> = {};
    for (const r of shipments.rows) shipmentsByStatus[r.status as string] = r.count as number;

    return {
      generatedAt: new Date().toISOString(),
      period: { days, from: since },
      batchesByStatus,
      inventory: {
        total: (inventory.rows[0]?.total as number) ?? 0,
        belowReorder: (inventory.rows[0]?.below_reorder as number) ?? 0,
      },
      shipmentsByStatus,
    };
  }

  async getAiUtilizationReport(orgId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { rows } = await this.db.query(
      `SELECT model_name, model_version, outcome,
              COUNT(*)::int AS count,
              AVG(latency_ms)::int AS avg_latency_ms,
              AVG(CASE WHEN disclaimer_shown THEN 1.0 ELSE 0.0 END) AS disclaimer_rate
       FROM ai_inference_audit
       WHERE organization_id=$1 AND created_at >= $2
       GROUP BY model_name, model_version, outcome
       ORDER BY count DESC`,
      [orgId, since],
    );

    const byModel: Record<string, { count: number; avgLatencyMs: number | null }> = {};
    const byOutcome: Record<string, number> = {};
    let totalInferences = 0;
    let disclaimerSum = 0;

    for (const r of rows) {
      const model = `${r.model_name as string}@${r.model_version as string}`;
      const count = r.count as number;
      totalInferences += count;

      byModel[model] = {
        count: (byModel[model]?.count ?? 0) + count,
        avgLatencyMs: r.avg_latency_ms != null ? Number(r.avg_latency_ms) : null,
      };

      const outcome = (r.outcome as string | null) ?? 'pending_review';
      byOutcome[outcome] = (byOutcome[outcome] ?? 0) + count;
      disclaimerSum += Number(r.disclaimer_rate) * count;
    }

    return {
      generatedAt: new Date().toISOString(),
      period: { days, from: since },
      totalInferences,
      byModel,
      byOutcome,
      disclaimerShownRate: totalInferences > 0
        ? Math.round((disclaimerSum / totalInferences) * 100) / 100
        : 1,
    };
  }

  async getDashboardHtml(orgId: string, days = 30): Promise<string> {
    const [practice, manufacturing, ai] = await Promise.all([
      this.getPracticeSummary(orgId, days),
      this.getManufacturingKpis(orgId, days),
      this.getAiUtilizationReport(orgId, days),
    ]);

    const statusRow = (label: string, value: number | string, color = '#374151') =>
      `<tr><td style="padding:6px 12px;color:#6b7280;">${label}</td><td style="padding:6px 12px;font-weight:600;color:${color};">${value}</td></tr>`;

    const tableSection = (title: string, rows: string) =>
      `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:20px;overflow:hidden;">
        <div style="background:#f9fafb;padding:12px 16px;font-weight:600;font-size:14px;border-bottom:1px solid #e5e7eb;">${title}</div>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>`;

    const caseRows = Object.entries(practice.cases.byStatus)
      .map(([s, n]) => statusRow(s.replace('_', ' '), n)).join('');

    const mfgRows = Object.entries(manufacturing.batchesByStatus)
      .map(([s, n]) => statusRow(s.replace('_', ' '), n)).join('');

    const aiRows = `
      ${statusRow('Total Inferences', ai.totalInferences)}
      ${statusRow('Disclaimer Shown Rate', `${Math.round(ai.disclaimerShownRate * 100)}%`, '#059669')}
      ${Object.entries(ai.byOutcome).map(([k, v]) => statusRow(k, v)).join('')}
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MyOrtho Platform Dashboard — ${new Date().toISOString().slice(0, 10)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#f3f4f6;color:#111827;}
  h1{font-size:22px;font-weight:700;margin:0 0 4px;}
  .subtitle{color:#6b7280;font-size:13px;margin-bottom:24px;}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;}
</style>
</head>
<body>
<h1>MyOrtho Platform Dashboard</h1>
<div class="subtitle">Generated ${practice.generatedAt} &nbsp;|&nbsp; Period: last ${days} days</div>
<div class="grid">
  ${tableSection('Practice Summary',
    statusRow('Total Cases', practice.cases.total) +
    statusRow('New This Period', practice.cases.newThisMonth) +
    statusRow('Completed This Period', practice.cases.completedThisMonth) +
    statusRow('Total Patients', practice.patients.total) +
    statusRow('New Patients', practice.patients.newThisMonth) +
    statusRow('Active Locations', practice.locations) +
    caseRows
  )}
  ${tableSection('Manufacturing KPIs',
    statusRow('Inventory Items', manufacturing.inventory.total) +
    statusRow('Below Reorder', manufacturing.inventory.belowReorder,
      manufacturing.inventory.belowReorder > 0 ? '#dc2626' : '#059669') +
    mfgRows
  )}
  ${tableSection('AI Utilization', aiRows)}
</div>
</body>
</html>`;
  }

  async getCasesCSV(orgId: string, days?: number): Promise<string> {
    const since = days
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { rows } = await this.db.query(
      `SELECT c.id, c.status, c.chief_complaint, c.created_at, c.updated_at,
              p.first_name, p.last_name, u.email AS assigned_to
       FROM cases c
       LEFT JOIN patients p ON p.id = c.patient_id
       LEFT JOIN auth_users u ON u.id = c.assigned_to
       WHERE c.organization_id=$1 ${since ? 'AND c.created_at >= $2' : ''}
       ORDER BY c.created_at DESC`,
      since ? [orgId, since] : [orgId],
    );

    const headers = ['Case ID', 'Status', 'Chief Complaint', 'Patient Name', 'Assigned To', 'Created At', 'Updated At'];

    const csvRows = rows.map((r) =>
      [
        r.id as string,
        r.status as string,
        ((r.chief_complaint as string) ?? '').replace(/,/g, ';'),
        `${(r.first_name as string) ?? ''} ${(r.last_name as string) ?? ''}`.trim(),
        (r.assigned_to as string) ?? '',
        r.created_at as string,
        r.updated_at as string,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    return [headers.join(','), ...csvRows].join('\n');
  }
}
