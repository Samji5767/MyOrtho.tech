"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Cpu,
  Layers3,
  Lock,
  Loader2,
  RefreshCw,
  RotateCcw,
  Scan,
  Scissors,
  Sparkles,
  Unlock,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import {
  type SegmentationJob,
  type ToothSegment,
  type CorrectionType,
  type SegmentationModel,
  type SegmentationArch,
  CORRECTION_LABELS,
  MODEL_LABELS,
  listSegmentationJobs,
  submitSegmentationJob,
  getSegmentationJob,
  applyCorrection,
  updateSegment,
} from "@/lib/api/segmentation";

// ─── Tooth map ────────────────────────────────────────────────────────────────

const FDI_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const FDI_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

function confidenceColor(c: number | null) {
  if (c == null) return "text-slate-400";
  if (c >= 0.9) return "text-emerald-600";
  if (c >= 0.8) return "text-teal-600";
  if (c >= 0.7) return "text-amber-600";
  return "text-rose-500";
}

function confidenceBg(c: number | null) {
  if (c == null) return "bg-slate-500/10 border-slate-300/30";
  if (c >= 0.9) return "bg-emerald-500/20 border-emerald-500/30";
  if (c >= 0.8) return "bg-teal-500/20 border-teal-500/30";
  if (c >= 0.7) return "bg-amber-500/20 border-amber-500/30";
  return "bg-rose-500/20 border-rose-500/40";
}

// ─── Arch map ─────────────────────────────────────────────────────────────────

