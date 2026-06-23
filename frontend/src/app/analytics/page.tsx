"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Card, MetricCard, ProgressBar, StatusBadge } from "@/components/DesignSystem";

// ─── Representative analytics data ────────────────────────────────────────────
// Never claimed to be live. Shown only when preview mode is enabled.

const MONTHLY_THROUGHPUT = [31, 28, 35, 41, 38, 47];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun (MTD)"];

const SLA_METRICS = { onTime: 92, atRisk: 5, breached: 3, total: 100 };

const STAGE_DISTRIBUTION = [
  { label: "Consultation",    count: 9,  pct: 19 },
  { label: "Scan & Segment",  count: 6,  pct: 13 },
  { label: "Treatment Plan",  count: 11, pct: 23 },
  { label: "Manufacturing",   count: 12, pct: 26 },
  { label: "Delivery",        count: 5,  pct: 11 },
  { label: "Retention",       count: 4,  pct: 9  },
];

const APPROVAL_TURNAROUND = [
  { label: "< 2 h",   count: 18, tone: "success" as const },
  { label: "2–6 h",   count: 31, tone: "primary" as const },
  { label: "6–24 h",  count: 28, tone: "warning" as const },
  { label: "> 24 h",  count: 8,  tone: "danger"  as const },
];

const PROVIDER_PERFORMANCE = [
  { name: "Dr. Chen",   cases: 24, approved: 23, sla: 96 },
  { name: "Dr. Lee",    cases: 18, approved: 17, sla: 94 },
  { name: "Dr. Park",   cases: 21, approved: 21, sla: 100 },
  { name: "Dr. Torres", cases: 29, approved: 27, sla: 93 },
  { name: "Dr. Nguyen", cases: 11, approved: 9,  sla: 82 },
];

const KPI_DATA = [
  { label: "Active patients",       value: "312", helper: "+8% MoM",     trend: "up",   icon: Users,        tone: "primary"  as const },
  { label: "Cases completed (MTD)", value: "47",  helper: "+22% vs plan", trend: "up",   icon: CheckCircle2, tone: "success"  as const },
  { label: "Avg SLA (days)",        value: "5.1", helper: "Target: 5.0",  trend: "down", icon: Clock,        tone: "success"  as const },
  { label: "Approval turnaround",   value: "4.2 h", helper: "−1.1 h MoM", trend: "down", icon: Zap,         tone: "info"     as const },
];

// ─── Chart components (no external library) ───────────────────────────────────

