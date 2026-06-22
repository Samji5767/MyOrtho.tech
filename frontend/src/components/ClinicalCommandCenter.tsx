"use client";

import { useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Factory,
  FileText,
  Layers3,
  Printer,
  RefreshCw,
  ScanLine,
  Sparkles,
  ThumbsUp,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import type { CommandCenterStats, SLARisk } from "@/types/orthodontic";

// ─── Mock data ────────────────────────────────────────────────────────────────

const STATS: CommandCenterStats = {
  activeCases: 0,
  awaitingApproval: 0,
  awaitingSegmentation: 0,
  awaitingCAD: 0,
  inManufacturing: 0,
  slaAtRisk: 0,
  refinementsNeeded: 0,
  completedToday: 0,
};

const SLA_RISKS: SLARisk[] = [];

type PipelineStage = { label: string; count: number; color: string; pct: number };
const PIPELINE: PipelineStage[] = [];

type ApprovalItem = { caseId: string; patient: string; stage: string; waitingSince: string; priority: "urgent" | "high" | "normal"; assignedDoctor: string };
const APPROVAL_QUEUE: ApprovalItem[] = [];

type MfgQueueItem = { batchId: string; patient: string; stages: string; printer: string; status: string; eta: string; slaRisk: boolean };
const MFG_QUEUE: MfgQueueItem[] = [];

type AIInsight = { id: string; title: string; body: string; severity: "info" | "warning" | "critical"; actionLabel?: string };
const AI_INSIGHTS: AIInsight[] = [];

type RecentActivity = { id: string; text: string; time: string; type: "success" | "warning" | "info" | "error" };
const RECENT_ACTIVITY: RecentActivity[] = [];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ElementType;
  tone: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
  trend?: "up" | "down";
}

const TONE_CLASSES: Record<KPICardProps["tone"], { bg: string; icon: string; text: string }> = {
  primary: { bg: "bg-[color:var(--primary-glow)]",  icon: "text-[color:var(--primary)]",   text: "text-[color:var(--primary)]" },
  success: { bg: "bg-emerald-500/10", icon: "text-emerald-600", text: "text-emerald-700 dark:text-emerald-400" },
  warning: { bg: "bg-amber-500/10",   icon: "text-amber-600",   text: "text-amber-700 dark:text-amber-400" },
  danger:  { bg: "bg-rose-500/10",    icon: "text-rose-600",    text: "text-rose-700 dark:text-rose-400" },
  info:    { bg: "bg-sky-500/10",     icon: "text-sky-600",     text: "text-sky-700 dark:text-sky-400" },
  neutral: { bg: "bg-slate-500/10",   icon: "text-slate-500",   text: "text-slate-600 dark:text-slate-400" },
};

