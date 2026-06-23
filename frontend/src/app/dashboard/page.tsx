"use client";

import { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Factory,
  Info,
  Package,
  Plus,
  Printer,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  Button,
  Card,
  MetricCard,
  ProgressBar,
  StatusBadge,
} from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "orthodontist" | "director" | "lab" | "manufacturing" | "executive";
type Urgency = "routine" | "urgent" | "critical";
type AlertTone = "warning" | "danger" | "info";

interface Kpi {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
}

interface QueueItem {
  id: string;
  primary: string;
  secondary: string;
  age: string;
  urgency: Urgency;
}

interface BarStat {
  label: string;
  count: number;
  total: number;
  tone: "primary" | "success" | "warning" | "danger";
}

interface AlertItem {
  text: string;
  tone: AlertTone;
}

interface RoleData {
  kpis: Kpi[];
  queueTitle: string;
  queue: QueueItem[];
  barsTitle?: string;
  bars?: BarStat[];
  alerts?: AlertItem[];
}

// ─── Representative preview data ─────────────────────────────────────────────
// Shown only when "Preview mode" is enabled. Never presented as live backend data.

const PREVIEW: Record<Role, RoleData> = {
  orthodontist: {
    kpis: [
      { label: "Active Cases", value: "47", helper: "Across 3 providers", icon: Users, tone: "primary" },
      { label: "Awaiting Approval", value: "8", helper: "3 urgent", icon: AlertCircle, tone: "warning" },
      { label: "In Manufacturing", value: "12", helper: "Avg 4.2 days left", icon: Factory, tone: "info" },
      { label: "Completed (MTD)", value: "23", helper: "+18% vs last month", icon: CheckCircle2, tone: "success" },
    ],
    queueTitle: "Approval Queue",
    queue: [
      { id: "C-2847", primary: "Sarah M. — Aligner Stage 14 Approval", secondary: "Dr. Chen · Treatment Plan review", age: "2d", urgency: "urgent" },
      { id: "C-2901", primary: "James R. — IPR Pre-Authorization", secondary: "Dr. Lee · Upper arch IPR 0.3 mm", age: "1d", urgency: "routine" },
      { id: "C-2859", primary: "Emma K. — Refinement Order", secondary: "Dr. Chen · 8 new upper aligners", age: "3d", urgency: "urgent" },
      { id: "C-2883", primary: "Oliver T. — Attachment Revision", secondary: "Dr. Park · Canine reposition protocol", age: "4h", urgency: "critical" },
      { id: "C-2912", primary: "Ava N. — Final Retention Phase", secondary: "Dr. Lee · Hawley + Vivera retainer", age: "5d", urgency: "routine" },
    ],
    barsTitle: "Case Pipeline",
    bars: [
      { label: "Consultation", count: 9, total: 47, tone: "primary" },
      { label: "Scan & Segment", count: 6, total: 47, tone: "primary" },
      { label: "Treatment Plan", count: 11, total: 47, tone: "primary" },
      { label: "Manufacturing", count: 12, total: 47, tone: "warning" },
      { label: "Delivery", count: 5, total: 47, tone: "success" },
      { label: "Retention", count: 4, total: 47, tone: "success" },
    ],
    alerts: [
      { text: "C-2783: SLA expires in 18 h — scan re-upload required before planning can proceed", tone: "danger" },
      { text: "C-2841: Scan resolution 0.08 mm (below 0.10 mm protocol) — review before planning", tone: "warning" },
    ],
  },
  director: {
    kpis: [
      { label: "Reviews Today", value: "14", helper: "Avg 11 min per review", icon: ShieldCheck, tone: "primary" },
      { label: "Pending Protocol", value: "5", helper: "2 escalated", icon: AlertCircle, tone: "warning" },
      { label: "Staff Utilization", value: "87%", helper: "Across 6 providers", icon: Users, tone: "success" },
      { label: "Protocol Compliance", value: "98.2%", helper: "Last 30 days", icon: CheckCircle2, tone: "success" },
    ],
    queueTitle: "Staff Submissions",
    queue: [
      { id: "C-2851", primary: "Dr. Park: Full-arch correction plan", secondary: "Class II Div1 · 7 attachments proposed", age: "2h", urgency: "routine" },
      { id: "C-2876", primary: "Dr. Chen: Surgical orthodontics handoff", secondary: "Oral Surgeon: Dr. Williams – pre-surgical records", age: "1d", urgency: "urgent" },
      { id: "C-2841", primary: "Dr. Lee: Low-resolution scan escalation", secondary: "Scan 0.08 mm — below 0.10 mm clinical threshold", age: "3h", urgency: "critical" },
      { id: "C-2900", primary: "Dr. Torres: Retention protocol deviation", secondary: "Extended retention from 12 → 24 months requested", age: "2d", urgency: "routine" },
    ],
    barsTitle: "Monthly Reviews by Provider",
    bars: [
      { label: "Dr. Chen", count: 24, total: 30, tone: "success" },
      { label: "Dr. Lee", count: 18, total: 30, tone: "primary" },
      { label: "Dr. Park", count: 21, total: 30, tone: "primary" },
      { label: "Dr. Torres", count: 29, total: 30, tone: "success" },
      { label: "Dr. Nguyen", count: 11, total: 30, tone: "warning" },
    ],
    alerts: [
      { text: "C-2841: Scan below resolution protocol — escalated from Dr. Lee for director review", tone: "danger" },
      { text: "Protocol update: IPR pre-authorization form v3.1 effective next Monday — notify all providers", tone: "info" },
    ],
  },
  lab: {
    kpis: [
      { label: "Print Jobs Today", value: "31", helper: "Across 4 printers", icon: Printer, tone: "primary" },
      { label: "Avg Print Time", value: "4.7 h", helper: "−0.3 h vs last week", icon: Clock, tone: "info" },
      { label: "QC Pass Rate", value: "96.8%", helper: "2 reprints today", icon: CheckCircle2, tone: "success" },
      { label: "Shipped Today", value: "18", helper: "All on-time", icon: Package, tone: "success" },
    ],
    queueTitle: "Active Print Queue",
    queue: [
      { id: "J-0441", primary: "Upper Arch · 14 aligners · C-2901", secondary: "Printer 2 · BioMed Clear · 68% complete", age: "4 h left", urgency: "routine" },
      { id: "J-0442", primary: "Lower Arch + Models · C-2847", secondary: "Printer 1 · DentaGuide · Queued — starts 14:30", age: "Queued", urgency: "routine" },
      { id: "J-0443", primary: "Surgical Splint · C-2876", secondary: "Printer 3 · SurgicalGuide Pro · 12% complete", age: "7 h left", urgency: "urgent" },
      { id: "J-0440", primary: "Retention Hawley Base · C-2912", secondary: "Printer 4 · Ortho Model · Awaiting QC sign-off", age: "QC", urgency: "routine" },
    ],
    barsTitle: "Printer Utilization",
    bars: [
      { label: "Printer 1", count: 74, total: 100, tone: "success" },
      { label: "Printer 2", count: 91, total: 100, tone: "warning" },
      { label: "Printer 3", count: 55, total: 100, tone: "primary" },
      { label: "Printer 4", count: 83, total: 100, tone: "success" },
    ],
    alerts: [
      { text: "Printer 2 — BioMed Clear resin at 18% · Order required today to avoid queue disruption", tone: "warning" },
    ],
  },
  manufacturing: {
    kpis: [
      { label: "Jobs Queued", value: "7", helper: "Next batch 14:30", icon: Activity, tone: "primary" },
      { label: "In Progress", value: "8", helper: "4 printers active", icon: Zap, tone: "info" },
      { label: "Completed Today", value: "18", helper: "On-time: 17 / 18", icon: CheckCircle2, tone: "success" },
      { label: "Material Utilization", value: "84%", helper: "Waste: 2.3 kg today", icon: Factory, tone: "primary" },
    ],
    queueTitle: "Active Jobs",
    queue: [
      { id: "J-0441", primary: "BioMed Clear · 14 aligners · 68%", secondary: "Printer 2 · Est. 4 h remaining", age: "~18:00", urgency: "routine" },
      { id: "J-0443", primary: "SurgicalGuide Pro · 1 splint · 12%", secondary: "Printer 3 · Est. 7 h remaining", age: "~21:00", urgency: "urgent" },
      { id: "J-0438", primary: "Ortho Model · 2 arches · 95%", secondary: "Printer 1 · QC in approx. 20 min", age: "~14:00", urgency: "routine" },
      { id: "J-0437", primary: "DentaGuide · 28 aligners · Complete", secondary: "Printer 4 · Awaiting QC sign-off", age: "Done", urgency: "routine" },
    ],
    barsTitle: "Resin Stock Levels",
    bars: [
      { label: "BioMed Clear V2", count: 78, total: 100, tone: "primary" },
      { label: "DentaGuide Aligner", count: 45, total: 100, tone: "success" },
      { label: "SurgicalGuide Pro", count: 8, total: 100, tone: "danger" },
      { label: "Ortho Model White", count: 63, total: 100, tone: "primary" },
    ],
    alerts: [
      { text: "SurgicalGuide Pro at 8% — critical reorder required; surgical jobs at risk by tomorrow", tone: "danger" },
      { text: "Printer 2 maintenance due in 3 cycles — schedule during overnight window", tone: "warning" },
    ],
  },
  executive: {
    kpis: [
      { label: "Active Patients", value: "312", helper: "Across all providers", icon: Users, tone: "primary" },
      { label: "New Cases (MTD)", value: "47", helper: "+22% vs same period", icon: TrendingUp, tone: "success" },
      { label: "Lab Turnaround", value: "5.1 d", helper: "−0.8 d vs last month", icon: Clock, tone: "success" },
      { label: "SLA Compliance", value: "97.3%", helper: "8 cases at risk", icon: ShieldCheck, tone: "success" },
    ],
    queueTitle: "Executive Alerts",
    queue: [
      { id: "OPS-14", primary: "Lab capacity at 91% — Q3 demand increase projected", secondary: "Recommend: +1 printer or overflow lab agreement before Aug 1", age: "Today", urgency: "urgent" },
      { id: "OPS-15", primary: "8 cases past 5-day SLA — manufacturing backlog", secondary: "Dr. Lee's aligner cases primarily affected", age: "2d", urgency: "urgent" },
      { id: "OPS-11", primary: "Monthly volume tracking +22% vs Q3 plan", secondary: "Revenue projection: on track for quarterly target", age: "1d", urgency: "routine" },
      { id: "OPS-10", primary: "Protocol v3.1 update — staff training required", secondary: "Clinical Director flagged 3 providers pending certification", age: "3d", urgency: "routine" },
    ],
    barsTitle: "Case Volume — Monthly Trend",
    bars: [
      { label: "Jan", count: 31, total: 60, tone: "primary" },
      { label: "Feb", count: 28, total: 60, tone: "primary" },
      { label: "Mar", count: 35, total: 60, tone: "primary" },
      { label: "Apr", count: 41, total: 60, tone: "primary" },
      { label: "May", count: 38, total: 60, tone: "primary" },
      { label: "Jun (MTD)", count: 47, total: 60, tone: "success" },
    ],
    alerts: [
      { text: "Lab capacity at 91% — evaluate overflow contract before Q3 peak season", tone: "warning" },
      { text: "8 cases approaching SLA deadline this week — clinical director intervention recommended", tone: "danger" },
    ],
  },
};

