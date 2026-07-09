"use client";

import React from "react";

type Variant = "success" | "warning" | "error" | "info" | "neutral" | "processing";

interface StatusBadgeProps {
  status: string;
  variant?: Variant;
  className?: string;
}

const STATUS_MAP: Record<string, Variant> = {
  active:     "success",
  activated:  "success",
  complete:   "success",
  completed:  "success",
  approved:   "success",
  done:       "success",
  pending:    "warning",
  review:     "warning",
  "in-review": "warning",
  "in review": "warning",
  processing: "processing",
  "in-progress": "processing",
  "in progress": "processing",
  running:    "processing",
  manufacturing: "processing",
  error:      "error",
  failed:     "error",
  rejected:   "error",
  cancelled:  "error",
  canceled:   "error",
  archived:   "neutral",
  inactive:   "neutral",
  draft:      "neutral",
  paused:     "neutral",
  info:       "info",
};

const VARIANT_STYLES: Record<Variant, string> = {
  success:    "bg-emerald-500/10 text-emerald-700 border-emerald-300/60 dark:text-emerald-400 dark:border-emerald-700/40",
  warning:    "bg-amber-500/10  text-amber-700  border-amber-300/60  dark:text-amber-400  dark:border-amber-700/40",
  error:      "bg-red-500/10    text-red-700    border-red-300/60    dark:text-red-400    dark:border-red-700/40",
  info:       "bg-blue-500/10   text-blue-700   border-blue-300/60   dark:text-blue-400   dark:border-blue-700/40",
  neutral:    "bg-[color:var(--clinical-neutral-tint)] text-[color:var(--muted-foreground)] border-border",
  processing: "bg-[color:var(--primary-glow)]    text-primary border-[color:var(--primary)]/30",
};

function resolveVariant(status: string, override?: Variant): Variant {
  if (override) return override;
  const key = status.toLowerCase().trim();
  return STATUS_MAP[key] ?? "neutral";
}

/** Dot indicator for 'processing' variant — animated pulse */
function ProcessingDot() {
  return (
    <span
      className="dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-primary"
      aria-hidden="true"
    />
  );
}

export function StatusBadge({ status, variant, className = "" }: StatusBadgeProps) {
  const resolved = resolveVariant(status, variant);
  const styles = VARIANT_STYLES[resolved];

  // Capitalise first letter for display
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold leading-none tracking-wide ${styles} ${className}`}
    >
      {resolved === "processing" && <ProcessingDot />}
      {label}
    </span>
  );
}

export default StatusBadge;