function ArchMap({
  segments,
  selectedFdi,
  onSelect,
}: {
  segments: ToothSegment[];
  selectedFdi: number | null;
  onSelect: (s: ToothSegment) => void;
}) {
  function cell(fdi: number) {
    const seg = segments.find(s => s.toothNumber === fdi);
    const hasFlag = seg?.landmarkData?.flags?.includes("root_flag");
    const bg = seg
      ? seg.isMissing
        ? "bg-slate-500/10 border-slate-300/30"
        : hasFlag
          ? "bg-rose-500/20 border-rose-500/40"
          : confidenceBg(seg.confidence)
      : "bg-[color:var(--muted)]/40 border-[color:var(--border)]";
    const selected = selectedFdi === fdi ? "ring-2 ring-[color:var(--primary)]" : "";
    return (
      <button
        key={fdi}
        type="button"
        onClick={() => seg && onSelect(seg)}
        title={seg?.label ?? `FDI ${fdi}`}
        className={`w-8 h-8 rounded-md border text-[10px] font-bold tabular-nums transition-all ${bg} ${selected} hover:opacity-80`}
      >
        {fdi}
      </button>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 justify-center flex-wrap">{FDI_UPPER.map(cell)}</div>
      <div className="h-px bg-[color:var(--border)]" />
      <div className="flex gap-1 justify-center flex-wrap">{FDI_LOWER.map(cell)}</div>
    </div>
  );
}

// ─── Tooth inspector ──────────────────────────────────────────────────────────

function ToothInspector({
  segment,
  caseId,
  jobId,
  onCorrected,
}: {
  segment: ToothSegment;
  caseId: string;
  jobId: string;
  onCorrected: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const REPAIR_OPS: CorrectionType[] = [
    "fix_geometry", "improve_segmentation", "repair_mesh",
    "recalculate_landmarks", "rebuild_tooth",
  ];
  const EDIT_OPS: CorrectionType[] = [
    "fill_hole", "smooth_boundary", "smart_grow", "smart_shrink",
    "split_tooth", "merge_teeth",
  ];

  const doCorrect = async (type: CorrectionType) => {
    setBusy(type);
    try {
      await applyCorrection(caseId, jobId, { toothNumber: segment.toothNumber, correctionType: type });
      onCorrected();
    } finally {
      setBusy(null);
    }
  };

  const toggleLock = async () => {
    setBusy("lock");
    try {
      await updateSegment(caseId, jobId, segment.toothNumber, { isLocked: !segment.isLocked });
      onCorrected();
    } finally {
      setBusy(null);
    }
  };

  const conf = segment.confidence;
  const hasFlag = segment.landmarkData?.flags?.includes("root_flag");

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[color:var(--primary)]">{segment.toothNumber}</span>
            {segment.universalNumber && (
              <span className="text-xs text-[color:var(--muted-foreground)]">#{segment.universalNumber}</span>
            )}
          </div>
          <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">{segment.label}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {segment.isMissing && <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-500">Missing</span>}
          {hasFlag && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-500">Root Flag</span>}
          {segment.isImpacted && <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-600">Impacted</span>}
          {segment.isSupernumerary && <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600">Supernumerary</span>}
          {segment.isLocked && <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-600">Locked</span>}
        </div>
      </div>

      {/* Confidence bar */}
      {conf != null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[color:var(--muted-foreground)]">Confidence</span>
            <span className={`font-bold ${confidenceColor(conf)}`}>{(conf * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[color:var(--border)]">
            <div
              className={`h-full rounded-full transition-all ${conf >= 0.9 ? "bg-emerald-500" : conf >= 0.8 ? "bg-teal-500" : conf >= 0.7 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${conf * 100}%` }}
            />
          </div>
        </div>
      )}

      {segment.landmarkData?.warning && (
        <p className="text-xs text-amber-600 flex items-start gap-1.5">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          {segment.landmarkData.warning}
        </p>
      )}

      {/* Repair tools */}
      {!segment.isMissing && !segment.isLocked && (
        <>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)] mb-1.5">Repair</p>
            <div className="flex flex-wrap gap-1">
              {REPAIR_OPS.map(op => (
                <button
                  key={op}
                  type="button"
                  onClick={() => doCorrect(op)}
                  disabled={!!busy}
                  className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-[10px] font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)] hover:border-[color:var(--primary)] disabled:opacity-50 transition-colors"
                >
                  {busy === op ? <Loader2 size={9} className="animate-spin" /> : <Wand2 size={9} />}
                  {CORRECTION_LABELS[op]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)] mb-1.5">Edit</p>
            <div className="flex flex-wrap gap-1">
              {EDIT_OPS.map(op => (
                <button
                  key={op}
                  type="button"
                  onClick={() => doCorrect(op)}
                  disabled={!!busy}
                  className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-[10px] font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)] hover:border-[color:var(--primary)] disabled:opacity-50 transition-colors"
                >
                  {busy === op ? <Loader2 size={9} className="animate-spin" /> : <Scissors size={9} />}
                  {CORRECTION_LABELS[op]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Lock toggle */}
      {!segment.isMissing && (
        <button
          type="button"
          onClick={toggleLock}
          disabled={busy === "lock"}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${segment.isLocked ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20" : "border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}
        >
          {segment.isLocked ? <Unlock size={11} /> : <Lock size={11} />}
          {segment.isLocked ? "Unlock Region" : "Lock Region"}
        </button>
      )}
    </div>
  );
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  isActive,
  onSelect,
}: {
  job: SegmentationJob;
  isActive: boolean;
  onSelect: () => void;
}) {
  const statusIcon = job.status === "completed"
    ? <CheckCircle2 size={13} className="text-emerald-500" />
    : job.status === "failed"
      ? <X size={13} className="text-rose-500" />
      : job.status === "processing"
        ? <Loader2 size={13} className="animate-spin text-blue-500" />
        : <Clock size={13} className="text-slate-400" />;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${isActive ? "border-[color:var(--primary)] bg-[color:var(--primary)]/5" : "border-[color:var(--border)] bg-[color:var(--card)] hover:bg-[color:var(--muted)]"}`}
    >
      {statusIcon}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[color:var(--foreground)] truncate">
          {MODEL_LABELS[job.modelType]} · {job.arch}
        </p>
        <p className="text-[10px] text-[color:var(--muted-foreground)]">
          {new Date(job.createdAt).toLocaleString()}
          {job.toothCount != null ? ` · ${job.toothCount} teeth` : ""}
        </p>
      </div>
      {job.status === "processing" && (
        <span className="text-[10px] font-bold text-blue-500">{job.progress}%</span>
      )}
      {isActive && <ChevronRight size={12} className="text-[color:var(--primary)]" />}
    </button>
  );
}

// ─── Submit modal ─────────────────────────────────────────────────────────────

function SubmitModal({ caseId, onSubmitted, onClose }: {
  caseId: string;
  onSubmitted: (job: SegmentationJob) => void;
  onClose: () => void;
}) {
  const [model, setModel] = useState<SegmentationModel>("cpu");
  const [arch, setArch] = useState<SegmentationArch>("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const job = await submitSegmentationJob(caseId, { modelType: model, arch });
      onSubmitted(job);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[color:var(--foreground)]">New Segmentation Job</h3>
          <button type="button" onClick={onClose}><X size={16} className="text-[color:var(--muted-foreground)]" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[color:var(--muted-foreground)] mb-1.5 block">AI Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value as SegmentationModel)}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
            >
              {(Object.entries(MODEL_LABELS) as [SegmentationModel, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-[color:var(--muted-foreground)]">
              GPU models require AI_SEGMENTATION_URL configuration. CPU uses rule-based segmentation.
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-[color:var(--muted-foreground)] mb-1.5 block">Arch</label>
            <div className="flex gap-2">
              {(["upper", "lower", "both"] as SegmentationArch[]).map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setArch(a)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-all ${arch === a ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-[color:var(--primary)]" : "border-[color:var(--border)] text-[color:var(--muted-foreground)]"}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)]">Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            Run Segmentation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { caseId: string }

export function AISegmentationCenter({ caseId }: Props) {
  const [jobs, setJobs] = useState<SegmentationJob[]>([]);
  const [activeJob, setActiveJob] = useState<SegmentationJob | null>(null);
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingJob, setLoadingJob] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const loadJob = useCallback(async (jobId: string) => {
    setLoadingJob(true); setSelectedFdi(null);
    try {
      const job = await getSegmentationJob(caseId, jobId);
      setActiveJob(job);
    } finally {
      setLoadingJob(false);
    }
  }, [caseId]);

  const loadJobs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const list = await listSegmentationJobs(caseId);
      setJobs(list);
      // Auto-select first completed job
      if (!activeJob) {
        const completed = list.find(j => j.status === "completed");
        if (completed) loadJob(completed.id);
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [caseId, activeJob, loadJob]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Poll processing jobs
  useEffect(() => {
    const processing = jobs.filter(j => j.status === "pending" || j.status === "processing");
    if (!processing.length) return;
    const interval = setInterval(() => {
      loadJobs();
      if (activeJob && (activeJob.status === "pending" || activeJob.status === "processing")) {
        loadJob(activeJob.id);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [jobs, activeJob, loadJobs, loadJob]);

  const selectedSegment = activeJob?.segments?.find(s => s.toothNumber === selectedFdi) ?? null;
  const segments = activeJob?.segments ?? [];

  const presentCount = segments.filter(s => !s.isMissing).length;
  const flaggedCount = segments.filter(s => s.landmarkData?.flags?.includes("root_flag")).length;
  const avgConf = segments.length
    ? segments.filter(s => s.confidence != null).reduce((a, s) => a + (s.confidence ?? 0), 0) /
      Math.max(1, segments.filter(s => s.confidence != null).length)
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Phase 21A</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">AI Tooth Segmentation</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Automatic detection · FDI/Universal numbering · Confidence scoring · Manual correction</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadJobs} disabled={loading} className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowSubmit(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Sparkles size={13} /> New Job
          </button>
        </div>
      </div>

      <MedicalDisclaimer variant="compact" />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">{error}</div>}

      {loading && !activeJob && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[color:var(--primary)]" />
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] py-16 text-center">
          <Scan size={32} strokeWidth={1.5} className="text-[color:var(--muted-foreground)]" />
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">No segmentation jobs yet</p>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">Submit a new job to detect and number teeth automatically</p>
          </div>
          <button onClick={() => setShowSubmit(true)} className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Zap size={13} /> Submit First Job
          </button>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          {/* Job list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">Jobs</p>
              <button
                type="button"
                onClick={() => setShowHistory(h => !h)}
                className="text-[10px] text-[color:var(--muted-foreground)] flex items-center gap-0.5"
              >
                History {showHistory ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            </div>
            {(showHistory ? jobs : jobs.slice(0, 3)).map(job => (
              <JobCard
                key={job.id}
                job={job}
                isActive={activeJob?.id === job.id}
                onSelect={() => loadJob(job.id)}
              />
            ))}
          </div>

          {/* Active job detail */}
          <div className="space-y-4">
            {loadingJob && (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={18} className="animate-spin text-[color:var(--primary)]" />
              </div>
            )}

            {activeJob && !loadingJob && (
              <>
                {/* Stats row */}
                {activeJob.status === "completed" && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Detected", value: presentCount, icon: CheckCircle2, color: "text-emerald-600" },
                      { label: "Flagged",  value: flaggedCount, icon: AlertTriangle, color: flaggedCount > 0 ? "text-rose-500" : "text-emerald-600" },
                      { label: "Avg. Conf.", value: avgConf != null ? `${(avgConf * 100).toFixed(1)}%` : "—", icon: Cpu, color: avgConf != null && avgConf >= 0.85 ? "text-emerald-600" : "text-amber-600" },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 flex flex-col items-center gap-1">
                        <s.icon size={15} className={s.color} />
                        <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-[color:var(--muted-foreground)]">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Processing state */}
                {(activeJob.status === "pending" || activeJob.status === "processing") && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3 dark:border-blue-900 dark:bg-blue-900/10">
                    <div className="flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin text-blue-500" />
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                        {activeJob.status === "pending" ? "Queued — waiting to start…" : `Segmenting teeth… ${activeJob.progress}%`}
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-blue-200 dark:bg-blue-900">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${activeJob.progress}%` }} />
                    </div>
                  </div>
                )}

                {activeJob.status === "failed" && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
                    <strong>Failed:</strong> {activeJob.errorMessage ?? "Unknown error"}
                  </div>
                )}

                {/* Tooth arch map */}
                {activeJob.status === "completed" && segments.length > 0 && (
                  <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Layers3 size={14} className="text-[color:var(--primary)]" />
                      <h3 className="text-sm font-bold text-[color:var(--foreground)]">Arch Map</h3>
                      <span className="text-xs text-[color:var(--muted-foreground)]">Click a tooth to inspect</span>
                    </div>
                    <ArchMap segments={segments} selectedFdi={selectedFdi} onSelect={s => setSelectedFdi(s.toothNumber)} />
                    <div className="flex flex-wrap gap-3 text-[10px] text-[color:var(--muted-foreground)]">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500/50" />≥90%</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-teal-500/50" />80–90%</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-500/50" />70–80%</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-rose-500/50" />&lt;70% / Flag</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-slate-300/50" />Missing</span>
                    </div>
                  </div>
                )}

                {/* Tooth inspector */}
                {selectedSegment && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">Tooth Inspector — FDI {selectedSegment.toothNumber}</p>
                    <ToothInspector
                      segment={selectedSegment}
                      caseId={caseId}
                      jobId={activeJob.id}
                      onCorrected={() => loadJob(activeJob.id)}
                    />
                  </div>
                )}

                {/* Corrections history */}
                {activeJob.corrections && activeJob.corrections.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">Correction History</p>
                    <div className="divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] overflow-hidden">
                      {activeJob.corrections.map(c => (
                        <div key={c.id} className="bg-[color:var(--card)] px-3 py-2">
                          <div className="flex items-center gap-2">
                            <RotateCcw size={11} className="text-[color:var(--muted-foreground)]" />
                            <span className="text-xs font-semibold text-[color:var(--foreground)]">
                              {CORRECTION_LABELS[c.correctionType as CorrectionType] ?? c.correctionType}
                            </span>
                            {c.toothNumber && <span className="text-xs text-[color:var(--muted-foreground)]">FDI {c.toothNumber}</span>}
                            {c.afterConfidence != null && c.beforeConfidence != null && (
                              <span className="ml-auto text-[10px] text-emerald-600 font-bold">
                                {(c.beforeConfidence * 100).toFixed(1)}% → {(c.afterConfidence * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[color:var(--muted-foreground)] mt-0.5">
                            {c.appliedByEmail ?? "system"} · {new Date(c.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI version note */}
                <div className="flex items-center gap-1.5 text-[10px] text-[color:var(--muted-foreground)]">
                  <Cpu size={10} />
                  AI version: {activeJob.aiVersion} · Model: {MODEL_LABELS[activeJob.modelType]}
                  {(activeJob.resultSummary as any)?.fallback && " · Rule-based fallback (configure AI_SEGMENTATION_URL for ML inference)"}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSubmit && (
        <SubmitModal
          caseId={caseId}
          onSubmitted={job => {
            setJobs(prev => [job, ...prev]);
            setShowSubmit(false);
            loadJob(job.id);
          }}
          onClose={() => setShowSubmit(false)}
        />
      )}
    </div>
  );
}

export default AISegmentationCenter;
