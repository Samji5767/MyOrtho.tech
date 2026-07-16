"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Package,
  Plus,
  Truck,
} from "lucide-react";
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

interface Shipment {
  id: string; batchId: string | null; courier: string | null;
  trackingNumber: string | null; carrierService: string | null;
  shippedAt: string | null; estimatedDelivery: string | null;
  deliveredAt: string | null; status: string;
  recipientName: string | null; recipientAddress: string | null;
  notes: string | null; createdAt: string; updatedAt: string;
}

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

type FilterKey = "all" | "pending" | "in_transit" | "delivered" | "exception";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, Tone> = {
  pending:          "neutral",
  label_printed:    "info",
  in_transit:       "primary",
  out_for_delivery: "warning",
  delivered:        "success",
  exception:        "danger",
  returned:         "danger",
};

const STATUS_LABEL: Record<string, string> = {
  pending:          "Pending",
  label_printed:    "Label Printed",
  in_transit:       "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  exception:        "Exception",
  returned:         "Returned",
};

// Each status's next step and the label for the advance button
const NEXT_STATUS: Record<string, string> = {
  pending:          "label_printed",
  label_printed:    "in_transit",
  in_transit:       "out_for_delivery",
  out_for_delivery: "delivered",
  exception:        "in_transit",
};

const ADVANCE_LABEL: Record<string, string> = {
  pending:          "Print Label",
  label_printed:    "Mark In Transit",
  in_transit:       "Out for Delivery",
  out_for_delivery: "Mark Delivered",
  exception:        "Retry Shipment",
};

const FILTER_SPECS: { key: FilterKey; label: string }[] = [
  { key: "all",        label: "All"        },
  { key: "pending",    label: "Pending"    },
  { key: "in_transit", label: "In Transit" },
  { key: "delivered",  label: "Delivered"  },
  { key: "exception",  label: "Exception"  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function matchesFilter(s: Shipment, f: FilterKey): boolean {
  if (f === "all") return true;
  // "Pending" tab covers both pending and label_printed
  if (f === "pending") return s.status === "pending" || s.status === "label_printed";
  // "In Transit" tab covers in_transit and out_for_delivery
  if (f === "in_transit") return s.status === "in_transit" || s.status === "out_for_delivery";
  return s.status === f;
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function ShipmentSkeleton() {
  return (
    <div className="flex gap-4 border-b border-[color:var(--border)] px-4 py-4 last:border-0">
      <SkeletonBlock className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="h-3 w-56 opacity-60" />
        <SkeletonBlock className="h-3 w-28 opacity-40" />
      </div>
      <SkeletonBlock className="h-8 w-28 shrink-0 rounded-xl" />
    </div>
  );
}

// ─── Create Shipment Modal ────────────────────────────────────────────────────

interface CreateForm {
  batchId: string;
  recipientName: string;
  courier: string;
  trackingNumber: string;
  notes: string;
}

const EMPTY_CREATE: CreateForm = {
  batchId: "", recipientName: "", courier: "", trackingNumber: "", notes: "",
};

function CreateShipmentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (s: Shipment) => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE);

  useEffect(() => {
    if (open) setForm(EMPTY_CREATE);
  }, [open]);

  const set =
    (field: keyof CreateForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const dto: Record<string, unknown> = {};
      if (form.batchId.trim())        dto.batchId        = form.batchId.trim();
      if (form.recipientName.trim())  dto.recipientName  = form.recipientName.trim();
      if (form.courier.trim())        dto.courier        = form.courier.trim();
      if (form.trackingNumber.trim()) dto.trackingNumber = form.trackingNumber.trim();
      if (form.notes.trim())          dto.notes          = form.notes.trim();

      const created = await api.post<Shipment>("/api/lab/shipments", dto);
      toast({ title: "Shipment created", type: "success" });
      onCreated(created);
      onClose();
    } catch (err) {
      toast({
        title: "Failed to create shipment",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30";
  const labelCls =
    "block text-xs font-semibold text-[color:var(--foreground)] mb-1";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Shipment"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            form="create-shipment-form"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating…
              </>
            ) : (
              <>
                <Truck size={14} />
                Create Shipment
              </>
            )}
          </Button>
        </>
      }
    >
      <form
        id="create-shipment-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="cs-batch">
              Batch ID{" "}
              <span className="font-normal text-[color:var(--muted-foreground)]">
                (optional)
              </span>
            </label>
            <input
              id="cs-batch"
              type="text"
              className={inputCls}
              placeholder="Batch reference"
              value={form.batchId}
              onChange={set("batchId")}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="cs-recipient">
              Recipient Name
            </label>
            <input
              id="cs-recipient"
              type="text"
              className={inputCls}
              placeholder="Clinic or patient name"
              value={form.recipientName}
              onChange={set("recipientName")}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="cs-courier">
              Courier
            </label>
            <input
              id="cs-courier"
              type="text"
              className={inputCls}
              placeholder="FedEx, UPS, DHL…"
              value={form.courier}
              onChange={set("courier")}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="cs-tracking">
              Tracking Number
            </label>
            <input
              id="cs-tracking"
              type="text"
              className={inputCls}
              placeholder="Tracking # if known"
              value={form.trackingNumber}
              onChange={set("trackingNumber")}
            />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="cs-notes">
            Notes
          </label>
          <textarea
            id="cs-notes"
            rows={3}
            className="w-full resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
            placeholder="Special instructions or delivery notes…"
            value={form.notes}
            onChange={set("notes")}
          />
        </div>
      </form>
    </Modal>
  );
}

