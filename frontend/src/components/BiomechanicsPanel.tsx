"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { Card, StatusBadge, ProgressBar } from "@/components/DesignSystem";
import {
  fetchBiomechanicsAssessment,
  runBiomechanicsAssessment,
  type BiomechanicsAssessment,
  type BiomechanicsFinding,
} from "@/lib/api/biomechanics";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_TONE = {
  safe: "success",
  warning: "warning",
  unsafe: "danger",
  unknown: "neutral",
} as const;

const STATUS_ICON = {
  safe: ShieldCheck,
  warning: TriangleAlert,
  unsafe: ShieldAlert,
  unknown: Activity,
};

function statusTone(s: string) {
  return STATUS_TONE[s as keyof typeof STATUS_TONE] ?? "neutral";
}

function groupByStage(findings: BiomechanicsFinding[]): Map<number, BiomechanicsFinding[]> {
  const map = new Map<number, BiomechanicsFinding[]>();
  for (const f of findings) {
    const list = map.get(f.stageNumber) ?? [];
    list.push(f);
    map.set(f.stageNumber, list);
  }
  return map;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({
  label,
  score,
  description,
}: {
  label: string;
  score: number | null;
  description: string;
}) {
  if (score === null) return null;
  const tone = score < 30 ? "success" : score < 70 ? "warning" : "danger";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[color:var(--foreground)]">{label}</span>
        <span className="tabular-nums text-[color:var(--muted-foreground)]">{score}/100</span>
      </div>
      <ProgressBar value={score} tone={tone} />
      <p className="text-[10px] text-[color:var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function FindingRow({ finding }: { finding: BiomechanicsFinding }) {
  const tone = statusTone(finding.status);
  const toneClass: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    danger: "bg-red-500/10 text-red-700 dark:text-red-300",
    neutral: "bg-[color:var(--muted)] text-[color:var(--muted-foreground)]",
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${toneClass[tone] ?? toneClass.neutral}`}>
      <span className="shrink-0 font-semibold tabular-nums">FDI {finding.fdi}</span>
      <span className="min-w-0 leading-relaxed">{finding.explanation}</span>
    </div>
  );
}

function StageGroup({ stageNumber, findings }: { stageNumber: number; findings: BiomechanicsFinding[] }) {
  const [open, setOpen] = useState(stageNumber <= 3);
  const worst = findings.some((f) => f.status === "unsafe")
    ? "unsafe"
    : findings.some((f) => f.status === "warning")
    ? "warning"
    : "safe";
  return (
    <div className="rounded-xl border border-[color:var(--border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[color:var(--muted)]/30 transition-colors"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className="font-semibold text-[color:var(--foreground)]">Stage {stageNumber}</span>
        <StatusBadge tone={statusTone(worst)}>
          {worst}
        </StatusBadge>
        <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">
          {findings.length} finding{findings.length !== 1 ? "s" : ""}
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-[color:var(--border)] p-3">
          {findings.map((f, i) => (
            <FindingRow key={i} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

export default function BiomechanicsPanel({ caseId, planId }: Props) {
  const [data, setData] = useState<BiomechanicsAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBiomechanicsAssessment(caseId, planId);
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runAssessment() {
    setRunning(true);
    setError(null);
    try {
      const result = await runBiomechanicsAssessment(caseId, planId);
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => { void load(); }, [caseId, planId]);

  const StatusIcon = data ? STATUS_ICON[data.overallStatus] ?? Activity : Activity;

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-[color:var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Biomechanics assessment is a clinical decision-support tool only. Clinician review required before treatment.
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Run / re-run button */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--muted-foreground)]">
          {data ? "Last run assessment results" : "No assessment yet — run to validate movement limits"}
        </p>
        <button
          type="button"
          onClick={runAssessment}
          disabled={running}
          className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-xs font-medium text-[color:var(--foreground)] hover:border-[color:var(--primary)]/40 transition-colors disabled:opacity-50"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {data ? "Re-run assessment" : "Run assessment"}
        </button>
      </div>

      {data && (
        <>
          {/* Overall status card */}
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  data.overallStatus === "safe"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : data.overallStatus === "warning"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : data.overallStatus === "unsafe"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-[color:var(--muted)] text-[color:var(--muted-foreground)]"
                }`}
              >
                <StatusIcon size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[color:var(--foreground)] capitalize">
                    {data.overallStatus}
                  </h3>
                  <StatusBadge tone={statusTone(data.overallStatus)}>
                    {data.stageCount} stage{data.stageCount !== 1 ? "s" : ""}
                  </StatusBadge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={11} className="text-emerald-500" />
                    {data.safeStageCount} safe
                  </span>
                  <span className="flex items-center gap-1">
                    <TriangleAlert size={11} className="text-amber-500" />
                    {data.warningStageCount} warning
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldAlert size={11} className="text-red-500" />
                    {data.unsafeStageCount} unsafe
                  </span>
                  {data.collisionPairs > 0 && (
                    <span className="flex items-center gap-1">
                      <Zap size={11} className="text-amber-500" />
                      {data.collisionPairs} collision risk{data.collisionPairs !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Clinical scores */}
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--foreground)]">Clinical Difficulty Scores</h3>
            <div className="space-y-4">
              <ScoreBar
                label="Anchorage Demand"
                score={data.anchorageScore}
                description="Higher = greater anchorage requirement. Consider TADs or skeletal anchorage above 70."
              />
              <ScoreBar
                label="Root Control Complexity"
                score={data.rootControlScore}
                description="Higher = significant torque/tip movements requiring careful monitoring."
              />
              <ScoreBar
                label="Overall Difficulty"
                score={data.difficultyScore}
                description="Composite difficulty index. Values above 70 indicate challenging case mechanics."
              />
            </div>
          </Card>

          {/* Findings by stage */}
          {data.findings.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                Findings ({data.findings.length})
              </h3>
              {Array.from(groupByStage(data.findings)).map(([stageNum, findings]) => (
                <StageGroup key={stageNum} stageNumber={stageNum} findings={findings} />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-semibold text-[color:var(--foreground)]">All movements within safe limits</p>
              <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">No per-stage findings to report.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
