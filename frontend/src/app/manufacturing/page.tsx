"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Boxes,
  ChevronRight,
  ClipboardCheck,
  Layers,
  Printer,
  RefreshCw,
  Truck,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api/client";
import {
  Card,
  EmptyState,
  MetricCard,
  SkeletonBlock,
  StatusBadge,
} from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusCount = { status: string; count: number };

interface LabDashboard {
  printJobsByStatus: StatusCount[];
  batchesByStatus: StatusCount[];
  printersByStatus: StatusCount[];
  failedJobsToday: number;
  qaInspectionsByStatus: StatusCount[];
  shipmentsByStatus: StatusCount[];
  inventoryAlerts: number;
  dailyMetrics: Array<{
    day: string;
    jobsCreated: number;
    jobsCompleted: number;
  }>;
}

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (["completed", "passed", "delivered"].includes(s)) return "success";
  if (["idle", "online"].includes(s)) return "info";
  if (["failed", "rejected", "error", "exception"].includes(s)) return "danger";
  if (["printing", "processing", "in_transit", "active", "in_progress", "out_for_delivery"].includes(s))
    return "primary";
  if (["pending", "queued", "staging", "held", "nesting"].includes(s)) return "warning";
  if (["cancelled", "skipped", "offline"].includes(s)) return "neutral";
  return "neutral";
}

function fmtStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function sumCounts(arr: StatusCount[]): number {
  return arr.reduce((a, r) => a + r.count, 0);
}

function sumStatusCounts(arr: StatusCount[], ...statuses: string[]): number {
  return arr.filter((r) => statuses.includes(r.status)).reduce((a, r) => a + r.count, 0);
}

// ─── Navigation cards ─────────────────────────────────────────────────────────

const LAB_NAV = [
  {
    href: "/manufacturing/batches",
    icon: Layers,
    label: "Batches",
    desc: "Production batch management",
  },
  {
    href: "/manufacturing/printers",
    icon: Printer,
    label: "Printers",
    desc: "Monitor printer fleet",
  },
  {
    href: "/manufacturing/qa",
    icon: ClipboardCheck,
    label: "QA Inspection",
    desc: "Quality assurance queue",
  },
  {
    href: "/manufacturing/inventory",
    icon: Boxes,
    label: "Inventory",
    desc: "Materials and stock levels",
  },
  {
    href: "/manufacturing/shipments",
    icon: Truck,
    label: "Shipments",
    desc: "Outbound shipment tracking",
  },
] as const;

// ─── StatusRow ────────────────────────────────────────────────────────────────