// ─── Add Tracking Modal ───────────────────────────────────────────────────────

interface TrackingForm {
  courier: string;
  trackingNumber: string;
  estimatedDelivery: string;
}

function AddTrackingModal({
  shipment,
  onClose,
  onSaved,
}: {
  shipment: Shipment | null;
  onClose: () => void;
  onSaved: (updated: Shipment) => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<TrackingForm>({
    courier: "", trackingNumber: "", estimatedDelivery: "",
  });

  useEffect(() => {
    if (shipment) {
      setForm({
        courier:           shipment.courier        ?? "",
        trackingNumber:    shipment.trackingNumber ?? "",
        estimatedDelivery: "",
      });
    }
  }, [shipment]);

  // All hooks above — safe early return below
  if (!shipment) return null;

  const set =
    (field: keyof TrackingForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courier.trim() || !form.trackingNumber.trim()) {
      toast({ title: "Courier and tracking number are required", type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const dto: Record<string, unknown> = {
        courier:       form.courier.trim(),
        trackingNumber: form.trackingNumber.trim(),
      };
      if (form.estimatedDelivery) dto.estimatedDelivery = form.estimatedDelivery;

      const updated = await api.patch<Shipment>(
        `/api/lab/shipments/${shipment.id}/tracking`,
        dto,
      );
      toast({ title: "Tracking info updated", type: "success" });
      onSaved(updated);
      onClose();
    } catch (err) {
      toast({
        title: "Failed to update tracking",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30";
  const labelCls =
    "block text-xs font-semibold text-[color:var(--foreground)] mb-1";

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Tracking Info"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            form="add-tracking-form"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving…
              </>
            ) : (
              "Save Tracking"
            )}
          </Button>
        </>
      }
    >
      <form
        id="add-tracking-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div>
          <label className={labelCls} htmlFor="at-courier">Courier</label>
          <input
            id="at-courier"
            type="text"
            className={inputCls}
            placeholder="FedEx, UPS, DHL…"
            value={form.courier}
            onChange={set("courier")}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="at-tracking">Tracking Number</label>
          <input
            id="at-tracking"
            type="text"
            className={inputCls}
            placeholder="e.g. 1Z9999W99999999999"
            value={form.trackingNumber}
            onChange={set("trackingNumber")}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="at-delivery">Estimated Delivery</label>
          <input
            id="at-delivery"
            type="date"
            className={inputCls}
            value={form.estimatedDelivery}
            onChange={set("estimatedDelivery")}
          />
        </div>
      </form>
    </Modal>
  );
}

// ─── Shipment Card ────────────────────────────────────────────────────────────

function ShipmentCard({
  shipment,
  advancingId,
  onAdvance,
  onAddTracking,
}: {
  shipment: Shipment;
  advancingId: string | null;
  onAdvance: (id: string, nextStatus: string) => void;
  onAddTracking: (s: Shipment) => void;
}) {
  const tone: Tone  = STATUS_TONE[shipment.status] ?? "neutral";
  const label       = STATUS_LABEL[shipment.status] ?? shipment.status;
  const nextStatus  = NEXT_STATUS[shipment.status];
  const nextLabel   = ADVANCE_LABEL[shipment.status];
  const isAdvancing = advancingId === shipment.id;

  const isTerminal =
    shipment.status === "delivered" ||
    shipment.status === "returned";

  // Offer "Add Tracking" when no tracking number exists and shipment is still active
  const canAddTracking =
    !shipment.trackingNumber &&
    (shipment.status === "pending" || shipment.status === "label_printed");

  return (
    <div className="flex flex-col gap-3 border-b border-[color:var(--border)] px-4 py-4 last:border-0 sm:flex-row sm:items-start sm:gap-4">

      {/* Status icon */}
      <div
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          shipment.status === "delivered"
            ? "bg-emerald-500/10"
            : shipment.status === "exception" || shipment.status === "returned"
            ? "bg-rose-500/10"
            : "bg-[color:var(--primary-glow)]",
        ].join(" ")}
      >
        {shipment.status === "delivered" ? (
          <CheckCircle2
            size={18}
            className="text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
        ) : shipment.status === "exception" || shipment.status === "returned" ? (
          <AlertCircle
            size={18}
            className="text-rose-600 dark:text-rose-400"
            aria-hidden
          />
        ) : (
          <Truck size={18} className="text-[color:var(--primary)]" aria-hidden />
        )}
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Recipient + badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              shipment.recipientName
                ? "text-sm font-medium text-[color:var(--foreground)]"
                : "text-sm font-medium text-[color:var(--muted-foreground)]"
            }
          >
            {shipment.recipientName ?? "No recipient"}
          </span>
          <StatusBadge tone={tone}>{label}</StatusBadge>
        </div>

        {/* Meta */}
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--muted-foreground)]">
          {shipment.batchId && (
            <span className="flex items-center gap-1 font-mono">
              <Package size={11} aria-hidden />
              Batch {shortId(shipment.batchId)}
            </span>
          )}
          {shipment.courier && (
            <span className="flex items-center gap-1">
              <Truck size={11} aria-hidden />
              {shipment.courier}
              {shipment.trackingNumber && (
                <>
                  {" · "}
                  <span className="font-mono tabular-nums">
                    {shipment.trackingNumber}
                  </span>
                  <ExternalLink size={10} className="opacity-60" aria-hidden />
                </>
              )}
            </span>
          )}
          {shipment.shippedAt && (
            <span>Shipped {fmtDate(shipment.shippedAt)}</span>
          )}
          {shipment.estimatedDelivery && !shipment.deliveredAt && (
            <span className="flex items-center gap-1">
              <MapPin size={11} aria-hidden />
              Est. {fmtDate(shipment.estimatedDelivery)}
            </span>
          )}
          {shipment.deliveredAt && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={11} aria-hidden />
              Delivered {fmtDate(shipment.deliveredAt)}
            </span>
          )}
        </div>

        {shipment.notes && (
          <p className="mt-1.5 line-clamp-2 text-xs text-[color:var(--muted-foreground)]">
            {shipment.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      {!isTerminal && (
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          {canAddTracking && (
            <button
              type="button"
              onClick={() => onAddTracking(shipment)}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
            >
              <Package size={12} aria-hidden />
              Add Tracking
            </button>
          )}
          {nextStatus && (
            <button
              type="button"
              onClick={() => onAdvance(shipment.id, nextStatus)}
              disabled={isAdvancing}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-[color:var(--primary)] bg-[color:var(--primary-glow)] px-3 text-xs font-semibold text-[color:var(--primary)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdvancing ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[color:var(--primary)]/30 border-t-[color:var(--primary)]" />
              ) : (
                <Truck size={12} aria-hidden />
              )}
              {nextLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShipmentsPage() {
  const { toast } = useToast();

  const [shipments, setShipments]           = useState<Shipment[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [filter, setFilter]                 = useState<FilterKey>("all");
  const [advancingId, setAdvancingId]       = useState<string | null>(null);
  const [showCreate, setShowCreate]         = useState(false);
  const [trackingTarget, setTrackingTarget] = useState<Shipment | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Shipment[]>("/api/lab/shipments");
      setShipments(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load shipments";
      setError(msg);
      toast({ title: "Failed to load shipments", description: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Advance status ────────────────────────────────────────────────────────

  const handleAdvance = useCallback(
    async (id: string, nextStatus: string) => {
      setAdvancingId(id);
      try {
        const updated = await api.patch<Shipment>(
          `/api/lab/shipments/${id}/status`,
          { status: nextStatus },
        );
        setShipments((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
        toast({
          title: `Shipment → ${STATUS_LABEL[nextStatus] ?? nextStatus}`,
          type: "success",
        });
      } catch (err) {
        toast({
          title: "Status update failed",
          description: err instanceof Error ? err.message : "Unknown error",
          type: "error",
        });
      } finally {
        setAdvancingId(null);
      }
    },
    [toast],
  );

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleCreated = useCallback((s: Shipment) => {
    setShipments((prev) => [s, ...prev]);
  }, []);

  const handleTrackingSaved = useCallback((updated: Shipment) => {
    setShipments((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)),
    );
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const visible = shipments.filter((s) => matchesFilter(s, filter));

  const inTransitCount = shipments.filter(
    (s) => s.status === "in_transit" || s.status === "out_for_delivery",
  ).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height,60px)+var(--sa-bottom,0px)+1.5rem)] pt-4 sm:px-5">

      {/* ── Back link ──────────────────────────────────────────────────────── */}
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

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Manufacturing
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            <Truck size={22} className="text-[color:var(--primary)]" aria-hidden />
            Shipments
          </h1>
          <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
            Track and manage outbound deliveries
            {!loading && inTransitCount > 0 && (
              <>
                {" · "}
                <span className="font-medium text-[color:var(--foreground)]">
                  {inTransitCount} in transit
                </span>
              </>
            )}
            {!loading && shipments.length > 0 && (
              <>
                {" · "}
                <span className="tabular-nums">{shipments.length} total</span>
              </>
            )}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={15} />
          Create Shipment
        </Button>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
          <AlertCircle size={15} className="flex-none" aria-hidden />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Filter pills ────────────────────────────────────────────────────── */}
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

      {/* ── Shipment list ───────────────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="divide-y divide-[color:var(--border)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <ShipmentSkeleton key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Truck}
              title="No shipments found"
              message={
                filter === "all"
                  ? "Create a shipment when batches are ready for delivery."
                  : `No ${FILTER_SPECS.find((f) => f.key === filter)?.label.toLowerCase()} shipments at this time.`
              }
              action={
                filter === "all" ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus size={14} />
                    Create Shipment
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {visible.map((shipment) => (
              <ShipmentCard
                key={shipment.id}
                shipment={shipment}
                advancingId={advancingId}
                onAdvance={handleAdvance}
                onAddTracking={setTrackingTarget}
              />
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && visible.length > 0 && (
          <div className="border-t border-[color:var(--border)] px-4 py-2.5 text-xs text-[color:var(--muted-foreground)]">
            {visible.length} shipment{visible.length !== 1 ? "s" : ""}
          </div>
        )}
      </Card>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <CreateShipmentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
      <AddTrackingModal
        shipment={trackingTarget}
        onClose={() => setTrackingTarget(null)}
        onSaved={handleTrackingSaved}
      />
    </section>
  );
}
