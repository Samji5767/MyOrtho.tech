"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Factory,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  getDifficultyScore,
  getRootSafety,
  getForceHeatmap,
  getEnhancedCollisions,
  validateApproval,
  type DifficultyScoreBreakdown,
  type RootSafetyResult,
  type ToothForceData,
  type EnhancedCollisionPair,
  type ApprovalValidation,
} from "@/lib/api/tooth-movement";
import { getAiScores, type AiScores } from "@/lib/api/ai-scores";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(n: number): string {
  if (n >= 80) return "var(--clinical-safe)";
  if (n >= 60) return "var(--clinical-warn)";
  return "var(--clinical-danger)";
}

function scoreBgClass(n: number): string {
  if (n >= 80) return "border-emerald-300/50 bg-emerald-50/60 dark:border-emerald-700/40 dark:bg-emerald-900/10";
  if (n >= 60) return "border-amber-300/50 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-900/10";
  return "border-rose-300/50 bg-rose-50/60 dark:border-rose-900/10 dark:border-rose-700/40";
}

function riskColor(risk: RootSafetyResult["corticalRisk"]): string {
  if (risk === "safe")    return "var(--clinical-safe)";
  if (risk === "caution") return "var(--clinical-warn)";
  return "var(--clinical-danger)";
}

function difficultyColor(level: DifficultyScoreBreakdown["level"]): string {
  if (level === "simple")   return "var(--clinical-safe)";
  if (level === "moderate") return "var(--clinical-warn)";
  if (level === "complex")  return "var(--clinical-danger)";
  return "#dc2626"; // very_complex has no CSS variable equivalent
}

function aggregateRootRisk(results: RootSafetyResult[]): { label: string; score: number; color: string } {
  if (!results.length) return { label: "No data", score: 0, color: "var(--muted-foreground)" };
  const critCount    = results.filter((r) => r.corticalRisk === "critical").length;
  const cautionCount = results.filter((r) => r.corticalRisk === "caution").length;
  if (critCount > 0)    return { label: `${critCount} critical`,   score: Math.max(0, 100 - critCount * 25),    color: "var(--clinical-danger)" };
  if (cautionCount > 0) return { label: `${cautionCount} caution`, score: Math.max(0, 100 - cautionCount * 10), color: "var(--clinical-warn)"   };
  return { label: "All safe", score: 100, color: "var(--clinical-safe)" };
}

function aggregateForceBalance(teeth: ToothForceData[]): { label: string; score: number } {
  if (!teeth.length) return { label: "No data", score: 0 };
  const high  = teeth.filter((t) => t.mobilityRisk === "high" || t.mobilityRisk === "moderate").length;
  const ratio = high / teeth.length;
  const score = Math.round((1 - ratio) * 100);
  return { label: `${teeth.length} teeth assessed`, score };
}

function buildMfgStats(ai: AiScores): string {
  if (ai.collisionCount === 0 && ai.unsafeIprCount === 0 && ai.criticalIssueCount === 0) {
    return "No blocking issues detected";
  }
  const parts: string[] = [];
  if (ai.collisionCount > 0)     parts.push(`${ai.collisionCount} collision${ai.collisionCount !== 1 ? "s" : ""}`);
  if (ai.unsafeIprCount > 0)     parts.push(`${ai.unsafeIprCount} unsafe IPR`);
  if (ai.criticalIssueCount > 0) parts.push(`${ai.criticalIssueCount} critical issue${ai.criticalIssueCount !== 1 ? "s" : ""}`);
  return parts.join(" · ");
}

// ─── SVG Ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r      = 50;
  const circ   = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color  = scoreColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - filled}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text x="60" y="58" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--foreground)" fontFamily="inherit">
          {score}
        </text>
        <text x="60" y="70" textAnchor="middle" fontSize="9" fill="var(--muted-foreground)" fontFamily="inherit">
          / 100
        </text>
      </svg>
      <p className="text-[11px] font-semibold text-[color:var(--foreground)]">{label}</p>
    </div>
  );
}

// ─── Score Card ───────────────────────────────────────────────────────────────

function ScoreCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 space-y-1">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} style={{ color: color ?? "var(--muted-foreground)" }} />}
        <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">{label}</p>
      </div>
      <p className="text-lg font-black text-[color:var(--foreground)] tabular-nums" style={color ? { color } : {}}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-[color:var(--muted-foreground)]">{sub}</p>}
    </div>
  );
}

// ─── Interpretation Panel ─────────────────────────────────────────────────────

function InterpretationPanel({
  name,
  measures,
  relevance,
  current,
}: {
  name: string;
  measures: string;
  relevance: string;
  current: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-3 space-y-1">
      <p className="text-[11px] font-bold text-[color:var(--foreground)]">{name}</p>
      <p className="text-[10px] text-[color:var(--muted-foreground)]">
        <span className="font-semibold">Measures: </span>{measures}
      </p>
      <p className="text-[10px] text-[color:var(--muted-foreground)]">
        <span className="font-semibold">Clinical relevance: </span>{relevance}
      </p>
      <p className="text-[10px] text-[color:var(--foreground)]">
        <span className="text-[color:var(--muted-foreground)]">Current: </span>{current}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

interface DashboardData {
  difficulty:     DifficultyScoreBreakdown | null;
  rootResults:    RootSafetyResult[];
  forceTeeth:     ToothForceData[];
  collisionPairs: EnhancedCollisionPair[];
  approval:       ApprovalValidation | null;
  aiScores:       AiScores | null;
}

export function ClinicalScoreDashboard({ caseId, planId }: Props) {
  const [data, setData] = useState<DashboardData>({
    difficulty:     null,
    rootResults:    [],
    forceTeeth:     [],
    collisionPairs: [],
    approval:       null,
    aiScores:       null,
  });
  const [loading,             setLoading]             = useState(false);
  const [error,               setError]               = useState<string | null>(null);
  const [lastUpdated,         setLastUpdated]         = useState<Date | null>(null);
  const [interpretationsOpen, setInterpretationsOpen] = useState(false);
  const [blockersOpen,        setBlockersOpen]        = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [diff, rootSafety, force, collisions, approval, aiScoresResult] = await Promise.allSettled([
        getDifficultyScore(caseId, planId),
        getRootSafety(caseId, planId),
        getForceHeatmap(caseId, planId),
        getEnhancedCollisions(caseId, planId),
        validateApproval(caseId, planId),
        getAiScores(caseId),
      ]);

      setData({
        difficulty:     diff.status === "fulfilled"           ? diff.value               : null,
        rootResults:    rootSafety.status === "fulfilled"     ? rootSafety.value.results : [],
        forceTeeth:     force.status === "fulfilled"          ? force.value.teeth        : [],
        collisionPairs: collisions.status === "fulfilled"     ? collisions.value.pairs   : [],
        approval:       approval.status === "fulfilled"       ? approval.value           : null,
        aiScores:       aiScoresResult.status === "fulfilled" ? aiScoresResult.value     : null,
      });
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  useEffect(() => { void load(); }, [load]);

  const overallScore    = data.approval?.score ?? 0;
  const rootAgg         = aggregateRootRisk(data.rootResults);
  const forceAgg        = aggregateForceBalance(data.forceTeeth);
  const critCollisions  = data.collisionPairs.filter((p) => p.severity === "significant_overlap").length;
  const totalCollisions = data.collisionPairs.length;

  const isInitialLoad = loading && data.difficulty === null && data.aiScores === null;

  const mfgStatus = (() => {
    if (!data.approval || !data.aiScores) return null;
    const { canApprove }                         = data.approval;
    const { criticalIssueCount, collisionCount } = data.aiScores;
    if (canApprove && criticalIssueCount === 0 && collisionCount === 0) return "ready"   as const;
    if (canApprove)                                                      return "caution" as const;
    return "blocked" as const;
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">
            Clinical Scoring
          </p>
          <h3 className="text-base font-semibold text-[color:var(--foreground)]">Treatment Dashboard</h3>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--primary)] disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-300/50 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/10 dark:text-rose-400">
          <AlertTriangle size={12} className="shrink-0" />
          {error}
        </div>
      )}

      {isInitialLoad ? (
        <div className="space-y-3">
          <div className="h-10 w-3/4 animate-pulse rounded bg-[color:var(--muted)]/40" />
          <div className="h-10 w-full animate-pulse rounded bg-[color:var(--muted)]/40" />
          <div className="h-10 w-5/6 animate-pulse rounded bg-[color:var(--muted)]/40" />
          <div className="h-10 w-2/3 animate-pulse rounded bg-[color:var(--muted)]/40" />
        </div>
      ) : (
        <>
          {/* Approval banner */}
          {data.approval && (
            <div className="space-y-1.5">
              <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${scoreBgClass(overallScore)}`}>
                {data.approval.canApprove
                  ? <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
                  : <ShieldAlert size={20} className="text-rose-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${data.approval.canApprove ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                    {data.approval.canApprove ? "Ready for Approval" : "Approval Blocked"}
                  </p>
                  <p className="text-xs text-[color:var(--muted-foreground)] truncate">{data.approval.summary}</p>
                </div>
                {data.approval.blockers.length > 0 && (
                  data.approval.blockers.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => setBlockersOpen((v) => !v)}
                      className="shrink-0 flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white"
                    >
                      {data.approval.blockers.length} blockers
                      {blockersOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {data.approval.blockers.length} blocker{data.approval.blockers.length !== 1 ? "s" : ""}
                    </span>
                  )
                )}
              </div>

              {data.approval.blockers.length > 0 && (data.approval.blockers.length <= 3 || blockersOpen) && (
                <div className="rounded-xl border border-rose-300/50 bg-rose-50/40 px-3 py-2 space-y-1.5 dark:border-rose-700/40 dark:bg-rose-900/10">
                  {data.approval.blockers.map((blocker, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400">
                      <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                      <span>
                        <span className="font-mono font-bold mr-1">[{blocker.code}]</span>
                        {blocker.description}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manufacturing Readiness Banner */}
          {mfgStatus !== null && data.aiScores !== null && (
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
              mfgStatus === "ready"
                ? "border-emerald-300/50 bg-emerald-50/60 dark:border-emerald-700/40 dark:bg-emerald-900/10"
                : mfgStatus === "caution"
                ? "border-amber-300/50 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-900/10"
                : "border-rose-300/50 bg-rose-50/60 dark:border-rose-700/40 dark:bg-rose-900/10"
            }`}>
              <Factory
                size={20}
                className={
                  mfgStatus === "ready"
                    ? "text-emerald-600 shrink-0"
                    : mfgStatus === "caution"
                    ? "text-amber-600 shrink-0"
                    : "text-rose-600 shrink-0"
                }
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${
                  mfgStatus === "ready"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : mfgStatus === "caution"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-rose-700 dark:text-rose-300"
                }`}>
                  {mfgStatus === "ready"
                    ? "Manufacturing Ready"
                    : mfgStatus === "caution"
                    ? "Manufacturing Caution"
                    : "Not Ready for Manufacturing"}
                </p>
                <p className="text-[11px] text-[color:var(--muted-foreground)] tabular-nums">
                  {buildMfgStats(data.aiScores)}
                </p>
              </div>
            </div>
          )}

          {/* Main ring + sub-scores */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="mx-auto sm:mx-0 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
              <ScoreRing score={overallScore} label="Treatment Score" />
              {lastUpdated && (
                <p className="mt-2 text-center text-[10px] text-[color:var(--muted-foreground)]">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>

            <div className="flex-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {/* Existing cards */}
              <ScoreCard
                label="Difficulty"
                value={data.difficulty ? data.difficulty.level.replace("_", " ") : "—"}
                sub={data.difficulty ? `Score ${data.difficulty.score}` : undefined}
                color={data.difficulty ? difficultyColor(data.difficulty.level) : undefined}
                icon={Zap}
              />
              <ScoreCard
                label="Root Safety"
                value={rootAgg.label}
                sub={data.rootResults.length ? `${data.rootResults.length} teeth` : undefined}
                color={rootAgg.color}
                icon={data.rootResults.every((r) => r.corticalRisk === "safe") ? ShieldCheck : ShieldAlert}
              />
              <ScoreCard
                label="Force Balance"
                value={forceAgg.score ? `${forceAgg.score}%` : "—"}
                sub={forceAgg.label}
                color={scoreColor(forceAgg.score)}
                icon={Activity}
              />
              <ScoreCard
                label="Collisions"
                value={totalCollisions === 0 ? "None" : String(totalCollisions)}
                sub={critCollisions > 0 ? `${critCollisions} critical` : "No critical overlaps"}
                color={totalCollisions === 0 ? "var(--clinical-safe)" : critCollisions > 0 ? "var(--clinical-danger)" : "var(--clinical-warn)"}
                icon={totalCollisions === 0 ? CheckCircle2 : AlertTriangle}
              />
              <ScoreCard
                label="Movements"
                value={data.difficulty ? String(data.difficulty.totalTeethMoved) : "—"}
                sub={data.difficulty ? `~${data.difficulty.estimatedStages} stages` : undefined}
                icon={TrendingUp}
              />
              <ScoreCard
                label="BRI Index"
                value={data.difficulty?.boneRemodelingIndex != null
                  ? data.difficulty.boneRemodelingIndex.toFixed(2)
                  : "—"}
                sub="Bone remodeling"
                color={data.difficulty?.boneRemodelingIndex != null
                  ? scoreColor(100 - data.difficulty.boneRemodelingIndex * 20)
                  : undefined}
                icon={TrendingDown}
              />

              {/* AI Score cards */}
              <ScoreCard
                label="Treatment Duration"
                value={data.aiScores?.estimatedDurationMonths != null
                  ? `~${data.aiScores.estimatedDurationMonths} months`
                  : "—"}
                sub="Estimated treatment time"
                icon={Clock}
              />
              <ScoreCard
                label="Success Confidence"
                value={data.aiScores != null ? `${data.aiScores.successConfidence}%` : "—"}
                sub="AI-predicted outcome"
                color={data.aiScores != null ? scoreColor(data.aiScores.successConfidence) : undefined}
                icon={Target}
              />
              <ScoreCard
                label="Clinical Risk"
                value={data.aiScores != null ? String(100 - data.aiScores.clinicalRiskScore) : "—"}
                sub={data.aiScores != null ? `Anchorage: ${data.aiScores.anchorageLevel}` : undefined}
                color={data.aiScores != null ? scoreColor(100 - data.aiScores.clinicalRiskScore) : undefined}
                icon={
                  data.aiScores != null && (100 - data.aiScores.clinicalRiskScore) >= 60
                    ? ShieldCheck
                    : ShieldAlert
                }
              />
              <ScoreCard
                label="Quality Grade"
                value={data.aiScores?.qualityGrade ?? "—"}
                sub={data.aiScores?.qualityScore != null ? `Score ${data.aiScores.qualityScore}` : undefined}
                icon={Award}
              />
              <ScoreCard
                label="Refinement Risk"
                value={data.aiScores != null ? `${data.aiScores.refinementProbability}%` : "—"}
                sub="Probability of mid-course correction"
                color={data.aiScores != null ? scoreColor(100 - data.aiScores.refinementProbability) : undefined}
                icon={RotateCcw}
              />
              <ScoreCard
                label="Issues"
                value={data.aiScores != null
                  ? `${data.aiScores.criticalIssueCount} critical / ${data.aiScores.warningCount} warnings`
                  : "—"}
                color={data.aiScores != null
                  ? data.aiScores.criticalIssueCount > 0
                    ? "var(--clinical-danger)"
                    : "var(--clinical-safe)"
                  : undefined}
                icon={AlertCircle}
              />
            </div>
          </div>

          {/* Difficulty breakdown */}
          {data.difficulty && (
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                Score Components
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {Object.entries(data.difficulty.scoreComponents).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[color:var(--muted-foreground)] capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <span className="font-semibold text-[color:var(--foreground)] tabular-nums">{val}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-[color:var(--border)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, val)}%`, backgroundColor: scoreColor(val) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinical Interpretations */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
            <button
              type="button"
              onClick={() => setInterpretationsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                Clinical Interpretations
              </p>
              {interpretationsOpen
                ? <ChevronUp size={14} className="text-[color:var(--muted-foreground)] shrink-0" />
                : <ChevronDown size={14} className="text-[color:var(--muted-foreground)] shrink-0" />}
            </button>
            {interpretationsOpen && (
              <div className="border-t border-[color:var(--border)] px-4 pt-3 pb-4 space-y-2">
                <InterpretationPanel
                  name="BRI (Bone Remodeling Index)"
                  measures="Estimates the load on alveolar bone during tooth movement."
                  relevance="Higher values may indicate increased remodeling demand and longer treatment time."
                  current={data.difficulty?.boneRemodelingIndex != null
                    ? `${data.difficulty.boneRemodelingIndex.toFixed(2)} — ${
                        data.difficulty.boneRemodelingIndex > 3   ? "Elevated load"     :
                        data.difficulty.boneRemodelingIndex > 1.5 ? "Moderate load"     :
                        "Within normal range"
                      }`
                    : "No data available"}
                />
                <InterpretationPanel
                  name="Force Balance Score"
                  measures="Measures how evenly forces are distributed across all moving teeth."
                  relevance="Poor balance can lead to unplanned tooth mobility."
                  current={forceAgg.score > 0
                    ? `${forceAgg.score}% — ${
                        forceAgg.score >= 80 ? "Well balanced"               :
                        forceAgg.score >= 60 ? "Moderate imbalance detected" :
                        "Significant force imbalance"
                      }`
                    : "No data available"}
                />
                <InterpretationPanel
                  name="Anchorage Level"
                  measures="Indicates required anchorage reinforcement."
                  relevance="Low = minimal TADs needed; high = maximum anchorage protocol required."
                  current={data.aiScores?.anchorageLevel != null
                    ? `${data.aiScores.anchorageLevel.charAt(0).toUpperCase()}${data.aiScores.anchorageLevel.slice(1)} anchorage requirement`
                    : "No data available"}
                />
                <InterpretationPanel
                  name="Refinement Probability"
                  measures="AI-estimated likelihood that mid-course corrections will be needed."
                  relevance="Based on movement complexity and historical case data."
                  current={data.aiScores?.refinementProbability != null
                    ? `${data.aiScores.refinementProbability}% — ${
                        data.aiScores.refinementProbability < 20 ? "Low likelihood"              :
                        data.aiScores.refinementProbability < 50 ? "Moderate likelihood"         :
                        "High likelihood of refinement"
                      }`
                    : "No data available"}
                />
              </div>
            )}
          </div>

          {/* Root safety breakdown (critical/caution only) */}
          {data.rootResults.filter((r) => r.corticalRisk !== "safe").length > 0 && (
            <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 p-4 space-y-2 dark:border-amber-700/40 dark:bg-amber-900/10">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Root Safety Alerts
              </p>
              <div className="space-y-1.5">
                {data.rootResults
                  .filter((r) => r.corticalRisk !== "safe")
                  .slice(0, 5)
                  .map((r) => (
                    <div key={r.fdi} className="flex items-start gap-2 text-xs">
                      <span
                        className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ borderColor: riskColor(r.corticalRisk), color: riskColor(r.corticalRisk) }}
                      >
                        {r.corticalRisk}
                      </span>
                      <div>
                        <span className="font-semibold text-[color:var(--foreground)]">FDI {r.fdi}</span>
                        {r.recommendation && (
                          <span className="ml-1 text-[color:var(--muted-foreground)]">{r.recommendation}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* AI Disclaimer — always visible */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50/60 px-3 py-2 dark:border-amber-700/40 dark:bg-amber-900/10">
        <AlertCircle size={12} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
          AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist.
        </p>
      </div>
    </div>
  );
}
