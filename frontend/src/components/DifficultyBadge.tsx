"use client";

import { useEffect, useState } from "react";
import { Zap, AlertTriangle, AlertOctagon, CheckCircle2 } from "lucide-react";
import { getDifficultyScore, type DifficultyScoreBreakdown } from "@/lib/api/tooth-movement";

interface Props {
  caseId: string;
  planId: string;
}

const LEVEL_CONFIG = {
  simple:       { label: "Simple",       color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-300/50 dark:border-emerald-700/40", icon: CheckCircle2 },
  moderate:     { label: "Moderate",     color: "text-amber-600",   bg: "bg-amber-500/10   border-amber-300/50   dark:border-amber-700/40",   icon: Zap },
  complex:      { label: "Complex",      color: "text-orange-600",  bg: "bg-orange-500/10  border-orange-300/50  dark:border-orange-700/40",  icon: AlertTriangle },
  very_complex: { label: "Very Complex", color: "text-rose-600",    bg: "bg-rose-500/10    border-rose-300/50    dark:border-rose-700/40",    icon: AlertOctagon },
} as const;

export function DifficultyBadge({ caseId, planId }: Props) {
  const [data, setData] = useState<DifficultyScoreBreakdown | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDifficultyScore(caseId, planId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [caseId, planId]);

  if (error || !data) return null;

  const cfg = LEVEL_CONFIG[data.level];
  const Icon = cfg.icon;

  return (
    <div
      title={`Score: ${data.score}/100 · ${data.totalTeethMoved} teeth · ${data.estimatedStages} stages`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${cfg.bg} ${cfg.color}`}
    >
      <Icon size={11} />
      <span>{cfg.label}</span>
      <span className="font-black tabular-nums">{data.score}</span>
    </div>
  );
}
