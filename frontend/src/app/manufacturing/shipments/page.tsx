"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ChevronRight, Package, Plus, Truck, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastContext";
import { api } from "@/lib/api/client";
import { EmptyState, SkeletonBlock, StatusBadge } from "@/components/DesignSystem";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

interface Shipment {
  id: string; batchId: string | null; courier: string | null;
  trackingNumber: string | null; carrierService: string | null;
  shippedAt: string | null; estimatedDelivery: string | null;
  deliveredAt: string | null; status: string;
  recipientName: string | null; recipientAddress: unknown;
  notes: string | null; createdAt: string; updatedAt: string;
}

const STATUS_TONE: Record<string, Tone> = {
  pending: "neutral", label_printed: "info", in_transit: "primary",
  out_for_delivery: "warning", delivered: "success", exception: "danger", returned: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", label_printed: "Label Printed", in_transit: "In Transit",
  out_for_delivery: "Out for Delivery", delivered: "Delivered",
  exception: "Exception", returned: "Returned",
};
const NEXT_STATUS: Record<string, string> = {
  pending: "label_printed", label_printed: "in_transit",
  in_transit: "out_for_delivery", out_for_delivery: "delivered",
};

const FILTERS = ["all", "pending", "label_printed", "in_transit", "out_for_delivery", "delivered", "exception"] as const;
type FilterStatus = (typeof FILTERS)[number];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ShipmentsPage() {
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [advancing, setAdvancing] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ batchId: "", recipientName: "", courier: "", trackingNumber: "", notes: "" });

  // Add tracking form (per shipment)
  const [trackingOpen, setTrackingOpen] = useState<string | null>(null);
  const [trackingForm, setTrackingForm] = useState({ courier: "", trackingNumber: "", estimatedDelivery: "" });
  const [trackingBusy, setTrackingBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const data = await api.get<Shipment[]>(`/api/lab/shipments${params}`);
      setShipments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus === "unauthenticated" || !user) { router.replace("/login"); return; }
    void load();
  }, [authStatus, user, router, load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const dto = {
        batchId: createForm.batchId || undefined,
        recipientName: createForm.recipientName || undefined,
        courier: createForm.courier || undefined,
        trackingNumber: createForm.trackingNumber || undefined,
        notes: createForm.notes || undefined,
      };
      const created = await api.post<Shipment>("/api/lab/shipments", dto);
      setShipments((prev) => [created, ...prev]);
      setShowCreate(false);
      setCreateForm({ batchId: "", recipientName: "", courier: "", trackingNumber: "", notes: "" });
      toast({ title: "Shipment created", type: "success" });
    } catch (err) {
      toast({ title: "Failed to create shipment", description: err instanceof Error ? err.message : "Unknown error", type: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleAdvance = async (shipment: Shipment) => {
    const next = NEXT_STATUS[shipment.status];
    if (!next) return;
    setAdvancing(shipment.id);
    try {
      const updated = await api.patch<Shipment>(`/api/lab/shipments/${shipment.id}/status`, { status: next });
      setShipments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast({ title: `Shipment → ${STATUS_LABEL[next]}`, type: "success" });
    } catch (err) {
      toast({ title: "Status update failed", description: err instanceof Error ? err.message : "Unknown error", type: "error" });
    } finally {
      setAdvancing(null);
    }
  };

  const handleAddTracking = async (id: string) => {
    setTrackingBusy(true);
    try {
      const updated = await api.patch<Shipment>(`/api/lab/shipments/${id}/tracking`, {
        courier: trackingForm.courier || undefined,
        trackingNumber: trackingForm.trackingNumber || undefined,
        estimatedDelivery: trackingForm.estimatedDelivery || undefined,
      });
      setShipments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setTrackingOpen(null);
      setTrackingForm({ courier: "", trackingNumber: "", estimatedDelivery: "" });
      toast({ title: "Tracking info updated", type: "success" });
    } catch (err) {
      toast({ title: "Failed to update tracking", description: err instanceof Error ? err.message : "Unknown error", type: "error" });
    } finally {
      setTrackingBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/manufacturing" className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] hover:opacity-80 transition-opacity">
          <ArrowLeft size={16} className="text-[color:var(--foreground)]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">Shipments</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">Track and manage outbound deliveries</p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-sm font-semibold text-[color:var(--primary-foreground)] hover:opacity-90 transition-opacity">
          <Plus size={15} />Create Shipment
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 rounded-xl border border-[color:var(--primary)]/30 bg-[color:var(--card)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">New Shipment</p>
            <button onClick={() => setShowCreate(false)}><X size={14} className="text-[color:var(--muted-foreground)]" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["Batch ID", "batchId", "Optional batch reference"],
              ["Recipient Name", "recipientName", "Clinic or patient name"],
              ["Courier", "courier", "FedEx, UPS, DHL…"],
              ["Tracking Number", "trackingNumber", "Tracking # if known"],
            ] as const).map(([label, field, placeholder]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-[color:var(--muted-foreground)] mb-1">{label}</label>
                <input type="text" placeholder={placeholder} value={createForm[field as keyof typeof createForm]}
                  onChange={(e) => setCreateForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40" />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[color:var(--muted-foreground)] mb-1">Notes</label>
              <input type="text" placeholder="Optional notes" value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void handleCreate()} disabled={creating}
              className="rounded-lg bg-[color:var(--primary)] px-4 py-1.5 text-sm font-semibold text-[color:var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity">
              {creating ? "Creating…" : "Create"}
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-[color:var(--border)] px-4 py-1.5 text-sm font-semibold text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
          <AlertCircle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={() => void load()} className="text-xs font-semibold underline">Retry</button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={["rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              filter === f
                ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                : "border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40",
            ].join(" ")}>
            {f === "all" ? "All" : STATUS_LABEL[f] ?? f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <SkeletonBlock key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : shipments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] py-12">
          <EmptyState icon={Truck} title="No shipments found" message="Create a shipment when batches are ready for delivery." />
        </div>
      ) : (
        <div className="space-y-3">
          {shipments.map((shipment) => {
            const nextStatus = NEXT_STATUS[shipment.status];
            const busy = advancing === shipment.id;
            const isTrackOpen = trackingOpen === shipment.id;
            return (
              <div key={shipment.id} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)]">
                    <Truck size={16} className="text-[color:var(--muted-foreground)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge tone={STATUS_TONE[shipment.status] ?? "neutral"}>{STATUS_LABEL[shipment.status] ?? shipment.status}</StatusBadge>
                      {shipment.recipientName && <span className="text-sm font-medium text-[color:var(--foreground)]">{shipment.recipientName}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                      {shipment.courier && <span className="text-xs text-[color:var(--muted-foreground)]">{shipment.courier}{shipment.trackingNumber ? `: ${shipment.trackingNumber}` : ""}</span>}
                      {shipment.batchId && <span className="text-xs text-[color:var(--muted-foreground)] font-mono">Batch: {shipment.batchId.slice(0, 8)}…</span>}
                      {shipment.shippedAt && <span className="text-xs text-[color:var(--muted-foreground)]">Shipped: {fmtDate(shipment.shippedAt)}</span>}
                      {shipment.estimatedDelivery && <span className="text-xs text-[color:var(--muted-foreground)]">Est. delivery: {fmtDate(shipment.estimatedDelivery)}</span>}
                      {shipment.deliveredAt && <span className="text-xs text-emerald-600 dark:text-emerald-400">Delivered: {fmtDate(shipment.deliveredAt)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {shipment.status === "pending" && !shipment.trackingNumber && (
                      <button onClick={() => { setTrackingOpen(isTrackOpen ? null : shipment.id); setTrackingForm({ courier: "", trackingNumber: "", estimatedDelivery: "" }); }}
                        className="rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40 transition-colors">
                        <Package size={12} className="inline mr-1" />Add Tracking
                      </button>
                    )}
                    {nextStatus && (
                      <button onClick={() => void handleAdvance(shipment)} disabled={busy}
                        className="flex items-center gap-1 rounded-lg bg-[color:var(--primary)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity">
                        <ChevronRight size={12} />{busy ? "…" : STATUS_LABEL[nextStatus]}
                      </button>
                    )}
                  </div>
                </div>

                {/* Add tracking form */}
                {isTrackOpen && (
                  <div className="mt-3 border-t border-[color:var(--border)] pt-3 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-3">
                      {([
                        ["Courier", "courier", "text", "FedEx, UPS…"],
                        ["Tracking Number", "trackingNumber", "text", "Tracking #"],
                        ["Est. Delivery", "estimatedDelivery", "date", ""],
                      ] as const).map(([label, field, type, placeholder]) => (
                        <div key={field}>
                          <label className="block text-xs font-medium text-[color:var(--muted-foreground)] mb-1">{label}</label>
                          <input type={type} placeholder={placeholder} value={trackingForm[field as keyof typeof trackingForm]}
                            onChange={(e) => setTrackingForm((f) => ({ ...f, [field]: e.target.value }))}
                            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-xs text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40" />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void handleAddTracking(shipment.id)} disabled={trackingBusy}
                        className="rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity">
                        {trackingBusy ? "Saving…" : "Save Tracking"}
                      </button>
                      <button onClick={() => setTrackingOpen(null)} className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
