"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastContext";
import {
  Button,
  EmptyState,
  SkeletonBlock,
  StatusBadge,
  Tooltip,
} from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QaInspection {
  id: string;
  batchId: string | null;
  printJobId: string | null;
  stlValid: boolean | null;
  meshIntegrityOk: boolean | null;
  wallThicknessOk: boolean | null;
  printabilityScore: number | null;
  orientationOk: boolean | null;
  supportOk: boolean | null;
  surfaceQualityScore: number | null;
  dimensionalVarianceMm: number | null;
  operatorNotes: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  isSimulated: boolean;
  simulatedNote?: string;
  createdAt: string;
  updatedAt: string;
}

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, Tone> = {
  pending: "warning",
  in_progress: "primary",
  passed: "success",
  failed: "danger",
  requires_reprint: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  passed: "Passed",
  failed: "Failed",
  requires_reprint: "Reprint Required",
};

type FilterKey = "pending" | "in_progress" | "passed" | "failed" | "requires_reprint" | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "passed", label: "Passed" },
  { key: "failed", label: "Failed" },
  { key: "requires_reprint", label: "Reprint Required" },
  { key: "all", label: "All" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (score >= 6) return "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20";
  return "text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/20";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BoolCheck({ value, label }: { value: boolean | null; label: string }) {
  if (value === null) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[color:var(--muted-foreground)]">
        <span className="h-3 w-3 flex-none rounded-full border border-[color:var(--border)] bg-[color:var(--background)]" aria-hidden />
        <span className="leading-tight">{label}</span>
      </span>
    );
  }
  return value ? (
    <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 size={13} className="flex-none" aria-hidden />
      <span className="leading-tight">{label}</span>
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-400">
      <XCircle size={13} className="flex-none" aria-hidden />
      <span className="leading-tight">{label}</span>
    </span>
  );
}

function ScoreChip({ label, score }: { label: string; score: number }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
        scoreColor(score),
      ].join(" ")}
    >
      {label}{" "}
      <span className="font-bold">{score}</span>
      <span className="font-normal opacity-60">/10</span>
    </span>
  );
}

// ─── Reject Form (inline expand) ─────────────────────────────────────────────

