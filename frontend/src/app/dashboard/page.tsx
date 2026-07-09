"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import {
  AlertTriangle,
  Box,
  Brain,
  ChevronRight,
  Clock,
  Download,
  FolderKanban,
  Package,
  Plus,
  ScanLine,
  Settings,
  Target,
  TrendingUp,
  Users,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/DesignSystem";
import { LoadingSkeleton, ErrorState, EmptyState, SectionCard } from "@/components/ui";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";
import { api } from "@/lib/api/client";
import NewCaseModal from "@/components/NewCaseModal";

// ─── Analytics types ──────────────────────────────────────────────────────────

interface PracticeAnalyticsSummary {
  totalCases: number;
  activeCases: number;
  pendingReview: number;
  completedThisMonth: number;
  manufacturingQueue: number;
  archivedCases: number;
  draftCases: number;
}

// ─── Workflow pipeline ────────────────────────────────────────────────────────

type PipelineStep = {
  n: number;
  label: string;
  sub: string;
  icon: LucideIcon;
  href: string;
  color: string;
};

const PIPELINE: PipelineStep[] = [
  { n: 1, label: "Scan",           sub: "STL / OBJ / PLY import",        icon: ScanLine, href: "/studio",         color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  { n: 2, label: "AI Segment",     sub: "Tooth detection & labelling",    icon: Target,   href: "/studio",         color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { n: 3, label: "CAD Design",     sub: "Aligner & attachment design",    icon: Box,      href: "/studio",         color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  { n: 4, label: "Treatment Plan", sub: "Movement sequencing & IPR",      icon: Wand2,    href: "/treatment-plan", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  { n: 5, label: "Export & Print",  sub: "STL, 3MF, OBJ for any printer", icon: Download, href: "/export",         color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { n: 6, label: "Delivery",       sub: "Ship to clinic",                 icon: Package,  href: "/export",         color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
];

// ─── Quick-access shortcuts ───────────────────────────────────────────────────

type Shortcut = { label: string; sub: string; icon: LucideIcon; href: string };

const SHORTCUTS: Shortcut[] = [
  { label: "Cases",              sub: "All patient cases",            icon: FolderKanban, href: "/cases"    },
  { label: "Patients",           sub: "Patient records",              icon: Users,        href: "/patients" },
  { label: "CAD Design Studio",  sub: "3D aligner & CAD workspace",   icon: Box,          href: "/studio"   },
  { label: "AI Copilot",         sub: "Treatment proposal & review",  icon: Brain,        href: "/studio"   },
  { label: "Export & Downloads", sub: "Printer-ready file exports",   icon: Download,     href: "/export"   },
  { label: "Settings",           sub: "Preferences & admin",          icon: Settings,     href: "/settings" },
];

// ─── Case status helpers ──────────────────────────────────────────────────────

function caseStatusBadge(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    draft:            { label: "Draft",            cls: "bg-slate-500/10 text-slate-500" },
    scan_review:      { label: "Scan Review",      cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
    segmentation:     { label: "Segmentation",     cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
    planning:         { label: "Planning",         cls: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
    clinical_review:  { label: "Clinical Review",  cls: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
    approved:         { label: "Approved",         cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    active_treatment: { label: "Active",           cls: "bg-[color:var(--primary-glow)] text-[color:var(--primary)]" },
    monitoring:       { label: "Monitoring",       cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    retention:        { label: "Retention",        cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    completed:        { label: "Completed",        cls: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
    archived:         { label: "Archived",         cls: "bg-slate-500/10 text-slate-400" },
    cancelled:        { label: "Cancelled",        cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  };
  return map[status] ?? { label: status, cls: "bg-slate-500/10 text-slate-500" };
}

// ─── Sparkline chart ──────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 200;
  const H = 44;
  const step = W / (values.length - 1);
  const py = (v: number) => H - ((v - min) / range) * (H * 0.78) - H * 0.11;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${py(v).toFixed(1)}`);
  const linePath = `M${pts.join(" L")}`;
  const lastX = ((values.length - 1) * step).toFixed(1);
  const lastY = py(values[values.length - 1]).toFixed(1);
  const areaPath = `M0,${H} L${linePath.slice(1)} L${lastX},${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 44 }}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-fill)" />
      <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill="var(--primary)" />
    </svg>
  );
}

// ─── Dashboard stat computation ───────────────────────────────────────────────

const ACTIVE_STATUSES = new Set([
  "scan_review", "segmentation", "planning", "clinical_review",
  "approved", "active_treatment", "monitoring",
]);
const REVIEW_STATUSES = new Set(["clinical_review", "scan_review"]);
const COMPLETED_STATUSES = new Set(["completed"]);

function computeMonthlyTrend(allCases: CaseListItem[]): { values: number[]; labels: string[] } {
  const now = new Date();
  const buckets: number[] = Array(12).fill(0);
  const labels: string[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString("en-US", { month: "short" }));
  }

  allCases.forEach((c) => {
    const created = new Date(c.createdAt);
    const diffMonths = (now.getFullYear() - created.getFullYear()) * 12 + now.getMonth() - created.getMonth();
    if (diffMonths >= 0 && diffMonths < 12) {
      buckets[11 - diffMonths]++;
    }
  });

  return { values: buckets, labels };
}

// Cases in clinical_review are "critical"; scan_review / planning are "urgent".
function toAttentionCase(c: CaseListItem): {
  id: string; patient: string; initials: string; accent: string;
  status: string; urgency: "critical" | "urgent"; age: string;
} {
  const patientName = `${c.patient.firstName} ${c.patient.lastName}`;
  const initials = [(c.patient.firstName?.[0] ?? ''), (c.patient.lastName?.[0] ?? '')].join("").toUpperCase();
  const urgency: "critical" | "urgent" = c.status === "clinical_review" ? "critical" : "urgent";
  const accent = urgency === "critical" ? "bg-rose-500" : c.status === "scan_review" ? "bg-sky-500" : "bg-amber-500";
  const { label: statusLabel } = caseStatusBadge(c.status);
  const updatedMs = Date.now() - new Date(c.updatedAt).getTime();
  const hours = Math.floor(updatedMs / 3_600_000);
  const days = Math.floor(updatedMs / 86_400_000);
  const age = days >= 1 ? `${days}d` : `${hours}h`;
  return { id: c.id, patient: patientName, initials, accent, status: statusLabel, urgency, age };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipelineCard({ step }: { step: PipelineStep }) {
  const Icon = step.icon;
  return (
    <Link
      href={step.href}
      className="ios-card group flex min-w-[148px] flex-col gap-3 p-4 transition-transform active:scale-[0.97]"
    >
      <div className="flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-2xl ${step.color}`}>
          <Icon size={17} />
        </span>
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--border)] text-[9px] font-bold text-[color:var(--muted-foreground)]">
          {step.n}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{step.label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[color:var(--muted-foreground)]">{step.sub}</p>
      </div>
    </Link>
  );
}

function ShortcutCard({ s }: { s: Shortcut }) {
  const Icon = s.icon;
  return (
    <Link
      href={s.href}
      className="ios-card flex items-center gap-3 p-4 transition-transform active:scale-[0.97]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{s.label}</p>
        <p className="mt-0.5 truncate text-[11px] text-[color:var(--muted-foreground)]">{s.sub}</p>
      </div>
    </Link>
  );
}

function CaseRow({ c }: { c: CaseListItem }) {
  const { label, cls } = caseStatusBadge(c.status);
  const patientName = `${c.patient.firstName} ${c.patient.lastName}`;
  const initials = [(c.patient.firstName?.[0] ?? ''), (c.patient.lastName?.[0] ?? '')].join("").toUpperCase();
  const date = new Date(c.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Link
      href={`/cases?id=${c.id}`}
      className="ios-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-sm font-bold text-[color:var(--primary)]">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{patientName}</p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--muted-foreground)]">
          {c.chiefComplaint ?? "No chief complaint"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
        <div className="flex items-center gap-0.5 text-[11px] text-[color:var(--muted-foreground)]">
          <Clock size={10} />
          {date}
        </div>
        <ChevronRight size={14} className="text-[color:var(--muted-foreground)]" />
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [allCases, setAllCases] = useState<CaseListItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<PracticeAnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const loadCases = useCallback(() => {
    setCasesError(null);
    Promise.all([
      fetchCases(),
      api.get<PracticeAnalyticsSummary>('/api/cases/analytics/summary').catch(() => null),
    ])
      .then(([{ cases: cs }, analyticsData]) => {
        setAllCases(cs);
        setAnalytics(analyticsData);
        setCasesLoading(false);
        setAnalyticsLoading(false);
      })
      .catch((err: unknown) => {
        setCasesError(err instanceof Error ? err.message : 'Failed to load cases. Please try again.');
        setCasesLoading(false);
        setAnalyticsLoading(false);
      });
  }, []);

  useEffect(() => { loadCases(); }, [loadCases]);

  // ── Derived stats from real case data ───────────────────────────────────────
  const activeCases = useMemo(() => allCases.filter((c) => ACTIVE_STATUSES.has(c.status)), [allCases]);
  const reviewCases = useMemo(() => allCases.filter((c) => REVIEW_STATUSES.has(c.status)), [allCases]);
  const completedThisMonth = useMemo(() => {
    const now = new Date();
    return allCases.filter((c) => {
      if (!COMPLETED_STATUSES.has(c.status)) return false;
      const u = new Date(c.updatedAt);
      return u.getFullYear() === now.getFullYear() && u.getMonth() === now.getMonth();
    }).length;
  }, [allCases]);

  // Cases older than 2 days in review status = SLA at risk
  const slaAtRisk = useMemo(() => reviewCases.filter((c) => {
    const ageDays = (Date.now() - new Date(c.updatedAt).getTime()) / 86_400_000;
    return ageDays >= 2;
  }).length, [reviewCases]);

  const attentionCases = useMemo(() =>
    reviewCases.slice(0, 3).map(toAttentionCase),
  [reviewCases]);

  const { values: monthlyValues, labels: monthLabels } = useMemo(
    () => computeMonthlyTrend(allCases),
    [allCases],
  );

  const recentCases = useMemo(() => allCases.slice(0, 6), [allCases]);

  const trendChange = monthlyValues[monthlyValues.length - 1] - monthlyValues[monthlyValues.length - 2];
  const trendPct = Math.round((trendChange / (monthlyValues[monthlyValues.length - 2] || 1)) * 100);

  // Prefer analytics data (single DB query, more accurate) when available;
  // fall back to derived values from the cases list.
  const kpiActiveCases   = analytics?.activeCases        ?? activeCases.length;
  const kpiNeedsReview   = analytics?.pendingReview       ?? reviewCases.length;
  const kpiCompleted     = analytics?.completedThisMonth  ?? completedThisMonth;

  const kpis = [
    { label: "Active Cases",   value: String(kpiActiveCases),  sub: `${kpiNeedsReview} pending review`, cls: "text-[color:var(--primary)]",  bg: "bg-[color:var(--primary-glow)]" },
    { label: "Needs Review",   value: String(kpiNeedsReview),  sub: "Clinical or scan review",          cls: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    { label: "SLA at Risk",    value: String(slaAtRisk),       sub: slaAtRisk > 0 ? "Action required" : "All on time", cls: slaAtRisk > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400", bg: slaAtRisk > 0 ? "bg-rose-500/10" : "bg-emerald-500/10" },
    { label: "Completed",      value: String(kpiCompleted),    sub: "This month",                       cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  ];

  return (
    <>
      <section className="animate-page-enter mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+2rem)] pt-5 sm:px-5">

        {/* ── Hero ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark variant="icon-only" size="md" className="shrink-0" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                MyOrtho.tech
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">
                Overview
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] transition-transform active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} />
            New Case
          </button>
        </div>

        {/* ── Cases load error ── */}
        {casesError && (
          <SectionCard>
            <ErrorState
              title="Failed to load cases"
              message={casesError}
              onRetry={loadCases}
            />
          </SectionCard>
        )}

        {/* ── Dashboard KPI row ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {casesLoading
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="ios-card h-[88px] animate-pulse" />
              ))
            : kpis.map((stat) => (
                <Card key={stat.label} className="flex flex-col gap-1.5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted-foreground)]">
                    {stat.label}
                  </p>
                  <p className={`text-3xl font-bold tabular-nums tracking-tight ${stat.cls}`}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">{stat.sub}</p>
                </Card>
              ))
          }
        </div>

        {/* ── Needs Attention ── */}
        {(casesLoading || attentionCases.length > 0) && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                Needs Your Attention
              </p>
              <Link
                href="/cases?filter=review"
                className="text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2"
              >
                View all →
              </Link>
            </div>
            <div className="space-y-2">
              {casesLoading
                ? <LoadingSkeleton type="card" rows={3} />
                : attentionCases.map((ac) => (
                    <Link
                      key={ac.id}
                      href={`/cases?id=${ac.id}`}
                      className="ios-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
                    >
                      <div className="relative shrink-0">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${ac.accent}`}>
                          {ac.initials}
                        </span>
                        {ac.urgency === "critical" && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-[color:var(--background)] bg-rose-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">{ac.patient}</p>
                        <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{ac.status}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {ac.urgency === "critical" ? (
                          <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            <AlertTriangle size={9} /> Critical
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Urgent
                          </span>
                        )}
                        <span className="text-[11px] text-[color:var(--muted-foreground)]">{ac.age}</span>
                        <ChevronRight size={13} className="text-[color:var(--muted-foreground)]" />
                      </div>
                    </Link>
                  ))
              }
            </div>
          </div>
        )}

        {/* ── Manufacturing Queue ── */}
        {!analyticsLoading && analytics && analytics.manufacturingQueue > 0 && (
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
              Manufacturing Queue
            </p>
            <Link
              href="/cases?filter=manufacturing"
              className="ios-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Package size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {analytics.manufacturingQueue} case{analytics.manufacturingQueue !== 1 ? "s" : ""} ready for manufacturing
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">Ready to export and print</p>
              </div>
              <ChevronRight size={14} className="text-[color:var(--muted-foreground)]" />
            </Link>
          </div>
        )}

        {/* ── Pending Approval ── */}
        {(() => {
          const approvalCases = casesLoading
            ? []
            : allCases.filter((c) => c.status === "planning" || c.status === "approved");
          if (casesLoading || approvalCases.length === 0) return null;
          const topApproval = approvalCases.slice(0, 3);
          return (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                  Pending Approval
                </p>
                <Link
                  href="/cases?filter=planning"
                  className="text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2"
                >
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {topApproval.map((c) => {
                  const { label, cls } = caseStatusBadge(c.status);
                  const patientName = `${c.patient.firstName} ${c.patient.lastName}`;
                  const initials = [(c.patient.firstName?.[0] ?? ""), (c.patient.lastName?.[0] ?? "")].join("").toUpperCase();
                  return (
                    <div key={c.id} className="ios-card flex items-center gap-3 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-xs font-bold text-[color:var(--primary)]">
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{patientName}</p>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                          {label}
                        </span>
                      </div>
                      <Link
                        href={`/cases?id=${c.id}`}
                        className="shrink-0 rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
                      >
                        Review
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── AI Planning Intelligence ── */}
        {!casesLoading && allCases.length > 0 && (() => {
          const planningCases = allCases.filter((c) =>
            ["planning", "clinical_review", "approved"].includes(c.status)
          );
          const segCases = allCases.filter((c) =>
            ["scan_review", "segmentation"].includes(c.status)
          );
          const readyToExport = allCases.filter((c) => c.status === "approved").length;
          const activeRx = allCases.filter((c) => c.status === "active_treatment").length;
          return (
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                AI Intelligence Summary
              </p>
              <SectionCard
                title="Planning Queue"
                description={`${planningCases.length} case${planningCases.length !== 1 ? "s" : ""} across active planning stages`}
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    {
                      label: "In Planning",
                      value: planningCases.length,
                      color: "text-violet-600 dark:text-violet-400",
                      bg: "bg-violet-500/10",
                    },
                    {
                      label: "Segmentation",
                      value: segCases.length,
                      color: "text-sky-600 dark:text-sky-400",
                      bg: "bg-sky-500/10",
                    },
                    {
                      label: "Ready to Export",
                      value: readyToExport,
                      color: "text-teal-600 dark:text-teal-400",
                      bg: "bg-teal-500/10",
                    },
                    {
                      label: "Active Rx",
                      value: activeRx,
                      color: "text-emerald-600 dark:text-emerald-400",
                      bg: "bg-emerald-500/10",
                    },
                  ].map((m) => (
                    <div key={m.label} className={`rounded-xl p-3 ${m.bg}`}>
                      <p className={`text-xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-[color:var(--muted-foreground)]">
                        {m.label}
                      </p>
                    </div>
                  ))}
                </div>
                {planningCases.length > 0 && (
                  <Link
                    href="/cases?filter=planning"
                    className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2"
                  >
                    Open AI studio for planning cases
                    <ChevronRight size={12} />
                  </Link>
                )}
              </SectionCard>
            </div>
          );
        })()}

        {/* ── Clinical Workflow Pipeline ── */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            Clinical Workflow
          </p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {PIPELINE.map((step) => (
              <PipelineCard key={step.n} step={step} />
            ))}
          </div>
        </div>

        {/* ── Quick Access ── */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            Quick Access
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SHORTCUTS.map((s) => (
              <ShortcutCard key={s.label} s={s} />
            ))}
          </div>
        </div>

        {/* ── Recent Cases ── */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
              Recent Cases
            </p>
            <Link
              href="/cases"
              className="text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2"
            >
              View all →
            </Link>
          </div>

          {casesLoading ? (
            <LoadingSkeleton type="card" rows={3} />
          ) : recentCases.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FolderKanban size={22} />}
                title="No cases yet"
                description="Create your first patient case to get started with the clinical workflow."
                action={
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    Create First Case
                  </button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {recentCases.map((c) => (
                <CaseRow key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>

        {/* ── Practice Trends ── */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            Practice Trends
          </p>
          <SectionCard
            title="Monthly Case Volume"
            description={`Cases opened in ${monthLabels[monthLabels.length - 1]}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums tracking-tight text-[color:var(--foreground)]">
                  {casesLoading ? "—" : monthlyValues[monthlyValues.length - 1]}
                </span>
                {!casesLoading && (
                  <span className={[
                    "flex items-center gap-0.5 text-xs font-semibold",
                    trendChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                  ].join(" ")}>
                    <TrendingUp size={12} />
                    {trendChange >= 0 ? "+" : ""}{trendPct}% vs last month
                  </span>
                )}
              </div>
              <Zap size={20} className="mt-0.5 shrink-0 text-[color:var(--primary)] opacity-60" />
            </div>

            <div className="mt-4">
              {casesLoading
                ? <LoadingSkeleton type="text" rows={1} className="h-11" />
                : <Sparkline values={monthlyValues} />
              }
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex gap-3 overflow-x-auto no-scrollbar">
                {monthLabels.slice(-6).map((m, i) => (
                  <span key={m} className={[
                    "shrink-0 text-[10px] tabular-nums",
                    i === 5 ? "font-semibold text-[color:var(--primary)]" : "text-[color:var(--muted-foreground)]",
                  ].join(" ")}>
                    {m}
                  </span>
                ))}
              </div>
              <Link
                href="/analytics"
                className="shrink-0 text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2"
              >
                Full analytics →
              </Link>
            </div>
          </SectionCard>
        </div>

      </section>

      {/* New Case modal */}
      {modalOpen && (
        <NewCaseModal
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            loadCases();
          }}
        />
      )}
    </>
  );
}
