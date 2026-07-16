"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock, Package, Plus, Printer } from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ToastContext";
import {
  Button,
  Card,
  EmptyState,
  Modal,
  SkeletonBlock,
  StatusBadge,
} from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ManufacturingBatch {
  id: string;
  batchNumber: string;
  status: string;
  caseIds: string[];
  scheduledDate: string | null;
  shippedAt: string | null;
  notes: string | null;
  resinType: string | null;
  priority: number;
  totalAligners: number;
  estimatedPrintHours: number | null;
  createdAt: string;
  updatedAt: string;
}

type BatchStatus =
  | "staging"
  | "printing"
  | "post_processing"
  | "qc"
  | "shipped"
  | "cancelled";

type FilterKey = "all" | BatchStatus;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<
  BatchStatus,
  "neutral" | "primary" | "warning" | "info" | "success" | "danger"
> = {
  staging:         "neutral",
  printing:        "primary",
  post_processing: "warning",
  qc:              "info",
  shipped:         "success",
  cancelled:       "danger",
};

const STATUS_LABEL: Record<BatchStatus, string> = {
  staging:         "Staging",
  printing:        "Printing",
  post_processing: "Post Processing",
  qc:              "QC",
  shipped:         "Shipped",
  cancelled:       "Cancelled",
};

const NEXT_STATUS: Partial<Record<BatchStatus, BatchStatus>> = {
  staging:         "printing",
  printing:        "post_processing",
  post_processing: "qc",
  qc:              "shipped",
};

const FILTER_SPECS: { key: FilterKey; label: string }[] = [
  { key: "all",             label: "All"             },
  { key: "staging",         label: "Staging"         },
  { key: "printing",        label: "Printing"        },
  { key: "post_processing", label: "Post Processing" },
  { key: "qc",              label: "QC"              },
  { key: "shipped",         label: "Shipped"         },
  { key: "cancelled",       label: "Cancelled"       },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidStatus(s: string): s is BatchStatus {
  return s in STATUS_TONE;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Create Batch Form ────────────────────────────────────────────────────────

interface CreateBatchFormValues {
  scheduledDate: string;
  resinType: string;
  notes: string;
  priority: number;
}

function CreateBatchModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (batch: ManufacturingBatch) => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateBatchFormValues>({
    scheduledDate: "",
    resinType: "",
    notes: "",
    priority: 5,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm({ scheduledDate: "", resinType: "", notes: "", priority: 5 });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        priority: form.priority,
      };
      if (form.scheduledDate) payload.scheduledDate = form.scheduledDate;
      if (form.resinType.trim()) payload.resinType = form.resinType.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();

      const batch = await api.post<ManufacturingBatch>(
        "/api/manufacturing-batches",
        payload,
      );
      toast({ title: `Batch ${batch.batchNumber} created`, type: "success" });
      onCreated(batch);
      onClose();
    } catch (err) {
      toast({
        title: "Failed to create batch",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30";

  const labelClass = "block text-xs font-semibold text-[color:var(--foreground)] mb-1";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Manufacturing Batch"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            form="create-batch-form"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating…
              </span>
            ) : (
              <>
                <Package size={14} />
                Create Batch
              </>
            )}
          </Button>
        </>
      }
    >
      <form id="create-batch-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass} htmlFor="batch-scheduled-date">
            Scheduled Date
          </label>
          <input
            id="batch-scheduled-date"
            type="date"
            className={inputClass}
            value={form.scheduledDate}
            onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="batch-resin-type">
            Resin Type
          </label>
          <input
            id="batch-resin-type"
            type="text"
            className={inputClass}
            placeholder="e.g. Evonik Vestakeep, EnvisionTEC…"
            value={form.resinType}
            onChange={(e) => setForm((f) => ({ ...f, resinType: e.target.value }))}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="batch-priority">
            Priority <span className="font-normal text-[color:var(--muted-foreground)]">(1 = low, 10 = critical)</span>
          </label>
          <input
            id="batch-priority"
            type="number"
            min={1}
            max={10}
            className={inputClass}
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                priority: Math.max(1, Math.min(10, Number(e.target.value))),
              }))
            }
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="batch-notes">
            Notes
          </label>
          <textarea
            id="batch-notes"
            rows={3}
            className="w-full resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
            placeholder="Special instructions or comments…"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </form>
    </Modal>
  );
}

