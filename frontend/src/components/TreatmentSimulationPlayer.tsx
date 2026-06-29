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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreBar(score: number | null, label: string): JSX.Element {
  const pct = score != null ? Math.min(score * 100, 100) : 0;
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono font-medium">
          {score != null ? `${(score * 100).toFixed(0)}%` : '—'}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function metricDelta(label: string, initial: number | null, final: number | null, unit: string): JSX.Element {
  const delta = initial != null && final != null ? final - initial : null;
  return (
    <div className="text-xs">
      <span className="text-gray-500">{label}: </span>
      <span className="font-mono">{initial?.toFixed(1) ?? '—'}{unit}</span>
      <span className="text-gray-400 mx-1">→</span>
      <span className="font-mono font-semibold">{final?.toFixed(1) ?? '—'}{unit}</span>
      {delta != null && (
        <span className={`ml-1 ${delta < 0 ? 'text-green-700' : delta > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
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
  if (mag < 0.05) return '#e5e7eb'; // gray — minimal movement
  if (mag < 0.5)  return '#bbf7d0'; // green — light
  if (mag < 1.0)  return '#fde68a'; // amber — moderate
  return '#fca5a5'; // red — significant
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
                className="flex-1 aspect-square rounded-sm border border-gray-300 text-center leading-none"
              >
                <span className="text-[7px] text-gray-600 font-mono">{fdi}</span>
              </div>
            );
          })}
        </div>
      ))}
      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-gray-200 border border-gray-300" /> Minimal</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-200 border border-gray-300" /> Light</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-200 border border-gray-300" /> Moderate</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-200 border border-gray-300" /> Significant</span>
      </div>
    </div>
  );
}

// ─── Frame metrics ────────────────────────────────────────────────────────────

function FrameMetrics({ frame }: { frame: SimulationFrame }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded border border-gray-200 p-2">
        <div className="text-gray-500 mb-0.5">Upper Arch Width</div>
        <div className="font-mono font-semibold">{frame.upperArchWidthMm?.toFixed(1) ?? '—'}mm</div>
      </div>
      <div className="rounded border border-gray-200 p-2">
        <div className="text-gray-500 mb-0.5">Lower Arch Width</div>
        <div className="font-mono font-semibold">{frame.lowerArchWidthMm?.toFixed(1) ?? '—'}mm</div>
      </div>
      <div className="rounded border border-gray-200 p-2">
        <div className="text-gray-500 mb-0.5">Overjet</div>
        <div className="font-mono font-semibold">{frame.overjetMm?.toFixed(2) ?? '—'}mm</div>
      </div>
      <div className="rounded border border-gray-200 p-2">
        <div className="text-gray-500 mb-0.5">Overbite</div>
        <div className="font-mono font-semibold">{frame.overbiteM?.toFixed(2) ?? '—'}mm</div>
      </div>
      {frame.midlineDeviationMm != null && (
        <div className="col-span-2 rounded border border-gray-200 p-2">
          <div className="text-gray-500 mb-0.5">Midline Deviation</div>
          <div className={`font-mono font-semibold ${Math.abs(frame.midlineDeviationMm) > 0.5 ? 'text-amber-700' : 'text-green-700'}`}>
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
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [frameLoading, setFrameLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runGenerate = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await generateSimulation(caseId, planId);
      setSim(result);
      setStage(1);
      const [frame, coord] = await Promise.all([
        getSimulationFrame(caseId, planId, 1),
        getArchCoordination(caseId, planId),
      ]);
      setCurrentFrame(frame);
      setArchCoord(coord);
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

  useEffect(() => {
    if (!playing || !sim) return;
    intervalRef.current = setInterval(() => {
      setStage(prev => {
        const next = prev >= sim.totalFrames ? 1 : prev + 1;
        loadFrame(next);
        return next;
      });
    }, 400);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, sim, loadFrame]);

  const handleSlider = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = parseInt(e.target.value, 10);
    setStage(s);
    await loadFrame(s);
  }, [loadFrame]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Treatment Simulation Player</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Linear interpolation simulation across all aligner stages
          </p>
        </div>
        <button
          onClick={runGenerate}
          disabled={loading}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generating…' : sim ? 'Re-Generate' : 'Generate Simulation'}
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 text-xs text-red-700 bg-red-50 rounded p-3 border border-red-200">
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

          <div className="flex gap-4 flex-wrap text-xs text-gray-600 pt-1">
            {metricDelta('Overjet', sim.overjetInitialMm, sim.overjetFinalMm, 'mm')}
            {metricDelta('Overbite', sim.overbiteInitialMm, sim.overbiteFinalmm, 'mm')}
            <span className="text-gray-400">
              {sim.totalFrames} stages · {sim.generationDurationMs ? `${sim.generationDurationMs}ms` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Stage slider + playback */}
      {sim && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlaying(p => !p)}
              className={`px-3 py-1 text-xs rounded font-medium ${
                playing ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-green-100 text-green-800 border border-green-300'
              }`}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <input
              type="range"
              min={1}
              max={sim.totalFrames}
              value={stage}
              onChange={handleSlider}
              className="flex-1 accent-blue-600"
            />
            <span className="text-xs font-mono text-gray-700 w-16 text-right">
              Stage {stage}/{sim.totalFrames}
            </span>
            {currentFrame?.isKeyframe && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                Keyframe
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tooth grid + frame metrics */}
      {currentFrame && (
        <div className={`px-4 pb-4 space-y-4 ${frameLoading ? 'opacity-50' : ''}`}>
          <ToothGrid frame={currentFrame} />
          <FrameMetrics frame={currentFrame} />
        </div>
      )}

      {/* Arch coordination */}
      {archCoord && (
        <div className="border-t border-gray-200 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-gray-700">Arch Coordination</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded border border-gray-200 p-2 text-center">
              <div className="font-mono font-semibold">{archCoord.upperExpansionMm.toFixed(2)}mm</div>
              <div className="text-gray-500">Upper Exp.</div>
            </div>
            <div className="rounded border border-gray-200 p-2 text-center">
              <div className="font-mono font-semibold">{archCoord.lowerExpansionMm.toFixed(2)}mm</div>
              <div className="text-gray-500">Lower Exp.</div>
            </div>
            <div className="rounded border border-gray-200 p-2 text-center">
              <div className={`font-mono font-semibold ${archCoord.imbalanceMm < 1 ? 'text-green-700' : archCoord.imbalanceMm < 2.5 ? 'text-amber-700' : 'text-red-700'}`}>
                {archCoord.imbalanceMm.toFixed(2)}mm
              </div>
              <div className="text-gray-500">Imbalance</div>
            </div>
          </div>
          <p className="text-xs text-gray-600 italic">{archCoord.recommendation}</p>
        </div>
      )}

      {/* Empty state */}
      {!sim && !loading && (
        <div className="px-4 pb-4 text-xs text-gray-500 italic">
          Click "Generate Simulation" to build the stage-by-stage treatment animation from movement prescriptions.
        </div>
      )}

      {/* Disclaimer */}
      <div className="border-t border-gray-200 px-4 py-2">
        <p className="text-xs text-amber-700">
          Simulation uses linear interpolation for visualization only. Actual tooth movement may differ. Clinical assessment required before approving treatment export.
        </p>
      </div>
    </div>
  );
}
