"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Zap,
} from "lucide-react";
import { Card, ProgressBar, StatusBadge } from "@/components/DesignSystem";
import {
  runSimulation,
  getSimulation,
  getPdlResults,
  type MovementSimulation,
  type PdlResult,
  type CollisionPair,
  type ConstraintViolation,
} from "@/lib/api/tooth-movement";

// ─── PDL risk colors ──────────────────────────────────────────────────────────

const PDL_RISK_TONE = {
  none:     "success",
  low:      "info",
  moderate: "warning",
  high:     "danger",
} as const;

// ─── Anchorage gauge ──────────────────────────────────────────────────────────

function AnchorageGauge({ sim }: { sim: MovementSimulation }) {
  const req = sim.anchorageUnitsRequired ?? 0;
  const avail = sim.anchorageUnitsAvailable ?? 0;
  const total = req + avail;
  const pct = total > 0 ? Math.round((req / total) * 100) : 0;
  const cls = sim.anchorageClass;

  const tone = cls === 'maximum' ? 'danger' : cls === 'moderate' ? 'warning' : 'success';
  const label = cls === 'maximum' ? 'Maximum Anchorage Required'
    : cls === 'moderate' ? 'Moderate Anchorage'
    : 'Minimum Anchorage';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[color:var(--foreground)]">{label}</span>
        <StatusBadge tone={tone}>{cls ?? "—"}</StatusBadge>
      </div>
      <ProgressBar value={pct} tone={tone} />
      <div className="flex justify-between text-[10px] text-[color:var(--muted-foreground)]">
        <span>Required: <strong className="text-[color:var(--foreground)]">{req.toFixed(0)} units</strong></span>
        <span>Available: <strong className="text-[color:var(--foreground)]">{avail.toFixed(0)} units</strong></span>
      </div>
    </div>
  );
}

// ─── Collisions list ──────────────────────────────────────────────────────────

