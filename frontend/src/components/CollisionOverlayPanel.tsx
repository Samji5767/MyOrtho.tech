"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, AlertOctagon, CheckCircle2, RefreshCw } from "lucide-react";
import { getEnhancedCollisions, type EnhancedCollisionPair } from "@/lib/api/tooth-movement";

interface Props {
  caseId: string;
  planId: string;
  /** Called whenever the set of colliding FDIs changes — for 3D overlay */
  onCollisionFdis?: (fdis: Set<number>) => void;
}

const SEVERITY_CONFIG = {
  contact_risk:       { label: "Contact Risk",      color: "text-amber-600",  bg: "bg-amber-500/10  border-amber-300/50",  Icon: AlertTriangle },
  mild_overlap:       { label: "Mild Overlap",      color: "text-orange-600", bg: "bg-orange-500/10 border-orange-300/50", Icon: AlertTriangle },
  significant_overlap:{ label: "Significant",       color: "text-rose-600",   bg: "bg-rose-500/10   border-rose-300/50",   Icon: AlertOctagon },
} as const;

export function CollisionOverlayPanel({ caseId, planId, onCollisionFdis }: Props) {
  const [pairs, setPairs] = useState<EnhancedCollisionPair[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getEnhancedCollisions(caseId, planId)
      .then(({ pairs: p }) => {
        setPairs(p);
        if (onCollisionFdis) {
          const fdis = new Set<number>();
          p.forEach((pair) => { fdis.add(pair.fdiA); fdis.add(pair.fdiB); });
          onCollisionFdis(fdis);
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [caseId, planId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ios-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-[color:var(--foreground)]">Collision Analysis</h4>
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

      {error && (
        <p className="text-xs text-rose-600">{error}</p>
      )}

      {!error && pairs !== null && pairs.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-50/60 px-3 py-2 dark:border-emerald-700/40 dark:bg-emerald-900/10">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">No inter-tooth collisions detected</p>
        </div>
      )}

      {pairs && pairs.length > 0 && (
        <div className="space-y-2">
          {pairs.map((pair, i) => {
            const cfg = SEVERITY_CONFIG[pair.severity];
            return (
              <div
                key={i}
                className={`rounded-lg border px-3 py-2 ${cfg.bg}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <cfg.Icon size={13} className={cfg.color} />
                  <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                  <span className="ml-auto text-xs font-black tabular-nums text-[color:var(--foreground)]">
                    FDI {pair.fdiA}–{pair.fdiB}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                  <span>Convergence: <strong className="text-[color:var(--foreground)]">{pair.rawConvergenceMm.toFixed(2)} mm</strong></span>
                  <span>Overlap: <strong className="text-[color:var(--foreground)]">{pair.totalEstimatedOverlapMm.toFixed(2)} mm</strong></span>
                  <span>Rotation contrib: <strong className="text-[color:var(--foreground)]">{pair.rotationContributionMm.toFixed(2)} mm</strong></span>
                  <span>Clearance needed: <strong className="text-[color:var(--foreground)]">{pair.clearanceThresholdMm.toFixed(2)} mm</strong></span>
                </div>
                <p className="mt-1.5 text-[11px] italic text-[color:var(--muted-foreground)]">{pair.recommendation}</p>
              </div>
            );
          })}
        </div>
      )}

      {loading && !pairs && (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
        </div>
      )}
    </div>
  );
}
