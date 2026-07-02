"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, Info, RefreshCw } from "lucide-react";
import { Button, Card } from "@/components/DesignSystem";
import {
  getLatestAnalysis,
  type CaseAnalysis,
  type IprEntry,
} from "@/lib/api/analysis";

// ─── Bolton thresholds (Bolton 1958 / 1962 published norms) ─────────────────
const BOLTON_OVERALL  = { mean: 91.3, sd: 1.91, low: 88.0, high: 94.5 };
const BOLTON_ANTERIOR = { mean: 77.2, sd: 1.65, low: 74.0, high: 80.5 };

// ─── Badge ────────────────────────────────────────────────────────────────────
type BadgeColor = "green" | "yellow" | "orange" | "red";

function Badge({ label, color }: { label: string; color: BadgeColor }) {
  const cls: Record<BadgeColor, string> = {
    green:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    yellow: "bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    red:    "bg-rose-100   text-rose-700   dark:bg-rose-900/30   dark:text-rose-400",
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls[color]}`}
    >
      {label}
    </span>
  );
}

// ─── Helpers: Bolton ──────────────────────────────────────────────────────────
function boltonColor(value: number, low: number, high: number): BadgeColor {
  return value < low || value > high ? "yellow" : "green";
}
function boltonLabel(value: number, low: number, high: number): string {
  if (value < low)  return "Mandibular excess";
  if (value > high) return "Maxillary excess";
  return "Within norm";
}

function BoltonRow({
  label,
  value,
  norm,
}: {
  label: string;
  value: number | null;
  norm: { mean: number; sd: number; low: number; high: number };
}) {
  return (
    <div className="py-2 space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-secondary">{label}</span>
        {value !== null ? (
          <div className="flex items-center gap-2">
            <span className="tabular-nums font-semibold text-foreground">{value.toFixed(1)}%</span>
            <Badge
              label={boltonLabel(value, norm.low, norm.high)}
              color={boltonColor(value, norm.low, norm.high)}
            />
          </div>
        ) : (
          <span className="italic text-secondary text-[11px]">Not measured</span>
        )}
      </div>
      <p className="text-[10px] text-secondary pl-0.5">
        Norm {norm.mean}% ± {norm.sd} SD &nbsp;·&nbsp; range {norm.low}–{norm.high}%
      </p>
    </div>
  );
}

// ─── Helpers: Overjet ─────────────────────────────────────────────────────────
function overjetInfo(v: number | null): { color: BadgeColor; label: string } {
  if (v === null) return { color: "green",  label: "—" };
  if (v < 0)      return { color: "red",    label: "Underbite" };
  if (v <= 3)     return { color: "green",  label: "Normal" };
  if (v <= 6)     return { color: "yellow", label: "Increased" };
  return            { color: "red",    label: "Severe" };
}

// ─── Helpers: Overbite ────────────────────────────────────────────────────────
function overbiteInfo(v: number | null): { color: BadgeColor; label: string } {
  if (v === null) return { color: "green",  label: "—" };
  if (v < 0)      return { color: "red",    label: "Open bite" };
  if (v <= 3)     return { color: "green",  label: "Normal" };
  if (v <= 5)     return { color: "yellow", label: "Deep bite" };
  return            { color: "red",    label: "Severe deep bite" };
}

// ─── Helpers: Angle class ─────────────────────────────────────────────────────
function angleClassColor(cls: string | null): BadgeColor {
  if (!cls)                  return "green";
  if (cls.startsWith("Class III")) return "red";
  if (cls.startsWith("Class II"))  return "orange";
  return "green"; // Class I
}

// ─── Helpers: Crowding (positive = spacing, negative = crowding) ──────────────
function crowdingInfo(mm: number | null): { color: BadgeColor; label: string } {
  if (mm === null) return { color: "green",  label: "—" };
  if (mm > 0)      return { color: "green",  label: "Spacing" };
  if (mm >= -4)    return { color: "yellow", label: "Mild crowding" };
  if (mm >= -8)    return { color: "orange", label: "Moderate crowding" };
  return             { color: "red",    label: "Severe crowding" };
}

// ─── Generic metric row ───────────────────────────────────────────────────────
function MetricRow({
  label,
  value,
  unit,
  color,
  status,
}: {
  label: string;
  value: number | null;
  unit?: string;
  color: BadgeColor;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-xs">
      <span className="shrink-0 text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        {value !== null ? (
          <span className="tabular-nums font-semibold text-foreground">
            {value.toFixed(1)}{unit}
          </span>
        ) : (
          <span className="italic text-secondary text-[11px]">—</span>
        )}
        <Badge label={status} color={color} />
      </div>
    </div>
  );
}

// ─── Complexity bar (0–10 scale) ──────────────────────────────────────────────
function ComplexityBar({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs italic text-secondary">Not scored</span>;
  }
  const pct   = Math.min(100, Math.max(0, (score / 10) * 100));
  const label = score === 0 ? "Simple" : score <= 3 ? "Moderate" : score <= 6 ? "Complex" : "Severe";
  const bar   =
    score === 0  ? "bg-emerald-500" :
    score <= 3   ? "bg-amber-400"   :
    score <= 6   ? "bg-orange-500"  :
                   "bg-rose-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="tabular-nums text-secondary">{score}/10</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-3 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
      <div className="divide-y divide-border/60">{children}</div>
    </Card>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function ClinicalAnalysisPanel({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [data,    setData]    = useState<CaseAnalysis | null>(null);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getLatestAnalysis(caseId);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load analysis");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { loadAnalysis(); }, [loadAnalysis]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <Skeleton />;

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Could not load analysis</p>
          <p className="mt-0.5 text-xs opacity-80">{error}</p>
          <button
            onClick={loadAnalysis}
            className="mt-2 text-xs underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-slate-50/60 px-6 py-12 text-center dark:bg-slate-900/40">
        <Info size={28} className="text-slate-400" />
        <p className="text-sm font-medium text-secondary">No analysis on file</p>
        <p className="max-w-xs text-xs text-secondary">
          Run a clinical analysis to see Bolton ratios, occlusal measurements, arch space
          evaluation, and IPR planning.
        </p>
        <Button variant="secondary" size="sm" onClick={loadAnalysis}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const iprEntries = data.iprSchedule ?? [];
  const iprTotal   = iprEntries.reduce((sum, e) => sum + e.amountMm, 0);
  const oj         = overjetInfo(data.overjetMm);
  const ob         = overbiteInfo(data.overbiteM);
  const upper      = crowdingInfo(data.upperCrowdingMm);
  const lower      = crowdingInfo(data.lowerCrowdingMm);

  return (
    <div className="space-y-4">

      {/* Section 1 — Bolton Analysis */}
      <Section title="Bolton Analysis">
        <BoltonRow
          label="Overall ratio (12:12)"
          value={data.boltonOverall}
          norm={BOLTON_OVERALL}
        />
        <BoltonRow
          label="Anterior ratio (6:6)"
          value={data.boltonAnterior}
          norm={BOLTON_ANTERIOR}
        />
      </Section>

      {/* Section 2 — Occlusion */}
      <Section title="Occlusion">
        <div className="flex items-center justify-between gap-3 py-2 text-xs">
          <span className="shrink-0 text-secondary">Angle classification</span>
          <Badge
            label={data.angleClass ?? "Not recorded"}
            color={angleClassColor(data.angleClass)}
          />
        </div>
        <MetricRow
          label="Overjet"
          value={data.overjetMm}
          unit=" mm"
          color={oj.color}
          status={oj.label}
        />
        <MetricRow
          label="Overbite"
          value={data.overbiteM}
          unit=" mm"
          color={ob.color}
          status={ob.label}
        />
      </Section>

      {/* Section 3 — Arch Space */}
      <Section title="Arch Space">
        <MetricRow
          label="Upper arch"
          value={data.upperCrowdingMm}
          unit=" mm"
          color={upper.color}
          status={upper.label}
        />
        <MetricRow
          label="Lower arch"
          value={data.lowerCrowdingMm}
          unit=" mm"
          color={lower.color}
          status={lower.label}
        />
        <div className="pt-3 pb-1">
          <p className="mb-2 text-[11px] font-medium text-secondary">Case complexity</p>
          <ComplexityBar score={data.complexityScore} />
        </div>
      </Section>

      {/* Section 4 — IPR Schedule (only if entries exist) */}
      {iprEntries.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">IPR Schedule</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-wide text-secondary">Stage</th>
                <th className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-wide text-secondary">Teeth</th>
                <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-wide text-secondary">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {iprEntries.map((entry: IprEntry, i: number) => (
                <tr key={i}>
                  <td className="py-1.5 pr-4 tabular-nums text-foreground">{entry.stage}</td>
                  <td className="py-1.5 pr-4 font-mono text-foreground">{entry.toothA} – {entry.toothB}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">{entry.amountMm.toFixed(2)} mm</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td colSpan={2} className="pt-2 text-secondary text-[11px]">Total IPR</td>
                <td className="pt-2 text-right tabular-nums text-foreground">{iprTotal.toFixed(2)} mm</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {/* Refresh */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-secondary">
          Bolton norms: Overall 91.3% ± 1.91 SD, Anterior 77.2% ± 1.65 SD.
          Source: Bolton 1958, 1962. Reference only — requires clinician sign-off.
        </p>
        <Button variant="secondary" size="sm" onClick={loadAnalysis} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

    </div>
  );
}
