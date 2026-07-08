"use client";

import { useCallback, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, ProgressBar, StatusBadge } from "@/components/DesignSystem";
import {
  analyzeSegmentation,
  getCorrectionReport,
  repairCorrectionItem,
  repairAllItems,
  ISSUE_LABELS,
  type AutoCorrectionReport,
  type AutoCorrectionItem,
  type IssueSeverity,
} from "@/lib/api/auto-correction";

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_TONE = {
  critical: "danger",
  warning:  "warning",
  info:     "info",
} as const;

const SEVERITY_ICON = {
  critical: XCircle,
  warning:  AlertTriangle,
  info:     Info,
} as const;

const SEVERITY_ORDER: IssueSeverity[] = ["critical", "warning", "info"];

// ─── Mesh validity gauge ──────────────────────────────────────────────────────

function ValidityGauge({ score }: { score: number | null }) {
  const pct = score !== null ? Math.round(score * 100) : null;
  const tone = pct === null ? "neutral" : pct >= 85 ? "success" : pct >= 60 ? "warning" : "danger";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[color:var(--muted-foreground)]">Mesh validity</span>
        <span className={`font-bold tabular-nums ${
          tone === "success" ? "text-emerald-600 dark:text-emerald-400" :
          tone === "warning"  ? "text-amber-600 dark:text-amber-400" :
          tone === "danger"   ? "text-red-600 dark:text-red-400" :
          "text-[color:var(--muted-foreground)]"
        }`}>
          {pct !== null ? `${pct}%` : "—"}
        </span>
      </div>
      <ProgressBar value={pct ?? 0} tone={tone === "neutral" ? "primary" : tone} />
    </div>
  );
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function ReportSummary({
  report,
  onRepairAll,
  repairing,
}: {
  report: AutoCorrectionReport;
  onRepairAll: () => void;
  repairing: boolean;
}) {
  const fixable = report.items.filter(i => i.autoFixable && !i.isRepaired).length;
  const remaining = report.totalIssues - report.autoFixedCount;

  return (
    <div className="space-y-3">
      <ValidityGauge score={report.meshValidityScore} />

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Total",    value: report.totalIssues,    cls: "text-[color:var(--foreground)]" },
          { label: "Critical", value: report.criticalCount,  cls: "text-red-600 dark:text-red-400" },
          { label: "Warning",  value: report.warningCount,   cls: "text-amber-600 dark:text-amber-400" },
          { label: "Fixed",    value: report.autoFixedCount, cls: "text-emerald-600 dark:text-emerald-400" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-lg bg-[color:var(--muted)]/30 px-2 py-2">
            <p className={`text-xl font-bold tabular-nums ${cls}`}>{value}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">{label}</p>
          </div>
        ))}
      </div>

      {report.analysisDurationMs && (
        <p className="flex items-center gap-1 text-[10px] text-[color:var(--muted-foreground)]">
          <Clock size={10} />
          Analysis completed in {report.analysisDurationMs}ms
          {report.analyzedAt && ` · ${new Date(report.analyzedAt).toLocaleTimeString()}`}
        </p>
      )}

      {fixable > 0 && (
        <button
          type="button"
          onClick={onRepairAll}
          disabled={repairing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {repairing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {repairing ? "Repairing…" : `Auto-Repair All (${fixable} fixable)`}
        </button>
      )}

      {remaining === 0 && report.totalIssues > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <ShieldCheck size={13} />
          All issues resolved — segmentation is ready for treatment planning.
        </div>
      )}
    </div>
  );
}

// ─── Issue item row ───────────────────────────────────────────────────────────

