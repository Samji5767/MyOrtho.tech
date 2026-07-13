"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import {
  MetricCard,
  SkeletonBlock,
  StatusBadge,
} from "@/components/DesignSystem";
import {
  BarChart3,
  Package,
  Printer,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface PrinterUtilization {
  name: string;
  brand: string;
  completedJobs: number;
  totalJobs: number;
  utilizationRate: number;
}

interface BatchEfficiencyRow {
  status: string;
  count: number;
  avgHours: number | null;
}

interface FailureRate {
  failed: number;
  total: number;
  rate: number;
}

interface QaRejectionRate {
  rejected: number;
  total: number;
  rate: number;
}

interface TopInventoryItem {
  name: string;
  category: string;
  totalUsed: number;
}

interface ThroughputByDay {
  day: string;
  completed: number;
  failed: number;
}

interface ManufacturingMetrics {
  printerUtilization: PrinterUtilization[];
  batchEfficiency: BatchEfficiencyRow[];
  failureRate: FailureRate;
  qaRejectionRate: QaRejectionRate;
  topInventoryUsage: TopInventoryItem[];
  throughputByDay: ThroughputByDay[];
  periodDays: number;
}

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const BATCH_STATUS_TONES: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "info"> = {
  completed:  "success",
  printing:   "primary",
  queued:     "neutral",
  failed:     "danger",
  cancelled:  "neutral",
  draft:      "neutral",
};

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtHours(h: number | null) {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function ThroughputBar({ completed, failed, maxVal }: { completed: number; failed: number; maxVal: number }) {
  const total = completed + failed;
  const barW = maxVal > 0 ? (total / maxVal) * 100 : 0;
  const failPct = total > 0 ? (failed / total) * 100 : 0;

  return (
    <div className="relative h-5 w-full overflow-hidden rounded bg-[color:var(--muted)]/40">
      <div
        className="absolute inset-y-0 left-0 flex"
        style={{ width: `${barW}%` }}
      >
        <div
          className="h-full bg-emerald-500/80"
          style={{ width: `${100 - failPct}%` }}
        />
        {failed > 0 && (
          <div
            className="h-full bg-rose-500/80"
            style={{ width: `${failPct}%` }}
          />
        )}
      </div>
    </div>
  );
}

export default function ManufacturingAnalyticsPage() {
  const [metrics, setMetrics] = useState<ManufacturingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    setLoading(true);
    api
      .get<ManufacturingMetrics>(`/api/manufacturing/analytics?days=${period}`)
      .then((data: ManufacturingMetrics) => {
        setMetrics(data);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  const maxThroughput = metrics
    ? Math.max(...metrics.throughputByDay.map((d) => d.completed + d.failed), 1)
    : 1;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 pb-24 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-[color:var(--foreground)]">
            <BarChart3 size={20} className="text-[color:var(--primary)]" />
            Manufacturing Analytics
          </h1>
          <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
            Production performance and quality metrics
          </p>
        </div>

        {/* Period picker */}
        <div className="flex gap-1 rounded-lg border border-[color:var(--border)] p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={[
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                period === opt.value
                  ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                  : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <SkeletonBlock className="h-48 rounded-xl" />
          <SkeletonBlock className="h-48 rounded-xl" />
        </div>
      ) : metrics ? (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Failure Rate"
              value={pct(metrics.failureRate.rate)}
              helper={`${metrics.failureRate.failed} / ${metrics.failureRate.total} jobs`}
              icon={TrendingDown}
            />
            <MetricCard
              label="QA Rejection Rate"
              value={pct(metrics.qaRejectionRate.rate)}
              helper={`${metrics.qaRejectionRate.rejected} / ${metrics.qaRejectionRate.total} inspections`}
              icon={ShieldCheck}
            />
            <MetricCard
              label="Printers Tracked"
              value={String(metrics.printerUtilization.length)}
              helper="in fleet"
              icon={Printer}
            />
            <MetricCard
              label="Inventory Items Used"
              value={String(metrics.topInventoryUsage.reduce((s, i) => s + i.totalUsed, 0))}
              helper={`past ${period} days`}
              icon={Package}
            />
          </div>

          {/* Throughput chart */}
          <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[color:var(--foreground)]">
              Daily Throughput — last {period} days
            </h2>
            {metrics.throughputByDay.length === 0 ? (
              <p className="py-8 text-center text-sm text-[color:var(--muted-foreground)]">No data for this period</p>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-4 text-xs text-[color:var(--muted-foreground)] mb-3">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/80" />
                    Completed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500/80" />
                    Failed
                  </span>
                </div>
                {metrics.throughputByDay.map((row) => (
                  <div key={row.day} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3">
                    <span className="text-right text-xs tabular-nums text-[color:var(--muted-foreground)]">
                      {new Date(row.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <ThroughputBar
                      completed={row.completed}
                      failed={row.failed}
                      maxVal={maxThroughput}
                    />
                    <span className="text-xs tabular-nums text-[color:var(--muted-foreground)]">
                      {row.completed + row.failed}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Printer utilization */}
          <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[color:var(--foreground)]">
              Printer Utilization
            </h2>
            {metrics.printerUtilization.length === 0 ? (
              <p className="py-8 text-center text-sm text-[color:var(--muted-foreground)]">No printer data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] text-left text-xs text-[color:var(--muted-foreground)]">
                      <th className="pb-2 font-medium">Printer</th>
                      <th className="pb-2 font-medium">Brand</th>
                      <th className="pb-2 text-right font-medium tabular-nums">Jobs Done</th>
                      <th className="pb-2 text-right font-medium tabular-nums">Total</th>
                      <th className="pb-2 w-32 font-medium">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border)]">
                    {metrics.printerUtilization.map((p) => (
                      <tr key={p.name} className="text-[color:var(--foreground)]">
                        <td className="py-2.5 font-medium">{p.name}</td>
                        <td className="py-2.5 text-[color:var(--muted-foreground)]">{p.brand}</td>
                        <td className="py-2.5 text-right tabular-nums">{p.completedJobs}</td>
                        <td className="py-2.5 text-right tabular-nums">{p.totalJobs}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="relative h-2 flex-1 overflow-hidden rounded bg-[color:var(--muted)]/40">
                              <div
                                className="absolute inset-y-0 left-0 rounded bg-[color:var(--primary)]"
                                style={{ width: pct(p.utilizationRate) }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs tabular-nums text-[color:var(--muted-foreground)]">
                              {pct(p.utilizationRate)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Batch efficiency + Top inventory side by side */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Batch efficiency */}
            <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
              <h2 className="mb-4 text-sm font-semibold text-[color:var(--foreground)]">
                Batch Efficiency by Status
              </h2>
              {metrics.batchEfficiency.length === 0 ? (
                <p className="py-8 text-center text-sm text-[color:var(--muted-foreground)]">No batch data</p>
              ) : (
                <div className="space-y-2">
                  {metrics.batchEfficiency.map((row) => (
                    <div
                      key={row.status}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <StatusBadge tone={BATCH_STATUS_TONES[row.status] ?? "neutral"}>
                        {row.status.replace(/_/g, " ")}
                      </StatusBadge>
                      <span className="tabular-nums text-sm text-[color:var(--foreground)]">
                        {row.count} batch{row.count !== 1 ? "es" : ""}
                      </span>
                      <span className="text-xs text-[color:var(--muted-foreground)]">
                        avg {fmtHours(row.avgHours)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Top inventory usage */}
            <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
                <TrendingUp size={14} />
                Top Inventory Usage
              </h2>
              {metrics.topInventoryUsage.length === 0 ? (
                <p className="py-8 text-center text-sm text-[color:var(--muted-foreground)]">No inventory data</p>
              ) : (
                <ol className="space-y-3">
                  {metrics.topInventoryUsage.map((item, idx) => (
                    <li key={item.name} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--muted)] text-xs font-bold tabular-nums text-[color:var(--muted-foreground)]">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                          {item.name}
                        </p>
                        <p className="text-xs text-[color:var(--muted-foreground)]">
                          {item.category}
                        </p>
                      </div>
                      <span className="tabular-nums text-sm text-[color:var(--foreground)]">
                        {item.totalUsed} used
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
