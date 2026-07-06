"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldOff, RefreshCw } from "lucide-react";
import { getRootSafety, type RootSafetyResult } from "@/lib/api/tooth-movement";

interface Props {
  caseId: string;
  planId: string;
}

const RISK_CONFIG = {
  safe:     { label: "Safe",     color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-300/50 dark:border-emerald-700/40", Icon: ShieldCheck },
  caution:  { label: "Caution",  color: "text-amber-600",   bg: "bg-amber-500/10   border-amber-300/50   dark:border-amber-700/40",   Icon: ShieldAlert },
  critical: { label: "Critical", color: "text-rose-600",    bg: "bg-rose-500/10    border-rose-300/50    dark:border-rose-700/40",    Icon: ShieldOff },
} as const;

export function RootSafetyPanel({ caseId, planId }: Props) {
  const [results, setResults] = useState<RootSafetyResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getRootSafety(caseId, planId)
      .then(({ results: r }) => setResults(r))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [caseId, planId]); // eslint-disable-line react-hooks/exhaustive-deps

  const critical = results?.filter((r) => r.corticalRisk === "critical") ?? [];
  const caution  = results?.filter((r) => r.corticalRisk === "caution")  ?? [];
  const safe     = results?.filter((r) => r.corticalRisk === "safe")     ?? [];

  return (
    <div className="ios-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-[color:var(--foreground)]">Root Safety Analysis</h4>
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

      {results !== null && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(["safe", "caution", "critical"] as const).map((risk) => {
              const cfg = RISK_CONFIG[risk];
              const count = risk === "safe" ? safe.length : risk === "caution" ? caution.length : critical.length;
              return (
                <div key={risk} className={`rounded-lg border p-2 text-center ${cfg.bg}`}>
                  <cfg.Icon size={14} className={`mx-auto mb-1 ${cfg.color}`} />
                  <p className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</p>
                  <p className={`text-lg font-black tabular-nums ${cfg.color}`}>{count}</p>
                </div>
              );
            })}
          </div>

          {results.filter((r) => r.corticalRisk !== "safe").length === 0 && (
            <p className="text-xs text-[color:var(--muted-foreground)]">All root movements within safe cortical limits.</p>
          )}

          <div className="space-y-2">
            {results
              .filter((r) => r.corticalRisk !== "safe")
              .sort((a, b) => (b.corticalRisk === "critical" ? 1 : 0) - (a.corticalRisk === "critical" ? 1 : 0))
              .map((r) => {
                const cfg = RISK_CONFIG[r.corticalRisk];
                return (
                  <div key={r.fdi} className={`rounded-lg border px-3 py-2 ${cfg.bg}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <cfg.Icon size={13} className={cfg.color} />
                      <span className={`text-xs font-bold ${cfg.color}`}>FDI {r.fdi} — {cfg.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-[color:var(--muted-foreground)] mb-1">
                      <span>Apical disp: <strong className="text-[color:var(--foreground)]">{r.estimatedApicalDisplacementMm.toFixed(2)} mm</strong></span>
                      <span>Angular: <strong className="text-[color:var(--foreground)]">{r.totalAngularMovementDeg.toFixed(1)}°</strong></span>
                      <span>Root mov: <strong className="text-[color:var(--foreground)]">{r.rootMovementMm.toFixed(2)} mm</strong></span>
                    </div>
                    {r.riskFactors.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {r.riskFactors.map((f, i) => (
                          <li key={i} className={`text-[11px] ${cfg.color}`}>· {f}</li>
                        ))}
                      </ul>
                    )}
                    {r.recommendation && (
                      <p className="mt-1 text-[11px] italic text-[color:var(--muted-foreground)]">{r.recommendation}</p>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}

      {loading && !results && (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
        </div>
      )}
    </div>
  );
}