function IssueRow({
  item,
  onRepair,
  repairing,
}: {
  item: AutoCorrectionItem;
  onRepair: (id: string) => void;
  repairing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = SEVERITY_ICON[item.severity];
  const tone = SEVERITY_TONE[item.severity];

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${
      item.isRepaired
        ? "border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-500/15 dark:bg-emerald-500/5"
        : "border-[color:var(--border)]"
    }`}>
      <div className="flex items-start gap-2">
        <Icon size={14} className={`mt-0.5 shrink-0 ${
          item.isRepaired ? "text-emerald-500" :
          item.severity === "critical" ? "text-red-500" :
          item.severity === "warning"  ? "text-amber-500" :
          "text-blue-500"
        }`} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={item.isRepaired ? "success" : tone}>
              {item.isRepaired ? "Fixed" : item.severity}
            </StatusBadge>
            <span className="text-xs font-semibold text-[color:var(--foreground)]">
              {ISSUE_LABELS[item.issueType]}
            </span>
            {item.toothNumber && (
              <span className="rounded bg-[color:var(--muted)]/40 px-1.5 py-0.5 text-[10px] font-mono text-[color:var(--muted-foreground)]">
                FDI {item.toothNumber}
              </span>
            )}
            {item.regionType && (
              <span className="text-[10px] text-[color:var(--muted-foreground)] capitalize">{item.regionType}</span>
            )}
          </div>
          <p className="text-xs text-[color:var(--muted-foreground)]">{item.description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!item.isRepaired && item.autoFixable && (
            <button
              type="button"
              onClick={() => onRepair(item.id)}
              disabled={repairing}
              className="flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
            >
              {repairing ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
              Fix
            </button>
          )}
          {item.isRepaired && (
            <CheckCircle2 size={14} className="text-emerald-500" />
          )}
          {!item.autoFixable && !item.isRepaired && (
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
              Manual
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded(o => !o)}
            aria-label={expanded ? "Collapse issue details" : "Expand issue details"}
            aria-expanded={expanded}
            className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="ml-5 space-y-1.5 text-xs">
          <p className="text-[color:var(--muted-foreground)]">
            <strong className="text-[color:var(--foreground)]">Suggested action:</strong>{" "}
            {item.suggestedAction}
          </p>
          {item.isRepaired && Object.keys(item.repairDetails).length > 0 && (
            <div className="rounded-lg bg-emerald-500/5 px-2 py-1.5">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">Repair details</p>
              {Object.entries(item.repairDetails).map(([k, v]) => (
                <p key={k} className="text-[color:var(--muted-foreground)]">
                  <span className="font-mono">{k}:</span> {String(v)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Issue group ──────────────────────────────────────────────────────────────

function IssueGroup({
  severity,
  items,
  onRepair,
  repairingId,
}: {
  severity: IssueSeverity;
  items: AutoCorrectionItem[];
  onRepair: (id: string) => void;
  repairingId: string | null;
}) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;

  const Icon = SEVERITY_ICON[severity];
  const tone = SEVERITY_TONE[severity];
  const label = severity.charAt(0).toUpperCase() + severity.slice(1);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 py-1.5 text-xs font-semibold text-[color:var(--foreground)]"
      >
        <StatusBadge tone={tone}>{label} ({items.length})</StatusBadge>
        {open ? <ChevronDown size={11} className="ml-auto" /> : <ChevronRight size={11} className="ml-auto" />}
      </button>
      {open && (
        <div className="space-y-2 mt-1">
          {items.map(item => (
            <IssueRow
              key={item.id}
              item={item}
              onRepair={onRepair}
              repairing={repairingId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  jobId: string;
}

export default function SegmentationAutoCorrector({ caseId, jobId }: Props) {
  const [report, setReport] = useState<AutoCorrectionReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [repairingAll, setRepairingAll] = useState(false);
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repairResult, setRepairResult] = useState<{ repairedCount: number; skippedCount: number } | null>(null);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setRepairResult(null);
    try {
      const result = await analyzeSegmentation(caseId, jobId);
      setReport(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }, [caseId, jobId]);

  const loadReport = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await getCorrectionReport(caseId, jobId);
      setReport(result);
    } catch {
      // No report yet — silently handled; user will click Analyze
    } finally {
      setAnalyzing(false);
    }
  }, [caseId, jobId]);

  // Load existing report on first render
  useState(() => { void loadReport(); });

  async function handleRepairItem(itemId: string) {
    setRepairingId(itemId);
    setError(null);
    try {
      const updated = await repairCorrectionItem(caseId, jobId, itemId);
      setReport(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          autoFixedCount: prev.autoFixedCount + (updated.isRepaired ? 1 : 0),
          items: prev.items.map(i => i.id === itemId ? updated : i),
        };
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRepairingId(null);
    }
  }

  async function handleRepairAll() {
    setRepairingAll(true);
    setError(null);
    try {
      const result = await repairAllItems(caseId, jobId);
      setRepairResult(result);
      // Reload to get updated is_repaired flags
      const fresh = await getCorrectionReport(caseId, jobId);
      setReport(fresh);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRepairingAll(false);
    }
  }

  const byServerity = (sev: IssueSeverity) =>
    (report?.items ?? []).filter(i => i.severity === sev);

  return (
    <div className="space-y-4">
      {/* AI disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Auto-corrections are AI-assisted suggestions. Clinician review required before using for treatment planning or manufacturing.
      </div>

      {/* Analyze button */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Segmentation Analysis</h3>
          </div>
          {report && (
            <button
              type="button"
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center gap-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
            >
              <RefreshCw size={11} className={analyzing ? "animate-spin" : ""} />
              Re-analyze
            </button>
          )}
        </div>

        {!report ? (
          <div className="space-y-3">
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Run automated analysis to detect boundary errors, confidence anomalies, missing gingival margins, mesh artifacts, and more.
            </p>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
              {analyzing ? "Analyzing…" : "Analyze Segmentation"}
            </button>
          </div>
        ) : (
          <ReportSummary
            report={report}
            onRepairAll={handleRepairAll}
            repairing={repairingAll}
          />
        )}
      </Card>

      {/* Repair result */}
      {repairResult && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
          Auto-repair complete: {repairResult.repairedCount} issue{repairResult.repairedCount !== 1 ? "s" : ""} fixed
          {repairResult.skippedCount > 0 && `, ${repairResult.skippedCount} skipped`}.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <XCircle size={12} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Issues list */}
      {report && report.totalIssues > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
            Detected Issues
          </h3>
          {SEVERITY_ORDER.map(sev => (
            <IssueGroup
              key={sev}
              severity={sev}
              items={byServerity(sev)}
              onRepair={handleRepairItem}
              repairingId={repairingId}
            />
          ))}
        </Card>
      )}

      {report && report.totalIssues === 0 && (
        <Card className="p-6 text-center">
          <ShieldCheck size={28} className="mx-auto mb-2 text-emerald-500" />
          <p className="text-sm font-semibold text-[color:var(--foreground)]">No issues detected</p>
          <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">Segmentation passed all automated quality checks.</p>
        </Card>
      )}
    </div>
  );
}
