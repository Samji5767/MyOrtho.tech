"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  Layers,
  Loader2,
  Microscope,
  Package,
  Printer,
  RefreshCw,
  Shield,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";
import {
  type QCJobSummary,
  type QCCheck,
  type QCCheckType,
  type QCCheckStatus,
  CHECK_TYPE_LABELS,
  listQCJobs,
  initQCChecks,
  updateQCCheck,
} from "@/lib/api/qc";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<QCCheckStatus, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  pass:    { label: "Pass",    bg: "bg-emerald-500/10", text: "text-emerald-600", icon: CheckCircle2 },
  fail:    { label: "Fail",    bg: "bg-rose-500/10",    text: "text-rose-500",    icon: AlertTriangle },
  warning: { label: "Warning", bg: "bg-amber-500/10",   text: "text-amber-600",   icon: AlertTriangle },
  pending: { label: "Pending", bg: "bg-slate-500/10",   text: "text-slate-500",   icon: Layers },
};

const CHECK_ICONS: Record<QCCheckType, React.ElementType> = {
  print_quality:          Layers,
  model_integrity:        Shield,
  thickness_verification: Microscope,
  fit_verification:       Eye,
  surface_finish:         Layers,
  dimensional_accuracy:   Layers,
  material_compliance:    CheckCircle2,
};

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-[color:var(--muted-foreground)] text-sm">Pending</span>;
  const color = score >= 90 ? "text-green-600" : score >= 70 ? "text-amber-600" : "text-rose-600";
  return <span className={`text-2xl font-bold tabular-nums ${color}`}>{score}%</span>;
}

// ─── Check row ────────────────────────────────────────────────────────────────

