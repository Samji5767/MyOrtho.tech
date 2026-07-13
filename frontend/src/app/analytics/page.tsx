"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  BarChart2,
  BarChart3,
  CheckCircle2,
  Clock,
  FolderKanban,
  TrendingUp,
  Users,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Card, SkeletonBlock } from "@/components/DesignSystem";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";
import { api } from "@/lib/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  total: number;
  active: number;
  awaitingApproval: number;
  manufacturingQueue: number;
  completedThisMonth: number;
  newThisMonth: number;
  avgTreatmentDays: number;
}

interface Metric {
  label: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set([
  "scan_review",
  "segmentation",
  "planning",
  "clinical_review",
  "active_treatment",
  "monitoring",
]);

const WORKFLOW_STATUSES = new Set([
  "draft",
  "scan_review",
  "segmentation",
  "planning",
  "clinical_review",
  "approved",
  "active_treatment",
  "monitoring",
  "retention",
  "completed",
]);

const STAGGER_CLASSES = [
  "animate-stagger-1",
  "animate-stagger-2",
  "animate-stagger-3",
  "animate-stagger-4",
  "animate-stagger-5",
  "animate-stagger-6",
];

function buildMetrics(cases: CaseListItem[]): Metric[] {
  const total = cases.length;
  const active = cases.filter((c) => ACTIVE_STATUSES.has(c.status)).length;
  const completed = cases.filter((c) => c.status === "completed").length;
  const approved = cases.filter((c) => c.status === "approved").length;
  const retention = cases.filter((c) => c.status === "retention").length;
  const uniquePatients = new Set(cases.map((c) => c.patient?.id).filter(Boolean)).size;

  return [
    {
      label: "Total Cases",
      value: total,
      icon: FolderKanban,
      color: "text-[color:var(--primary)]",
      bg: "bg-[color:var(--primary-glow)]",
      sub: "all time",
    },
    {
      label: "Active Cases",
      value: active,
      icon: Activity,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      sub: "in progress",
    },
    {
      label: "Completed",
      value: completed,
      icon: CheckCircle2,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-500/10",
      sub: "treatment done",
    },
    {
      label: "Awaiting Approval",
      value: approved,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      sub: "pending sign-off",
    },
    {
      label: "In Retention",
      value: retention,
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
      sub: "retention phase",
    },
    {
      label: "Unique Patients",
      value: uniquePatients,
      icon: Users,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-500/10",
      sub: "distinct patients",
    },
  ];
}

// ─── Monthly trend helpers ─────────────────────────────────────────────────────

interface MonthBucket {
  label: string;
  count: number;
}

function buildMonthlyTrend(cases: CaseListItem[], months = 6): MonthBucket[] {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    return {
      label: d.toLocaleString("default", { month: "short" }),
      count: cases.filter((c) => {
        const cd = new Date(c.createdAt);
        return cd.getFullYear() === year && cd.getMonth() === month;
      }).length,
    };
  });
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft:            "Draft",
  scan_review:      "Scan Review",
  segmentation:     "Segmentation",
  planning:         "Planning",
  clinical_review:  "Clinical Review",
  approved:         "Approved",
  active_treatment: "Active Treatment",
  monitoring:       "Monitoring",
  retention:        "Retention",
  completed:        "Completed",
  archived:         "Archived",
  cancelled:        "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  draft:            "bg-slate-400",
  scan_review:      "bg-sky-500",
  segmentation:     "bg-violet-500",
  planning:         "bg-indigo-500",
  clinical_review:  "bg-amber-500",
  approved:         "bg-teal-500",
  active_treatment: "bg-emerald-500",
  monitoring:       "bg-blue-500",
  retention:        "bg-cyan-500",
  completed:        "bg-green-600",
  archived:         "bg-slate-500",
  cancelled:        "bg-rose-500",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-3 p-4">
          <SkeletonBlock className="h-7 w-7 rounded-lg" />
          <SkeletonBlock className="h-7 w-12" />
          <div className="space-y-1.5">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-2.5 w-16" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "demo">("demo");
  const [barsVisible, setBarsVisible] = useState(false);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [auditCount, setAuditCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchCases();
      setCases(result.cases);
      setSource(result.source);

      api.get<AnalyticsSummary>('/api/cases/analytics/summary')
        .then(setSummary)
        .catch(() => { /* optional metric, ignore failure */ });

      api.get<{ recentCount: number }>('/api/audit/summary?hours=24')
        .then((d) => setAuditCount(d.recentCount))
        .catch(() => { /* optional metric, ignore failure */ });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Animate bars after data loads
  useEffect(() => {
    if (!loading && cases.length > 0) {
      const t = setTimeout(() => setBarsVisible(true), 80);
      return () => clearTimeout(t);
    }
  }, [loading, cases.length]);

  const metrics = buildMetrics(cases);
  const monthlyTrend = buildMonthlyTrend(cases, 6);
  const maxMonthlyCount = Math.max(...monthlyTrend.map((b) => b.count), 1);

  const statusCounts = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusEntries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...statusEntries.map(([, n]) => n), 1);

  // Workflow distribution (exclude archived/cancelled)
  const workflowEntries = statusEntries.filter(([status]) => WORKFLOW_STATUSES.has(status));

  // Completion rate
  const completionRate = cases.length > 0
    ? Math.round((cases.filter((c) => c.status === "completed").length / cases.length) * 100)
    : 0;
  const activeRate = cases.length > 0
    ? Math.round((cases.filter((c) => ACTIVE_STATUSES.has(c.status)).length / cases.length) * 100)
    : 0;

  // Practice efficiency rates
  const approvalPipelineRate = summary
    ? Math.round((summary.awaitingApproval / Math.max(summary.total, 1)) * 100)
    : 0;
  const manufacturingThroughputRate = summary
    ? Math.round((summary.manufacturingQueue / Math.max(summary.active, 1)) * 100)
    : 0;

  return (
    <main className="animate-page-enter mx-auto w-full max-w-4xl px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+2rem)] pt-4 sm:px-5">

      {/* ── Header ── */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--primary-glow)]">
            <BarChart3 className="h-5 w-5 text-[color:var(--primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[color:var(--foreground)]">Analytics</h1>
            <p className="text-xs text-[color:var(--muted-foreground)]">Practice performance overview</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {source === "demo" && !loading && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Demo data
            </span>
          )}
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40 disabled:opacity-50 transition-colors"
          >
            <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
          <span className="shrink-0">⚠</span>
          <span>{loadError}</span>
          <button onClick={() => void load()} className="ml-auto text-xs font-semibold underline underline-offset-2 hover:no-underline">Retry</button>
        </div>
      )}

      {/* ── Metrics grid ── */}
      {loading ? (
        <MetricsSkeleton />
      ) : cases.length === 0 && !loadError ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] py-12 text-center">
          <p className="text-sm font-medium text-[color:var(--foreground)]">No cases yet</p>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">Analytics will appear once you create your first case.</p>
          <Link href="/cases/new" className="mt-4 inline-block rounded-xl bg-[color:var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90">Create case</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metrics.map((m, i) => {
            const stagger = STAGGER_CLASSES[Math.min(i, STAGGER_CLASSES.length - 1)];
            return (
              <Card key={m.label} className={`flex flex-col gap-2 p-4 ${stagger}`}>
                <div className={`grid h-8 w-8 place-items-center rounded-xl ${m.bg}`}>
                  <m.icon className={`h-4 w-4 ${m.color}`} />
                </div>
                <p className={`text-2xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
                <div>
                  <p className="text-xs font-semibold text-[color:var(--foreground)]">{m.label}</p>
                  {m.sub && <p className="text-[10px] text-[color:var(--muted-foreground)]">{m.sub}</p>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Rate summary ── */}
      {!loading && cases.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 animate-stagger-3">
          {[
            { label: "Completion Rate", value: completionRate, color: "bg-emerald-500", track: "bg-emerald-500/15" },
            { label: "Active Rate",     value: activeRate,     color: "bg-[color:var(--primary)]", track: "bg-[color:var(--primary-glow)]" },
          ].map((r) => (
            <Card key={r.label} className="p-4">
              <p className="text-xs font-semibold text-[color:var(--foreground)]">{r.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[color:var(--foreground)]">{r.value}%</p>
              <div className={`mt-2 h-2 overflow-hidden rounded-full ${r.track}`}>
                <div
                  className={`h-full rounded-full ${r.color} transition-all duration-700 ease-out`}
                  style={{ width: barsVisible ? `${r.value}%` : "0%" }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Status distribution ── */}
      {!loading && statusEntries.length > 0 && (
        <Card className="mt-4 p-4 animate-stagger-4">
          <div className="mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[color:var(--muted-foreground)]" />
            <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Cases by Status</h2>
            <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">{cases.length} total</span>
          </div>
          <div className="space-y-3">
            {statusEntries.map(([status, count], i) => {
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[11px] text-[color:var(--muted-foreground)] truncate">
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <div className="flex-1 overflow-hidden rounded-full bg-[color:var(--border)]/40 h-2">
                    <div
                      className={`h-full rounded-full transition-all ease-out ${STATUS_COLOR[status] ?? "bg-slate-400"}`}
                      style={{
                        width: barsVisible ? `${pct}%` : "0%",
                        transitionDuration: `${500 + i * 60}ms`,
                        transitionDelay: barsVisible ? `${i * 40}ms` : "0ms",
                      }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[color:var(--foreground)]">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Monthly new cases trend ── */}
      {!loading && cases.length > 0 && (
        <Card className="mt-4 p-4 animate-stagger-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[color:var(--muted-foreground)]" />
            <h2 className="text-sm font-semibold text-[color:var(--foreground)]">New Cases — Last 6 Months</h2>
          </div>
          <div className="flex items-end gap-2 h-24">
            {monthlyTrend.map((bucket, i) => {
              const pct = Math.round((bucket.count / maxMonthlyCount) * 100);
              const isLast = i === monthlyTrend.length - 1;
              return (
                <div key={bucket.label} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold tabular-nums text-[color:var(--foreground)]">
                    {bucket.count > 0 ? bucket.count : ""}
                  </span>
                  <div className="relative w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-sm transition-all duration-700 ease-out ${
                        isLast
                          ? "bg-[color:var(--primary)]"
                          : "bg-[color:var(--primary)]/40"
                      }`}
                      style={
                        {
                          height: barsVisible ? `${Math.max(4, pct)}%` : "0%",
                          transitionDelay: barsVisible ? `${i * 60}ms` : "0ms",
                        } as CSSProperties
                      }
                    />
                  </div>
                  <span className="text-[10px] text-[color:var(--muted-foreground)]">{bucket.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Treatment Intelligence ── */}
      {!loading && summary !== null && (
        <div className="mt-4 animate-stagger-5">
          <h2 className="mb-2 text-sm font-semibold text-[color:var(--foreground)]">Treatment Intelligence</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="flex flex-col gap-2 p-4">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/10">
                <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                {summary.avgTreatmentDays ?? '—'} <span className="text-sm font-medium">days</span>
              </p>
              <div>
                <p className="text-xs font-semibold text-[color:var(--foreground)]">Avg Treatment Duration</p>
                <p className="text-[10px] text-[color:var(--muted-foreground)]">per case</p>
              </div>
            </Card>
            <Card className="flex flex-col gap-2 p-4">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/10">
                <TrendingUp className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-sky-600 dark:text-sky-400">
                {summary.newThisMonth ?? '—'}
              </p>
              <div>
                <p className="text-xs font-semibold text-[color:var(--foreground)]">New Cases This Month</p>
                <p className="text-[10px] text-[color:var(--muted-foreground)]">calendar month</p>
              </div>
            </Card>
            <Card className="flex flex-col gap-2 p-4">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/10">
                <Activity className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-400">
                {summary.manufacturingQueue ?? '—'}
              </p>
              <div>
                <p className="text-xs font-semibold text-[color:var(--foreground)]">Manufacturing Queue</p>
                <p className="text-[10px] text-[color:var(--muted-foreground)]">awaiting production</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Practice Efficiency ── */}
      {!loading && summary !== null && (
        <div className="mt-4 animate-stagger-5">
          <h2 className="mb-2 text-sm font-semibold text-[color:var(--foreground)]">Practice Efficiency</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Approval Pipeline",
                value: approvalPipelineRate,
                color: "bg-amber-500",
                track: "bg-amber-500/15",
              },
              {
                label: "Manufacturing Throughput",
                value: manufacturingThroughputRate,
                color: "bg-violet-500",
                track: "bg-violet-500/15",
              },
            ].map((r) => (
              <Card key={r.label} className="p-4">
                <p className="text-xs font-semibold text-[color:var(--foreground)]">{r.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[color:var(--foreground)]">{r.value}%</p>
                <div className={`mt-2 h-2 overflow-hidden rounded-full ${r.track}`}>
                  <div
                    className={`h-full rounded-full ${r.color} transition-all duration-700 ease-out`}
                    style={{ width: barsVisible ? `${r.value}%` : "0%" }}
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Workflow Distribution ── */}
      {!loading && workflowEntries.length > 0 && (
        <Card className="mt-4 p-4 animate-stagger-5">
          <div className="mb-3 flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-[color:var(--muted-foreground)]" />
            <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Workflow Distribution</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-[color:var(--border)]/40">
                {workflowEntries.map(([status, count]) => (
                  <tr key={status} className="group">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_COLOR[status] ?? "bg-slate-400"}`}
                        />
                        <span className="text-[color:var(--foreground)] font-medium">
                          {STATUS_LABELS[status] ?? status}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <span className="inline-flex items-center justify-center rounded-full bg-[color:var(--border)]/50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[color:var(--foreground)]">
                        {count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Recent Activity (Audit) ── */}
      {!loading && (
        <Card className="mt-4 p-4 animate-stagger-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-[color:var(--primary-glow)]">
                <Activity className="h-4 w-4 text-[color:var(--primary)]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[color:var(--foreground)]">Recent Activity</p>
                <p className="text-[10px] text-[color:var(--muted-foreground)]">
                  {auditCount !== null
                    ? `${auditCount} event${auditCount === 1 ? '' : 's'} in the last 24 hours`
                    : "Audit trail"}
                </p>
              </div>
            </div>
            <Link
              href="/admin/audit"
              className="shrink-0 text-[11px] font-semibold text-[color:var(--primary)] hover:opacity-80 transition-opacity"
            >
              View all
            </Link>
          </div>
        </Card>
      )}

      {/* ── Link to cases ── */}
      {!loading && (
        <div className="mt-5 text-center animate-stagger-5">
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--primary)] hover:opacity-80 transition-opacity"
          >
            View all cases
            <FolderKanban className="h-4 w-4" />
          </Link>
        </div>
      )}
    </main>
  );
}