// ─── Role configuration ───────────────────────────────────────────────────────

const ROLE_CONFIG: { key: Role; label: string; icon: LucideIcon; description: string }[] = [
  { key: "orthodontist", label: "Orthodontist", icon: Users, description: "Case pipeline, approvals, and clinical queue" },
  { key: "director", label: "Clinical Director", icon: ShieldCheck, description: "Staff submissions, protocol compliance, escalations" },
  { key: "lab", label: "Lab Director", icon: Printer, description: "Print queue, QC pass rate, machine utilization" },
  { key: "manufacturing", label: "Manufacturing", icon: Factory, description: "Active jobs, materials, production throughput" },
  { key: "executive", label: "Executive", icon: BarChart3, description: "KPIs, volume trends, operational health" },
];

const URGENCY_TONE: Record<Urgency, "neutral" | "warning" | "danger"> = {
  routine: "neutral",
  urgent: "warning",
  critical: "danger",
};

const ALERT_ICON: Record<AlertTone, LucideIcon> = {
  warning: AlertTriangle,
  danger: AlertCircle,
  info: Info,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function QueueRow({ item }: { item: QueueItem }) {
  return (
    <Link
      href="/cases"
      className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[color:var(--border)]"
    >
      <span className="mt-0.5 shrink-0 rounded-md bg-[color:var(--primary-glow)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[color:var(--primary)]">
        {item.id}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[color:var(--foreground)]">{item.primary}</p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--muted-foreground)]">{item.secondary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge tone={URGENCY_TONE[item.urgency]}>{item.urgency}</StatusBadge>
        <span className="text-xs tabular-nums text-[color:var(--muted-foreground)]">{item.age}</span>
        <ChevronRight
          size={14}
          className="text-[color:var(--muted-foreground)] transition-colors group-hover:text-[color:var(--foreground)]"
        />
      </div>
    </Link>
  );
}

function AlertBanner({ alert }: { alert: AlertItem }) {
  const Icon = ALERT_ICON[alert.tone];
  const cls: Record<AlertTone, string> = {
    warning: "border-amber-200/60 bg-amber-50/60 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    danger: "border-red-200/60 bg-red-50/60 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
    info: "border-[color:var(--primary)]/20 bg-[color:var(--primary-glow)] text-[color:var(--primary)]",
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${cls[alert.tone]}`}>
      <Icon size={13} className="mt-0.5 shrink-0" />
      <span>{alert.text}</span>
    </div>
  );
}

function StatBars({ bars, title }: { bars: BarStat[]; title: string }) {
  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-36 shrink-0 truncate text-xs font-medium text-[color:var(--foreground)]">
              {b.label}
            </span>
            <div className="flex-1">
              <ProgressBar value={Math.round((b.count / b.total) * 100)} tone={b.tone} />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[color:var(--muted-foreground)]">
              {b.count}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [role, setRole] = useState<Role>("orthodontist");
  const [previewMode, setPreviewMode] = useState(true);

  const data = previewMode ? PREVIEW[role] : null;
  const roleInfo = ROLE_CONFIG.find((r) => r.key === role)!;
  const RoleIcon = roleInfo.icon;

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Command Center
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            {roleInfo.description}
          </p>
        </div>
        <Link href="/cases/new">
          <Button variant="primary" size="sm">
            <Plus size={15} />
            New Case
          </Button>
        </Link>
      </div>

      {/* Preview mode toggle */}
      <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[color:var(--foreground)]">Preview mode</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {previewMode
              ? "Representative data shown — not from a live backend"
              : "Connect Supabase to see live clinic metrics"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewMode((v) => !v)}
          role="switch"
          aria-checked={previewMode}
          className={[
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            previewMode ? "bg-[color:var(--primary)]" : "bg-[color:var(--border)]",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
              previewMode ? "translate-x-5" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>

      {previewMode && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={12} className="shrink-0" />
          Representative preview data · Not connected to live data
        </div>
      )}

      {/* Role selector */}
      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5"
        style={{ scrollbarWidth: "none" } as React.CSSProperties}
      >
        {ROLE_CONFIG.map((r) => {
          const Icon = r.icon;
          const active = role === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setRole(r.key)}
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                  : "bg-[color:var(--border)] text-[color:var(--foreground)] hover:opacity-80",
              ].join(" ")}
            >
              <Icon size={12} aria-hidden />
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {data ? (
        <>
          {/* KPI row */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((kpi) => (
              <MetricCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                helper={kpi.helper}
                icon={kpi.icon}
                tone={kpi.tone}
              />
            ))}
          </div>

          {/* Alerts */}
          {data.alerts && data.alerts.length > 0 && (
            <div className="flex flex-col gap-2">
              {data.alerts.map((a, i) => (
                <AlertBanner key={i} alert={a} />
              ))}
            </div>
          )}

          {/* Queue */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{data.queueTitle}</p>
              <StatusBadge tone="neutral">{data.queue.length} items</StatusBadge>
            </div>
            <div className="divide-y divide-[color:var(--border)]">
              {data.queue.map((item) => (
                <div key={item.id} className="px-2">
                  <QueueRow item={item} />
                </div>
              ))}
            </div>
            <div className="border-t border-[color:var(--border)] px-5 py-3">
              <Link
                href="/cases"
                className="text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2"
              >
                View all cases →
              </Link>
            </div>
          </Card>

          {/* Stats bars */}
          {data.bars && data.barsTitle && (
            <StatBars bars={data.bars} title={data.barsTitle} />
          )}
        </>
      ) : (
        /* Empty state — no backend connected */
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5">
                <div className="mb-3 h-3 w-20 animate-pulse rounded-full bg-[color:var(--border)]" />
                <div className="mb-2 h-7 w-16 animate-pulse rounded-lg bg-[color:var(--border)]" />
                <div className="h-2.5 w-28 animate-pulse rounded-full bg-[color:var(--border)]" />
              </Card>
            ))}
          </div>

          <Card className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
              <RoleIcon size={26} aria-hidden />
            </span>
            <div>
              <p className="text-base font-semibold text-[color:var(--foreground)]">
                {roleInfo.label} dashboard ready
              </p>
              <p className="mt-1 max-w-xs text-sm text-[color:var(--muted-foreground)]">
                Connect your Supabase backend to see live KPIs, queues, and role metrics.
                Enable preview mode to explore the layout with representative data.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
              >
                Enable preview mode
              </button>
              <Link
                href="/settings"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-sm font-semibold text-[color:var(--foreground)] transition-transform active:scale-95"
              >
                Go to settings
              </Link>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
