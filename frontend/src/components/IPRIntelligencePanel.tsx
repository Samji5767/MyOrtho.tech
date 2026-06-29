'use client';

import React, { useState, useCallback } from 'react';
import {
  optimizeIpr,
  getIprEnamelAnalysis,
  getIprClinicalWarnings,
  IprEnamelEstimate,
  IprClinicalWarning,
  IprOptimizationResult,
} from '@/lib/api/ipr-intelligence';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityClass(sev: string): string {
  if (sev === 'critical') return 'text-red-700 bg-red-50 border-red-200';
  if (sev === 'warning') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-blue-700 bg-blue-50 border-blue-200';
}

function safetyBar(remaining: number, safe: boolean): JSX.Element {
  const pct = Math.min((remaining / 2.5) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${safe ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${safe ? 'text-green-700' : 'text-red-700'}`}>
        {remaining.toFixed(2)}mm
      </span>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EnamelTable({ estimates }: { estimates: IprEnamelEstimate[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border border-gray-200">Contact</th>
            <th className="p-2 border border-gray-200">Enamel A (mm)</th>
            <th className="p-2 border border-gray-200">Enamel B (mm)</th>
            <th className="p-2 border border-gray-200">Available IPR</th>
            <th className="p-2 border border-gray-200">Recommended</th>
            <th className="p-2 border border-gray-200">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {estimates.map((e, i) => (
            <tr key={i} className={`hover:bg-gray-50 ${!e.isSafe ? 'bg-red-50' : ''}`}>
              <td className="p-2 border border-gray-200 text-center font-mono font-semibold">
                {e.fdiA}–{e.fdiB}
              </td>
              <td className="p-2 border border-gray-200 text-center">{e.enamelAMm.toFixed(1)}</td>
              <td className="p-2 border border-gray-200 text-center">{e.enamelBMm.toFixed(1)}</td>
              <td className="p-2 border border-gray-200 text-center">{e.availableIprMm.toFixed(2)}</td>
              <td className="p-2 border border-gray-200 text-center font-semibold">
                {e.recommendedIprMm.toFixed(2)}mm
              </td>
              <td className="p-2 border border-gray-200 min-w-[120px]">
                {safetyBar(e.remainingEnamelMm, e.isSafe)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WarningList({ warnings }: { warnings: IprClinicalWarning[] }) {
  if (warnings.length === 0) {
    return (
      <p className="text-xs text-green-700 bg-green-50 rounded p-3 border border-green-200">
        No clinical warnings — all IPR contacts within Sheridan safety limits.
      </p>
    );
  }
  const bySeverity: Record<string, IprClinicalWarning[]> = { critical: [], warning: [], info: [] };
  for (const w of warnings) {
    (bySeverity[w.severity] ??= []).push(w);
  }
  return (
    <div className="space-y-2">
      {(['critical', 'warning', 'info'] as const).map(sev =>
        (bySeverity[sev] ?? []).length > 0 ? (
          <div key={sev}>
            <p className="text-xs font-semibold text-gray-700 mb-1 capitalize">{sev}</p>
            <ul className="space-y-1">
              {(bySeverity[sev] ?? []).map((w, i) => (
                <li key={i} className={`text-xs rounded p-2 border ${severityClass(sev)}`}>
                  <span className="font-mono font-semibold">FDI {w.fdiA}–{w.fdiB}</span>
                  {' — '}{w.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}

function OptimizedItemsList({ items }: { items: IprOptimizationResult['optimizedItems'] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-green-700 bg-green-50 rounded p-3 border border-green-200">
        All contacts already within safe IPR limits — no adjustments needed.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-xs bg-amber-50 rounded p-2 border border-amber-200 text-amber-800">
          <span className="font-mono font-semibold">FDI {item.fdiA}–{item.fdiB}</span>
          {': '}
          {item.originalMm.toFixed(2)}mm → {item.optimizedMm.toFixed(2)}mm — {item.reason}
        </li>
      ))}
    </ul>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

type Tab = 'optimize' | 'enamel' | 'warnings';

export default function IPRIntelligencePanel({ caseId, planId }: Props) {
  const [tab, setTab] = useState<Tab>('optimize');
  const [result, setResult] = useState<IprOptimizationResult | null>(null);
  const [estimates, setEstimates] = useState<IprEnamelEstimate[]>([]);
  const [warnings, setWarnings] = useState<IprClinicalWarning[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runOptimize = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await optimizeIpr(caseId, planId);
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const loadEnamel = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getIprEnamelAnalysis(caseId, planId);
      setEstimates(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const loadWarnings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getIprClinicalWarnings(caseId, planId);
      setWarnings(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'optimize', label: 'IPR Optimization' },
    { id: 'enamel', label: 'Enamel Analysis' },
    { id: 'warnings', label: 'Clinical Warnings' },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">IPR Intelligence</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Sheridan enamel safety analysis, contact-by-contact IPR optimization
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
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

      {/* Body */}
      <div className="p-4 space-y-4">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 rounded p-3 border border-red-200">
            {error}
          </div>
        )}

        {/* Optimize Tab */}
        {tab === 'optimize' && (
          <div className="space-y-3">
            <button
              onClick={runOptimize}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Optimizing…' : 'Run IPR Optimization'}
            </button>

            {result && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded border border-gray-200 p-2 text-center">
                    <div className="text-lg font-bold text-gray-900">{result.totalIprMm.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Total IPR (mm)</div>
                  </div>
                  <div className="rounded border border-gray-200 p-2 text-center">
                    <div className="text-lg font-bold text-gray-900">{result.pairsOptimized}</div>
                    <div className="text-xs text-gray-500">Pairs Optimized</div>
                  </div>
                  <div className="rounded border border-gray-200 p-2 text-center">
                    <div className={`text-lg font-bold ${result.enamelSafetyPassed ? 'text-green-700' : 'text-red-700'}`}>
                      {result.enamelSafetyPassed ? 'Pass' : 'Fail'}
                    </div>
                    <div className="text-xs text-gray-500">Enamel Safety</div>
                  </div>
                  <div className="rounded border border-gray-200 p-2 text-center">
                    <div className={`text-lg font-bold ${result.clinicalWarningCount === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                      {result.clinicalWarningCount}
                    </div>
                    <div className="text-xs text-gray-500">Warnings</div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Adjustments Made</p>
                  <OptimizedItemsList items={result.optimizedItems} />
                </div>
              </>
            )}

            {!result && !loading && (
              <p className="text-xs text-gray-500 italic">
                Optimization applies Sheridan 0.5mm minimum enamel safety and 0.5mm/session maximum IPR caps.
              </p>
            )}
          </div>
        )}

        {/* Enamel Analysis Tab */}
        {tab === 'enamel' && (
          <div className="space-y-3">
            <button
              onClick={loadEnamel}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load Enamel Analysis'}
            </button>
            {estimates.length > 0 && <EnamelTable estimates={estimates} />}
            {estimates.length === 0 && !loading && (
              <p className="text-xs text-gray-500 italic">
                Run IPR Optimization first to populate enamel estimates.
              </p>
            )}
          </div>
        )}

        {/* Warnings Tab */}
        {tab === 'warnings' && (
          <div className="space-y-3">
            <button
              onClick={loadWarnings}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load Clinical Warnings'}
            </button>
            {(warnings.length > 0 || (loading === false && tab === 'warnings')) && (
              <WarningList warnings={warnings} />
            )}
            {warnings.length === 0 && !loading && (
              <p className="text-xs text-gray-500 italic">
                Click above to check for enamel safety and clinical risk warnings.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="border-t border-gray-200 px-4 py-2">
        <p className="text-xs text-amber-700">
          IPR recommendations are based on Sheridan 1985 estimates. Clinician must verify enamel thickness radiographically before proceeding.
        </p>
      </div>
    </div>
  );
}
