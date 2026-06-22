"use client";

import { useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Factory,
  Layers3,
  Printer,
  RefreshCw,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";

// ─── Mock analytics data ──────────────────────────────────────────────────────

const CLINICAL_METRICS = {
  totalCases: 686,
  activeCases: 128,
  completedThisMonth: 34,
  averageTreatmentMonths: 9.1,
  refinementRate: 22.4,
  averageAlignerCount: 21.3,
  patientSatisfactionScore: 4.7,
  onTimeCompletionRate: 88.2,
};

const MANUFACTURING_METRICS = {
  totalJobsThisMonth: 142,
  successRate: 91.7,
  failureRate: 8.3,
  averageTurnaroundHours: 3.8,
  printerUtilization: 72,
  resinConsumedMl: 11340,
  wasteReductionPct: 12,
  batchesShipped: 98,
};

const BUSINESS_METRICS = {
  revenueThisMonth: 284000,
  revenueLastMonth: 261000,
  revenueGrowthPct: 8.8,
  caseVolumeThisMonth: 34,
  averageCaseValue: 4800,
};

const TOP_DOCTORS = [
  { name: "Dr. Aryan Faizal",  revenue: 112000, cases: 28, clinic: "SF Clinic" },
  { name: "Dr. Mark Kowalski", revenue: 98000,  cases: 24, clinic: "NY Clinic" },
  { name: "Dr. Sarah Osei",    revenue: 74000,  cases: 18, clinic: "NY Clinic" },
];

const CLINIC_PERFORMANCE = [
  { clinicName: "Faizal Ortho — SF", cases: 82,  revenue: 142000, efficiency: 94 },
  { clinicName: "Kowalski Dental — NY", cases: 124, revenue: 168000, efficiency: 88 },
  { clinicName: "Faizal Ortho — LA",  cases: 46,  revenue: 74000,  efficiency: 91 },
];

const STAGE_DISTRIBUTION = [
  { stage: "Consultation",      count: 22, pct: 17 },
  { stage: "Scan & Segmentation", count: 14, pct: 11 },
  { stage: "CAD & Planning",    count: 18, pct: 14 },
  { stage: "Awaiting Approval", count: 12, pct: 9 },
  { stage: "Manufacturing",     count: 24, pct: 19 },
  { stage: "Delivery",          count: 17, pct: 13 },
  { stage: "Retention",         count: 21, pct: 17 },
];

const MONTHLY_TRENDS = [
  { month: "Jan", cases: 24, revenue: 198000, yield: 88 },
  { month: "Feb", cases: 28, revenue: 226000, yield: 90 },
  { month: "Mar", cases: 31, revenue: 241000, yield: 91 },
  { month: "Apr", cases: 26, revenue: 214000, yield: 89 },
  { month: "May", cases: 30, revenue: 261000, yield: 92 },
  { month: "Jun", cases: 34, revenue: 284000, yield: 92 },
];

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricTile({ label, value, unit, helper, trend, icon: Icon, color }: {
  label: string; value: string | number; unit?: string; helper?: string;
  trend?: { value: string; up: boolean };
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="ios-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${color.replace("text-", "bg-").replace("600", "500/10").replace("500", "500/10")}`}>
          <Icon size={16} className={color} />
        </span>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${trend.up ? "text-emerald-600" : "text-rose-500"}`}>
            {trend.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {trend.value}
          </span>
        )}
      </div>
      <p className={`mt-3 text-2xl font-black tabular-nums ${color}`}>
        {value}<span className="text-sm font-bold text-[color:var(--muted-foreground)]">{unit}</span>
      </p>
      <p className="mt-0.5 text-sm font-semibold text-[color:var(--foreground)]">{label}</p>
      {helper && <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{helper}</p>}
    </div>
  );
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function MiniBarChart({ data, valueKey, labelKey, color }: { data: object[]; valueKey: string; labelKey: string; color: string }) {
  const values = data.map(d => (d as Record<string, number>)[valueKey]);
  const max = Math.max(...values);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => {
        const val = (d as Record<string, number>)[valueKey];
        const label = (d as Record<string, string>)[labelKey];
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full flex flex-col justify-end" style={{ height: "64px" }}>
              <div className={`w-full rounded-t-sm ${color}`} style={{ height: `${pct}%` }} />
            </div>
            <span className="text-[9px] font-semibold text-[color:var(--muted-foreground)]">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Clinical Analytics ───────────────────────────────────────────────────────

function ClinicalAnalytics() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Active Cases"        value={CLINICAL_METRICS.activeCases}               icon={Activity}   color="text-[color:var(--primary)]" trend={{ value: "+8%", up: true }} />
        <MetricTile label="Completed (Month)"   value={CLINICAL_METRICS.completedThisMonth}        icon={CheckCircle2} color="text-emerald-600" trend={{ value: "+13%", up: true }} />
        <MetricTile label="Refinement Rate"     value={CLINICAL_METRICS.refinementRate}    unit="%" icon={RefreshCw}  color="text-amber-600" trend={{ value: "-1.2%", up: false }} helper="Target < 25%" />
        <MetricTile label="On-Time Completion"  value={CLINICAL_METRICS.onTimeCompletionRate} unit="%" icon={CheckCircle2} color="text-teal-600" trend={{ value: "+2.1%", up: true }} />
        <MetricTile label="Avg Duration"        value={CLINICAL_METRICS.averageTreatmentMonths} unit=" mo" icon={Activity} color="text-sky-600" />
        <MetricTile label="Avg Aligner Count"   value={CLINICAL_METRICS.averageAlignerCount} icon={Layers3} color="text-indigo-600" />
        <MetricTile label="Satisfaction Score"  value={CLINICAL_METRICS.patientSatisfactionScore} unit="/5" icon={Users} color="text-violet-600" trend={{ value: "+0.2", up: true }} />
        <MetricTile label="Total Cases (YTD)"   value={CLINICAL_METRICS.totalCases}               icon={Stethoscope} color="text-[color:var(--foreground)]" />
      </div>

      {/* Stage distribution */}
      <div className="ios-card p-5">
        <h4 className="font-bold text-[color:var(--foreground)] mb-4">Cases by Stage</h4>
        <div className="space-y-2.5">
          {STAGE_DISTRIBUTION.map(s => (
            <div key={s.stage}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[color:var(--foreground)]">{s.stage}</span>
                <span className="text-sm font-bold tabular-nums text-[color:var(--foreground)]">{s.count}</span>
              </div>
              <div className="h-2 rounded-full bg-[color:var(--border)]">
                <div className="h-full rounded-full bg-[color:var(--primary)] transition-all" style={{ width: `${s.pct * 4}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Manufacturing Analytics ──────────────────────────────────────────────────

function ManufacturingAnalytics() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Jobs (Month)"       value={MANUFACTURING_METRICS.totalJobsThisMonth}    icon={Printer}   color="text-[color:var(--primary)]" />
        <MetricTile label="Success Rate"       value={MANUFACTURING_METRICS.successRate}    unit="%" icon={CheckCircle2} color="text-emerald-600" trend={{ value: "+1.2%", up: true }} />
        <MetricTile label="Failure Rate"       value={MANUFACTURING_METRICS.failureRate}    unit="%" icon={TrendingDown} color="text-rose-500" trend={{ value: "-2%", up: false }} />
        <MetricTile label="Avg Turnaround"     value={MANUFACTURING_METRICS.averageTurnaroundHours} unit=" h" icon={Activity} color="text-sky-600" trend={{ value: "-0.5h", up: false }} />
        <MetricTile label="Printer Utilization" value={MANUFACTURING_METRICS.printerUtilization} unit="%" icon={Factory} color="text-teal-600" />
        <MetricTile label="Resin Consumed"     value={Math.round(MANUFACTURING_METRICS.resinConsumedMl / 1000 * 10) / 10} unit=" L" icon={Layers3} color="text-indigo-600" />
        <MetricTile label="Waste Reduction"    value={MANUFACTURING_METRICS.wasteReductionPct} unit="%" icon={TrendingDown} color="text-emerald-600" trend={{ value: "+12%", up: true }} helper="YoY" />
        <MetricTile label="Batches Shipped"    value={MANUFACTURING_METRICS.batchesShipped}       icon={CheckCircle2} color="text-[color:var(--foreground)]" />
      </div>

      {/* Monthly trend */}
      <div className="ios-card p-5">
        <h4 className="font-bold text-[color:var(--foreground)] mb-4">Print Yield Trend (6 Months)</h4>
        <MiniBarChart data={MONTHLY_TRENDS} valueKey="yield" labelKey="month" color="bg-emerald-500/70" />
      </div>
    </div>
  );
}

// ─── Business Analytics ───────────────────────────────────────────────────────

function BusinessAnalytics() {
  const formatCurrency = (n: number) => `$${(n / 1000).toFixed(0)}k`;
  const growthUp = BUSINESS_METRICS.revenueGrowthPct > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Revenue (Month)"    value={formatCurrency(BUSINESS_METRICS.revenueThisMonth)}  icon={DollarSign} color="text-emerald-600" trend={{ value: `+${BUSINESS_METRICS.revenueGrowthPct}%`, up: growthUp }} />
        <MetricTile label="Revenue (Last Mo)"  value={formatCurrency(BUSINESS_METRICS.revenueLastMonth)} icon={DollarSign} color="text-[color:var(--muted-foreground)]" />
        <MetricTile label="Cases (Month)"      value={BUSINESS_METRICS.caseVolumeThisMonth}              icon={Activity}  color="text-[color:var(--primary)]" trend={{ value: "+13%", up: true }} />
        <MetricTile label="Avg Case Value"     value={formatCurrency(BUSINESS_METRICS.averageCaseValue)} icon={BarChart3} color="text-teal-600" />
      </div>

      {/* Monthly revenue chart */}
      <div className="ios-card p-5">
        <h4 className="font-bold text-[color:var(--foreground)] mb-4">Revenue Trend (6 Months)</h4>
        <MiniBarChart data={MONTHLY_TRENDS} valueKey="revenue" labelKey="month" color="bg-[color:var(--primary)]/60" />
      </div>

      {/* Top doctors */}
      <div className="ios-card p-5">
        <h4 className="font-bold text-[color:var(--foreground)] mb-4">Top Doctors by Revenue</h4>
        <div className="space-y-3">
          {TOP_DOCTORS.map((doc, i) => (
            <div key={doc.name} className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-xs font-black text-[color:var(--primary)]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[color:var(--foreground)]">{doc.name}</p>
                <p className="text-xs text-[color:var(--muted-foreground)]">{doc.clinic} · {doc.cases} cases</p>
              </div>
              <span className="text-sm font-black tabular-nums text-emerald-600">{formatCurrency(doc.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Clinic performance */}
      <div className="ios-card p-5">
        <h4 className="font-bold text-[color:var(--foreground)] mb-4">Clinic Performance</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)]">
                {["Clinic", "Cases", "Revenue", "Efficiency"].map(h => (
                  <th key={h} className="pb-2 text-left text-xs font-bold text-[color:var(--muted-foreground)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLINIC_PERFORMANCE.map(c => (
                <tr key={c.clinicName} className="border-b border-[color:var(--border)] last:border-0">
                  <td className="py-3 font-semibold text-[color:var(--foreground)]">{c.clinicName}</td>
                  <td className="py-3 tabular-nums text-[color:var(--foreground)]">{c.cases}</td>
                  <td className="py-3 tabular-nums font-bold text-emerald-600">{formatCurrency(c.revenue)}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-[color:var(--border)]">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${c.efficiency}%` }} />
                      </div>
                      <span className={`text-xs font-bold ${c.efficiency >= 90 ? "text-emerald-600" : "text-teal-600"}`}>{c.efficiency}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BusinessIntelligence() {
  const [activeTab, setActiveTab] = useState<"clinical" | "manufacturing" | "business">("clinical");
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Analytics & Business Intelligence</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Platform Analytics</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Clinical outcomes, manufacturing performance, and business metrics.</p>
        </div>
        <div className="flex rounded-xl border border-[color:var(--border)] overflow-hidden">
          {(["month", "quarter", "year"] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${period === p ? "bg-[color:var(--primary)] text-white" : "bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <MedicalDisclaimer variant="compact" />

      {/* Tab bar */}
      <div className="flex gap-2">
        {(["clinical", "manufacturing", "business"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all capitalize ${activeTab === tab ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "clinical"       && <ClinicalAnalytics />}
      {activeTab === "manufacturing"  && <ManufacturingAnalytics />}
      {activeTab === "business"       && <BusinessAnalytics />}
    </div>
  );
}

export default BusinessIntelligence;