function CollisionsList({ pairs }: { pairs: CollisionPair[] }) {
  const [open, setOpen] = useState(true);
  if (pairs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={12} />No interproximal collisions detected
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[color:var(--border)]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]"
      >
        <AlertTriangle size={12} className="text-amber-500" />
        Collision Risk ({pairs.length} pair{pairs.length !== 1 ? "s" : ""})
        {open ? <ChevronDown size={11} className="ml-auto" /> : <ChevronRight size={11} className="ml-auto" />}
      </button>
      {open && (
        <div className="border-t border-[color:var(--border)] px-3 py-2 space-y-1.5">
          {pairs.map((cp, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-[color:var(--foreground)]">
                FDI {cp.fdiA} ↔ FDI {cp.fdiB}
              </span>
              <span className={`font-semibold ${cp.overlapMm > 0.5 ? "text-red-500" : "text-amber-500"}`}>
                {cp.overlapMm.toFixed(2)} mm overlap
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Violations list ──────────────────────────────────────────────────────────

function ViolationsList({ violations }: { violations: ConstraintViolation[] }) {
  const [open, setOpen] = useState(true);
  if (violations.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={12} />All movements within biological limits
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[color:var(--border)]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]"
      >
        <Sliders size={12} className="text-red-500" />
        Limit Violations ({violations.length})
        {open ? <ChevronDown size={11} className="ml-auto" /> : <ChevronRight size={11} className="ml-auto" />}
      </button>
      {open && (
        <div className="border-t border-[color:var(--border)] px-3 py-2 space-y-1.5">
          {violations.map((v, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-xs">
              <span>
                <span className={`font-semibold ${v.severity === "critical" ? "text-red-500" : "text-amber-500"}`}>
                  FDI {v.fdi}
                </span>
                <span className="ml-1 text-[color:var(--muted-foreground)] capitalize">
                  {v.movement.replace(/_/g, " ")}
                </span>
              </span>
              <span className="font-mono text-[color:var(--foreground)]">
                {v.value.toFixed(2)} / {v.limit.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PDL stage viewer ─────────────────────────────────────────────────────────

function PdlStageViewer({
  caseId, planId, totalStages,
}: {
  caseId: string; planId: string; totalStages: number;
}) {
  const [stageNum, setStageNum] = useState(1);
  const [results, setResults] = useState<PdlResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(s: number) {
    setLoading(true);
    try {
      setResults(await getPdlResults(caseId, planId, s));
    } catch { /* swallow */ }
    setLoading(false);
  }

  useEffect(() => { void load(stageNum); }, [stageNum]); // eslint-disable-line

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
          Stage:
        </label>
        <input
          type="range"
          min={1}
          max={totalStages}
          value={stageNum}
          onChange={e => setStageNum(parseInt(e.target.value, 10))}
          className="flex-1 accent-[color:var(--primary)]"
        />
        <span className="w-8 text-right text-xs font-semibold tabular-nums text-[color:var(--foreground)]">
          {stageNum}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={14} className="animate-spin text-[color:var(--muted-foreground)]" />
        </div>
      ) : results.length === 0 ? (
        <p className="py-2 text-center text-xs text-[color:var(--muted-foreground)]">No PDL data for stage {stageNum}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                <th className="pb-1.5 pr-3">Tooth</th>
                <th className="pb-1.5 pr-3">Stress (MPa)</th>
                <th className="pb-1.5 pr-3">Force (N)</th>
                <th className="pb-1.5 pr-3">Moment (N·cm)</th>
                <th className="pb-1.5">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]/50">
              {results.map(r => (
                <tr key={r.toothNumber}>
                  <td className="py-1.5 pr-3 font-mono font-bold text-[color:var(--foreground)]">
                    {r.toothNumber}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums text-[color:var(--foreground)]">
                    {r.stressMpa.toFixed(4)}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums text-[color:var(--foreground)]">
                    {r.forceN.toFixed(3)}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums text-[color:var(--foreground)]">
                    {r.momentNcm.toFixed(3)}
                  </td>
                  <td className="py-1.5">
                    <StatusBadge tone={PDL_RISK_TONE[r.mobilityRisk]}>
                      {r.mobilityRisk}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

export default function MovementSimulationPanel({ caseId, planId }: Props) {
  const [sim, setSim] = useState<MovementSimulation | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExisting = useCallback(async () => {
    setLoading(true);
    try {
      setSim(await getSimulation(caseId, planId));
    } catch { /* no sim yet */ }
    setLoading(false);
  }, [caseId, planId]);

  useEffect(() => { void loadExisting(); }, [loadExisting]);

  async function handleRunSimulation() {
    setRunning(true);
    setError(null);
    try {
      setSim(await runSimulation(caseId, planId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={18} className="animate-spin text-[color:var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Simulation outputs are engineering estimates only. PDL stress values are approximations based on published tooth-type area averages. Clinician judgment required.
      </div>

      {/* Run / re-run */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Movement Simulation</h3>
          </div>
          {sim && (
            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={running}
              className="flex items-center gap-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
            >
              <RefreshCw size={11} className={running ? "animate-spin" : ""} />
              Re-run
            </button>
          )}
        </div>

        {!sim ? (
          <div className="space-y-3">
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Runs biomechanical analysis: collision detection, biological limit checks, anchorage classification, and PDL stress estimation per tooth per stage.
            </p>
            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={running}
              className="flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {running ? "Simulating…" : "Run Simulation"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Teeth moved",    value: String(sim.totalTeethMoved) },
                { label: "Est. stages",    value: sim.estimatedStages !== null ? String(sim.estimatedStages) : "—" },
                { label: "Max move/stage", value: sim.maxSingleMovementMm !== null ? `${sim.maxSingleMovementMm.toFixed(2)}mm` : "—" },
                { label: "Bone rmdl. idx", value: sim.boneRemodelingIndex !== null ? sim.boneRemodelingIndex.toFixed(2) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-[color:var(--muted)]/30 px-2.5 py-2 text-center">
                  <p className="text-base font-bold tabular-nums text-[color:var(--foreground)]">{value}</p>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">{label}</p>
                </div>
              ))}
            </div>

            {sim.simulationDurationMs && (
              <p className="text-[10px] text-[color:var(--muted-foreground)]">
                Simulated in {sim.simulationDurationMs}ms · {new Date(sim.simulatedAt).toLocaleString()}
              </p>
            )}

            {/* Anchorage */}
            {sim.anchorageClass && <AnchorageGauge sim={sim} />}

            {/* Collisions */}
            <CollisionsList pairs={sim.collisionPairs} />

            {/* Violations */}
            <ViolationsList violations={sim.constraintViolations} />
          </div>
        )}
        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}
      </Card>

      {/* PDL stress viewer */}
      {sim && sim.estimatedStages && sim.estimatedStages > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">PDL Stress by Stage</h3>
          </div>
          <p className="text-[10px] text-[color:var(--muted-foreground)]">
            PDL stress (MPa), estimated force (N), and mobility risk per tooth. Optimal stress range: 0.003–0.008 MPa.
          </p>
          <PdlStageViewer caseId={caseId} planId={planId} totalStages={sim.estimatedStages} />
        </Card>
      )}
    </div>
  );
}