// ─── Batch Card ───────────────────────────────────────────────────────────────

function BatchCard({
  batch,
  onAdvance,
  onCancel,
  advancingId,
  cancellingId,
}: {
  batch: ManufacturingBatch;
  onAdvance: (id: string, nextStatus: BatchStatus) => void;
  onCancel: (id: string) => void;
  advancingId: string | null;
  cancellingId: string | null;
}) {
  const status = isValidStatus(batch.status) ? batch.status : null;
  const tone = status ? STATUS_TONE[status] : "neutral";
  const label = status ? STATUS_LABEL[status] : batch.status;
  const nextStatus = status ? NEXT_STATUS[status] : undefined;

  const isAdvancing = advancingId === batch.id;
  const isCancelling = cancellingId === batch.id;
  const isActing = isAdvancing || isCancelling;

  return (
    <div className="flex flex-col gap-3 border-b border-[color:var(--border)] px-4 py-4 last:border-0 sm:flex-row sm:items-start sm:gap-4">
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary-glow)]">
        <Package size={18} className="text-[color:var(--primary)]" />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Top row: batch number + status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-[color:var(--foreground)]">
            {batch.batchNumber}
          </span>
          <StatusBadge tone={tone}>{label}</StatusBadge>
          {batch.priority >= 8 && (
            <StatusBadge tone="danger">Priority {batch.priority}</StatusBadge>
          )}
        </div>

        {/* Meta row */}
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <Package size={11} aria-hidden />
            {batch.caseIds.length} case{batch.caseIds.length !== 1 ? "s" : ""}
            {batch.totalAligners > 0 && (
              <span className="ml-0.5 opacity-70">· {batch.totalAligners} aligners</span>
            )}
          </span>
          {batch.scheduledDate && (
            <span className="flex items-center gap-1">
              <Clock size={11} aria-hidden />
              {formatDate(batch.scheduledDate)}
            </span>
          )}
          {batch.resinType && (
            <span className="flex items-center gap-1">
              <Printer size={11} aria-hidden />
              {batch.resinType}
            </span>
          )}
          {batch.estimatedPrintHours != null && (
            <span>~{batch.estimatedPrintHours}h print</span>
          )}
        </div>

        {batch.notes && (
          <p className="mt-1.5 line-clamp-2 text-xs text-[color:var(--muted-foreground)]">
            {batch.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        {nextStatus && (
          <button
            type="button"
            onClick={() => onAdvance(batch.id, nextStatus)}
            disabled={isActing}
            className="flex h-8 items-center gap-1.5 rounded-xl border border-[color:var(--primary)] bg-[color:var(--primary-glow)] px-3 text-xs font-semibold text-[color:var(--primary)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAdvancing ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[color:var(--primary)]/30 border-t-[color:var(--primary)]" />
            ) : (
              <ChevronRight size={13} />
            )}
            {STATUS_LABEL[nextStatus]}
          </button>
        )}

        {status === "staging" && (
          <button
            type="button"
            onClick={() => onCancel(batch.id)}
            disabled={isActing}
            className="flex h-8 items-center gap-1.5 rounded-xl border border-rose-300/60 bg-rose-50/60 px-3 text-xs font-semibold text-rose-700 transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400"
          >
            {isCancelling ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-500/30 border-t-rose-500" />
            ) : null}
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton Cards ───────────────────────────────────────────────────────────

function BatchSkeleton() {
  return (
    <div className="flex gap-4 border-b border-[color:var(--border)] px-4 py-4 last:border-0">
      <SkeletonBlock className="h-10 w-10 shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-3 w-48 opacity-60" />
      </div>
      <SkeletonBlock className="h-8 w-24 shrink-0" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManufacturingBatchesPage() {
  const { toast } = useToast();

  const [batches, setBatches] = useState<ManufacturingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // ── Fetch batches ────────────────────────────────────────────────────────
  const fetchBatches = useCallback(
    async (statusFilter: FilterKey) => {
      setLoading(true);
      setError(null);
      try {
        const url =
          statusFilter === "all"
            ? "/api/manufacturing-batches"
            : `/api/manufacturing-batches?status=${statusFilter}`;
        const data = await api.get<ManufacturingBatch[]>(url);
        setBatches(Array.isArray(data) ? data : []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load batches";
        setError(msg);
        setBatches([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchBatches(filter);
  }, [filter, fetchBatches]);

  // ── Advance status ───────────────────────────────────────────────────────
  const handleAdvance = useCallback(
    async (id: string, nextStatus: BatchStatus) => {
      setAdvancingId(id);
      try {
        const updated = await api.patch<ManufacturingBatch>(
          `/api/manufacturing-batches/${id}/status`,
          { status: nextStatus },
        );
        // When filtering by status, remove the now-changed batch from the current view
        if (filter !== "all") {
          setBatches((prev) => prev.filter((b) => b.id !== id));
        } else {
          setBatches((prev) =>
            prev.map((b) => (b.id === id ? updated : b)),
          );
        }
        toast({
          title: `Batch advanced to ${STATUS_LABEL[nextStatus]}`,
          type: "success",
        });
      } catch (err) {
        toast({
          title: "Failed to advance batch",
          description: err instanceof Error ? err.message : "Unknown error",
          type: "error",
        });
      } finally {
        setAdvancingId(null);
      }
    },
    [toast, filter],
  );

  // ── Cancel batch ─────────────────────────────────────────────────────────
  const handleCancel = useCallback(
    async (id: string) => {
      setCancellingId(id);
      try {
        const updated = await api.patch<ManufacturingBatch>(
          `/api/manufacturing-batches/${id}/status`,
          { status: "cancelled" },
        );
        // Remove from view when filtering by staging (cancelled won't match)
        if (filter === "staging") {
          setBatches((prev) => prev.filter((b) => b.id !== id));
        } else {
          setBatches((prev) =>
            prev.map((b) => (b.id === id ? updated : b)),
          );
        }
        toast({ title: "Batch cancelled", type: "info" });
      } catch (err) {
        toast({
          title: "Failed to cancel batch",
          description: err instanceof Error ? err.message : "Unknown error",
          type: "error",
        });
      } finally {
        setCancellingId(null);
      }
    },
    [toast, filter],
  );

  // ── Handle new batch created ─────────────────────────────────────────────
  const handleCreated = useCallback(
    (batch: ManufacturingBatch) => {
      if (filter === "all" || filter === "staging") {
        setBatches((prev) => [batch, ...prev]);
      }
    },
    [filter],
  );

  // ── Derived filtered list (client-side for status changes) ───────────────
  const visible =
    filter === "all"
      ? batches
      : batches.filter((b) => b.status === filter);

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height,60px)+var(--sa-bottom,0px)+1.5rem)] pt-4 sm:px-5">

      {/* ── Back link ── */}
      <Link
        href="/manufacturing"
        className="flex w-fit items-center gap-1 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
      >
        <ChevronRight size={13} className="rotate-180" aria-hidden />
        Manufacturing
      </Link>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Manufacturing
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            <Package size={22} className="text-[color:var(--primary)]" aria-hidden />
            Batches
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Track print runs from staging through shipment
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={15} />
          New Batch
        </Button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400"
        >
          <Package size={15} className="shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => void fetchBatches(filter)}
            className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Status filter pills ── */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {FILTER_SPECS.map((f) => (
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

      {/* ── Batch list ── */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="divide-y divide-[color:var(--border)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <BatchSkeleton key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Package}
              title="No batches found"
              message={
                filter === "all"
                  ? "Create a new batch to start a print run."
                  : `No batches with status "${filter === "post_processing" ? "Post Processing" : filter.charAt(0).toUpperCase() + filter.slice(1)}".`
              }
              action={
                filter === "all" ? (
                  <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                    <Plus size={14} />
                    New Batch
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {visible.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                onAdvance={handleAdvance}
                onCancel={handleCancel}
                advancingId={advancingId}
                cancellingId={cancellingId}
              />
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && visible.length > 0 && (
          <div className="border-t border-[color:var(--border)] px-4 py-2.5 text-xs text-[color:var(--muted-foreground)]">
            {visible.length} batch{visible.length !== 1 ? "es" : ""}
          </div>
        )}
      </Card>

      {/* ── Create Batch Modal ── */}
      <CreateBatchModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </section>
  );
}
