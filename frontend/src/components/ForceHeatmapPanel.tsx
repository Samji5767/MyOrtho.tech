"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { getForceHeatmap, type ToothForceData } from "@/lib/api/tooth-movement";

interface Props {
  caseId: string;
  planId: string;
  /** Called with per-FDI hex color strings (green → yellow → red by normalizedForce) */
  onHeatmapColors?: (colors: Map<number, string>) => void;
}

const MOBILITY_CONFIG = {
  none:     { label: "None",     bar: "bg-emerald-500" },
  low:      { label: "Low",      bar: "bg-lime-500" },
  moderate: { label: "Moderate", bar: "bg-amber-500" },
  high:     { label: "High",     bar: "bg-rose-500" },
} as const;

function normalizedToHex(n: number): string {
  // green(0) → yellow(0.5) → red(1)
  const r = Math.round(Math.min(255, n < 0.5 ? n * 2 * 255 : 255));
  const g = Math.round(Math.min(255, n < 0.5 ? 255 : (1 - n) * 2 * 255));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}00`;
}

export function ForceHeatmapPanel({ caseId, planId, onHeatmapColors }: Props) {
  const [teeth, setTeeth] = useState<ToothForceData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arch, setArch] = useState<"upper" | "lower" | "all">("all");

  const load = () => {
    setLoading(true);
    setError(null);
    getForceHeatmap(caseId, planId)
      .then(({ teeth: t }) => {
        setTeeth(t);
        if (onHeatmapColors) {
          const colors = new Map<number, string>();
          t.forEach((tooth) => colors.set(tooth.fdi, normalizedToHex(tooth.normalizedForce)));
          onHeatmapColors(colors);
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [caseId, planId]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = teeth?.filter((t) => arch === "all" || t.arch === arch) ?? [];
  const maxForce = Math.max(...(teeth?.map((t) => t.forceGrams) ?? [1]));

  return (
    <div className="ios-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[color:var(--primary)]" />
          <h4 className="text-sm font-bold text-[color:var(--foreground)]">Force Heatmap</h4>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[color:var(--border)] overflow-hidden text-[11px]">
            {(["all", "upper", "lower"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setArch(a)}
                className={`px-2 py-1 font-semibold capitalize transition-colors ${arch === a ? "bg-[color:var(--primary)] text-white" : "bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
              >
                {a}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 text-xs font-semibold text-[color:var(--primary)] disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {teeth !== null && teeth.length === 0 && (
        <p className="text-xs text-[color:var(--muted-foreground)]">No movement prescriptions — run simulation first.</p>
      )}

      {displayed.length > 0 && (
        <div className="space-y-1.5">
          {displayed
            .sort((a, b) => b.forceGrams - a.forceGrams)
            .map((tooth) => {
              const pct = maxForce > 0 ? (tooth.forceGrams / maxForce) * 100 : 0;
              const cfg = MOBILITY_CONFIG[tooth.mobilityRisk];
              return (
                <div key={tooth.fdi} className="flex items-center gap-2.5">
                  <span className="w-12 shrink-0 text-[11px] font-bold text-[color:var(--foreground)] tabular-nums">
                    FDI {tooth.fdi}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-[color:var(--border)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cfg.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-[11px] tabular-nums text-[color:var(--muted-foreground)] text-right">
                    {tooth.forceGrams.toFixed(0)} g
                  </span>
                  <span className={`w-16 shrink-0 text-[10px] font-semibold text-right ${
                    tooth.mobilityRisk === "high"     ? "text-rose-600"   :
                    tooth.mobilityRisk === "moderate" ? "text-amber-600"  :
                    tooth.mobilityRisk === "low"      ? "text-lime-600"   :
                    "text-emerald-600"
                  }`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {loading && !teeth && (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
        </div>
      )}

      {/* Legend */}
      {teeth && teeth.length > 0 && (
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[10px] text-[color:var(--muted-foreground)]">Force:</span>
          <div className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(to right, #00ff00, #ffff00, #ff0000)" }} />
          <span className="text-[10px] text-[color:var(--muted-foreground)]">Low → High</span>
        </div>
      )}
    </div>
  );
}
