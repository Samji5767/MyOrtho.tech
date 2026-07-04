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
import { Card } from "@/components/DesignSystem";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Metric {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
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

function buildMetrics(cases: CaseListItem[]): Metric[] {
  const total = cases.length;
  const active = cases.filter((c) => ACTIVE_STATUSES.has(c.status)).length;
  const completed = cases.filter((c) => c.status === "completed").length;
  const approved = cases.filter((c) => c.status === "approved").length;
  const retention = cases.filter((c) => c.status === "retention").length;
  const uniquePatients = new Set(cases.map((c) => c.patient?.id).filter(Boolean)).size;

  return [
    { label: "Total Cases",       value: total,      icon: FolderKanban, color: "text-indigo-600",  sub: "all time" },
    { label: "Active Cases",      value: active,     icon: Activity,     color: "text-emerald-600", sub: "in progress" },
    { label: "Completed",         value: completed,  icon: CheckCircle2, color: "text-teal-600",    sub: "treatment done" },
    { label: "Awaiting Approval", value: approved,   icon: Clock,        color: "text-amber-600",   sub: "pending sign-off" },
    { label: "In Retention",      value: retention,  icon: TrendingUp,   color: "text-blue-600",    sub: "retention phase" },
    { label: "Unique Patients",   value: uniquePatients, icon: Users,    color: "text-violet-600",  sub: "distinct patients" },
  ];
}

// ─── Status distribution ──────────────────────────────────────────────────────

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"api" | "demo">("demo");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchCases();
      setCases(result.cases);
      setSource(result.source);
    } catch {
      // fetchCases handles network errors internally; this is a final guard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = buildMetrics(cases);

  // Build status distribution
  const statusCounts = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusEntries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...statusEntries.map(([, n]) => n), 1);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+2rem)] pt-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
            <p className="text-xs text-secondary">Practice performance overview</p>
          </div>
        </div>
        {source === "demo" && !loading && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Demo data
          </span>
        )}
      </div>

      {/* Metrics grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metrics.map((m) => (
            <Card key={m.label} className="flex flex-col gap-1.5 p-4">
              <div className="flex items-center justify-between">
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
              <div>
                <p className="text-xs font-semibold text-foreground">{m.label}</p>
                {m.sub && <p className="text-[10px] text-secondary">{m.sub}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Status distribution */}
      {!loading && statusEntries.length > 0 && (
        <Card className="mt-6 p-4">
          <div className="mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-secondary" />
            <h2 className="text-sm font-semibold text-foreground">Cases by Status</h2>
          </div>
          <div className="space-y-2.5">
            {statusEntries.map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-[11px] text-secondary truncate">
                  {STATUS_LABELS[status] ?? status}
                </span>
                <div className="flex-1 overflow-hidden rounded-full bg-border/40">
                  <div
                    className={`h-2 rounded-full transition-all ${STATUS_COLOR[status] ?? "bg-slate-400"}`}
                    style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-[11px] font-semibold text-foreground">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Link to cases */}
      {!loading && (
        <div className="mt-6 text-center">
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View all cases <FolderKanban className="h-4 w-4" />
          </Link>
        </div>
      )}
    </main>
  );
}