function ThroughputBars({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-1.5 h-28 pt-2">
      {data.map((val, i) => {
        const isLatest = i === data.length - 1;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[9px] font-semibold tabular-nums text-[color:var(--foreground)]">{val}</span>
            <div
              className={`w-full rounded-t-md transition-all duration-500 ${isLatest ? "bg-[color:var(--primary)]" : "bg-[color:var(--primary)]/40"}`}
              style={{ height: `${Math.max(8, (val / max) * 80)}px` }}
            />
            <span className="text-[8px] font-medium text-[color:var(--muted-foreground)] truncate w-full text-center leading-tight">
              {labels[i].replace(" (MTD)", "")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ApprovalHistogram({ data }: { data: typeof APPROVAL_TURNAROUND }) {
  const max = Math.max(...data.map(d => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-xs font-medium text-[color:var(--foreground)]">{d.label}</span>
          <div className="flex-1">
            <ProgressBar value={Math.round((d.count / max) * 100)} tone={d.tone} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-[color:var(--muted-foreground)]">
            {d.count} · {Math.round((d.count / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [previewMode, setPreviewMode] = useState(true);

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Enterprise Reporting
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            KPIs, SLA performance, throughput, and clinical metrics
          </p>
        </div>
      </div>

      {/* Preview toggle */}
      <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[color:var(--foreground)]">Preview mode</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {previewMode ? "Representative data · not from a live backend" : "Connect backend to see live analytics"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewMode(v => !v)}
          role="switch"
          aria-checked={previewMode}
          className={["relative h-6 w-11 shrink-0 rounded-full transition-colors", previewMode ? "bg-[color:var(--primary)]" : "bg-[color:var(--border)]"].join(" ")}
        >
          <span className={["absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200", previewMode ? "translate-x-5" : "translate-x-0"].join(" ")} />
        </button>
      </div>

      {previewMode && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={12} className="shrink-0" />
          Representative preview data · Not connected to live data
        </div>
      )}

      {previewMode ? (
        <>
          {/* KPI row with trend indicators */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_DATA.map(kpi => {
              const Icon = kpi.icon;
              const toneClass: Record<string, string> = {
                primary: "border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300",
                success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                info:    "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
              };
              return (
                <Card key={kpi.label} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{kpi.label}</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)] tabular-nums">{kpi.value}</p>
                      <div className="mt-2 flex items-center gap-1">
                        {kpi.trend === "up"
                          ? <TrendingUp size={11} className="text-emerald-500 shrink-0" />
                          : <TrendingDown size={11} className="text-emerald-500 shrink-0" />
                        }
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{kpi.helper}</p>
                      </div>
                    </div>
                    <span className={`rounded-lg border p-2 ${toneClass[kpi.tone] ?? toneClass.primary}`}>
                      <Icon size={18} />
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Monthly throughput chart */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 size={15} className="text-[color:var(--primary)]" />
              <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Monthly Case Throughput</h2>
              <StatusBadge tone="info">Jan–Jun 2026</StatusBadge>
            </div>
            <ThroughputBars data={MONTHLY_THROUGHPUT} labels={MONTH_LABELS} />
            <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
              Jun (MTD) tracking +52% above Jan baseline · Target: 60 cases/month
            </p>
          </Card>

          {/* Two-column: Stage distribution + Approval turnaround */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Activity size={15} className="text-[color:var(--primary)]" />
                <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Cases by Stage</h2>
                <span className="ml-auto text-xs font-semibold tabular-nums text-[color:var(--muted-foreground)]">47 active</span>
              </div>
              <div className="space-y-2.5">
                {STAGE_DISTRIBUTION.map(s => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs font-medium text-[color:var(--foreground)] truncate">{s.label}</span>
                    <div className="flex-1">
                      <ProgressBar value={s.pct * 4} tone="primary" />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-[color:var(--muted-foreground)]">
                      {s.count} · {s.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Clock size={15} className="text-[color:var(--primary)]" />
                <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Approval Turnaround</h2>
              </div>
              <ApprovalHistogram data={APPROVAL_TURNAROUND} />
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-[color:var(--border)] p-3">
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums text-emerald-500">{SLA_METRICS.onTime}%</p>
                  <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">On-time</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums text-amber-500">{SLA_METRICS.atRisk}</p>
                  <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">At risk</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums text-rose-500">{SLA_METRICS.breached}</p>
                  <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">Breached</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Provider performance */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-5 py-4">
              <Users size={15} className="text-[color:var(--primary)]" />
              <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Provider Performance — Jun MTD</h2>
            </div>
            <div className="divide-y divide-[color:var(--border)]">
              {PROVIDER_PERFORMANCE.sort((a, b) => b.cases - a.cases).map(p => (
                <div key={p.name} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-[10px] font-bold text-[color:var(--primary)]">
                    {p.name.split(" ")[1][0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{p.name}</p>
                    <div className="mt-1 flex-1">
                      <ProgressBar value={Math.round((p.approved / p.cases) * 100)} tone="success" />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
                    <span className="font-medium text-[color:var(--foreground)]">{p.cases} cases</span>
                    <StatusBadge tone={p.sla >= 95 ? "success" : p.sla >= 90 ? "primary" : "warning"}>
                      {p.sla}% SLA
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        /* Empty state */
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Active patients", icon: Users, tone: "primary" as const },
            { label: "Cases completed", icon: CheckCircle2, tone: "success" as const },
            { label: "Avg SLA (days)",  icon: TrendingDown, tone: "info" as const },
            { label: "Approval time",   icon: Zap, tone: "warning" as const },
          ].map(kpi => (
            <MetricCard key={kpi.label} label={kpi.label} value="—" helper="Connect backend to view" icon={kpi.icon} tone={kpi.tone} />
          ))}
        </div>
      )}
    </section>
  );
}
