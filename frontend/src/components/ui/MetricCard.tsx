"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type DeltaType = "positive" | "negative" | "neutral";

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: DeltaType;
  icon?: React.ReactNode;
  className?: string;
}

const DELTA_STYLES: Record<DeltaType, { text: string; Icon: React.ElementType }> = {
  positive: { text: "text-emerald-600 dark:text-emerald-400", Icon: TrendingUp },
  negative: { text: "text-[color:var(--danger)]",             Icon: TrendingDown },
  neutral:  { text: "text-[color:var(--muted-foreground)]",   Icon: Minus },
};

export function MetricCard({
  label,
  value,
  delta,
  deltaType = "neutral",
  icon,
  className = "",
}: MetricCardProps) {
  const deltaConfig = DELTA_STYLES[deltaType];
  const DeltaIcon = deltaConfig.Icon;

  return (
    <div
      className={`flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-[var(--shadow-sm)] ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[color:var(--muted-foreground)] uppercase tracking-wider leading-none">
          {label}
        </span>
        {icon && (
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[color:var(--primary-glow)] text-primary">
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold tabular-nums text-foreground leading-none">
          {value}
        </span>
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${deltaConfig.text}`}
          >
            <DeltaIcon size={12} strokeWidth={2} />
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
