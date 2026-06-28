"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Layers3,
  Loader2,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Card, MetricCard, ProgressBar, StatusBadge } from "@/components/DesignSystem";
import { fetchAnalyticsSummary, type AnalyticsSummary } from "@/lib/api/analytics";

// ─── Status display helpers ───────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active_treatment: "Active Treatment",
  pending_records: "Pending Records",
  scan_review: "Scan Review",
  clinical_review: "Clinical Review",
  planning: "Planning",
  manufacturing: "Manufacturing",
  completed: "Completed",
  on_hold: "On Hold",
  draft: "Draft",
};

// ─── Chart components ─────────────────────────────────────────────────────────

function ThroughputBars({ data }: { data: { month: string; count: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-28 pt-2">
      {data.map((d, i) => {
        const isLatest = i === data.length - 1;
        const label = new Date(d.month + "-01").toLocaleString("default", { month: "short" });
        return (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[9px] font-semibold tabular-nums text-[color:var(--foreground)]">{d.count}</span>
            <div
              className={`w-full rounded-t-md transition-all duration-500 ${isLatest ? "bg-[color:var(--primary)]" : "bg-[color:var(--primary)]/40"}`}
              style={{ height: `${Math.max(8, (d.count / max) * 80)}px` }}
            />
            <span className="text-[8px] font-medium text-[color:var(--muted-foreground)] truncate w-full text-center leading-tight">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatusDistribution({ casesByStatus }: { casesByStatus: Record<string, number> }) {
  const total = Object.values(casesByStatus).reduce((a, b) => a + b, 0);
  const entries = Object.entries(casesByStatus)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  if (total === 0) return <p className="text-sm text-[color:var(--muted-foreground)]">No case data yet</p>;
  return (
    <div className="space-y-2.5">
      {entries.map(([status, count]) => (
        <div key={status} className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-xs font-medium text-[color:var(--foreground)] truncate">
            {STATUS_LABEL[status] ?? status}
          </span>
          <div className="flex-1">
            <ProgressBar value={Math.round((count / max) * 100)} tone="primary" />
          </div>
          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-[color:var(--muted-foreground)]">
            {count} · {Math.round((count / total) * 100)}%
          </span>
        </div>
      ))}
      <p className="pt-1 text-xs text-[color:var(--muted-foreground)]">{total} total cases</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [source, setSource] = useState<"api" | "demo" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyticsSummary()
      .then(({ data, source }) => { setData(data); setSource(source); })
      .catch((e) => setError(e?.message ?? "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[color:var(--muted-foreground)]" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="animate-page-enter mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-4 sm:px-5">
        <div className="flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50/60 px-3 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error ?? "Analytics unavailable"}
        </div>
      </section>
    );
  }

  // Derived KPIs
  const completedCases = data.casesByStatus["completed"] ?? 0;
  const activeCases = (data.casesByStatus["active_treatment"] ?? 0) + (data.casesByStatus["planning"] ?? 0);
  const latestMonthCount = data.monthlyThroughput.at(-1)?.count ?? 0;
  const prevMonthCount = data.monthlyThroughput.at(-2)?.count ?? 0;
  const momDelta = prevMonthCount > 0
    ? Math.round(((latestMonthCount - prevMonthCount) / prevMonthCount) * 100)
    : null;

  const KPI_CARDS = [
    {
      label: "Total cases",
      value: String(data.totalCases),
      helper: `${activeCases} active`,
      trend: "up" as const,
      icon: Activity,
      tone: "primary" as const,
    },
    {
      label: "Total patients",
      value: String(data.totalPatients),
      helper: `${completedCases} completed cases`,
      trend: "up" as const,
      icon: Users,
      tone: "success" as const,
    },
    {
      label: "Cases this month",
      value: String(latestMonthCount),
      helper: momDelta !== null ? `${momDelta >= 0 ? "+" : ""}${momDelta}% vs last month` : "First month tracked",
      trend: (momDelta ?? 0) >= 0 ? ("up" as const) : ("down" as const),
      icon: TrendingUp,
      tone: "info" as const,
    },
    {
      label: "Plan approval rate",
      value: data.planApprovalRate !== null ? `${data.planApprovalRate}%` : "—",
      helper: data.avgEstimatedStages !== null ? `Avg ${data.avgEstimatedStages} stages/plan` : "No plans yet",
      trend: "up" as const,
      icon: CheckCircle2,
      tone: "success" as const,
    },
  ];

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Practice Reporting
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Case throughput, status distribution, and treatment plan metrics
          </p>
        </div>
        <StatusBadge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Live data" : "Demo data"}
        </StatusBadge>
      </div>

      {source === "demo" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={12} className="shrink-0" />
          Backend unreachable — showing representative demo data
        </div>
      )}

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CARDS.map((kpi) => {
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
                    <p className="text-xs text-[color:var(--muted-foreground)]">{kpi.helper}</p>
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
      {data.monthlyThroughput.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 size={15} className="text-[color:var(--primary)]" />
            <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Monthly Case Throughput</h2>
            <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">last 6 months</span>
          </div>
          <ThroughputBars data={data.monthlyThroughput} />
        </Card>
      )}

      {/* Status distribution */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={15} className="text-[color:var(--primary)]" />
            <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Cases by Status</h2>
          </div>
          <StatusDistribution casesByStatus={data.casesByStatus} />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 size={15} className="text-[color:var(--primary)]" />
            <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Treatment Plans</h2>
          </div>
          {data.planApprovalRate !== null ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">
                    {data.planApprovalRate}%
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">Approval rate</p>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">
                    {data.avgEstimatedStages?.toFixed(0) ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">Avg stages</p>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[color:var(--muted-foreground)]">Plan approval rate</span>
                  <span className="font-semibold text-[color:var(--foreground)]">{data.planApprovalRate}%</span>
                </div>
                <ProgressBar
                  value={data.planApprovalRate}
                  tone={data.planApprovalRate >= 90 ? "success" : data.planApprovalRate >= 70 ? "warning" : "danger"}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Clock size={20} className="text-[color:var(--muted-foreground)]" />
              <p className="text-sm text-[color:var(--muted-foreground)]">No treatment plans created yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* Disclaimer */}
      <Card className="border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <Zap size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-xs leading-5 text-[color:var(--foreground)]">
            Analytics data is aggregated from your organization&apos;s case records in real time.
            Throughput counts include all case statuses. Plan approval rate counts plans with
            doctor_approval = true. Data refreshes on page load.
          </p>
        </div>
      </Card>
    </section>
  );
}
