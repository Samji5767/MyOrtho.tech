"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  Brain,
  CheckCircle2,
  Clock,
  FolderKanban,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api/client";
import { Card, SkeletonBlock, StatusBadge } from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PracticeAnalytics {
  period: string;
  totalNewPatients: number;
  totalNewCases: number;
  completedCases: number;
  averageCaseDurationWeeks: number | null;
  refinementRate: number | null;
  completionRate: number | null;
  casesByStatus: Record<string, number>;
  sampleSizes: Record<string, number>;
}

interface MetricsPayload {
  jobs: {
    pending: number; running: number; completed: number; failed: number;
    dead_letter: number; retry_scheduled: number; total: number;
  };
  ai: { total: number; disclaimerShownCount: number; disclaimerRate: number };
  worker: { isRunning: boolean; concurrency: number; activeJobs: number };
}

interface CaseAnalyticsSummary {
  totalCases: number;
  activeCases: number;
  pendingReview: number;
  completedThisMonth: number;
  manufacturingQueue: number;
  archivedCases: number;
  draftCases: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n * 100)}%`;
}
function weeks(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(1)}w`;
}
function num(n: number | undefined): string {
  if (n === undefined) return '—';
  return n.toLocaleString();
}

function KpiCard({
  label, value, sub, icon: Icon, color, bg,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType;
  color: string; bg: string;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted-foreground)]">{label}</p>
        <span className={`grid h-7 w-7 place-items-center rounded-xl ${bg} ${color}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className={`text-3xl font-bold tabular-nums tracking-tight ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-[color:var(--muted-foreground)]">{sub}</p>}
    </Card>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-[color:var(--foreground)]">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{sub}</p>}
    </div>
  );
}

