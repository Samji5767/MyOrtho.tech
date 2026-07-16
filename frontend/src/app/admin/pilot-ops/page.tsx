"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FlaskConical,
  FolderKanban,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api/client";
import {
  Card,
  MetricCard,
  SkeletonBlock,
  StatusBadge,
} from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgOnboarding {
  orgId: string;
  orgName: string;
  completedSteps: number;
  pendingSteps: number;
}

interface RecentActivity {
  caseId: string;
  fromStatus: string;
  toStatus: string;
  actorRole: string;
  actorEmail: string | null;
  orgName: string | null;
  createdAt: string;
}

interface PilotOpsSnapshot {
  generatedAt: string;
  feedback: {
    total: number;
    open: number;
    openCritical: number;
    openHigh: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  };
  onboarding: {
    orgs: OrgOnboarding[];
  };
  cases: {
    byStatus: Record<string, number>;
    demoCount: number;
  };
  recentActivity: RecentActivity[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ORDER = [
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
  "archived",
  "cancelled",
];

function severityTone(sev: string): "danger" | "warning" | "info" | "neutral" {
  if (sev === "critical") return "danger";
  if (sev === "high") return "warning";
  if (sev === "medium") return "info";
  return "neutral";
}

function fmt(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function label(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeedbackPanel({ feedback }: { feedback: PilotOpsSnapshot["feedback"] }) {
  const categories = Object.entries(feedback.byCategory).sort((a, b) => b[1] - a[1]);
  const statuses = Object.entries(feedback.byStatus);
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-[color:var(--muted)] mb-4 flex items-center gap-2">
        <MessageSquare size={14} /> Pilot Feedback
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg bg-[color:var(--surface-2)] p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{feedback.total}</p>
          <p className="text-xs text-[color:var(--muted)] mt-0.5">Total</p>
        </div>
        <div className="rounded-lg bg-[color:var(--surface-2)] p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{feedback.open}</p>
          <p className="text-xs text-[color:var(--muted)] mt-0.5">Open</p>
        </div>
        <div className="rounded-lg bg-red-500/10 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{feedback.openCritical}</p>
          <p className="text-xs text-[color:var(--muted)] mt-0.5">Critical</p>
        </div>
        <div className="rounded-lg bg-orange-500/10 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">{feedback.openHigh}</p>
          <p className="text-xs text-[color:var(--muted)] mt-0.5">High</p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-[color:var(--muted)] mb-2">Open by category</p>
          <div className="flex flex-wrap gap-2">
            {categories.map(([cat, count]) => (
              <span key={cat} className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-[color:var(--surface-2)]">
                <span className="font-medium tabular-nums">{count}</span>
                <span className="text-[color:var(--muted)]">{label(cat)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-[color:var(--muted)] mb-2">By status</p>
        <div className="flex flex-wrap gap-2">
          {statuses.map(([st, count]) => (
            <StatusBadge key={st} tone={st === "resolved" ? "success" : st === "wont_fix" ? "neutral" : "info"}>
              {label(st)}: {count}
            </StatusBadge>
          ))}
        </div>
      </div>
    </Card>
  );
}

function OnboardingPanel({ orgs }: { orgs: OrgOnboarding[] }) {
  if (orgs.length === 0) return null;
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-[color:var(--muted)] mb-4 flex items-center gap-2">
        <Users size={14} /> Onboarding Progress ({orgs.length} orgs)
      </h3>
      <div className="space-y-2">
        {orgs.map((org) => {
          const total = org.completedSteps + org.pendingSteps;
          const pct = total === 0 ? 100 : Math.round((org.completedSteps / total) * 100);
          return (
            <div key={org.orgId} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium truncate">{org.orgName}</span>
                  <span className="text-xs text-[color:var(--muted)] ml-2 shrink-0">
                    {org.completedSteps}/{total}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[color:var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[color:var(--primary)] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {org.pendingSteps === 0 ? (
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              ) : (
                <Clock size={16} className="text-[color:var(--muted)] shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CasesPanel({ cases }: { cases: PilotOpsSnapshot["cases"] }) {
  const ordered = STATUS_ORDER.map((s) => ({ status: s, count: cases.byStatus[s] ?? 0 }))
    .filter((x) => x.count > 0);
  const total = ordered.reduce((sum, x) => sum + x.count, 0);

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-[color:var(--muted)] mb-4 flex items-center gap-2">
        <FolderKanban size={14} /> Live Cases (excl. demo)
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ordered.map(({ status, count }) => (
          <div key={status} className="rounded-lg bg-[color:var(--surface-2)] p-3">
            <p className="text-xl font-bold tabular-nums">{count}</p>
            <p className="text-xs text-[color:var(--muted)] truncate mt-0.5">{label(status)}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--muted)]">
        <span>Total live cases: <strong className="text-[color:var(--text)]">{total}</strong></span>
        <span className="flex items-center gap-1">
          <FlaskConical size={12} /> {cases.demoCount} demo case{cases.demoCount !== 1 ? "s" : ""}
        </span>
      </div>
    </Card>
  );
}

function ActivityPanel({ activity }: { activity: RecentActivity[] }) {
  if (activity.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-[color:var(--muted)] mb-4 flex items-center gap-2">
          <ShieldCheck size={14} /> Recent Workflow Activity (48h)
        </h3>
        <p className="text-sm text-[color:var(--muted)]">No workflow transitions in the last 48 hours.</p>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-[color:var(--muted)] mb-4 flex items-center gap-2">
        <ShieldCheck size={14} /> Recent Workflow Activity (48h)
      </h3>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {activity.map((ev, i) => (
          <div key={i} className="flex items-start gap-3 text-sm border-b border-[color:var(--border)] last:border-0 pb-2 last:pb-0">
            <div className="shrink-0 w-2 h-2 rounded-full bg-[color:var(--primary)] mt-1.5" />
            <div className="flex-1 min-w-0">
              <span className="font-medium">{label(ev.fromStatus)}</span>
              <span className="text-[color:var(--muted)] mx-1">→</span>
              <span className="font-medium">{label(ev.toStatus)}</span>
              {ev.orgName && (
                <span className="text-xs text-[color:var(--muted)] ml-1">({ev.orgName})</span>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-[color:var(--muted)]">{ev.actorRole}</p>
              <p className="text-xs text-[color:var(--muted)]">{fmt(ev.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PilotOpsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<PilotOpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await api.get<PilotOpsSnapshot>("/api/admin/pilot-ops");
      setData(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pilot ops data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (user?.role !== "super_admin") {
    return (
      <div className="p-8 text-center">
        <XCircle size={40} className="mx-auto mb-3 text-red-500" />
        <p className="font-semibold">Access restricted to platform administrators.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Pilot Operations Dashboard</h1>
            <p className="text-sm text-[color:var(--muted)]">
              Real-time status across all pilot clinic deployments
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--surface-2)] transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Timestamp */}
      {data && (
        <p className="text-xs text-[color:var(--muted)]">
          Snapshot generated {fmt(data.generatedAt)}
        </p>
      )}

      {/* Top metric cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonBlock key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            label="Open Feedback"
            value={String(data.feedback.open)}
            helper={`${data.feedback.total} total submitted`}
            icon={MessageSquare}
          />
          <MetricCard
            label="Critical Issues"
            value={String(data.feedback.openCritical)}
            helper={`${data.feedback.openHigh} high severity open`}
            icon={AlertTriangle}
            tone="danger"
          />
          <MetricCard
            label="Active Cases"
            value={String(
              (data.cases.byStatus["active_treatment"] ?? 0) +
              (data.cases.byStatus["planning"] ?? 0) +
              (data.cases.byStatus["clinical_review"] ?? 0)
            )}
            helper="across all orgs (excl. demo)"
            icon={FolderKanban}
          />
          <MetricCard
            label="Pilot Orgs"
            value={String(data.onboarding.orgs.length)}
            helper={`${data.onboarding.orgs.filter(o => o.pendingSteps === 0).length} fully onboarded`}
            icon={Users}
            tone="success"
          />
        </div>
      ) : null}

      {/* Main panels */}
      {loading ? (
        <div className="space-y-4">
          <SkeletonBlock className="h-48 rounded-xl" />
          <SkeletonBlock className="h-48 rounded-xl" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FeedbackPanel feedback={data.feedback} />
          <OnboardingPanel orgs={data.onboarding.orgs} />
          <CasesPanel cases={data.cases} />
          <ActivityPanel activity={data.recentActivity} />
        </div>
      ) : null}
    </div>
  );
}
