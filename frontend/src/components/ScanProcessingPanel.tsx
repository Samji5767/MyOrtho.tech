'use client';

import React, { useState, useCallback } from 'react';
import {
  runAutoOrient, runAutoCleanup, assignToothIds, getToothIds, confirmToothId,
  listProcessingJobs,
  OrientationResult, CleanupResult, ToothIdResult, ProcessingJob,
} from '@/lib/api/scan-processing';

// ─── FDI Arch Grid ─────────────────────────────────────────────────────────────

const UPPER_FDI = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER_FDI = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

const ARCH_COLOR: Record<string, string> = {
  upper: 'bg-blue-100 text-blue-800 border-blue-300',
  lower: 'bg-teal-100 text-teal-800 border-teal-300',
};

function ToothGrid({
  teeth,
  onConfirm,
}: {
  teeth: ToothIdResult[];
  onConfirm: (fdi: number) => void;
}) {
  const byFdi = new Map(teeth.map(t => [t.fdiNumber, t]));

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] text-gray-500 mb-1">Upper (maxillary)</p>
        <div className="flex gap-0.5">
          {UPPER_FDI.map(fdi => {
            const tooth = byFdi.get(fdi);
            return (
              <div
                key={fdi}
                title={tooth ? `FDI ${fdi} — confidence ${(tooth.confidence * 100).toFixed(0)}%` : `FDI ${fdi} — not detected`}
                className={`w-7 h-7 rounded text-[9px] font-mono flex items-center justify-center border cursor-pointer hover:opacity-80 ${
                  tooth ? ARCH_COLOR.upper : 'bg-gray-50 text-gray-300 border-gray-200'
                }`}
                onClick={() => tooth && onConfirm(fdi)}
              >
                {fdi}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-[10px] text-gray-500 mb-1">Lower (mandibular)</p>
        <div className="flex gap-0.5">
          {LOWER_FDI.map(fdi => {
            const tooth = byFdi.get(fdi);
            return (
              <div
                key={fdi}
                title={tooth ? `FDI ${fdi} — confidence ${(tooth.confidence * 100).toFixed(0)}%` : `FDI ${fdi} — not detected`}
                className={`w-7 h-7 rounded text-[9px] font-mono flex items-center justify-center border cursor-pointer hover:opacity-80 ${
                  tooth ? ARCH_COLOR.lower : 'bg-gray-50 text-gray-300 border-gray-200'
                }`}
                onClick={() => tooth && onConfirm(fdi)}
              >
                {fdi}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Orientation card ─────────────────────────────────────────────────────────

function OrientCard({ result }: { result: OrientationResult }) {
  return (
    <div className="rounded border border-blue-200 bg-blue-50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-blue-900">
          {result.detectedArch === 'maxillary' ? 'Maxillary arch' :
           result.detectedArch === 'mandibular' ? 'Mandibular arch' : 'Unknown arch'}
        </span>
        <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded">
          {(result.confidence * 100).toFixed(0)}% confidence
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-gray-500 text-[10px]">Centroid (mm)</p>
          <p className="font-mono text-gray-800">
            X {result.centroid.x.toFixed(1)}, Y {result.centroid.y.toFixed(1)}, Z {result.centroid.z.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px]">Occlusal normal</p>
          <p className="font-mono text-gray-800">
            ({result.occlusalPlaneNormal.x},{result.occlusalPlaneNormal.y},{result.occlusalPlaneNormal.z})
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px]">Rotation correction</p>
          <p className="font-mono text-gray-800">
            Rx {result.rotationCorrection.x}° Ry {result.rotationCorrection.y}° Rz {result.rotationCorrection.z}°
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
        <div>W {(result.boundingBox.maxX - result.boundingBox.minX).toFixed(1)}mm</div>
        <div>D {(result.boundingBox.maxY - result.boundingBox.minY).toFixed(1)}mm</div>
        <div>H {(result.boundingBox.maxZ - result.boundingBox.minZ).toFixed(1)}mm</div>
      </div>
    </div>
  );
}

// ─── Cleanup card ─────────────────────────────────────────────────────────────

function CleanupCard({ result }: { result: CleanupResult }) {
  const qualityImproved = result.qualityScoreAfter != null && result.qualityScoreBefore != null
    ? result.qualityScoreAfter - result.qualityScoreBefore
    : null;

  return (
    <div className="rounded border border-green-200 bg-green-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-green-900">Cleanup Complete</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-gray-500 text-[10px]">Components removed</p>
          <p className="font-semibold text-gray-800">{result.disconnectedRemoved}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px]">Holes filled</p>
          <p className="font-semibold text-gray-800">{result.holesFilled}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px]">Spikes smoothed</p>
          <p className="font-semibold text-gray-800">{result.spikesSmoothed}</p>
        </div>
      </div>
      {result.verticesBefore != null && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-gray-500 text-[10px]">Vertices before</p>
            <p className="font-mono text-gray-800">{result.verticesBefore.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[10px]">Vertices after</p>
            <p className="font-mono text-gray-800">{result.verticesAfter?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[10px]">Reduction</p>
            <p className="font-mono text-gray-800">{result.reductionPct?.toFixed(1)}%</p>
          </div>
        </div>
      )}
      {qualityImproved != null && (
        <div className="text-xs">
          <span className="text-gray-500">Quality: </span>
          <span className="font-mono">{((result.qualityScoreBefore ?? 0) * 100).toFixed(0)}</span>
          <span className="text-gray-400 mx-1">→</span>
          <span className="font-mono font-semibold text-green-800">
            {((result.qualityScoreAfter ?? 0) * 100).toFixed(0)}
          </span>
          <span className="ml-1 text-green-700 text-[10px]">(+{(qualityImproved * 100).toFixed(0)} pts)</span>
        </div>
      )}
      {result.trimPlaneZ != null && (
        <div className="text-xs text-gray-500">
          Gingival trim at Z={result.trimPlaneZ.toFixed(1)}mm — {result.trimmedVertices?.toLocaleString()} vertices trimmed
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  scanId: string;
}

type TabId = 'orient' | 'cleanup' | 'tooth-id' | 'jobs';

export default function ScanProcessingPanel({ caseId, scanId }: Props) {
  const [tab, setTab] = useState<TabId>('orient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orientResult, setOrientResult] = useState<OrientationResult | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [toothIds, setToothIds] = useState<ToothIdResult[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [confirmingFdi, setConfirmingFdi] = useState<number | null>(null);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'orient',   label: 'Auto-Orient' },
    { id: 'cleanup',  label: 'Cleanup & Trim' },
    { id: 'tooth-id', label: 'Tooth ID' },
    { id: 'jobs',     label: 'Jobs' },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Auto Scan Processing</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Automated arch orientation, model cleanup, trimming, and FDI tooth identification
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
        )}

        {/* Auto-Orient Tab */}
        {tab === 'orient' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-600">
              Detects arch type (maxillary/mandibular), computes occlusal plane normal,
              and calculates the rotation correction needed for standard dental orientation.
            </p>
            <button
              onClick={() => run(async () => setOrientResult(await runAutoOrient(caseId, scanId)))}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Running…' : 'Run Auto-Orient'}
            </button>
            {orientResult && <OrientCard result={orientResult} />}
          </div>
        )}

        {/* Cleanup & Trim Tab */}
        {tab === 'cleanup' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-600">
              Removes disconnected mesh components, fills surface holes, smooths spike artifacts,
              and trims the gingival base at the detected occlusal plane.
            </p>
            <button
              onClick={() => run(async () => setCleanupResult(await runAutoCleanup(caseId, scanId)))}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Running…' : 'Run Cleanup & Trim'}
            </button>
            {cleanupResult && <CleanupCard result={cleanupResult} />}
          </div>
        )}

        {/* Tooth ID Tab */}
        {tab === 'tooth-id' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-600">
              Assigns FDI tooth numbers from segmentation label classes. Click a tooth cell to confirm its assignment.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => run(async () => setToothIds(await assignToothIds(caseId, scanId)))}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Running…' : 'Assign Tooth IDs'}
              </button>
              <button
                onClick={() => run(async () => setToothIds(await getToothIds(caseId, scanId)))}
                disabled={loading}
                className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Load Existing
              </button>
            </div>
            {toothIds.length > 0 && (
              <>
                <div className="flex gap-4 text-xs text-gray-600">
                  <span className="font-semibold">{toothIds.length} teeth assigned</span>
                  <span>{toothIds.filter(t => t.arch === 'upper').length} upper</span>
                  <span>{toothIds.filter(t => t.arch === 'lower').length} lower</span>
                  <span>
                    Avg confidence{' '}
                    {(toothIds.reduce((s, t) => s + t.confidence, 0) / toothIds.length * 100).toFixed(0)}%
                  </span>
                </div>
                <ToothGrid
                  teeth={toothIds}
                  onConfirm={fdi => setConfirmingFdi(fdi)}
                />
                {confirmingFdi != null && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-800">Confirm FDI {confirmingFdi}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => run(async () => {
                          await confirmToothId(caseId, scanId, confirmingFdi);
                          setConfirmingFdi(null);
                        })}
                        disabled={loading}
                        className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                      >
                        Confirm as FDI {confirmingFdi}
                      </button>
                      <button
                        onClick={() => setConfirmingFdi(null)}
                        className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            <p className="text-[10px] text-gray-400">
              Tooth ID assignments are automated suggestions. Clinician confirmation required before treatment planning.
            </p>
          </div>
        )}

        {/* Jobs Tab */}
        {tab === 'jobs' && (
          <div className="space-y-3">
            <button
              onClick={() => run(async () => setJobs(await listProcessingJobs(caseId, scanId)))}
              disabled={loading}
              className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Refresh Jobs'}
            </button>
            {jobs.length === 0 && (
              <p className="text-xs text-gray-400 italic">No processing jobs yet.</p>
            )}
            {jobs.map(job => (
              <div key={job.id} className="rounded border border-gray-200 p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-gray-500 text-[10px]">{job.id.slice(0, 8)}</span>
                  <span className="font-semibold text-gray-800">{job.jobType}</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded ${
                    job.status === 'completed' ? 'bg-green-100 text-green-700' :
                    job.status === 'failed'    ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{job.status}</span>
                  {job.durationMs != null && (
                    <span className="text-gray-400 ml-auto">{job.durationMs}ms</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
