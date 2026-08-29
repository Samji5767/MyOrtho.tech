"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import {
  STRATEGY_LABELS,
  approveGenerationPlan,
  generatePlan,
  generateStageStls,
  getGenerationPlan,
  getQualityReport,
  stlExportUrl,
  type AlignerGenerationPlan,
  type StageQualityReport,
  type StagingStrategy,
} from "@/lib/api/alignerGeneration";

/**
 * Drives the aligner-generation workflow for a treatment plan:
 *   1. Generate the stage allocation plan (Kravitz per-stage limits)
 *   2. Review the quality report and manufacturing-readiness checks
 *   3. Generate the per-stage meshes (AI engine, requires segmentation)
 *   4. Approve for manufacturing (approval authority required)
 * Downstream, the manufacturing export panel packages the results.
 */
export function AlignerGenerationPanel({ caseId, planId }: { caseId: string; planId: string }) {
  const [plan, setPlan] = useState<AlignerGenerationPlan | null>(null);
  const [report, setReport] = useState<StageQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [strategy, setStrategy] = useState<StagingStrategy>("balanced");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const p = await getGenerationPlan(caseId, planId);
      setPlan(p);
      setReport(await getQualityReport(caseId, planId).catch(() => null));
    } catch {
      setPlan(null); // 404 = not generated yet — a valid starting state
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  useEffect(() => { load(); }, [load]);

  const run = async (label: string, fn: () => Promise<AlignerGenerationPlan>) => {
    setBusy(label); setError("");
    try {
      setPlan(await fn());
      setReport(await getQualityReport(caseId, planId).catch(() => null));
    } catch (e: any) {
      setError(e.message ?? `${label} failed`);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] py-10">
        <Loader2 size={18} className="animate-spin text-[color:var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[color:var(--primary)]" />
          <h3 className="text-sm font-bold text-[color:var(--foreground)]">Aligner generation</h3>
          {plan && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              plan.status === "approved" || plan.status === "manufacturing"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-blue-500/10 text-blue-600"
            }`}>
              {plan.status}
            </span>
          )}
        </div>
        <button
          type="button" onClick={load} disabled={!!busy} aria-label="Refresh"
          className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-50"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Step 1 — generate the allocation plan */}
      {!plan ? (
        <div className="space-y-2">
          <p className="text-xs text-[color:var(--muted-foreground)]">
            No generation plan yet. Staging divides the plan&apos;s movement prescriptions into
            per-stage allocations within clinical per-stage limits.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value as StagingStrategy)}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
            >
              {(Object.entries(STRATEGY_LABELS) as [StagingStrategy, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => run("generate", () => generatePlan(caseId, planId, { stagingStrategy: strategy }))}
              disabled={!!busy}
              className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy === "generate" ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              Generate plan
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Plan summary */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            {[
              ["Active stages", plan.totalActiveStages],
              ["Retention", plan.retentionStageCount],
              ["Change interval", `${plan.alignerChangeWeeks} wk`],
              ["Est. duration", plan.estimatedTotalWeeks != null ? `${plan.estimatedTotalWeeks} wk` : "—"],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <p className="text-[color:var(--muted-foreground)]">{k}</p>
                <p className="font-bold tabular-nums text-[color:var(--foreground)]">{v}</p>
              </div>
            ))}
          </div>

          {/* Step 2 — quality report */}
          {report && (
            <div className="rounded-lg bg-[color:var(--background)] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">Quality report</p>
                <span className={`text-sm font-black tabular-nums ${report.overallQualityScore >= 80 ? "text-emerald-600" : report.overallQualityScore >= 60 ? "text-amber-500" : "text-rose-500"}`}>
                  {report.overallQualityScore}/100
                </span>
              </div>
              {report.manufacturingReadiness.map(c => (
                <div key={c.name} className="flex items-start gap-1.5 text-[11px]">
                  {c.passed
                    ? <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-emerald-500" />
                    : <X size={11} className="mt-0.5 shrink-0 text-rose-500" />}
                  <span className="text-[color:var(--foreground)]">
                    <span className="font-semibold">{c.name}:</span>{" "}
                    <span className="text-[color:var(--muted-foreground)]">{c.details}</span>
                  </span>
                </div>
              ))}
              {report.issues.length > 0 && (
                <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                  <AlertTriangle size={11} />
                  {report.issues.filter(i => i.severity === "error").length} error(s),{" "}
                  {report.issues.filter(i => i.severity === "warning").length} warning(s) in stage allocations
                </p>
              )}
            </div>
          )}

          {/* Steps 3-4 — meshes, approval, download */}
          <div className="flex items-center gap-2 flex-wrap">
            {!plan.stlExportReady && (
              <button
                type="button"
                onClick={() => run("stl", () => generateStageStls(caseId, planId))}
                disabled={!!busy}
                className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy === "stl" ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}
                {busy === "stl" ? "Generating stage meshes…" : "Generate stage meshes"}
              </button>
            )}
            {plan.stlExportReady && (
              <a
                href={stlExportUrl(caseId, planId)}
                className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs font-semibold text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
              >
                <Download size={12} /> Stage meshes (zip)
              </a>
            )}
            {plan.status === "draft" && (
              <button
                type="button"
                onClick={() => run("approve", () => approveGenerationPlan(caseId, planId))}
                disabled={!!busy}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy === "approve" ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                Approve for manufacturing
              </button>
            )}
            {plan.approvedAt && (
              <span className="text-[11px] text-emerald-600">
                Approved {new Date(plan.approvedAt).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-[11px] leading-snug text-[color:var(--muted-foreground)]">
            Stage meshes require a completed AI segmentation with per-tooth meshes for this case.
            Approval requires clinical authority and is blocked while the plan contains scaffold stages.
          </p>
        </>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export default AlignerGenerationPanel;
