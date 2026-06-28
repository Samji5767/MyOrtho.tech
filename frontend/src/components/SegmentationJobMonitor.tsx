"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Card, ProgressBar, StatusBadge } from "@/components/DesignSystem";
import {
  listSegmentationJobs,
  submitSegmentationJob,
  type SegmentationJob,
  type SegmentationModel,
  type SegmentationArch,
  MODEL_LABELS,
} from "@/lib/api/segmentation";

// ─── Status display ───────────────────────────────────────────────────────────

const STATUS_TONE = {
  pending:    "neutral",
  processing: "info",
  completed:  "success",
  failed:     "danger",
} as const;

function durationStr(job: SegmentationJob) {
  if (!job.startedAt) return null;
  const start = new Date(job.startedAt).getTime();
  const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
  const secs = Math.round((end - start) / 1000);
  return secs < 60 ? `${secs}s` : `${Math.round(secs / 60)}m ${secs % 60}s`;
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job, isLatest }: { job: SegmentationJob; isLatest: boolean }) {
  const tone = STATUS_TONE[job.status] ?? "neutral";
  const dur = durationStr(job);
  const summary = job.resultSummary as Record<string, unknown> | null;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isLatest ? "border-[color:var(--primary)]/40 bg-[color:var(--primary-glow)]/20" : "border-[color:var(--border)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge tone={tone}>{job.status}</StatusBadge>
            <span className="text-xs font-mono text-[color:var(--muted-foreground)]">{job.id.slice(0, 8)}…</span>
            {isLatest && <StatusBadge tone="info">Latest</StatusBadge>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[color:var(--muted-foreground)]">
            <span className="flex items-center gap-1">
              <Cpu size={10} /> {MODEL_LABELS[job.modelType] ?? job.modelType}
            </span>
            <span className="flex items-center gap-1">
              <Activity size={10} /> {job.arch} arch
            </span>
            {dur && (
              <span className="flex items-center gap-1">
                <Clock size={10} /> {dur}
              </span>
            )}
          </div>
        </div>
        {job.status === "processing" && (
          <Loader2 size={16} className="shrink-0 animate-spin text-[color:var(--primary)]" />
        )}
        {job.status === "completed" && (
          <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
        )}
        {job.status === "failed" && (
          <AlertTriangle size={16} className="shrink-0 text-red-500" />
        )}
      </div>

      {/* Progress bar */}
      {job.status === "processing" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[color:var(--muted-foreground)]">Processing…</span>
            <span className="font-semibold tabular-nums text-[color:var(--foreground)]">{job.progress}%</span>
          </div>
          <ProgressBar value={job.progress} tone="primary" />
        </div>
      )}

      {/* Completed summary */}
      {job.status === "completed" && summary && (
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-emerald-500/5 px-3 py-2 text-xs">
          <div className="text-center">
            <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {summary['presentCount'] as number ?? 0}
            </p>
            <p className="text-[color:var(--muted-foreground)]">Teeth found</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold tabular-nums text-[color:var(--foreground)]">
              {summary['totalCount'] as number ?? 0}
            </p>
            <p className="text-[color:var(--muted-foreground)]">Total slots</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold tabular-nums text-[color:var(--foreground)]">
              {summary['averageConfidence']
                ? `${((summary['averageConfidence'] as number) * 100).toFixed(0)}%`
                : "—"}
            </p>
            <p className="text-[color:var(--muted-foreground)]">Avg conf.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {job.status === "failed" && job.errorMessage && (
        <p className="text-xs text-red-600 dark:text-red-400">{job.errorMessage}</p>
      )}

      {/* AI version badge */}
      {job.aiVersion && (
        <p className="text-[10px] text-[color:var(--muted-foreground)]">
          AI version: <span className="font-mono">{job.aiVersion}</span>
          {(summary as Record<string, unknown>)?.['fallback'] === true && (
            <span className="ml-1 text-amber-500">(rule-based fallback)</span>
          )}
        </p>
      )}
    </div>
  );
}

// ─── Submit form ──────────────────────────────────────────────────────────────

function SubmitForm({
  caseId,
  onSubmitted,
}: {
  caseId: string;
  onSubmitted: (job: SegmentationJob) => void;
}) {
  const [model, setModel] = useState<SegmentationModel>("cpu");
  const [arch, setArch] = useState<SegmentationArch>("both");
  const [gpuRequested, setGpuRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const job = await submitSegmentationJob(caseId, { modelType: model, arch, gpuRequested });
      onSubmitted(job);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const MODELS: { key: SegmentationModel; label: string; badge?: string }[] = [
    { key: "monai",   label: "MONAI",       badge: "GPU" },
    { key: "nnunet",  label: "nnU-Net",     badge: "GPU" },
    { key: "onnx",    label: "ONNX Runtime" },
    { key: "pytorch", label: "PyTorch" },
    { key: "cpu",     label: "Rule-based",  badge: "CPU" },
  ];

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1.5">AI Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as SegmentationModel)}
            className="h-9 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)]"
          >
            {MODELS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}{m.badge ? ` (${m.badge})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1.5">Arch</label>
          <select
            value={arch}
            onChange={(e) => setArch(e.target.value as SegmentationArch)}
            className="h-9 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)]"
          >
            <option value="both">Both arches</option>
            <option value="upper">Upper only</option>
            <option value="lower">Lower only</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={gpuRequested}
          onChange={(e) => setGpuRequested(e.target.checked)}
          className="rounded border-[color:var(--border)] accent-[color:var(--primary)]"
        />
        <span className="text-xs text-[color:var(--muted-foreground)]">
          <Zap size={11} className="inline mr-0.5 text-amber-500" />
          Request GPU acceleration (requires AI_SEGMENTATION_URL)
        </span>
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
        {submitting ? "Submitting…" : "Run Segmentation"}
      </button>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  onJobSelect?: (job: SegmentationJob) => void;
}

export default function SegmentationJobMonitor({ caseId, onJobSelect }: Props) {
  const [jobs, setJobs] = useState<SegmentationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const list = await listSegmentationJobs(caseId);
      setJobs(list);
      // Auto-notify caller of the latest completed job
      const latest = list.find((j) => j.status === "completed");
      if (latest) onJobSelect?.(latest);
    } catch { /* swallow */ }
    setLoading(false);
    setRefreshing(false);
  }, [caseId, onJobSelect]);

  useEffect(() => { void load(); }, [load]);

  // Poll while any job is processing
  useEffect(() => {
    const hasProcessing = jobs.some((j) => j.status === "pending" || j.status === "processing");
    if (!hasProcessing) return;
    const timer = setInterval(() => { void load(true); }, 3000);
    return () => clearInterval(timer);
  }, [jobs, load]);

  function handleSubmitted(job: SegmentationJob) {
    setJobs((prev) => [job, ...prev]);
    // Start polling
    const timer = setInterval(async () => {
      const list = await listSegmentationJobs(caseId);
      setJobs(list);
      if (!list.some((j) => j.status === "pending" || j.status === "processing")) {
        clearInterval(timer);
        const latest = list.find((j) => j.status === "completed");
        if (latest) onJobSelect?.(latest);
      }
    }, 2000);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">New Segmentation Job</h3>
        </div>
        <SubmitForm caseId={caseId} onSubmitted={handleSubmitted} />
      </Card>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
          Job History
          {jobs.length > 0 && (
            <span className="ml-1.5 rounded-full bg-[color:var(--primary-glow)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--primary)]">
              {jobs.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
        >
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin text-[color:var(--muted-foreground)]" />
        </div>
      ) : jobs.length === 0 ? (
        <Card className="p-6 text-center">
          <Activity size={24} className="mx-auto mb-2 text-[color:var(--muted-foreground)]" />
          <p className="text-sm text-[color:var(--muted-foreground)]">No segmentation jobs yet</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job, i) => (
            <JobCard key={job.id} job={job} isLatest={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
