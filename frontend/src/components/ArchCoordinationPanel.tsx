'use client';

import React, { useState, useCallback } from 'react';
import {
  coordinatePlan,
  getCheckpoints,
  evaluateCheckpoint,
  getSyncAllocations,
  approveCoordinationPlan,
  ArchCoordinationPlan,
  ArchCheckpoint,
  ArchSyncAllocation,
} from '@/lib/api/arch-coordination';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STRATEGY_LABELS: Record<string, string> = {
  simultaneous: 'Simultaneous',
  upper_first:  'Upper First (+3 stage offset)',
  lower_first:  'Lower First (+3 stage offset)',
  alternating:  'Alternating Arches',
};

const STRATEGY_DESC: Record<string, string> = {
  simultaneous: 'Upper and lower arches move together in every stage. Best for cases with similar movement complexity.',
  upper_first:  'Upper arch begins treatment 3 stages before lower. Used when upper arch needs preparatory expansion first.',
  lower_first:  'Lower arch begins treatment 3 stages before upper. Used when lower proclination must be corrected before upper.',
  alternating:  'Arch emphasis alternates every stage. Can reduce total force magnitude but increases total stage count.',
};

const CHECKPOINT_TYPE_LABELS: Record<string, string> = {
  occlusion_check:   'Occlusion Check',
  midline_check:     'Midline Check',
  arch_width_check:  'Arch Width Check',
  bolton_check:      'Bolton Check',
  overjet_check:     'Overjet Check',
  overbite_check:    'Overbite Check',
  expansion_sync:    'Expansion Sync',
};

const STATUS_STYLE: Record<string, string> = {
  pending:  'border-gray-300 bg-white text-gray-700',
  passed:   'border-green-300 bg-green-50 text-green-800',
  failed:   'border-red-300 bg-red-50 text-red-800',
  deferred: 'border-amber-300 bg-amber-50 text-amber-700',
};

