"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { validateApproval, type ApprovalValidation } from "@/lib/api/tooth-movement";

interface Props {
  caseId: string;
  planId: string;
  /** Called with canApprove whenever validation completes — lets parent gate the approve button */
  onValidation?: (result: ApprovalValidation) => void;
}

export function ApprovalValidationPanel({ caseId, planId, onValidation }: Props) {
  const [data, setData] = useState<ApprovalValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    validateApproval(caseId, planId)
      .then((result) => {
        setData(result);
        onValidation?.(result);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [caseId, planId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ios-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[color:var(--primary)]" />
          <h4 className="text-sm font-bold text-[color:var(--foreground)]">Approval Validation</h4>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 text-xs font-semibold text-[color:var(--primary)] disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Re-check
        </button>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {data !== null && (
        <>
          {/* Status banner */}
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            data.canApprove
              ? "border-emerald-300/50 bg-emerald-50/60 dark:border-emerald-700/40 dark:bg-emerald-900/10"
              : "border-rose-300/50 bg-rose-50/60 dark:border-rose-700/40 dark:bg-rose-900/10"
          }`}>
            {data.canApprove
              ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              : <Lock size={18} className="text-rose-600 shrink-0" />
            }
            <div className="flex-1">
              <p className={`text-sm font-bold ${data.canApprove ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                {data.canApprove ? "Ready for Approval" : "Approval Blocked"}
              </p>
              <p className="text-xs text-[color:var(--muted-foreground)]">{data.summary}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black tabular-nums text-[color:var(--foreground)]">{data.score}</p>
              <p className="text-[10px] text-[color:var(--muted-foreground)]">/ 100</p>
            </div>
          </div>

          {/* Blockers */}
          {data.blockers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-rose-600">Blockers</p>
              {data.blockers.map((b, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-rose-300/50 bg-rose-500/5 px-3 py-2">
                  <XCircle size={13} className="text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">{b.code.replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-[color:var(--foreground)]">{b.description}</p>
                    {b.affectedTeeth && b.affectedTeeth.length > 0 && (
                      <p className="text-[10px] text-[color:var(--muted-foreground)] mt-0.5">
                        Affected FDI: {b.affectedTeeth.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Warnings</p>
              {data.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-500/5 px-3 py-2">
                  <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{w.code.replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-[color:var(--foreground)]">{w.description}</p>
                    {w.affectedTeeth && w.affectedTeeth.length > 0 && (
                      <p className="text-[10px] text-[color:var(--muted-foreground)] mt-0.5">
                        Affected FDI: {w.affectedTeeth.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.blockers.length === 0 && data.warnings.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-50/60 px-3 py-2 dark:border-emerald-700/40 dark:bg-emerald-900/10">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">All validation checks passed</p>
            </div>
          )}
        </>
      )}

      {loading && !data && (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
        </div>
      )}
    </div>
  );
}
