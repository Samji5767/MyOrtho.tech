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
  Package,
  Printer,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  getAlignerGenerationPlan,
  getQualityReport,
  type AlignerGenerationPlan,
  type QualityReport,
} from "@/lib/api/aligner-generation";
import { listExportPackages, type ExportPackage } from "@/lib/api/export-package";
import {
  getManufacturingReadiness,
  type ManufacturingReadiness,
  type PrintabilityScoreFactor,
} from "@/lib/api/manufacturingPrep";

// ─── Constants ────────────────────────────────────────────────────────────────

// Print failure risk thresholds (based on print farm operational data)
// Values below these printability sub-scores indicate elevated failure risk
const FAILURE_RISK_THRESHOLDS = {
  meshIntegrity: 75,   // non-watertight mesh causes resin voids
  printability:  70,   // thin walls / overhangs cause print failures
  complexity:    60,   // high complexity increases support removal damage
} as const;

const PRINTER_MODELS = [
  { brand: "Formlabs",  model: "Form 3B+",  resolution: "25 µm" },
  { brand: "Formlabs",  model: "Form 3BL",  resolution: "25 µm" },
  { brand: "SprintRay", model: "Pro 55 S",  resolution: "50 µm" },
  { brand: "SprintRay", model: "Pro 95 H",  resolution: "50 µm" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(n: number): string {
  if (n >= 80) return "var(--clinical-safe)";
  if (n >= 60) return "var(--clinical-warn)";
  return "var(--clinical-danger)";
}

function formatPrintTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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

// Simulated vs Validated badge
function DataSourceBadge({ validated }: { validated: boolean }) {
  return validated ? (
    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      Validated
    </span>
  ) : (
    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      Simulated
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  validated = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  validated?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 space-y-1">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-[color:var(--muted-foreground)]" />
          <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">{label}</p>
        </div>
        <DataSourceBadge validated={validated} />
      </div>
      <p className="text-base font-black tabular-nums text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function FactorRow({ factor }: { factor: PrintabilityScoreFactor }) {
  const Icon =
    factor.impact === "positive"
      ? TrendingUp
      : factor.impact === "negative"
      ? TrendingDown
      : Minus;
  const colorCls =
    factor.impact === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : factor.impact === "negative"
      ? "text-rose-600 dark:text-rose-400"
      : "text-[color:var(--muted-foreground)]";

  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon size={12} className={`shrink-0 mt-0.5 ${colorCls}`} />
      <div>
        <span className="font-semibold text-[color:var(--foreground)]">{factor.label}</span>
        {" — "}
        <span className="text-[color:var(--muted-foreground)]">{factor.detail}</span>
      </div>
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
  readiness: ManufacturingReadiness | null;
}

export function ManufacturingReadinessPanel({ caseId, planId }: Props) {
  const [data, setData] = useState<PanelData>({ plan: null, quality: null, packages: [], readiness: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planRes, qualityRes, packagesRes, readinessRes] = await Promise.allSettled([
        getAlignerGenerationPlan(caseId, planId),
        getQualityReport(caseId, planId),
        listExportPackages(caseId, planId),
        getManufacturingReadiness(caseId),
      ]);
      setData({
        plan:      planRes.status      === "fulfilled" ? planRes.value      : null,
        quality:   qualityRes.status   === "fulfilled" ? qualityRes.value   : null,
        packages:  packagesRes.status  === "fulfilled" ? packagesRes.value  : [],
        readiness: readinessRes.status === "fulfilled" ? readinessRes.value : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load manufacturing data");
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  useEffect(() => { void load(); }, [load]);

  const { plan, quality, packages, readiness } = data;
  const stlPackage = packages.find((p) => p.exportType === "aligner_stl");
  const ps = readiness?.printabilityScore;

  // Compatible printers: match backend list against PRINTER_MODELS constant
  const compatibleNames: ReadonlySet<string> = readiness
    ? new Set(readiness.compatiblePrinters)
    : new Set(PRINTER_MODELS.map((p) => `${p.brand} ${p.model}`));
  const compatiblePrinters = PRINTER_MODELS.filter((p) =>
    compatibleNames.has(`${p.brand} ${p.model}`),
  );

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

      {/* Printability Score — from readiness endpoint */}
      {ps && (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">Printability Score</p>
            <span className="text-xl font-black tabular-nums" style={{ color: scoreColor(ps.overall) }}>
              {ps.overall}
              <span className="text-xs font-semibold text-[color:var(--muted-foreground)]">/100</span>
            </span>
          </div>
          <div className="space-y-2.5">
            <ScoreBar label="Mesh Integrity" value={ps.meshIntegrity} />
            <ScoreBar label="Printability"   value={ps.printability}  />
            <ScoreBar label="Complexity"     value={ps.complexity}    />
          </div>
          {ps.factors.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-[color:var(--border)]">
              {ps.factors.map((f, i) => (
                <FactorRow key={i} factor={f} />
              ))}
            </div>
          )}
          <p className="text-xs text-[color:var(--muted-foreground)] italic pt-0.5">{ps.recommendation}</p>
        </div>
      )}

      {/* Print time / resin / cost — from readiness (all Simulated until print validated) */}
      {ps && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard icon={Clock}      label="Print Time"     value={formatPrintTime(ps.estimatedPrintTimeMinutes)} validated={false} />
            <MetricCard icon={Package}    label="Resin Est."     value={`${ps.estimatedResinGrams.toFixed(0)} g`}      validated={false} />
            <MetricCard icon={DollarSign} label="Estimated Cost" value={`$${ps.estimatedCostUsd.toFixed(2)}`}          validated={false} />
          </div>
          <p className="text-[10px] text-[color:var(--muted-foreground)] italic">
            ⚠ Values marked "Simulated" are AI estimates from model geometry and have not been validated against actual print output.
            Values become "Validated" after first physical print QC pass.
          </p>

          {/* Failure Prediction */}
          {(() => {
            const risks: { label: string; risk: "low" | "medium" | "high"; detail: string }[] = [
              {
                label: "Mesh failure (non-watertight)",
                risk: ps.meshIntegrity < FAILURE_RISK_THRESHOLDS.meshIntegrity ? "high" : ps.meshIntegrity < 85 ? "medium" : "low",
                detail: ps.meshIntegrity < FAILURE_RISK_THRESHOLDS.meshIntegrity
                  ? `Mesh integrity ${ps.meshIntegrity}/100 — non-watertight regions will cause resin voids. Mesh repair required before printing.`
                  : "Mesh geometry appears printable. Standard pre-flight validation recommended.",
              },
              {
                label: "Thin-wall / overhang failure",
                risk: ps.printability < FAILURE_RISK_THRESHOLDS.printability ? "high" : ps.printability < 80 ? "medium" : "low",
                detail: ps.printability < FAILURE_RISK_THRESHOLDS.printability
                  ? `Printability score ${ps.printability}/100 — thin walls or unsupported overhangs detected. Review support structure before printing.`
                  : "Geometry is within printable limits for configured printers.",
              },
              {
                label: "Support removal damage",
                risk: ps.complexity < FAILURE_RISK_THRESHOLDS.complexity ? "high" : ps.complexity < 75 ? "medium" : "low",
                detail: ps.complexity < FAILURE_RISK_THRESHOLDS.complexity
                  ? `Complexity score ${ps.complexity}/100 — complex geometry increases support removal damage risk. Manual post-processing review required.`
                  : "Complexity within manageable range for trained post-processing technician.",
              },
            ];
            const highRisk = risks.filter(r => r.risk === "high").length;
            const medRisk = risks.filter(r => r.risk === "medium").length;
            return (
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">Print Failure Prediction</p>
                  <DataSourceBadge validated={false} />
                </div>
                <div className="flex gap-3 text-[10px] mb-1">
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">{highRisk} high risk</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">{medRisk} medium risk</span>
                </div>
                <div className="space-y-1.5">
                  {risks.map((r, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                      r.risk === "high" ? "bg-rose-50/50 dark:bg-rose-900/10" :
                      r.risk === "medium" ? "bg-amber-50/50 dark:bg-amber-900/10" :
                      "bg-emerald-50/30 dark:bg-emerald-900/10"
                    }`}>
                      {r.risk === "high" ? <XCircle size={13} className="shrink-0 mt-0.5 text-rose-500" /> :
                       r.risk === "medium" ? <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-500" /> :
                       <CheckCircle2 size={13} className="shrink-0 mt-0.5 text-emerald-500" />}
                      <div>
                        <p className="font-semibold text-[color:var(--foreground)]">{r.label}</p>
                        <p className="text-[color:var(--muted-foreground)]">{r.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[color:var(--muted-foreground)] italic pt-1">
                  Failure predictions are simulated estimates. Physical print testing is the definitive validation method.
                </p>
              </div>
            );
          })()}
        </>
      )}

      {/* Quality score + manufacturing readiness */}
      {quality && (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">Quality Score</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tabular-nums" style={{ color: scoreColor(quality.overallQualityScore) }}>
                {quality.overallQualityScore}
                <span className="text-xs font-semibold text-[color:var(--muted-foreground)]">/100</span>
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                quality.isManufacturingReady
                  ? "border-emerald-300/50 bg-emerald-50/60 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/10 dark:text-emerald-400"
                  : "border-rose-300/50 bg-rose-50/60 text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/10 dark:text-rose-400"
              }`}>
                {quality.isManufacturingReady ? "Ready" : "Not Ready"}
              </span>
            </div>
          </div>
          <ScoreBar label="Overall Quality" value={quality.overallQualityScore} />
        </div>
      )}

      {/* Manufacturing readiness checklist */}
      {quality && quality.manufacturingReadiness.length > 0 && (() => {
        const passed = quality.manufacturingReadiness.filter((c) => c.passed).length;
        const blocked = quality.manufacturingReadiness.length - passed;
        return (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">Readiness Checks</p>
              <div className="flex items-center gap-1.5">
                {passed > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/50 bg-emerald-50/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/10 dark:text-emerald-400">
                    <CheckCircle2 size={10} /> {passed} ready
                  </span>
                )}
                {blocked > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/50 bg-rose-50/60 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/10 dark:text-rose-400">
                    <XCircle size={10} /> {blocked} blocked
                  </span>
                )}
              </div>
            </div>
            {quality.manufacturingReadiness.map((check, i) => (
              <div
                key={i}
                className={[
                  "flex items-start gap-2 rounded-lg px-3 py-2",
                  check.passed
                    ? "bg-emerald-50/40 dark:bg-emerald-900/10"
                    : "bg-rose-50/40 dark:bg-rose-900/10",
                ].join(" ")}
              >
                {check.passed
                  ? <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                  : <XCircle     size={14} className="shrink-0 mt-0.5 text-rose-500" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-[color:var(--foreground)]">{check.name}</p>
                    {!check.passed && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">Blocked</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">{check.details}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

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

      {/* Compatible Printers */}
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">Compatible Printers</p>
        <div className="space-y-1.5">
          {compatiblePrinters.map((p) => (
            <div key={`${p.brand}-${p.model}`} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />
                <span className="font-semibold text-[color:var(--foreground)]">
                  {p.brand} {p.model}
                </span>
              </div>
              <span className="font-mono text-[color:var(--muted-foreground)]">{p.resolution}</span>
            </div>
          ))}
          {compatiblePrinters.length === 0 && (
            <p className="text-xs text-[color:var(--muted-foreground)]">No compatible printers configured.</p>
          )}
        </div>
      </div>

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
      {!loading && !plan && !quality && !readiness && !error && (
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
