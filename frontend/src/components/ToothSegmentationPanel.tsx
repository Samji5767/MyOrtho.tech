'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button, Card, ProgressBar, StatusBadge, Spinner } from '@/components/DesignSystem';
import { api } from '@/lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type ArchType = 'upper' | 'lower' | 'both';
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'ai_complete' | 'reviewed';

interface ToothSegment {
  toothNumber: number;
  label?: string;
  confidence: number | null;
  estimatedWidthMm?: number | null;
  isMissing: boolean;
  isSupernumerary: boolean;
  arch: 'upper' | 'lower' | null;
}

interface SegmentationJob {
  id: string;
  status: JobStatus;
  progress: number;
  toothCount: number | null;
  arch: ArchType;
  overallConfidence?: number | null;
  segments?: ToothSegment[];
  errorMessage?: string | null;
}

// ─── Arch layouts ─────────────────────────────────────────────────────────────

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceTone(c: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (c === null) return 'neutral';
  if (c >= 0.85) return 'success';
  if (c >= 0.6) return 'warning';
  return 'danger';
}

function confidenceBarTone(c: number | null): 'success' | 'warning' | 'danger' {
  if (c === null) return 'danger';
  if (c >= 0.85) return 'success';
  if (c >= 0.6) return 'warning';
  return 'danger';
}

function toothLabel(num: number): string {
  const molar = [18, 17, 28, 27, 38, 37, 48, 47];
  const premolar = [16, 15, 26, 25, 36, 35, 46, 45];
  const canine = [13, 23, 33, 43];
  const lateral = [12, 22, 32, 42];
  const central = [11, 21, 31, 41];
  if (molar.includes(num)) return 'M';
  if (premolar.includes(num)) return 'PM';
  if (canine.includes(num)) return 'C';
  if (lateral.includes(num)) return 'Li';
  if (central.includes(num)) return 'CI';
  return '?';
}

function statusLabel(status: JobStatus): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'processing': return 'Processing';
    case 'completed':
    case 'ai_complete': return 'AI Complete';
    case 'reviewed': return 'Clinician Reviewed';
    case 'failed': return 'Failed';
    default: return status;
  }
}

function statusTone(status: JobStatus): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'pending': return 'neutral';
    case 'processing': return 'info';
    case 'completed':
    case 'ai_complete': return 'success';
    case 'reviewed': return 'primary' as 'success';
    case 'failed': return 'danger';
    default: return 'neutral';
  }
}

// ─── Tooth Card ───────────────────────────────────────────────────────────────

function ToothCard({
  fdi,
  segment,
  onToggleMissing,
  toggling,
}: {
  fdi: number;
  segment: ToothSegment | undefined;
  onToggleMissing: (fdi: number) => void;
  toggling: boolean;
}) {
  const missing = segment?.isMissing ?? false;
  const supernum = segment?.isSupernumerary ?? false;
  const confidence = segment?.confidence ?? null;

  let bgClass = 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700';
  if (missing) bgClass = 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700';
  if (supernum) bgClass = 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700';
  if (!missing && !supernum && confidence !== null && confidence >= 0.85)
    bgClass = 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-700';

  return (
    <div
      className={`relative flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer select-none group ${bgClass}`}
      style={{ minWidth: 40 }}
      onClick={() => !toggling && onToggleMissing(fdi)}
      title={`FDI ${fdi} — click to toggle missing`}
    >
      {/* FDI number */}
      <span className="text-[10px] font-bold text-foreground tabular-nums">{fdi}</span>

      {/* Tooth type abbrev */}
      <span className="text-[9px] text-secondary font-medium">{toothLabel(fdi)}</span>

      {/* Status indicator */}
      {missing && <X size={10} className="text-rose-500 mt-0.5" />}
      {supernum && <span className="text-[8px] font-bold text-purple-600">SN</span>}
      {!missing && !supernum && confidence !== null && (
        <span className={`text-[9px] font-semibold ${confidence >= 0.85 ? 'text-emerald-600' : confidence >= 0.6 ? 'text-amber-600' : 'text-rose-600'}`}>
          {Math.round(confidence * 100)}%
        </span>
      )}
      {!missing && !supernum && confidence === null && (
        <span className="text-[9px] text-slate-300">—</span>
      )}
    </div>
  );
}

// ─── Arch Row ─────────────────────────────────────────────────────────────────

