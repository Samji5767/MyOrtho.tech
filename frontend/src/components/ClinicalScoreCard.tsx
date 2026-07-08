"use client";

import { AlertTriangle, CheckCircle2, Info, TrendingUp } from "lucide-react";
import { Card } from "./DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScoreLevel = "excellent" | "good" | "fair" | "poor" | "critical";

export interface ClinicalScoreCardProps {
  label: string;
  value: number;
  maxValue?: number;
  unit?: string;
  level?: ScoreLevel;
  description?: string;
  sublabel?: string;
  compact?: boolean;
  /** Invert the color mapping — higher is worse (e.g. risk scores) */
  invertColors?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLevel(value: number, max: number, invert: boolean): ScoreLevel {
  const pct = (value / max) * 100;
  if (invert) {
    if (pct <= 10) return "excellent";
    if (pct <= 25) return "good";
    if (pct <= 50) return "fair";
    if (pct <= 75) return "poor";
    return "critical";
  }
  if (pct >= 90) return "excellent";
  if (pct >= 75) return "good";
  if (pct >= 55) return "fair";
  if (pct >= 30) return "poor";
  return "critical";
}

const LEVEL_STYLES: Record<ScoreLevel, { bar: string; text: string; bg: string; icon: React.ElementType }> = {
  excellent: {
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    icon: CheckCircle2,
  },
  good: {
    bar: "bg-teal-500",
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-500/10",
    icon: TrendingUp,
  },
  fair: {
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    icon: Info,
  },
  poor: {
    bar: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    icon: AlertTriangle,
  },
  critical: {
    bar: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    icon: AlertTriangle,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ClinicalScoreCard({
  label,
  value,
  maxValue = 100,
  unit = "",
  level,
  description,
  sublabel,
  compact = false,
  invertColors = false,
}: ClinicalScoreCardProps) {
  const resolvedLevel = level ?? getLevel(value, maxValue, invertColors);
  const styles = LEVEL_STYLES[resolvedLevel];
  const pct = Math.min(100, Math.round((value / maxValue) * 100));
  const Icon = styles.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${styles.bg}`}
          aria-hidden
        >
          <Icon className={`h-4 w-4 ${styles.text}`} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-xs font-medium text-[color:var(--foreground)]">
              {label}
            </span>
            <span
              className={`text-xs font-bold tabular-nums ${styles.text}`}
              aria-live="polite"
            >
              {value}{unit}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label}: ${pct}%`}
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color:var(--border)]/40"
          >
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${styles.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4" aria-label={`${label}: ${value}${unit}`}>
      <div className="flex items-start justify-between gap-2">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${styles.bg}`}
          aria-hidden
        >
          <Icon className={`h-4 w-4 ${styles.text}`} aria-hidden />
        </div>
        <div className="text-right">
          <p
            className={`text-2xl font-bold tabular-nums leading-none ${styles.text}`}
            aria-live="polite"
          >
            {value}<span className="text-sm font-medium">{unit}</span>
          </p>
          {sublabel && (
            <p className="mt-0.5 text-[10px] text-[color:var(--muted-foreground)]">{sublabel}</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-[color:var(--foreground)]">{label}</p>
        {description && (
          <p className="mt-0.5 text-[10px] text-[color:var(--muted-foreground)] leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} progress: ${pct}%`}
        className="h-1.5 overflow-hidden rounded-full bg-[color:var(--border)]/40"
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${styles.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  );
}

// ─── Grade Badge ──────────────────────────────────────────────────────────────

export function GradeBadge({ grade }: { grade: string }) {
  const GRADE_STYLES: Record<string, string> = {
    A: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    B: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    C: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    D: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    F: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  };
  const cls = GRADE_STYLES[grade] ?? "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold ${cls}`}>
      {grade}
    </span>
  );
}