function StatusRow({ status, count }: { status: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)]/60 py-2.5 last:border-0">
      <StatusBadge tone={statusTone(status)}>{fmtStatus(status)}</StatusBadge>
      <span
        className="text-sm font-semibold text-[color:var(--foreground)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {count}
      </span>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-52" />
        <SkeletonBlock className="h-52" />
      </div>
      <SkeletonBlock className="h-56" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManufacturingDashboard() {
  const { status, user } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<LabDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const d = await api.get<LabDashboard>("/api/lab/dashboard");
      setData(d);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load the lab dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !user) {
      router.replace("/login");
      return;
    }
    void load();
  }, [status, user, router, load]);

  // ── Derived quick-stat values ──────────────────────────────────────────

  const activeJobs = data
    ? sumStatusCounts(data.printJobsByStatus, "queued", "printing", "nesting", "cleaning", "curing")
    : 0;

  const batchesInProd = data
    ? sumStatusCounts(data.batchesByStatus, "staging", "printing", "post_processing", "qc")
    : 0;

  const printersOnline = data
    ? sumStatusCounts(data.printersByStatus, "idle", "printing")
    : 0;

  const qaPending = data
    ? sumStatusCounts(data.qaInspectionsByStatus, "pending", "in_progress")
    : 0;

  // Throughput bar scaling
  const maxCompleted = Math.max(
    ...(data?.dailyMetrics?.map((d) => d.jobsCompleted) ?? [0]),
    1,
  );

  const isLoadingView = loading || status === "loading";

  return (
    <main
      id="main-content"
      className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 animate-page-enter"
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--clinical-highlight)]">
            <Printer size={18} className="text-white" aria-hidden />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">
              Manufacturing
            </p>
            <h1 className="text-xl font-bold tracking-tight text-[color:var(--foreground)]">
              Digital Lab
            </h1>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Manufacturing Command Center
            </p>
          </div>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={refreshing || isLoadingView}
          aria-label="Refresh dashboard"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-sm font-medium text-[color:var(--muted-foreground)] transition hover:border-[color:var(--primary)]/40 hover:bg-[color:var(--primary-glow)] hover:text-[color:var(--foreground)] disabled:pointer-events-none disabled:opacity-50 focus-ring"
        >
          <RefreshCw
            size={14}
            aria-hidden
            className={refreshing ? "animate-spin text-[color:var(--primary)]" : ""}
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
        >
          <AlertCircle size={16} aria-hidden className="shrink-0" />
          <p className="flex-1">{error}</p>
          <button
            onClick={() => void load()}
            className="shrink-0 rounded-md px-3 py-1 text-xs font-semibold underline underline-offset-2 hover:no-underline focus-ring"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────── */}
      {isLoadingView ? (
        <DashboardSkeleton />
      ) : !data ? (
        !error && (
          <EmptyState
            icon={Activity}
            title="No data available"
            message="The lab dashboard could not be loaded."
            action={
              <button
                onClick={() => void load()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] transition hover:bg-[color:var(--primary-hover)] focus-ring"
              >
                <RefreshCw size={14} aria-hidden />
                Try again
              </button>
            }
          />
        )
      ) : (
        <div className="space-y-6">
          {/* ── Quick stats ─────────────────────────────────────────── */}
          <section aria-label="Quick statistics">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="animate-stagger-1">
                <MetricCard
                  label="Active Print Jobs"
                  value={String(activeJobs)}
                  helper="Queued + printing"
                  icon={Activity}
                  tone="primary"
                />
              </div>
              <div className="animate-stagger-2">
                <MetricCard
                  label="Batches in Production"
                  value={String(batchesInProd)}
                  helper="Staging + printing"
                  icon={Layers}
                  tone="primary"
                />
              </div>
              <div className="animate-stagger-3">
                <MetricCard
                  label="Printers Online"
                  value={String(printersOnline)}
                  helper="Idle + printing"
                  icon={Printer}
                  tone="success"
                />
              </div>
              <div className="animate-stagger-4">
                <MetricCard
                  label="Failed Today"
                  value={String(data.failedJobsToday)}
                  helper="Print jobs failed"
                  icon={XCircle}
                  tone="danger"
                />
              </div>
              <div className="animate-stagger-5">
                <MetricCard
                  label="QA Pending"
                  value={String(qaPending)}
                  helper="Awaiting inspection"
                  icon={ClipboardCheck}
                  tone="warning"
                />
              </div>
              <div className="animate-stagger-6">
                <MetricCard
                  label="Inventory Alerts"
                  value={String(data.inventoryAlerts)}
                  helper="Low stock items"
                  icon={AlertTriangle}
                  tone="warning"
                />
              </div>
            </div>
          </section>

          {/* ── Status breakdowns ───────────────────────────────────── */}
          <section aria-label="Status breakdowns">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Print Jobs */}
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity
                      size={15}
                      aria-hidden
                      className="text-[color:var(--primary)]"
                    />
                    <h2 className="text-sm font-semibold text-[color:var(--foreground)]">
                      Print Jobs by Status
                    </h2>
                  </div>
                  <span
                    className="text-xs text-[color:var(--muted-foreground)]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {sumCounts(data.printJobsByStatus)} total
                  </span>
                </div>
                {data.printJobsByStatus.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="No print jobs"
                    message="No jobs have been recorded yet."
                  />
                ) : (
                  <div>
                    {data.printJobsByStatus.map(({ status, count }) => (
                      <StatusRow key={status} status={status} count={count} />
                    ))}
                  </div>
                )}
              </Card>

              {/* Batches */}
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers
                      size={15}
                      aria-hidden
                      className="text-[color:var(--primary)]"
                    />
                    <h2 className="text-sm font-semibold text-[color:var(--foreground)]">
                      Batches by Status
                    </h2>
                  </div>
                  <span
                    className="text-xs text-[color:var(--muted-foreground)]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {sumCounts(data.batchesByStatus)} total
                  </span>
                </div>
                {data.batchesByStatus.length === 0 ? (
                  <EmptyState
                    icon={Layers}
                    title="No batches"
                    message="No batches have been recorded yet."
                  />
                ) : (
                  <div>
                    {data.batchesByStatus.map(({ status, count }) => (
                      <StatusRow key={status} status={status} count={count} />
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </section>

          {/* ── Daily throughput ────────────────────────────────────── */}
          <section aria-label="Daily throughput">
            <Card className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3
                  size={15}
                  aria-hidden
                  className="text-[color:var(--primary)]"
                />
                <h2 className="text-sm font-semibold text-[color:var(--foreground)]">
                  7-Day Throughput
                </h2>
                <span className="ml-auto text-[10px] text-[color:var(--muted-foreground)]">
                  completed / created
                </span>
              </div>

              {!data.dailyMetrics || data.dailyMetrics.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No throughput data"
                  message="Daily metrics will appear once jobs have been processed."
                />
              ) : (
                <div className="space-y-3">
                  {data.dailyMetrics.map((row) => {
                    const barPct = Math.round(
                      (row.jobsCompleted / maxCompleted) * 100,
                    );
                    return (
                      <div key={row.day} className="flex items-center gap-3">
                        {/* Day label */}
                        <span
                          className="w-[4.5rem] shrink-0 text-[11px] font-medium text-[color:var(--muted-foreground)]"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {row.day}
                        </span>
                        {/* Proportional bar */}
                        <div className="flex flex-1 items-center gap-2">
                          <div
                            className="relative h-2 flex-1 overflow-hidden rounded-full"
                            style={{
                              background:
                                "color-mix(in srgb, var(--border) 80%, transparent)",
                            }}
                            role="presentation"
                          >
                            <div
                              className="absolute left-0 top-0 h-full rounded-full bg-[color:var(--primary)] transition-all duration-500 motion-reduce:transition-none"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          {/* Completed count */}
                          <span
                            className="w-7 shrink-0 text-right text-xs font-semibold text-[color:var(--foreground)]"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {row.jobsCompleted}
                          </span>
                        </div>
                        {/* Created count */}
                        <span
                          className="w-16 shrink-0 text-right text-[10px] text-[color:var(--muted-foreground)]"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {row.jobsCreated} created
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>

          {/* ── Quick navigation ────────────────────────────────────── */}
          <section aria-label="Lab modules">
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
              Lab Modules
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {LAB_NAV.map(({ href, icon: Icon, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="interactive-card group flex items-center gap-3 px-4 py-3 focus-ring"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--primary-glow)] transition-colors group-hover:bg-[color:var(--primary)]/20">
                    <Icon
                      size={16}
                      aria-hidden
                      className="text-[color:var(--primary)]"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {label}
                    </p>
                    <p className="truncate text-[11px] leading-tight text-[color:var(--muted-foreground)]">
                      {desc}
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className="shrink-0 text-[color:var(--muted-foreground)] transition-transform duration-150 group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