function DataBar({ label, value, max, color = 'bg-[color:var(--primary)]' }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pctVal = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="w-28 shrink-0 truncate text-xs text-[color:var(--foreground)]">{label}</p>
      <div className="flex-1 overflow-hidden rounded-full bg-[color:var(--border)]" style={{ height: 6 }}>
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, pctVal)}%` }} />
      </div>
      <p className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EnterpriseDashboardPage() {
  const { status, user } = useAuth();
  const [analytics, setAnalytics] = useState<PracticeAnalytics | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [caseStats, setCaseStats] = useState<CaseAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, metricsRes, caseStatsRes] = await Promise.allSettled([
        api.get<PracticeAnalytics>(`/api/predictions/practice-analytics?period=${period}`),
        api.get<MetricsPayload>('/api/metrics'),
        api.get<CaseAnalyticsSummary>('/api/cases/analytics/summary'),
      ]);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value);
      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value);
      if (caseStatsRes.status === 'fulfilled') setCaseStats(caseStatsRes.value);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  if (status === 'loading') return null;
  if (status === 'unauthenticated') return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--muted-foreground)]">
      Authentication required
    </div>
  );

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  if (!isAdmin) return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--muted-foreground)]">
      Admin access required
    </div>
  );

  const statusEntries = analytics?.casesByStatus
    ? Object.entries(analytics.casesByStatus).sort(([, a], [, b]) => b - a)
    : [];
  const maxStatusCount = statusEntries[0]?.[1] ?? 1;

  const aiDisclaimer = metrics?.ai.disclaimerRate !== undefined
    ? `${Math.round(metrics.ai.disclaimerRate * 100)}%`
    : '—';
  const disclaimerOk = metrics?.ai.disclaimerRate === 1.0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-20 pt-5 sm:px-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
          >
            <ArrowLeft size={13} /> Admin
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">Enterprise Dashboard</h1>
          <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
            Practice performance, AI utilization, and operational health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]/30 p-1">
            {(['7', '30', '90'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={[
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  period === p
                    ? 'bg-[color:var(--card)] text-[color:var(--foreground)] shadow-sm'
                    : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]',
                ].join(' ')}
              >
                {p}d
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Practice Growth KPIs ── */}
      <section>
        <SectionTitle title="Practice Growth" sub={`Last ${period} days`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading ? (
            [1,2,3,4].map((i) => <SkeletonBlock key={i} className="h-24 w-full" />)
          ) : (
            <>
              <KpiCard label="New Patients" value={num(analytics?.totalNewPatients)} icon={Users}
                color="text-[color:var(--primary)]" bg="bg-[color:var(--primary-glow)]" />
              <KpiCard label="New Cases" value={num(analytics?.totalNewCases)} icon={FolderKanban}
                color="text-violet-600 dark:text-violet-400" bg="bg-violet-500/10" />
              <KpiCard label="Completed" value={num(analytics?.completedCases)} icon={CheckCircle2}
                color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-500/10" />
              <KpiCard label="Completion Rate" value={pct(analytics?.completionRate)} icon={TrendingUp}
                sub={analytics?.sampleSizes?.cases ? `${analytics.sampleSizes.cases} cases` : undefined}
                color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-500/10" />
            </>
          )}
        </div>
      </section>

      {/* ── Clinical Quality KPIs ── */}
      <section>
        <SectionTitle title="Clinical Quality" sub="Based on historical case data" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading ? (
            [1,2,3,4].map((i) => <SkeletonBlock key={i} className="h-24 w-full" />)
          ) : (
            <>
              <KpiCard label="Avg Case Duration" value={weeks(analytics?.averageCaseDurationWeeks)}
                sub={analytics?.sampleSizes?.duration ? `${analytics.sampleSizes.duration} completed` : undefined}
                icon={Clock} color="text-sky-600 dark:text-sky-400" bg="bg-sky-500/10" />
              <KpiCard label="Refinement Rate" value={pct(analytics?.refinementRate)}
                sub={analytics?.sampleSizes?.refinement ? `${analytics.sampleSizes.refinement} cases` : undefined}
                icon={BarChart2} color="text-amber-600 dark:text-amber-400" bg="bg-amber-500/10" />
              <KpiCard label="Mfg Queue" value={num(caseStats?.manufacturingQueue)} icon={Package}
                color="text-orange-600 dark:text-orange-400" bg="bg-orange-500/10" />
              <KpiCard label="Pending Review" value={num(caseStats?.pendingReview)} icon={ArrowUpRight}
                color="text-rose-600 dark:text-rose-400" bg="bg-rose-500/10" />
            </>
          )}
        </div>
      </section>

      {/* ── AI & Worker ── */}
      <section>
        <SectionTitle title="AI & Operations" sub="Live system metrics" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {loading ? (
            [1,2,3].map((i) => <SkeletonBlock key={i} className="h-28 w-full" />)
          ) : (
            <>
              <Card className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-violet-500/10">
                    <Brain size={14} className="text-violet-600 dark:text-violet-400" />
                  </span>
                  <p className="text-xs font-semibold text-[color:var(--foreground)]">AI Disclaimer Compliance</p>
                </div>
                <p className={`text-3xl font-bold tabular-nums ${disclaimerOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {aiDisclaimer}
                </p>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={disclaimerOk ? 'success' : 'danger'}>
                    {disclaimerOk ? 'Compliant' : 'Requires Action'}
                  </StatusBadge>
                  <span className="text-[10px] text-[color:var(--muted-foreground)]">
                    {metrics?.ai.total ?? 0} inferences
                  </span>
                </div>
              </Card>

              <Card className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-sky-500/10">
                    <Zap size={14} className="text-sky-600 dark:text-sky-400" />
                  </span>
                  <p className="text-xs font-semibold text-[color:var(--foreground)]">Background Worker</p>
                </div>
                <p className={`text-3xl font-bold tabular-nums ${metrics?.worker.isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {metrics?.worker.isRunning ? 'Online' : 'Offline'}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-[color:var(--muted-foreground)]">
                  <span>{metrics?.worker.activeJobs ?? 0} active jobs</span>
                  <span>·</span>
                  <span>{metrics?.worker.concurrency ?? 0} concurrency</span>
                </div>
              </Card>

              <Card className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-amber-500/10">
                    <Package size={14} className="text-amber-600 dark:text-amber-400" />
                  </span>
                  <p className="text-xs font-semibold text-[color:var(--foreground)]">Job Queue Health</p>
                </div>
                <p className={`text-3xl font-bold tabular-nums ${(metrics?.jobs.dead_letter ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {metrics?.jobs.pending ?? '—'}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-[color:var(--muted-foreground)]">
                  <span>{metrics?.jobs.dead_letter ?? 0} dead-letter</span>
                  <span>·</span>
                  <span>{metrics?.jobs.failed ?? 0} failed</span>
                </div>
              </Card>
            </>
          )}
        </div>
      </section>

      {/* ── Cases by Status ── */}
      {!loading && statusEntries.length > 0 && (
        <section>
          <SectionTitle title="Cases by Status" sub="Current caseload distribution" />
          <Card className="flex flex-col gap-3 p-4">
            {statusEntries.map(([status, count]) => (
              <DataBar
                key={status}
                label={status.replace(/_/g, ' ')}
                value={count}
                max={maxStatusCount}
                color={
                  status === 'active_treatment' ? 'bg-[color:var(--primary)]' :
                  status === 'completed' ? 'bg-emerald-500' :
                  status === 'clinical_review' || status === 'scan_review' ? 'bg-amber-500' :
                  status === 'cancelled' || status === 'archived' ? 'bg-slate-400' :
                  'bg-sky-500'
                }
              />
            ))}
          </Card>
        </section>
      )}

      {/* ── Quick links ── */}
      <section>
        <SectionTitle title="Operations" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Background Jobs', sub: 'Worker queue & DLQ', href: '/admin/jobs' },
            { label: 'AI Operations', sub: 'Inference audit & models', href: '/admin/ai-ops' },
            { label: 'Integrations', sub: 'Provider health status', href: '/admin/integrations' },
            { label: 'Audit Log', sub: 'Organization audit trail', href: '/admin/audit' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 transition-all hover:border-[color:var(--primary)]/30 hover:bg-[color:var(--primary-glow)]/50"
            >
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{item.label}</p>
              <p className="text-xs text-[color:var(--muted-foreground)]">{item.sub}</p>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