function ArchRow({
  label,
  teeth,
  segments,
  onToggleMissing,
  toggling,
}: {
  label: string;
  teeth: number[];
  segments: ToothSegment[];
  onToggleMissing: (fdi: number) => void;
  toggling: boolean;
}) {
  const segMap = new Map(segments.map((s) => [s.toothNumber, s]));

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">{label}</p>
      <div className="flex gap-1 flex-wrap">
        {teeth.map((fdi) => (
          <ToothCard
            key={fdi}
            fdi={fdi}
            segment={segMap.get(fdi)}
            onToggleMissing={onToggleMissing}
            toggling={toggling}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Tooth Detail List ─────────────────────────────────────────────────────────

function ToothDetailList({ segments }: { segments: ToothSegment[] }) {
  const sorted = [...segments].sort((a, b) => a.toothNumber - b.toothNumber);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {sorted.map((seg) => (
        <div
          key={seg.toothNumber}
          className="rounded-lg border border-border p-2 space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">FDI {seg.toothNumber}</span>
            <StatusBadge tone={confidenceTone(seg.confidence)}>
              {seg.confidence !== null ? `${Math.round(seg.confidence * 100)}%` : 'N/A'}
            </StatusBadge>
          </div>
          {seg.estimatedWidthMm != null && (
            <p className="text-[10px] text-secondary">{seg.estimatedWidthMm.toFixed(1)} mm</p>
          )}
          <ProgressBar
            value={seg.confidence !== null ? Math.round(seg.confidence * 100) : 0}
            tone={confidenceBarTone(seg.confidence)}
          />
          <div className="flex gap-1 flex-wrap">
            {seg.isMissing && <StatusBadge tone="danger">Missing</StatusBadge>}
            {seg.isSupernumerary && <StatusBadge tone="warning">SN</StatusBadge>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ToothSegmentationPanel({
  uploadId,
  token,
}: {
  uploadId: string;
  token: string;
}) {
  const [archType, setArchType] = useState<ArchType>('upper');
  const [job, setJob] = useState<SegmentationJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Poll while processing
  useEffect(() => {
    if (!job || job.status !== 'processing') return;
    const iv = setInterval(async () => {
      try {
        const updated = await api.get<SegmentationJob>(`/api/segmentation/${job.id}`);
        setJob(updated);
        if (updated.status !== 'processing') clearInterval(iv);
      } catch {
        clearInterval(iv);
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [job]);

  // ── Run segmentation ───────────────────────────────────────────────────────

  const handleRunSegmentation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<SegmentationJob>(`/api/segmentation/${uploadId}`, { archType });
      setJob(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Segmentation failed');
    } finally {
      setLoading(false);
    }
  }, [uploadId, archType]);

  // ── Toggle tooth missing ───────────────────────────────────────────────────

  const handleToggleMissing = useCallback(async (fdi: number) => {
    if (!job) return;
    const seg = job.segments?.find((s) => s.toothNumber === fdi);
    const nowMissing = !(seg?.isMissing ?? false);
    setToggling(true);
    try {
      await api.patch(`/api/segmentation/${job.id}/segments/${fdi}`, {
        isMissing: nowMissing,
      });
      setJob((prev) => {
        if (!prev) return prev;
        const segs = prev.segments ?? [];
        const exists = segs.find((s) => s.toothNumber === fdi);
        if (exists) {
          return {
            ...prev,
            segments: segs.map((s) =>
              s.toothNumber === fdi ? { ...s, isMissing: nowMissing } : s,
            ),
          };
        }
        return {
          ...prev,
          segments: [
            ...segs,
            {
              toothNumber: fdi,
              confidence: null,
              isMissing: nowMissing,
              isSupernumerary: false,
              arch: fdi >= 10 && fdi <= 29 ? 'upper' : 'lower',
            },
          ],
        };
      });
    } catch {
      // silent — UI will show old state
    } finally {
      setToggling(false);
    }
  }, [job]);

  // ── Approve segmentation ───────────────────────────────────────────────────

  const handleApprove = useCallback(async () => {
    if (!job) return;
    setApproving(true);
    setApproveError(null);
    try {
      const updated = await api.patch<SegmentationJob>(`/api/segmentation/${job.id}/review`, {
        approved: true,
      });
      setJob(updated);
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setApproving(false);
    }
  }, [job]);

  const segments = job?.segments ?? [];
  const upperSegs = segments.filter((s) => s.arch === 'upper' || UPPER_TEETH.includes(s.toothNumber));
  const lowerSegs = segments.filter((s) => s.arch === 'lower' || LOWER_TEETH.includes(s.toothNumber));
  const overallConfidence = job?.overallConfidence ?? null;

  const isCompleted =
    job?.status === 'completed' ||
    job?.status === 'ai_complete' ||
    job?.status === 'reviewed';

  return (
    <div className="space-y-5">
      {/* Controls */}
      {!job && (
        <Card className="p-5 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">AI Tooth Segmentation</p>
            <p className="text-sm text-secondary">Run AI-powered boundary detection to identify individual teeth.</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-secondary w-20 shrink-0">Arch</label>
            <div className="flex gap-2">
              {(['upper', 'lower', 'both'] as ArchType[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setArchType(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    archType === a
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-secondary hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            onClick={() => void handleRunSegmentation()}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Starting Segmentation…</>
            ) : (
              'Run AI Segmentation'
            )}
          </Button>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle size={12} /> {error}
            </p>
          )}
        </Card>
      )}

      {/* Job status */}
      {job && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-0.5">Segmentation Status</p>
              <div className="flex items-center gap-2">
                <StatusBadge tone={statusTone(job.status)}>
                  {job.status === 'processing' && <Loader2 size={10} className="animate-spin inline mr-1" />}
                  {statusLabel(job.status)}
                </StatusBadge>
                {job.toothCount !== null && (
                  <span className="text-xs text-secondary">{job.toothCount} teeth detected</span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleRunSegmentation()}
              disabled={loading || job.status === 'processing'}
            >
              <RefreshCw size={13} /> Restart
            </Button>
          </div>

          {job.status === 'processing' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-secondary">
                <span>Processing…</span>
                <span>{job.progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500 animate-pulse"
                  style={{ width: `${Math.max(5, job.progress)}%` }}
                />
              </div>
            </div>
          )}

          {job.status === 'failed' && job.errorMessage && (
            <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle size={12} /> {job.errorMessage}
            </p>
          )}

          {overallConfidence !== null && isCompleted && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-secondary">Overall Confidence</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {Math.round(overallConfidence * 100)}%
                </span>
              </div>
              <ProgressBar
                value={Math.round(overallConfidence * 100)}
                tone={overallConfidence >= 0.85 ? 'success' : overallConfidence >= 0.6 ? 'warning' : 'danger'}
              />
            </div>
          )}
        </Card>
      )}

      {/* Arch Display */}
      {isCompleted && segments.length > 0 && (
        <Card className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Tooth Arch Map</h3>
            <div className="flex items-center gap-3 text-[10px] text-secondary">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-200 dark:bg-rose-900/50 border border-rose-400 inline-block" />
                Missing
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-200 dark:bg-purple-900/50 border border-purple-400 inline-block" />
                Supernumerary
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 inline-block" />
                High confidence
              </span>
            </div>
          </div>

          <p className="text-xs text-secondary">Click any tooth to toggle &ldquo;missing&rdquo; status.</p>

          {(archType === 'upper' || archType === 'both') && (
            <ArchRow
              label="Upper Arch (Maxillary)"
              teeth={UPPER_TEETH}
              segments={upperSegs}
              onToggleMissing={(fdi) => void handleToggleMissing(fdi)}
              toggling={toggling}
            />
          )}

          {(archType === 'lower' || archType === 'both') && (
            <ArchRow
              label="Lower Arch (Mandibular)"
              teeth={LOWER_TEETH}
              segments={lowerSegs}
              onToggleMissing={(fdi) => void handleToggleMissing(fdi)}
              toggling={toggling}
            />
          )}
        </Card>
      )}

      {/* Tooth Detail Cards */}
      {isCompleted && segments.length > 0 && (
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Tooth-by-Tooth Details</h3>
          <ToothDetailList segments={segments} />
        </Card>
      )}

      {/* Approve Button */}
      {isCompleted && job?.status !== 'reviewed' && (
        <div className="space-y-2">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => void handleApprove()}
            disabled={approving}
          >
            {approving ? (
              <><Loader2 size={14} className="animate-spin" /> Approving…</>
            ) : (
              <><CheckCircle2 size={15} /> Approve Segmentation</>
            )}
          </Button>
          {approveError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle size={12} /> {approveError}
            </p>
          )}
        </div>
      )}

      {job?.status === 'reviewed' && (
        <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Segmentation approved by clinician
          </span>
        </div>
      )}
    </div>
  );
}