function scoreBar(score: number | null, label: string): JSX.Element {
  const pct = score != null ? Math.min(score * 100, 100) : 0;
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono">{score != null ? `${pct.toFixed(0)}%` : '—'}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Checkpoint card ──────────────────────────────────────────────────────────

function CheckpointCard({
  checkpoint,
  onEvaluate,
}: {
  checkpoint: ArchCheckpoint;
  onEvaluate: (id: string, status: 'passed' | 'failed' | 'deferred', note?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');

  return (
    <div className={`rounded border text-xs p-3 ${STATUS_STYLE[checkpoint.status]}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold">Stage {checkpoint.checkpointStage}</span>
            <span className="text-gray-500">·</span>
            <span>{CHECKPOINT_TYPE_LABELS[checkpoint.checkpointType] ?? checkpoint.checkpointType}</span>
            {checkpoint.isMandatory && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded border border-red-200">Required</span>
            )}
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold capitalize ${
              checkpoint.status === 'passed' ? 'bg-green-200 text-green-800' :
              checkpoint.status === 'failed' ? 'bg-red-200 text-red-800' :
              checkpoint.status === 'deferred' ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-700'
            }`}>
              {checkpoint.status}
            </span>
          </div>
          <p className="text-gray-600">{checkpoint.description}</p>
          {checkpoint.targetValueMm != null && (
            <p className="text-gray-500 mt-0.5">
              Target: {checkpoint.targetValueMm.toFixed(1)}mm ±{checkpoint.toleranceMm?.toFixed(1) ?? '?'}mm
            </p>
          )}
          {checkpoint.clinicalNote && (
            <p className="mt-1 italic text-gray-600">"{checkpoint.clinicalNote}"</p>
          )}
        </div>
        {checkpoint.status === 'pending' && (
          <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600 shrink-0">
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {expanded && checkpoint.status === 'pending' && (
        <div className="mt-2 space-y-2">
          <textarea
            placeholder="Clinical note (optional)…"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="w-full text-xs p-1.5 border border-gray-300 rounded bg-white text-gray-800 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onEvaluate(checkpoint.id, 'passed', note || undefined)}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              Pass
            </button>
            <button
              onClick={() => onEvaluate(checkpoint.id, 'failed', note || undefined)}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              Fail
            </button>
            <button
              onClick={() => onEvaluate(checkpoint.id, 'deferred', note || undefined)}
              className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            >
              Defer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sync timeline strip ──────────────────────────────────────────────────────

function SyncTimeline({ allocations }: { allocations: ArchSyncAllocation[] }) {
  const maxSync = Math.max(...allocations.map(a => a.synchronizedStage), 1);
  const upperByStage = new Map<number, number>();
  const lowerByStage = new Map<number, number>();

  for (const a of allocations) {
    const map = a.arch === 'upper' ? upperByStage : lowerByStage;
    map.set(a.synchronizedStage, (map.get(a.synchronizedStage) ?? 0) + 1);
  }

  const stages = Array.from({ length: maxSync }, (_, i) => i + 1);

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-700 mb-1">Synchronized Stage Timeline</div>
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {stages.map(s => {
          const u = upperByStage.get(s) ?? 0;
          const l = lowerByStage.get(s) ?? 0;
          return (
            <div key={s} title={`Stage ${s}: ${u} upper, ${l} lower movements`} className="flex-shrink-0 w-5 space-y-0.5">
              <div
                className="h-3 rounded-sm border"
                style={{ backgroundColor: u > 0 ? `rgba(59,130,246,${Math.min(0.2 + u * 0.1, 1)})` : 'var(--clinical-neutral-tint)', borderColor: u > 0 ? '#93c5fd' : 'var(--clinical-track)' }}
              />
              <div
                className="h-3 rounded-sm border"
                style={{ backgroundColor: l > 0 ? `rgba(16,185,129,${Math.min(0.2 + l * 0.1, 1)})` : 'var(--clinical-neutral-tint)', borderColor: l > 0 ? '#6ee7b7' : 'var(--clinical-track)' }}
              />
              {s % 5 === 0 && <div className="text-[8px] text-gray-400 text-center">{s}</div>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm bg-blue-200 border border-blue-300" /> Upper
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm bg-emerald-200 border border-emerald-300" /> Lower
        </span>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

type Tab = 'plan' | 'checkpoints' | 'timeline';

export default function ArchCoordinationPanel({ caseId, planId }: Props) {
  const [tab, setTab] = useState<Tab>('plan');
  const [plan, setPlan] = useState<ArchCoordinationPlan | null>(null);
  const [checkpoints, setCheckpoints] = useState<ArchCheckpoint[]>([]);
  const [allocations, setAllocations] = useState<ArchSyncAllocation[]>([]);
  const [strategy, setStrategy] = useState<'simultaneous' | 'upper_first' | 'lower_first' | 'alternating'>('simultaneous');
  const [expansionCoord, setExpansionCoord] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCoordinate = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await coordinatePlan(caseId, planId, strategy, expansionCoord);
      setPlan(result);
      const [cps, allocs] = await Promise.all([
        getCheckpoints(caseId, planId),
        getSyncAllocations(caseId, planId),
      ]);
      setCheckpoints(cps);
      setAllocations(allocs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId, strategy, expansionCoord]);

  const loadCheckpoints = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const cps = await getCheckpoints(caseId, planId);
      setCheckpoints(cps);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const loadTimeline = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const allocs = await getSyncAllocations(caseId, planId);
      setAllocations(allocs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const handleEvaluate = useCallback(async (
    id: string,
    status: 'passed' | 'failed' | 'deferred',
    note?: string,
  ) => {
    try {
      const updated = await evaluateCheckpoint(caseId, planId, id, status, note);
      setCheckpoints(prev => prev.map(c => c.id === id ? updated : c));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [caseId, planId]);

  const handleApprove = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const updated = await approveCoordinationPlan(caseId, planId);
      setPlan(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const pendingCheckpoints = checkpoints.filter(c => c.status === 'pending' && c.isMandatory).length;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'plan', label: 'Coordination Plan' },
    { id: 'checkpoints', label: `Checkpoints${checkpoints.length > 0 ? ` (${pendingCheckpoints} pending)` : ''}` },
    { id: 'timeline', label: 'Sync Timeline' },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Multi-Arch Treatment Coordinator</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Cross-arch staging, occlusion checkpoints, synchronized treatment timeline
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id === 'checkpoints' && checkpoints.length === 0) loadCheckpoints();
              if (t.id === 'timeline' && allocations.length === 0) loadTimeline();
            }}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 rounded p-3 border border-red-200">
            {error}
          </div>
        )}

        {/* Plan tab */}
        {tab === 'plan' && (
          <div className="space-y-4">
            {/* Strategy selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">Coordination Strategy</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(STRATEGY_LABELS) as Array<keyof typeof STRATEGY_LABELS>).map(s => (
                  <label
                    key={s}
                    className={`flex items-start gap-2 text-xs p-2 rounded border cursor-pointer ${
                      strategy === s ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      value={s}
                      checked={strategy === s}
                      onChange={() => setStrategy(s as typeof strategy)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span>
                      <span className="font-medium text-gray-900">{STRATEGY_LABELS[s]}</span>
                      <span className="block text-gray-500 mt-0.5">{STRATEGY_DESC[s]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={expansionCoord}
                onChange={e => setExpansionCoord(e.target.checked)}
                className="accent-blue-600"
              />
              <span className="text-gray-700">Apply expansion coordination (link upper/lower expansion amounts)</span>
            </label>

            <div className="flex items-center gap-3">
              <button
                onClick={runCoordinate}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Coordinating…' : plan ? 'Re-Coordinate' : 'Run Coordination'}
              </button>
              {plan?.approvedAt == null && plan != null && (
                <button
                  onClick={handleApprove}
                  disabled={loading || pendingCheckpoints > 0}
                  className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  title={pendingCheckpoints > 0 ? `${pendingCheckpoints} mandatory checkpoints still pending` : ''}
                >
                  Approve Plan
                </button>
              )}
              {plan?.approvedAt && (
                <span className="text-xs text-green-700 font-medium">
                  ✓ Approved {new Date(plan.approvedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Results */}
            {plan && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded border border-gray-200 p-2 text-center">
                    <div className="text-lg font-bold text-gray-900">{plan.upperTotalStages ?? '—'}</div>
                    <div className="text-xs text-gray-500">Upper Stages</div>
                  </div>
                  <div className="rounded border border-gray-200 p-2 text-center">
                    <div className="text-lg font-bold text-gray-900">{plan.lowerTotalStages ?? '—'}</div>
                    <div className="text-xs text-gray-500">Lower Stages</div>
                  </div>
                  <div className="rounded border border-gray-200 p-2 text-center">
                    <div className="text-lg font-bold text-blue-700">{plan.synchronizedStages ?? '—'}</div>
                    <div className="text-xs text-gray-500">Sync Stages</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {scoreBar(plan.coordinationScore, 'Coordination Score')}
                  <div className="text-xs space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Arch Width Discrepancy</span>
                      <span className={`font-mono ${(plan.archWidthDiscrepancyMm ?? 0) > 2 ? 'text-amber-700' : 'text-green-700'}`}>
                        {plan.archWidthDiscrepancyMm?.toFixed(2) ?? '—'}mm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phase Offset</span>
                      <span className="font-mono">{plan.phaseOffsetStages} stages</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!plan && !loading && (
              <p className="text-xs text-gray-500 italic">
                Select a strategy and run coordination to synchronize upper and lower arches.
              </p>
            )}
          </div>
        )}

        {/* Checkpoints tab */}
        {tab === 'checkpoints' && (
          <div className="space-y-2">
            <button
              onClick={loadCheckpoints}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Refresh Checkpoints'}
            </button>
            {checkpoints.length > 0 && (
              <div className="space-y-2">
                {checkpoints.map(c => (
                  <CheckpointCard key={c.id} checkpoint={c} onEvaluate={handleEvaluate} />
                ))}
              </div>
            )}
            {checkpoints.length === 0 && !loading && (
              <p className="text-xs text-gray-500 italic">
                Run coordination to generate clinical checkpoints.
              </p>
            )}
          </div>
        )}

        {/* Timeline tab */}
        {tab === 'timeline' && (
          <div className="space-y-3">
            <button
              onClick={loadTimeline}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load Timeline'}
            </button>
            {allocations.length > 0 && <SyncTimeline allocations={allocations} />}
            {allocations.length > 0 && (
              <div className="text-xs text-gray-500">
                {allocations.filter(a => a.arch === 'upper').length} upper · {allocations.filter(a => a.arch === 'lower').length} lower allocations across {Math.max(...allocations.map(a => a.synchronizedStage), 0)} synchronized stages
              </div>
            )}
            {allocations.length === 0 && !loading && (
              <p className="text-xs text-gray-500 italic">
                Run coordination first to see the synchronized movement timeline.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="border-t border-gray-200 px-4 py-2">
        <p className="text-xs text-amber-700">
          Arch coordination is a clinical planning aid. Clinician approval and checkpoint evaluation required before treatment export.
        </p>
      </div>
    </div>
  );
}