function CheckRow({
  check,
  jobId,
  onUpdate,
}: {
  check: QCCheck;
  jobId: string;
  onUpdate: (updated: QCCheck) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [measured, setMeasured] = useState(check.measuredValue?.toString() ?? "");
  const [notes, setNotes] = useState(check.notes ?? "");
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[check.status];
  const Icon = CHECK_ICONS[check.checkType];

  const submit = async (status: QCCheckStatus) => {
    setBusy(true);
    try {
      const updated = await updateQCCheck(jobId, check.id, {
        status,
        measuredValue: measured ? parseFloat(measured) : undefined,
        notes: notes || undefined,
      });
      onUpdate(updated);
      setExpanded(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${check.status === "fail" ? "border-rose-300/50 bg-rose-50/30 dark:border-rose-700/40" : "border-[color:var(--border)] bg-[color:var(--card)]"}`}>
      <button type="button" onClick={() => setExpanded(x => !x)} className="w-full flex items-center gap-3 text-left">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${cfg.bg} ${cfg.text}`}>
          <Icon size={14} />
        </span>
        <span className="flex-1 text-sm font-semibold text-[color:var(--foreground)]">{CHECK_TYPE_LABELS[check.checkType]}</span>
        {check.measuredValue != null && check.unit && (
          <span className="text-xs text-[color:var(--muted-foreground)] font-mono">{check.measuredValue} {check.unit}</span>
        )}
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
          {cfg.label}
        </span>
        {expanded ? <ChevronUp size={13} className="text-[color:var(--muted-foreground)]" /> : <ChevronDown size={13} className="text-[color:var(--muted-foreground)]" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[color:var(--border)] pt-3">
          {check.expectedMin != null && (
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Expected: {check.expectedMin}–{check.expectedMax} {check.unit}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={measured}
              onChange={e => setMeasured(e.target.value)}
              placeholder={`Value (${check.unit ?? ""})`}
              className="w-32 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1.5 text-sm text-[color:var(--foreground)]"
            />
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes…"
              className="flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1.5 text-sm text-[color:var(--foreground)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => submit("pass")}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <ThumbsUp size={11} />} Pass
            </button>
            <button
              type="button"
              onClick={() => submit("warning")}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <AlertTriangle size={11} /> Warning
            </button>
            <button
              type="button"
              onClick={() => submit("fail")}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-50"
            >
              <ThumbsDown size={11} /> Fail
            </button>
          </div>
          {check.checkedByEmail && (
            <p className="text-[10px] text-[color:var(--muted-foreground)]">
              Last checked by {check.checkedByEmail}
              {check.checkedAt ? ` · ${new Date(check.checkedAt).toLocaleString()}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job, onRefresh }: { job: QCJobSummary; onRefresh: (j: QCJobSummary) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [initBusy, setInitBusy] = useState(false);

  const handleUpdateCheck = (updated: QCCheck) => {
    const next = { ...job, checks: job.checks.map(c => c.id === updated.id ? updated : c) };
    next.passCount = next.checks.filter(c => c.status === "pass").length;
    next.failCount = next.checks.filter(c => c.status === "fail").length;
    next.pendingCount = next.checks.filter(c => c.status === "pending").length;
    onRefresh(next);
  };

  const handleInit = async () => {
    setInitBusy(true);
    try {
      const checks = await initQCChecks(job.id);
      onRefresh({ ...job, checks, pendingCount: checks.length, passCount: 0, failCount: 0 });
      setExpanded(true);
    } finally {
      setInitBusy(false);
    }
  };

  const statusColor = job.status === "completed" ? "text-green-600" : job.status === "failed" ? "text-rose-600" : "text-amber-600";

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
      <button type="button" onClick={() => setExpanded(x => !x)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[color:var(--muted)]">
        <Printer size={15} className="text-[color:var(--muted-foreground)] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)] truncate">
            {job.printerName ?? "Unassigned"} · {job.id.slice(-8)}
          </p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {new Date(job.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ScoreGauge score={job.qualityScore} />
          <div className="flex gap-1 text-xs">
            <span className="text-green-600 font-bold">{job.passCount}✓</span>
            {job.failCount > 0 && <span className="text-rose-600 font-bold">{job.failCount}✗</span>}
            {job.pendingCount > 0 && <span className="text-[color:var(--muted-foreground)]">{job.pendingCount}?</span>}
          </div>
          <span className={`text-xs font-semibold capitalize ${statusColor}`}>{job.status}</span>
        </div>
        {expanded ? <ChevronUp size={13} className="text-[color:var(--muted-foreground)]" /> : <ChevronDown size={13} className="text-[color:var(--muted-foreground)]" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[color:var(--border)] space-y-2 pt-3">
          {job.checks.length === 0 ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-[color:var(--muted-foreground)]">No QC checks initialised.</p>
              <button
                type="button"
                onClick={handleInit}
                disabled={initBusy}
                className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-xs font-medium text-[color:var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
              >
                {initBusy ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                Init 7 Checks
              </button>
            </div>
          ) : (
            job.checks.map(check => (
              <CheckRow key={check.id} check={check} jobId={job.id} onUpdate={handleUpdateCheck} />
            ))
          )}
          {job.qcNotes && (
            <p className="text-xs text-[color:var(--muted-foreground)] mt-2 italic">{job.qcNotes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QualityControlCenter() {
  const [jobs, setJobs] = useState<QCJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      setJobs(await listQCJobs(50));
    } catch (e: any) {
      setError(e.message ?? "Failed to load QC jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRefreshJob = (updated: QCJobSummary) => {
    setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
  };

  const totalJobs = jobs.length;
  const pendingJobs = jobs.filter(j => j.pendingCount > 0).length;
  const failedJobs = jobs.filter(j => j.failCount > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Manufacturing QC</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Quality Control Center</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Print quality · Thickness · Fit verification · Material compliance</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--muted)] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Print Jobs", value: totalJobs, icon: Package, tone: "text-[color:var(--foreground)]" },
          { label: "Pending Review", value: pendingJobs, icon: Loader2, tone: pendingJobs > 0 ? "text-amber-600" : "text-green-600" },
          { label: "Issues Found", value: failedJobs, icon: AlertTriangle, tone: failedJobs > 0 ? "text-rose-600" : "text-green-600" },
        ].map(s => (
          <div key={s.label} className="ios-card flex flex-col items-center gap-1 p-4">
            <s.icon size={18} className={s.tone} />
            <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
            <p className="text-xs text-[color:var(--muted-foreground)]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-[color:var(--muted-foreground)]">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">Loading QC queue…</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] py-16 text-center">
          <ShieldCheck size={32} strokeWidth={1.5} className="text-[color:var(--muted-foreground)]" />
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">No print jobs in QC queue</p>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">Print jobs will appear here once created in Manufacturing</p>
          </div>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Info size={13} className="text-[color:var(--muted-foreground)]" />
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Click a job to expand checks. Use <strong>Init 7 Checks</strong> to create standard QC checklist for unreviewed jobs.
            </p>
          </div>
          {jobs.map(job => (
            <JobCard key={job.id} job={job} onRefresh={handleRefreshJob} />
          ))}
        </div>
      )}
    </div>
  );
}
