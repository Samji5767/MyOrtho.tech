'use client';

import React, { useState, useCallback } from 'react';
import {
  optimizeAttachments,
  getAttachmentLibrary,
  getAttachmentForceAnalysis,
  getAttachmentCollisions,
  validateAttachmentManufacturing,
  AttachmentLibraryEntry,
  AttachmentForceVector,
  AttachmentCollision,
  AttachmentOptimizationResult,
  ManufacturingValidation,
} from '@/lib/api/attachment-intelligence';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityClass(sev: string): string {
  if (sev === 'critical') return 'text-red-700 bg-red-50 border-red-200';
  if (sev === 'warning') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-blue-700 bg-blue-50 border-blue-200';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LibraryTable({ entries }: { entries: AttachmentLibraryEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2 border border-gray-200">Name</th>
            <th className="p-2 border border-gray-200">Type</th>
            <th className="p-2 border border-gray-200">D×W×H (mm)</th>
            <th className="p-2 border border-gray-200">Retention</th>
            <th className="p-2 border border-gray-200">Torque Eff.</th>
            <th className="p-2 border border-gray-200">Source</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id} className="hover:bg-gray-50">
              <td className="p-2 border border-gray-200 font-medium">{e.name}</td>
              <td className="p-2 border border-gray-200 text-center capitalize">{e.attachmentType.replace(/_/g, ' ')}</td>
              <td className="p-2 border border-gray-200 text-center">
                {e.depthMm.toFixed(1)}×{e.widthMm.toFixed(1)}×{e.heightMm.toFixed(1)}
              </td>
              <td className="p-2 border border-gray-200 text-center">
                <span
                  className={`inline-block px-1 rounded text-xs font-semibold ${
                    e.retentionScore >= 0.8 ? 'bg-green-100 text-green-700' :
                    e.retentionScore >= 0.6 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {(e.retentionScore * 100).toFixed(0)}%
                </span>
              </td>
              <td className="p-2 border border-gray-200 text-center">
                {(e.torqueEfficiency * 100).toFixed(0)}%
              </td>
              <td className="p-2 border border-gray-200 text-center">
                {e.isSystem ? (
                  <span className="text-gray-500 text-xs">System</span>
                ) : (
                  <span className="text-blue-600 text-xs font-medium">Custom</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForceVectorTable({ vectors }: { vectors: AttachmentForceVector[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border border-gray-200">FDI</th>
            <th className="p-2 border border-gray-200">Type</th>
            <th className="p-2 border border-gray-200">Force (N)</th>
            <th className="p-2 border border-gray-200">Moment (N·mm)</th>
            <th className="p-2 border border-gray-200">Fx/Fy/Fz</th>
            <th className="p-2 border border-gray-200">Efficiency</th>
          </tr>
        </thead>
        <tbody>
          {vectors.map((v, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="p-2 border border-gray-200 text-center font-mono font-semibold">{v.toothFdi}</td>
              <td className="p-2 border border-gray-200 capitalize">{v.attachmentType.replace(/_/g, ' ')}</td>
              <td className="p-2 border border-gray-200 text-center">{v.forceMagnitudeN.toFixed(3)}</td>
              <td className="p-2 border border-gray-200 text-center">{v.momentMagnitudeNmm.toFixed(3)}</td>
              <td className="p-2 border border-gray-200 text-center font-mono text-xs">
                {v.forceX.toFixed(2)}/{v.forceY.toFixed(2)}/{v.forceZ.toFixed(2)}
              </td>
              <td className="p-2 border border-gray-200 text-center">
                <span
                  className={`inline-block px-1 rounded text-xs font-semibold ${
                    v.efficiencyScore >= 0.8 ? 'bg-green-100 text-green-700' :
                    v.efficiencyScore >= 0.6 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {(v.efficiencyScore * 100).toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollisionList({ collisions }: { collisions: AttachmentCollision[] }) {
  if (collisions.length === 0) {
    return (
      <p className="text-sm text-green-700 bg-green-50 rounded p-3 border border-green-200">
        No attachment collisions detected.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {collisions.map((c, i) => (
        <li key={i} className={`text-xs rounded p-3 border ${severityClass(c.severity)}`}>
          <div className="font-semibold">
            FDI {c.toothFdiA}–{c.toothFdiB} — {c.collisionType.replace(/_/g, ' ')}
            {' '}({c.overlapMm.toFixed(2)}mm overlap)
          </div>
          <div className="mt-1">{c.recommendation}</div>
        </li>
      ))}
    </ul>
  );
}

function PlacementsTable({ result }: { result: AttachmentOptimizationResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border border-gray-200">FDI</th>
            <th className="p-2 border border-gray-200">Attachment</th>
            <th className="p-2 border border-gray-200">Score</th>
            <th className="p-2 border border-gray-200">Reason</th>
          </tr>
        </thead>
        <tbody>
          {result.placements.map((p, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="p-2 border border-gray-200 text-center font-mono font-semibold">{p.toothFdi}</td>
              <td className="p-2 border border-gray-200">{p.selectedAttachmentName}</td>
              <td className="p-2 border border-gray-200 text-center">
                <span
                  className={`inline-block px-1 rounded text-xs font-semibold ${
                    p.score >= 0.8 ? 'bg-green-100 text-green-700' :
                    p.score >= 0.6 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {(p.score * 100).toFixed(0)}%
                </span>
              </td>
              <td className="p-2 border border-gray-200 text-gray-600">{p.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

type Tab = 'library' | 'optimize' | 'forces' | 'collisions';

export default function AttachmentIntelligencePanel({ caseId, planId }: Props) {
  const [tab, setTab] = useState<Tab>('library');
  const [library, setLibrary] = useState<AttachmentLibraryEntry[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<AttachmentOptimizationResult | null>(null);
  const [forces, setForces] = useState<AttachmentForceVector[]>([]);
  const [collisions, setCollisions] = useState<AttachmentCollision[]>([]);
  const [mfgValidation, setMfgValidation] = useState<ManufacturingValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getAttachmentLibrary(caseId, planId);
      setLibrary(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const runOptimize = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await optimizeAttachments(caseId, planId);
      setOptimizationResult(result);
      setForces(result.forceVectors);
      setCollisions(result.collisions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const loadForces = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getAttachmentForceAnalysis(caseId, planId);
      setForces(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const loadCollisions = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cols, mfg] = await Promise.all([
        getAttachmentCollisions(caseId, planId),
        validateAttachmentManufacturing(caseId, planId),
      ]);
      setCollisions(cols);
      setMfgValidation(mfg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'library', label: 'Library' },
    { id: 'optimize', label: 'Optimize' },
    { id: 'forces', label: 'Force Vectors' },
    { id: 'collisions', label: 'Collisions & MFG' },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Attachment Intelligence</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Optimized attachment selection, force vectors, and manufacturing validation
          </p>
        </div>
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

        {/* Library Tab */}
        {tab === 'library' && (
          <div className="space-y-3">
            <button
              onClick={loadLibrary}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load Library'}
            </button>
            {library.length > 0 && <LibraryTable entries={library} />}
            {library.length === 0 && !loading && (
              <p className="text-xs text-gray-500 italic">Click "Load Library" to view available attachments.</p>
            )}
          </div>
        )}

        {/* Optimize Tab */}
        {tab === 'optimize' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={runOptimize}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Optimizing…' : 'Run Optimization'}
              </button>
              {optimizationResult && (
                <span className={`text-xs font-medium ${optimizationResult.manufacturingValid ? 'text-green-700' : 'text-red-700'}`}>
                  MFG: {optimizationResult.manufacturingValid ? 'Valid' : 'Issues Found'}
                </span>
              )}
            </div>

            {optimizationResult && (
              <>
                {/* Summary strip */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded border border-gray-200 p-2 text-center">
                    <div className="text-lg font-bold text-gray-900">{optimizationResult.placements.length}</div>
                    <div className="text-xs text-gray-500">Placements</div>
                  </div>
                  <div className="rounded border border-gray-200 p-2 text-center">
                    <div className={`text-lg font-bold ${optimizationResult.collisions.length === 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {optimizationResult.collisions.length}
                    </div>
                    <div className="text-xs text-gray-500">Collisions</div>
                  </div>
                  <div className="rounded border border-gray-200 p-2 text-center">
                    <div className={`text-lg font-bold ${optimizationResult.manufacturingValid ? 'text-green-700' : 'text-red-700'}`}>
                      {optimizationResult.manufacturingValid ? '✓' : '✗'}
                    </div>
                    <div className="text-xs text-gray-500">MFG Valid</div>
                  </div>
                </div>

                <PlacementsTable result={optimizationResult} />

                {optimizationResult.manufacturingIssues.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-red-700">Manufacturing Issues:</p>
                    {optimizationResult.manufacturingIssues.map((issue, i) => (
                      <div key={i} className="text-xs text-red-700 bg-red-50 rounded p-2 border border-red-200">
                        {issue.message} (value: {issue.value}mm, min: {issue.minimum}mm)
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!optimizationResult && !loading && (
              <p className="text-xs text-gray-500 italic">
                Run optimization to select best attachments per tooth based on movement prescriptions.
              </p>
            )}
          </div>
        )}

        {/* Force Vectors Tab */}
        {tab === 'forces' && (
          <div className="space-y-3">
            <button
              onClick={loadForces}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load Force Analysis'}
            </button>
            {forces.length > 0 && <ForceVectorTable vectors={forces} />}
            {forces.length === 0 && !loading && (
              <p className="text-xs text-gray-500 italic">
                Run optimization first, then view force vectors here.
              </p>
            )}
          </div>
        )}

        {/* Collisions & MFG Tab */}
        {tab === 'collisions' && (
          <div className="space-y-4">
            <button
              onClick={loadCollisions}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Check Collisions & MFG'}
            </button>

            {(collisions.length > 0 || mfgValidation) && (
              <>
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Collision Analysis</p>
                  <CollisionList collisions={collisions} />
                </div>

                {mfgValidation && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Manufacturing Validation</p>
                    {mfgValidation.isValid ? (
                      <p className="text-xs text-green-700 bg-green-50 rounded p-3 border border-green-200">
                        All attachment dimensions meet manufacturing tolerances.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {mfgValidation.issues.map((issue, i) => (
                          <div key={i} className="text-xs text-red-700 bg-red-50 rounded p-2 border border-red-200">
                            {issue.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {collisions.length === 0 && !mfgValidation && !loading && (
              <p className="text-xs text-gray-500 italic">
                Click above to validate attachment spacing and manufacturing tolerances.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="border-t border-gray-200 px-4 py-2">
        <p className="text-xs text-amber-700">
          Attachment recommendations are clinical decision support only. Clinician review and approval required before manufacturing.
        </p>
      </div>
    </div>
  );
}
