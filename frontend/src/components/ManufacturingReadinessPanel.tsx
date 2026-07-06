"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  DollarSign,
  Layers,
  Package,
  Printer,
} from "lucide-react";
import {
  getAlignerGenerationPlan,
  getQualityReport,
  type AlignerGenerationPlan,
  type QualityReport,
} from "@/lib/api/aligner-generation";
import { listExportPackages, type ExportPackage } from "@/lib/api/export-package";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(n: number): string {
  if (n >= 80) return "var(--clinical-safe)";
  if (n >= 60) return "var(--clinical-warn)";
  return "var(--clinical-danger)";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[color:var(--muted-foreground)]">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-[color:var(--border)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function PlanStatusChip({ status }: { status: AlignerGenerationPlan["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:         { label: "Draft",         cls: "border-amber-300/50 bg-amber-50/60 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/10 dark:text-amber-400" },
    approved:      { label: "Approved",      cls: "border-emerald-300/50 bg-emerald-50/60 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/10 dark:text-emerald-400" },
    manufacturing: { label: "Manufacturing", cls: "border-blue-300/50 bg-blue-50/60 text-blue-700 dark:border-blue-700/40 dark:bg-blue-900/10 dark:text-blue-400" },
    complete:      { label: "Complete",      cls: "border-emerald-300/50 bg-emerald-50/60 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/10 dark:text-emerald-400" },
  };
  const entry = map[status] ?? { label: status, cls: "border-[color:var(--border)]" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-[color:var(--muted-foreground)]" />
        <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">{label}</p>
      </div>
      <p className="text-base font-black tabular-nums text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

interface PanelData {
  plan: AlignerGenerationPlan | null;
  quality: QualityReport | null;
  packages: ExportPackage[];
}

export function ManufacturingReadinessPanel({ caseId, planId }: Props) {
  const [data, setData] = useState<PanelData>({ plan: null, quality: null, packages: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planRes, qualityRes, packagesRes] = await Promise.allSettled([
        getAlignerGenerationPlan(caseId, planId),
        getQualityReport(caseId, planId),
        listExportPackages(caseId, planId),
      ]);
      setData({
        plan:     planRes.status     === "fulfilled" ? planRes.value     : null,
        quality:  qualityRes.status  === "fulfilled" ? qualityRes.value  : null,
        packages: packagesRes.status === "fulfilled" ? packagesRes.value : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load manufacturing data");
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  useEffect(() => { void load(); }, [load]);

  const { plan, quality, packages } = data;
  const stlPackage = packages.find((p) => p.exportType === "aligner_stl");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">Manufacturing</p>
          <h3 className="text-base font-semibold text-[color:var(--foreground)]">Print Readiness</h3>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--primary)] disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-300/50 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/10 dark:text-rose-400">
          <AlertTriangle size={12} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Plan status banner */}
      {plan && (
        <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
          <Box size={20} className="shrink-0 text-[color:var(--primary)]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-[color:var(--foreground)]">Aligner Generation Plan</p>
              <PlanStatusChip status={plan.status} />
            </div>
            <p className="text-xs text-[color:var(--muted-foreground)]">
              {plan.totalActiveStages} active · {plan.passiveAlignerCount} passive · {plan.retentionStageCount} retention stages
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-black tabular-nums text-[color:var(--foreground)]">{plan.totalActiveStages}</p>
            <p className="text-[10px] text-[color:var(--muted-foreground)]">stages</p>
          </div>
        </div>
      )}

      {/* Quality scores */}
      {quality && (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">Quality Scores</p>
            <span className="text-xl font-black tabular-nums" style={{ color: scoreColor(quality.overallScore) }}>
              {quality.overallScore}
              <span className="text-xs font-semibold text-[color:var(--muted-foreground)]">/100</span>
            </span>
          </div>
          <div className="space-y-2.5">
            <ScoreBar label="Mesh Integrity" value={quality.meshIntegrity} />
            <ScoreBar label="Printability"   value={quality.printability}  />
          </div>
        </div>
      )}

      {/* Metrics grid */}
      {quality && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard icon={Layers}        label="Min Thickness"  value={`${quality.minThicknessMm.toFixed(2)} mm`}                           />
          <MetricCard icon={AlertTriangle} label="Overhangs"      value={String(quality.overhangCount)}                                        />
          <MetricCard icon={Package}       label="Resin Est."     value={`${quality.estimatedResinGrams.toFixed(1)} g`}                        />
          <MetricCard icon={Clock}         label="Print Time"     value={`${Math.round(quality.estimatedPrintTimeMinutes)} min`}               />
        </div>
      )}

      {quality && (
        <div className="grid grid-cols-2 gap-2">
          <MetricCard icon={DollarSign} label="Estimated Cost"  value={`$${quality.estimatedCostUsd.toFixed(2)}`} />
          <MetricCard icon={Printer}   label="Batch Groups"     value={String(quality.batchCount)}                />
        </div>
      )}

      {/* STL export readiness */}
      {plan && (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">STL Export</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {plan.stlExportReady
                ? <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                : <XCircle size={16} className="shrink-0 text-rose-500" />}
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {plan.stlExportReady ? "STL files ready" : "STL not yet generated"}
              </p>
            </div>
            {stlPackage && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                stlPackage.status === "approved" || stlPackage.status === "exported"
                  ? "border-emerald-300/50 bg-emerald-50/60 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/10 dark:text-emerald-400"
                  : stlPackage.status === "validated"
                  ? "border-blue-300/50 bg-blue-50/60 text-blue-700 dark:border-blue-700/40 dark:bg-blue-900/10 dark:text-blue-400"
                  : "border-amber-300/50 bg-amber-50/60 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/10 dark:text-amber-400"
              }`}>
                {stlPackage.status}
              </span>
            )}
          </div>
          {plan.estimatedTotalWeeks != null && (
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Estimated treatment: {plan.estimatedTotalWeeks} weeks · Change every {plan.alignerChangeWeeks} weeks
            </p>
          )}
        </div>
      )}

      {/* Issues */}
      {quality && quality.issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">Issues</p>
          {quality.issues.map((issue, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                issue.severity === "error"
                  ? "border-rose-300/50 bg-rose-50/60 dark:border-rose-700/40 dark:bg-rose-900/10"
                  : issue.severity === "warning"
                  ? "border-amber-300/50 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-900/10"
                  : "border-blue-300/50 bg-blue-50/60 dark:border-blue-700/40 dark:bg-blue-900/10"
              }`}
            >
              {issue.severity === "error"
                ? <XCircle size={13} className="shrink-0 text-rose-600 mt-0.5" />
                : issue.severity === "warning"
                ? <AlertTriangle size={13} className="shrink-0 text-amber-600 mt-0.5" />
                : <CheckCircle2 size={13} className="shrink-0 text-blue-600 mt-0.5" />}
              <div>
                <p className="font-semibold">{issue.code.replace(/_/g, " ")}</p>
                <p className="text-[color:var(--muted-foreground)]">{issue.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !plan && !quality && !error && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Box size={28} className="text-[color:var(--muted-foreground)]" />
          <p className="text-sm text-[color:var(--muted-foreground)]">No manufacturing data available</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">Generate an aligner plan first to view manufacturing readiness.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
          Loading manufacturing data…
        </div>
      )}
    </div>
  );
}