function RejectForm({
  id,
  busy,
  onConfirm,
  onCancel,
}: {
  id: string;
  busy: boolean;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="border-t border-[color:var(--border)] pt-3">
      <p className="mb-1.5 text-xs font-semibold text-[color:var(--foreground)]">
        Rejection reason
      </p>
      <textarea
        ref={ref}
        id={`reject-notes-${id}`}
        rows={2}
        placeholder="Describe the defect or issue requiring rejection…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-rose-500/30"
        aria-label="Rejection reason"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onConfirm(notes)}
          disabled={busy || !notes.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <XCircle size={12} aria-hidden />
          )}
          {busy ? "Rejecting…" : "Confirm Rejection"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Inspection Card ──────────────────────────────────────────────────────────

function QaInspectionCard({
  insp,
  processing,
  permittedToApprove,
  onApprove,
  onReject,
}: {
  insp: QaInspection;
  processing: string | null;
  permittedToApprove: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string, notes: string) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const busy = processing === insp.id;
  const canAct =
    (insp.status === "pending" || insp.status === "in_progress") &&
    !insp.isSimulated;
  const canApprove = canAct && permittedToApprove;
  const actionBlockedBySimulation =
    insp.isSimulated &&
    (insp.status === "pending" || insp.status === "in_progress");

  const ref = insp.batchId
    ? `Batch ${shortId(insp.batchId)}`
    : insp.printJobId
    ? `Job ${shortId(insp.printJobId)}`
    : "—";

  const hasScores =
    insp.printabilityScore !== null || insp.surfaceQualityScore !== null;
  const hasVariance = insp.dimensionalVarianceMm !== null;

  return (
    <article className="interactive-card overflow-hidden">
      {/* ── Simulated warning ─────────────────────────────── */}
      {insp.isSimulated && (
        <div className="flex items-start gap-2.5 border-b border-amber-200/70 bg-amber-50/80 px-4 py-2.5 dark:border-amber-700/30 dark:bg-amber-900/20">
          <AlertTriangle
            size={13}
            className="mt-0.5 flex-none text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          <p className="text-xs font-semibold leading-snug text-amber-700 dark:text-amber-400">
            SIMULATED — Not validated for production. Physical inspection
            required before approval.
            {insp.simulatedNote && (
              <span className="ml-1 font-normal opacity-80">
                {insp.simulatedNote}
              </span>
            )}
          </p>
        </div>
      )}

      <div className="p-4">
        {/* ── Header row ────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          {/* Left: identity */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold tracking-tight text-[color:var(--foreground)]">
                {ref}
              </span>
              <StatusBadge tone={STATUS_TONE[insp.status] ?? "neutral"}>
                {STATUS_LABEL[insp.status] ?? insp.status}
              </StatusBadge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--muted-foreground)]">
              <span className="flex items-center gap-1">
                <Clock size={10} aria-hidden />
                {formatDateTime(insp.createdAt)}
              </span>
              {insp.approvedBy && insp.approvedAt && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={10} aria-hidden />
                  Approved by {insp.approvedBy} ·{" "}
                  {formatDateTime(insp.approvedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          {!rejectOpen && (
            <div className="flex shrink-0 items-center gap-2">
              {canAct && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRejectOpen(true)}
                  disabled={busy}
                  className="border-rose-200/70 text-rose-700 hover:bg-rose-50/70 dark:border-rose-700/30 dark:text-rose-400 dark:hover:bg-rose-900/20"
                >
                  <XCircle size={13} aria-hidden />
                  Reject
                </Button>
              )}
              {canApprove && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onApprove(insp.id)}
                  disabled={busy}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {busy ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <CheckCircle2 size={13} aria-hidden />
                  )}
                  {busy ? "Approving…" : "Approve"}
                </Button>
              )}
              {actionBlockedBySimulation && (
                <Tooltip
                  content="Simulated inspections cannot be approved. Complete a physical inspection first."
                  position="left"
                >
                  <span className="cursor-not-allowed rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] opacity-70 select-none">
                    Approval blocked
                  </span>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* ── Checklist ─────────────────────────────────────── */}
        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            <Eye size={11} aria-hidden />
            Checklist
          </p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 sm:grid-cols-3">
            <BoolCheck value={insp.stlValid} label="STL Valid" />
            <BoolCheck value={insp.meshIntegrityOk} label="Mesh Integrity" />
            <BoolCheck value={insp.wallThicknessOk} label="Wall Thickness" />
            <BoolCheck value={insp.orientationOk} label="Orientation" />
            <BoolCheck value={insp.supportOk} label="Support Structure" />
          </div>

          {/* Scores & variance */}
          {(hasScores || hasVariance) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {insp.printabilityScore !== null && (
                <ScoreChip
                  label="Printability"
                  score={insp.printabilityScore}
                />
              )}
              {insp.surfaceQualityScore !== null && (
                <ScoreChip
                  label="Surface Quality"
                  score={insp.surfaceQualityScore}
                />
              )}
              {hasVariance && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-0.5 text-xs text-[color:var(--muted-foreground)]">
                  Dimensional variance
                  <span className="font-semibold tabular-nums text-[color:var(--foreground)]">
                    {insp.dimensionalVarianceMm!.toFixed(2)} mm
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Operator notes ────────────────────────────────── */}
        {insp.operatorNotes && (
          <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
              Operator Notes
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--foreground)]">
              {insp.operatorNotes}
            </p>
          </div>
        )}

        {/* ── Inline reject form ────────────────────────────── */}
        {rejectOpen && (
          <RejectForm
            id={insp.id}
            busy={busy}
            onConfirm={(notes) => {
              setRejectOpen(false);
              onReject(insp.id, notes);
            }}
            onCancel={() => setRejectOpen(false)}
          />
        )}
      </div>
    </article>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function InspectionSkeleton() {
  return (
    <div className="interactive-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-3 w-24 opacity-60" />
        </div>
        <SkeletonBlock className="h-7 w-20 shrink-0 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-y-2 gap-x-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 w-24 opacity-50" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const QA_APPROVE_ROLES = ["admin", "super_admin", "lab_manager", "vp_manufacturing"];

export default function QaQueuePage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [inspections, setInspections] = useState<QaInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  const permittedToApprove = user ? QA_APPROVE_ROLES.includes(user.role) : false;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const load = useCallback(
    async (f: FilterKey) => {
      setLoading(true);
      setError(null);
      try {
        const params = f !== "all" ? `?status=${f}` : "";
        const data = await api.get<QaInspection[]>(
          `/api/qa-inspections${params}`,
        );
        setInspections(Array.isArray(data) ? data : []);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load QA queue";
        setError(msg);
        toast({ title: "Load failed", description: msg, type: "error" });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  // ── Approve ────────────────────────────────────────────────────────────────

  const handleApprove = useCallback(
    async (id: string) => {
      setProcessing(id);
      try {
        const updated = await api.post<QaInspection>(`/api/qa-inspections/${id}/approve`, {});
        if (filter === "pending" || filter === "in_progress") {
          setInspections((prev) => prev.filter((i) => i.id !== id));
        } else {
          setInspections((prev) =>
            prev.map((i) => (i.id === id ? updated : i)),
          );
        }
        toast({ title: "Inspection approved", type: "success" });
      } catch (err) {
        toast({
          title: "Approval failed",
          description:
            err instanceof Error ? err.message : "Unknown error",
          type: "error",
        });
      } finally {
        setProcessing(null);
      }
    },
    [toast, filter],
  );

  // ── Reject ─────────────────────────────────────────────────────────────────

  const handleReject = useCallback(
    async (id: string, notes: string) => {
      setProcessing(id);
      try {
        const updated = await api.post<QaInspection>(`/api/qa-inspections/${id}/reject`, { notes });
        if (filter === "pending" || filter === "in_progress") {
          setInspections((prev) => prev.filter((i) => i.id !== id));
        } else {
          setInspections((prev) =>
            prev.map((i) => (i.id === id ? updated : i)),
          );
        }
        toast({ title: "Inspection rejected", type: "info" });
      } catch (err) {
        toast({
          title: "Rejection failed",
          description:
            err instanceof Error ? err.message : "Unknown error",
          type: "error",
        });
      } finally {
        setProcessing(null);
      }
    },
    [toast, filter],
  );

  // ── Derived ────────────────────────────────────────────────────────────────

  const pendingCount = inspections.filter(
    (i) => i.status === "pending" || i.status === "in_progress",
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height,60px)+var(--sa-bottom,0px)+1.5rem)] pt-4 sm:px-5">

      {/* ── Back link ─────────────────────────────────────────────────────── */}
      <Link
        href="/manufacturing"
        className="flex w-fit items-center gap-1 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Manufacturing
      </Link>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Manufacturing
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            <ShieldCheck
              size={22}
              className="text-[color:var(--primary)]"
              aria-hidden
            />
            QA Inspection Queue
          </h1>
          <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
            Review and approve quality checks before release
          </p>
        </div>

        {/* Pending badge */}
        {!loading && pendingCount > 0 && filter !== "passed" && filter !== "failed" && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50/80 px-3 py-1 dark:border-amber-700/30 dark:bg-amber-900/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            <span className="text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {pendingCount} awaiting review
            </span>
          </div>
        )}
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
          <AlertTriangle size={15} className="flex-none" aria-hidden />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => void load(filter)}
            className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Status filter pills ───────────────────────────────────────────── */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={[
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
              filter === f.key
                ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <InspectionSkeleton key={i} />
          ))}
        </div>
      ) : inspections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] py-6">
          <EmptyState
            icon={ShieldCheck}
            title={
              filter === "all"
                ? "No inspections found"
                : `No ${STATUS_LABEL[filter] ?? filter} inspections`
            }
            message={
              filter === "pending"
                ? "All pending inspections have been reviewed."
                : filter === "all"
                ? "QA inspections will appear here once batches reach the QA stage."
                : `No inspections with status "${STATUS_LABEL[filter] ?? filter}" at this time.`
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {inspections.map((insp) => (
            <QaInspectionCard
              key={insp.id}
              insp={insp}
              processing={processing}
              permittedToApprove={permittedToApprove}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}

          {/* Footer count */}
          <p className="pb-1 text-center text-xs text-[color:var(--muted-foreground)]">
            {inspections.length} inspection
            {inspections.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </section>
  );
}
