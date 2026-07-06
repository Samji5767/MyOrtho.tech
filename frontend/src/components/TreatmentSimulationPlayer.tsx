'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  generateSimulation,
  getSimulationFrame,
  getArchCoordination,
  TreatmentSimulation,
  SimulationFrame,
  ArchCoordination,
} from '@/lib/api/treatment-simulation';
import { getAlignerGenerationPlan } from '@/lib/api/aligner-generation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreBar(score: number | null, label: string): JSX.Element {
  const pct = score != null ? Math.min(score * 100, 100) : 0;
  const barColor = pct >= 80 ? 'var(--clinical-safe)' : pct >= 60 ? 'var(--clinical-warn)' : 'var(--clinical-danger)';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-[color:var(--muted-foreground)]">{label}</span>
        <span className="font-mono font-medium text-[color:var(--foreground)]">
          {score != null ? `${(score * 100).toFixed(0)}%` : '—'}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-[color:var(--clinical-track)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

function metricDelta(label: string, initial: number | null, final: number | null, unit: string): JSX.Element {
  const delta = initial != null && final != null ? final - initial : null;
  return (
    <div className="text-xs text-[color:var(--muted-foreground)]">
      <span>{label}: </span>
      <span className="font-mono text-[color:var(--foreground)]">{initial?.toFixed(1) ?? '—'}{unit}</span>
      <span className="mx-1">→</span>
      <span className="font-mono font-semibold text-[color:var(--foreground)]">{final?.toFixed(1) ?? '—'}{unit}</span>
      {delta != null && (
        <span
          className="ml-1 font-mono"
          style={{ color: delta < 0 ? 'var(--clinical-safe)' : delta > 0 ? 'var(--clinical-warn)' : 'var(--muted-foreground)' }}
        >
          ({delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit})
        </span>
      )}
    </div>
  );
}

// ─── Tooth position visualizer ────────────────────────────────────────────────

const FDI_GRID_UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const FDI_GRID_LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

function movementMagnitude(pos: { tx: number; ty: number; tz: number; rx: number; ry: number; rz: number }): number {
  return Math.sqrt(pos.tx ** 2 + pos.ty ** 2 + pos.tz ** 2 + (pos.rx / 10) ** 2 + (pos.ry / 10) ** 2 + (pos.rz / 10) ** 2);
}

function toothColor(mag: number): string {
  if (mag < 0.05) return 'var(--clinical-neutral-tint)';
  if (mag < 0.5)  return 'var(--clinical-safe-tint)';
  if (mag < 1.0)  return 'var(--clinical-warn-tint)';
  return 'var(--clinical-danger-tint)';
}

function ToothGrid({ frame }: { frame: SimulationFrame }) {
  return (
    <div className="space-y-1">
      {[FDI_GRID_UPPER, FDI_GRID_LOWER].map((row, ri) => (
        <div key={ri} className="flex gap-0.5">
          {row.map(fdi => {
            const pos = frame.toothPositions[fdi];
            const mag = pos ? movementMagnitude(pos) : 0;
            return (
              <div
                key={fdi}
                title={pos ? `FDI ${fdi}: tx${pos.tx.toFixed(2)} ty${pos.ty.toFixed(2)} rx${pos.rx.toFixed(1)}°` : `FDI ${fdi}`}
                style={{ backgroundColor: toothColor(mag) }}
                className="flex-1 aspect-square rounded-sm border border-[color:var(--border)] text-center leading-none"
              >
                <span className="text-[7px] text-[color:var(--muted-foreground)] font-mono">{fdi}</span>
              </div>
            );
          })}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted-foreground)] mt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm border border-[color:var(--border)]" style={{ backgroundColor: 'var(--clinical-neutral-tint)' }} /> Minimal</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm border border-[color:var(--border)]" style={{ backgroundColor: 'var(--clinical-safe-tint)' }} /> Light</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm border border-[color:var(--border)]" style={{ backgroundColor: 'var(--clinical-warn-tint)' }} /> Moderate</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm border border-[color:var(--border)]" style={{ backgroundColor: 'var(--clinical-danger-tint)' }} /> Significant</span>
      </div>
    </div>
  );
}

// ─── Frame metrics ────────────────────────────────────────────────────────────

function FrameMetrics({ frame }: { frame: SimulationFrame }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {[
        { label: 'Upper Arch Width', value: frame.upperArchWidthMm?.toFixed(1), unit: 'mm' },
        { label: 'Lower Arch Width', value: frame.lowerArchWidthMm?.toFixed(1), unit: 'mm' },
        { label: 'Overjet', value: frame.overjetMm?.toFixed(2), unit: 'mm' },
        { label: 'Overbite', value: frame.overbiteM?.toFixed(2), unit: 'mm' },
      ].map(({ label, value, unit }) => (
        <div key={label} className="rounded border border-[color:var(--border)] bg-[color:var(--card)] p-2">
          <div className="text-[color:var(--muted-foreground)] mb-0.5">{label}</div>
          <div className="font-mono font-semibold text-[color:var(--foreground)]">{value ?? '—'}{value != null ? unit : ''}</div>
        </div>
      ))}
      {frame.midlineDeviationMm != null && (
        <div className="col-span-2 rounded border border-[color:var(--border)] bg-[color:var(--card)] p-2">
          <div className="text-[color:var(--muted-foreground)] mb-0.5">Midline Deviation</div>
          <div
            className="font-mono font-semibold"
            style={{ color: Math.abs(frame.midlineDeviationMm) > 0.5 ? 'var(--clinical-warn)' : 'var(--clinical-safe)' }}
          >
            {frame.midlineDeviationMm.toFixed(3)}mm
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Player ──────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

export default function TreatmentSimulationPlayer({ caseId, planId }: Props) {
  const [sim, setSim] = useState<TreatmentSimulation | null>(null);
  const [currentFrame, setCurrentFrame] = useState<SimulationFrame | null>(null);
  const [archCoord, setArchCoord] = useState<ArchCoordination | null>(null);
  const [stage, setStage] = useState(1);
  const stageRef = useRef(1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [frameLoading, setFrameLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [alignerChangeWeeks, setAlignerChangeWeeks] = useState(2);
  const [abMode, setAbMode] = useState(false);
  const [stageB, setStageB] = useState(1);
  const stageBRef = useRef(1);
  const [frameB, setFrameB] = useState<SimulationFrame | null>(null);
  const [frameBLoading, setFrameBLoading] = useState(false);

  const runGenerate = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await generateSimulation(caseId, planId);
      setSim(result);
      stageRef.current = 1;
      setStage(1);
      const [frame, coord] = await Promise.all([
        getSimulationFrame(caseId, planId, 1),
        getArchCoordination(caseId, planId),
      ]);
      setCurrentFrame(frame);
      setArchCoord(coord);
      // Non-blocking: fetch aligner plan for duration estimate
      getAlignerGenerationPlan(caseId, planId)
        .then((p) => { if (p.alignerChangeWeeks) setAlignerChangeWeeks(p.alignerChangeWeeks); })
        .catch(() => { /* use default 2-week cadence */ });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const loadFrame = useCallback(async (s: number) => {
    if (!sim) return;
    setFrameLoading(true);
    try {
      const frame = await getSimulationFrame(caseId, planId, s);
      setCurrentFrame(frame);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFrameLoading(false);
    }
  }, [caseId, planId, sim]);

  const loadFrameB = useCallback(async (s: number) => {
    if (!sim) return;
    setFrameBLoading(true);
    try {
      const frame = await getSimulationFrame(caseId, planId, s);
      setFrameB(frame);
    } catch {
      // silently ignore B-frame errors
    } finally {
      setFrameBLoading(false);
    }
  }, [caseId, planId, sim]);

  useEffect(() => {
    if (!playing || !sim) return;
    intervalRef.current = setInterval(() => {
      const next = stageRef.current >= sim.totalFrames ? 1 : stageRef.current + 1;
      stageRef.current = next;
      setStage(next);
      void loadFrame(next);
    }, 400);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, sim, loadFrame]);

  const handleSlider = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = parseInt(e.target.value, 10);
    stageRef.current = s;
    setStage(s);
    await loadFrame(s);
  }, [loadFrame]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!sim) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying(p => !p);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = Math.max(1, stageRef.current - 1);
        stageRef.current = prev;
        setStage(prev);
        void loadFrame(prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = Math.min(sim.totalFrames, stageRef.current + 1);
        stageRef.current = next;
        setStage(next);
        void loadFrame(next);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sim, loadFrame]);

  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)] px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Treatment Simulation Player</h2>
          <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">
            Linear interpolation simulation across all aligner stages
          </p>
        </div>
        <button
          type="button"
          onClick={runGenerate}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded font-medium disabled:opacity-50 transition-colors"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {loading ? 'Generating…' : sim ? 'Re-Generate' : 'Generate Simulation'}
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 text-xs rounded p-3 border text-red-700 bg-red-50 border-red-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-800/50">
          {error}
        </div>
      )}

      {/* Simulation scores */}
      {sim && (
        <div className="px-4 pt-4 pb-2 space-y-2">
          <div className="grid grid-cols-3 gap-3">
            {scoreBar(sim.archCoordinationScore, 'Arch Coordination')}
            {scoreBar(sim.occlusionScore, 'Occlusion Score')}
            {scoreBar(sim.smileArcScore, 'Smile Arc Score')}
          </div>

          <div className="flex gap-4 flex-wrap text-xs text-[color:var(--muted-foreground)] pt-1">
            {metricDelta('Overjet', sim.overjetInitialMm, sim.overjetFinalMm, 'mm')}
            {metricDelta('Overbite', sim.overbiteInitialMm, sim.overbiteFinalmm, 'mm')}
            <span className="text-gray-400">
              {sim.totalFrames} stages · ~{sim.totalFrames * alignerChangeWeeks}w total
              {sim.generationDurationMs ? ` · ${sim.generationDurationMs}ms` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Stage slider + playback */}
      {sim && (
        <div className="px-4 pb-3 space-y-2">
          {/* Milestone ticks */}
          <div className="relative h-5 mx-[1.5rem]">
            {[0.25, 0.5, 0.75].map((frac) => {
              const milestoneStage = Math.round(frac * sim.totalFrames);
              const pct = ((milestoneStage - 1) / Math.max(sim.totalFrames - 1, 1)) * 100;
              const labels: Record<number, string> = { 0.25: '¼', 0.5: 'Mid', 0.75: '¾' };
              return (
                <div
                  key={frac}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="h-2 w-px bg-[color:var(--border)]" />
                  <span className="text-[8px] font-mono text-[color:var(--muted-foreground)]">{labels[frac]}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying(p => !p)}
              aria-label={playing ? 'Pause simulation' : 'Play simulation'}
              className="shrink-0 px-3 py-1 text-xs rounded font-medium border transition-colors"
              style={playing
                ? { backgroundColor: 'var(--clinical-warn-tint)', color: 'var(--clinical-warn)', borderColor: 'var(--clinical-warn)' }
                : { backgroundColor: 'var(--clinical-safe-tint)', color: 'var(--clinical-safe)', borderColor: 'var(--clinical-safe)' }
              }
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              disabled={stage <= 1}
              onClick={() => { const s = Math.max(1, stage - 1); stageRef.current = s; setStage(s); void loadFrame(s); }}
              aria-label="Previous stage"
              className="shrink-0 px-2 py-1 text-xs rounded border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-40 transition-colors"
            >
              ‹
            </button>
            <input
              type="range"
              min={1}
              max={sim.totalFrames}
              value={stage}
              onChange={handleSlider}
              className="flex-1"
              style={{ accentColor: 'var(--primary)' }}
            />
            <button
              type="button"
              disabled={stage >= sim.totalFrames}
              onClick={() => { const s = Math.min(sim.totalFrames, stage + 1); stageRef.current = s; setStage(s); void loadFrame(s); }}
              aria-label="Next stage"
              className="shrink-0 px-2 py-1 text-xs rounded border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-40 transition-colors"
            >
              ›
            </button>
            <span className="shrink-0 text-xs font-mono text-[color:var(--muted-foreground)] w-16 text-right tabular-nums">
              {stage}/{sim.totalFrames}
            </span>
            {currentFrame?.isKeyframe && (
              <span
                className="shrink-0 text-xs px-1.5 py-0.5 rounded border"
                style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', borderColor: 'var(--primary-glow)' }}
              >
                Key
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[color:var(--muted-foreground)]">
              Space to play/pause · ‹ › to step · click to jump
            </p>
            <button
              type="button"
              onClick={() => {
                setAbMode(v => !v);
                if (!abMode) void loadFrameB(stageB);
              }}
              className={[
                "shrink-0 px-2 py-1 text-[10px] rounded border font-semibold transition-colors",
                abMode
                  ? "border-amber-400 bg-amber-50/60 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400"
                  : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              A/B Compare
            </button>
          </div>

          {/* A/B comparison second slider */}
          {abMode && (
            <div className="flex items-center gap-2 border-t border-[color:var(--border)] pt-2">
              <span className="shrink-0 text-[10px] font-bold text-amber-600 uppercase">B:</span>
              <input
                type="range"
                min={1}
                max={sim.totalFrames}
                value={stageB}
                onChange={(e) => {
                  const s = parseInt(e.target.value, 10);
                  stageBRef.current = s;
                  setStageB(s);
                  void loadFrameB(s);
                }}
                className="flex-1"
                style={{ accentColor: 'var(--clinical-warn)' }}
              />
              <span className="shrink-0 text-xs font-mono text-amber-600 w-16 text-right tabular-nums">
                {stageB}/{sim.totalFrames}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tooth grid + frame metrics */}
      {currentFrame && (
        <div className={`px-4 pb-4 space-y-4 ${frameLoading ? 'opacity-50' : ''}`}>
          <ToothGrid frame={currentFrame} />
          {abMode && frameB ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1.5">
                  Stage {stage} (A)
                </p>
                <FrameMetrics frame={currentFrame} />
              </div>
              <div className={frameBLoading ? "opacity-50" : ""}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1.5">
                  Stage {stageB} (B)
                </p>
                <FrameMetrics frame={frameB} />
              </div>
            </div>
          ) : (
            <FrameMetrics frame={currentFrame} />
          )}
        </div>
      )}

      {/* Arch coordination */}
      {archCoord && (
        <div className="border-t border-[color:var(--border)] px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-[color:var(--foreground)]">Arch Coordination</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded border border-[color:var(--border)] bg-[color:var(--card)] p-2 text-center">
              <div className="font-mono font-semibold text-[color:var(--foreground)]">{archCoord.upperExpansionMm.toFixed(2)}mm</div>
              <div className="text-[color:var(--muted-foreground)]">Upper Exp.</div>
            </div>
            <div className="rounded border border-[color:var(--border)] bg-[color:var(--card)] p-2 text-center">
              <div className="font-mono font-semibold text-[color:var(--foreground)]">{archCoord.lowerExpansionMm.toFixed(2)}mm</div>
              <div className="text-[color:var(--muted-foreground)]">Lower Exp.</div>
            </div>
            <div className="rounded border border-[color:var(--border)] bg-[color:var(--card)] p-2 text-center">
              <div
                className="font-mono font-semibold"
                style={{ color: archCoord.imbalanceMm < 1 ? 'var(--clinical-safe)' : archCoord.imbalanceMm < 2.5 ? 'var(--clinical-warn)' : 'var(--clinical-danger)' }}
              >
                {archCoord.imbalanceMm.toFixed(2)}mm
              </div>
              <div className="text-[color:var(--muted-foreground)]">Imbalance</div>
            </div>
          </div>
          <p className="text-xs text-[color:var(--muted-foreground)] italic">{archCoord.recommendation}</p>
        </div>
      )}

      {/* Empty state */}
      {!sim && !loading && (
        <div className="px-4 pb-4 text-xs text-[color:var(--muted-foreground)] italic">
          Click &quot;Generate Simulation&quot; to build the stage-by-stage treatment animation from movement prescriptions.
        </div>
      )}

      {/* Disclaimer */}
      <div className="border-t border-[color:var(--border)] px-4 py-2">
        <p className="text-xs" style={{ color: 'var(--clinical-warn)' }}>
          Simulation uses linear interpolation for visualization only. Actual tooth movement may differ. Clinical assessment required before approving treatment export.
        </p>
      </div>
    </div>
  );
}
