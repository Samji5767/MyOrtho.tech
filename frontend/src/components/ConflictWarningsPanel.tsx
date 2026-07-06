"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, AlertOctagon, Info, RefreshCw, CheckCircle2 } from "lucide-react";
import { getMovementConflicts, type MovementConflict } from "@/lib/api/tooth-movement";

interface Props {
  caseId: string;
  planId: string;
}

const SEVERITY_CONFIG = {
  advisory: { label: "Advisory", color: "text-sky-600",    bg: "bg-sky-500/10    border-sky-300/50    dark:border-sky-700/40",    Icon: Info },
  warning:  { label: "Warning",  color: "text-amber-600",  bg: "bg-amber-500/10  border-amber-300/50  dark:border-amber-700/40",  Icon: AlertTriangle },
  critical: { label: "Critical", color: "text-rose-600",   bg: "bg-rose-500/10   border-rose-300/50   dark:border-rose-700/40",   Icon: AlertOctagon },
} as const;

const TYPE_LABELS: Record<MovementConflict["type"], string> = {
  intra_tooth: "Intra-Tooth",
  inter_arch:  "Inter-Arch",
  anchorage:   "Anchorage",
  staging:     "Staging",
};

export function ConflictWarningsPanel({ caseId, planId }: Props) {
  const [conflicts, setConflicts] = useState<MovementConflict[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getMovementConflicts(caseId, planId)
      .then(({ conflicts: c }) => setConflicts(c))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [caseId, planId]); // eslint-disable-line react-hooks/exhaustive-deps

  const critical = conflicts?.filter((c) => c.severity === "critical").length ?? 0;
  const warning  = conflicts?.filter((c) => c.severity === "warning").length ?? 0;

  return (
    <div className="ios-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-[color:var(--foreground)]">Movement Conflicts</h4>
          {conflicts !== null && (
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              {critical > 0 && <span className="text-rose-600 font-semibold">{critical} critical</span>}
              {critical > 0 && warning > 0 && " · "}
              {warning > 0 && <span className="text-amber-600 font-semibold">{warning} warning</span>}
              {critical === 0 && warning === 0 && conflicts.length === 0 && "No conflicts"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 text-xs font-semibold text-[color:var(--primary)] disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {conflicts !== null && conflicts.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-50/60 px-3 py-2 dark:border-emerald-700/40 dark:bg-emerald-900/10">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">No movement conflicts detected</p>
        </div>
      )}

      {conflicts && conflicts.length > 0 && (
        <div className="space-y-2">
          {conflicts
            .sort((a, b) => {
              const order = { critical: 0, warning: 1, advisory: 2 };
              return order[a.severity] - order[b.severity];
            })
            .map((c, i) => {
              const cfg = SEVERITY_CONFIG[c.severity];
              const teeth = c.fdi
                ? `FDI ${c.fdi}`
                : c.fdiA && c.fdiB
                ? `FDI ${c.fdiA}–${c.fdiB}`
                : null;
              return (
                <div key={i} className={`rounded-lg border px-3 py-2.5 ${cfg.bg}`}>
                  <div className="flex items-start gap-2">
                    <cfg.Icon size={13} className={`${cfg.color} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-[11px] text-[color:var(--muted-foreground)]">{TYPE_LABELS[c.type]}</span>
                        {teeth && <span className="text-[11px] font-semibold text-[color:var(--foreground)]">{teeth}</span>}
                      </div>
                      <p className="text-xs text-[color:var(--foreground)] leading-snug">{c.description}</p>
                      <p className="mt-1 text-[11px] italic text-[color:var(--muted-foreground)]">{c.suggestion}</p>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {loading && !conflicts && (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
        </div>
      )}
    </div>
  );
}