function KPICard({ label, value, helper, icon: Icon, tone, trend }: KPICardProps) {
  const t = TONE_CLASSES[tone];
  return (
    <div className="ios-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${t.bg} ${t.icon}`}>
          <Icon size={18} />
        </span>
        {trend && (
          <span className={`text-xs font-semibold ${trend === "up" ? "text-emerald-600" : "text-rose-500"}`}>
            {trend === "up" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-[color:var(--foreground)]">{value}</p>
      <p className="mt-0.5 text-sm font-semibold text-[color:var(--foreground)]">{label}</p>
      {helper && <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{helper}</p>}
    </div>
  );
}

function PipelineBoard() {
  return (
    <div className="ios-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-bold text-[color:var(--foreground)]">Case Pipeline</h3>
        <span className="text-xs text-[color:var(--muted-foreground)]">{PIPELINE.reduce((s, p) => s + p.count, 0)} total</span>
      </div>
      <div className="space-y-2.5">
        {PIPELINE.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <Layers3 size={24} className="text-[color:var(--muted-foreground)]" />
            <p className="text-sm text-[color:var(--muted-foreground)]">No cases in pipeline</p>
          </div>
        ) : PIPELINE.map((stage) => (
          <div key={stage.label}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${stage.color}`} />
                <span className="text-sm font-medium text-[color:var(--foreground)]">{stage.label}</span>
              </div>
              <span className="text-sm font-bold tabular-nums text-[color:var(--foreground)]">{stage.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[color:var(--border)] overflow-hidden">
              <div className={`h-full rounded-full transition-all ${stage.color}`} style={{ width: `${stage.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalQueue() {
  return (
    <div className="ios-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-bold text-[color:var(--foreground)]">Awaiting Approval</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
          {APPROVAL_QUEUE.length} pending
        </span>
      </div>
      <div className="space-y-2">
        {APPROVAL_QUEUE.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <CheckCircle2 size={24} className="text-emerald-500" />
            <p className="text-sm text-[color:var(--muted-foreground)]">No pending approvals</p>
          </div>
        ) : APPROVAL_QUEUE.map((item) => (
          <div key={item.caseId} className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.priority === "urgent" ? "bg-rose-500" : item.priority === "high" ? "bg-amber-500" : "bg-slate-400"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-bold text-[color:var(--primary)]">{item.caseId}</span>
                <span className="truncate text-sm font-semibold text-[color:var(--foreground)]">{item.patient}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-[color:var(--muted-foreground)]">{item.stage}</span>
                <span className="text-[10px] text-[color:var(--muted-foreground)]">·</span>
                <span className="text-xs text-[color:var(--muted-foreground)]">{item.assignedDoctor}</span>
                <span className="text-[10px] text-[color:var(--muted-foreground)]">·</span>
                <span className="text-xs text-[color:var(--muted-foreground)]">{item.waitingSince}</span>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 flex items-center gap-1 rounded-lg bg-[color:var(--primary)] px-2.5 py-1.5 text-xs font-bold text-white transition-transform active:scale-95"
            >
              Review <ChevronRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManufacturingQueue() {
  return (
    <div className="ios-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-bold text-[color:var(--foreground)]">Manufacturing Queue</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--primary-glow)] px-2.5 py-0.5 text-xs font-bold text-[color:var(--primary)]">
          {MFG_QUEUE.length} active
        </span>
      </div>
      <div className="space-y-2">
        {MFG_QUEUE.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <Factory size={24} className="text-[color:var(--muted-foreground)]" />
            <p className="text-sm text-[color:var(--muted-foreground)]">No active manufacturing jobs</p>
          </div>
        ) : MFG_QUEUE.map((job) => (
          <div key={job.batchId} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${job.slaRisk ? "border-rose-300/50 bg-rose-50/60 dark:border-rose-700/40 dark:bg-rose-900/10" : "border-[color:var(--border)] bg-[color:var(--card)]"}`}>
            <Printer size={14} className={job.slaRisk ? "text-rose-500" : "text-[color:var(--primary)]"} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-bold text-[color:var(--muted-foreground)]">{job.batchId}</span>
                <span className="truncate text-sm font-semibold text-[color:var(--foreground)]">{job.patient}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-[color:var(--muted-foreground)]">Stages {job.stages}</span>
                <span className="text-[10px] text-[color:var(--muted-foreground)]">·</span>
                <span className="text-xs text-[color:var(--muted-foreground)]">{job.printer}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className={`block text-xs font-bold ${job.status === "Printing" ? "text-[color:var(--primary)]" : job.status === "Washing" ? "text-teal-600" : job.status === "Curing" ? "text-amber-600" : "text-slate-500"}`}>{job.status}</span>
              <span className="block text-[11px] text-[color:var(--muted-foreground)]">ETA {job.eta}</span>
            </div>
            {job.slaRisk && <AlertTriangle size={14} className="shrink-0 text-rose-500" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskRadar() {
  if (SLA_RISKS.length === 0) {
    return (
      <div className="ios-card p-5">
        <h3 className="font-bold text-[color:var(--foreground)] mb-4">Risk Radar</h3>
        <div className="flex flex-col items-center gap-2 py-6">
          <CheckCircle2 size={28} className="text-emerald-500" />
          <p className="text-sm font-semibold text-[color:var(--foreground)]">No active SLA risks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ios-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-bold text-[color:var(--foreground)]">Risk Radar</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">
          {SLA_RISKS.length} at risk
        </span>
      </div>
      <div className="space-y-2">
        {SLA_RISKS.map((risk) => (
          <div key={risk.caseId} className={`rounded-lg border px-3 py-3 ${risk.severity === "critical" ? "border-rose-300/60 bg-rose-50/60 dark:border-rose-700/40 dark:bg-rose-900/10" : "border-amber-300/50 bg-amber-50/50 dark:border-amber-700/40 dark:bg-amber-900/10"}`}>
            <div className="flex items-start gap-2">
              <AlertOctagon size={15} className={risk.severity === "critical" ? "mt-0.5 text-rose-500" : "mt-0.5 text-amber-500"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-[color:var(--primary)]">{risk.caseId}</span>
                  <span className="text-sm font-semibold text-[color:var(--foreground)]">{risk.patientName}</span>
                </div>
                <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">
                  {risk.currentStage} · Due {risk.dueDate}
                  {risk.hoursOverdue > 0 && <span className="ml-1 font-semibold text-rose-600">{risk.hoursOverdue}h overdue</span>}
                </p>
                <p className="text-xs text-[color:var(--muted-foreground)]">Assigned to {risk.assignedTo}</p>
              </div>
              <button
                type="button"
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white transition-transform active:scale-95 ${risk.severity === "critical" ? "bg-rose-500" : "bg-amber-500"}`}
              >
                Escalate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIRecommendations() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = AI_INSIGHTS.filter(i => !dismissed.includes(i.id));

  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-violet-500" />
        <h3 className="font-bold text-[color:var(--foreground)]">AI Recommendations</h3>
        <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">Clinical Decision Support Only</span>
      </div>
      <MedicalDisclaimer variant="compact" className="mb-3" />
      <div className="space-y-2.5">
        {visible.map((insight) => (
          <div
            key={insight.id}
            className={`rounded-lg border px-3 py-3 ${
              insight.severity === "critical"
                ? "border-rose-300/50 bg-rose-50/50 dark:border-rose-700/40 dark:bg-rose-900/10"
                : insight.severity === "warning"
                ? "border-amber-300/50 bg-amber-50/50 dark:border-amber-700/40 dark:bg-amber-900/10"
                : "border-[color:var(--border)] bg-[color:var(--card)]"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${insight.severity === "critical" ? "bg-rose-500" : insight.severity === "warning" ? "bg-amber-500" : "bg-sky-500"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{insight.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--muted-foreground)]">{insight.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {insight.actionLabel && (
                  <button type="button" className="rounded-lg bg-[color:var(--primary)] px-2.5 py-1.5 text-xs font-bold text-white">
                    {insight.actionLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDismissed(d => [...d, insight.id])}
                  className="rounded-lg border border-[color:var(--border)] px-2 py-1.5 text-xs text-[color:var(--muted-foreground)]"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 py-3">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <p className="text-sm text-[color:var(--muted-foreground)]">No active recommendations</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentActivity() {
  const TONE: Record<RecentActivity["type"], string> = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    info:    "bg-sky-500",
    error:   "bg-rose-500",
  };
  return (
    <div className="ios-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-bold text-[color:var(--foreground)]">Recent Clinical Activity</h3>
        <button type="button" className="text-[color:var(--primary)] text-xs font-semibold">View all</button>
      </div>
      <div className="space-y-2">
        {RECENT_ACTIVITY.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <Activity size={24} className="text-[color:var(--muted-foreground)]" />
            <p className="text-sm text-[color:var(--muted-foreground)]">No recent activity</p>
          </div>
        ) : RECENT_ACTIVITY.map((ev) => (
          <div key={ev.id} className="flex items-start gap-2.5">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[ev.type]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[color:var(--foreground)]">{ev.text}</p>
              <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{ev.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClinicalCommandCenter() {
  const [lastRefresh] = useState(() => new Date().toLocaleTimeString());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Clinical Command Center</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">What requires attention right now?</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Live operational status across all cases, approvals, manufacturing, and SLA risks.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[color:var(--muted-foreground)]">Last refreshed {lastRefresh}</span>
          <button type="button" className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-xs font-semibold text-[color:var(--foreground)] transition-transform active:scale-95">
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Medical Disclaimer */}
      <MedicalDisclaimer variant="inline" />

      {/* KPI Cards — 8 tiles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Active Cases"         value={STATS.activeCases}          helper="Across all clinics"          icon={Activity}  tone="primary"  trend="up" />
        <KPICard label="Awaiting Approval"    value={STATS.awaitingApproval}     helper="Doctor sign-off required"    icon={ThumbsUp}  tone="warning" />
        <KPICard label="SLA at Risk"          value={STATS.slaAtRisk}            helper="Immediate review needed"     icon={AlertOctagon} tone="danger" />
        <KPICard label="Completed Today"      value={STATS.completedToday}       helper="Cases fully shipped"         icon={CheckCircle2} tone="success" trend="up" />
        <KPICard label="In Manufacturing"     value={STATS.inManufacturing}      helper="Active print jobs"           icon={Printer}   tone="primary" />
        <KPICard label="Awaiting Segmentation" value={STATS.awaitingSegmentation} helper="AI queue"                  icon={ScanLine}  tone="info" />
        <KPICard label="Awaiting CAD"         value={STATS.awaitingCAD}          helper="Design review queue"         icon={Box}       tone="info" />
        <KPICard label="Refinements Needed"   value={STATS.refinementsNeeded}    helper="Revision cycle open"         icon={RefreshCw} tone="warning" />
      </div>

      {/* Main grid: pipeline + approval queue */}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <ApprovalQueue />
        <PipelineBoard />
      </div>

      {/* Manufacturing + Risk Radar */}
      <div className="grid gap-5 xl:grid-cols-2">
        <ManufacturingQueue />
        <RiskRadar />
      </div>

      {/* AI Recommendations + Recent Activity */}
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <AIRecommendations />
        <RecentActivity />
      </div>
    </div>
  );
}

export default ClinicalCommandCenter;
