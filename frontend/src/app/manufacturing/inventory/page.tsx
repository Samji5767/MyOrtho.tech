"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpDown,
  Box,
  Package,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ToastContext";
import { EmptyState, SkeletonBlock, StatusBadge } from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string; name: string; sku: string | null; category: string;
  unit: string; unitCostCents: number | null; reorderThreshold: number;
  quantityOnHand: number; belowReorder: boolean; notes: string | null;
  createdAt: string; updatedAt: string;
}

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
type FilterKey = "all" | "resin" | "packaging" | "consumable" | "build_platform" | "maintenance" | "material";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  resin:          "Resin",
  packaging:      "Packaging",
  consumable:     "Consumable",
  build_platform: "Build Platform",
  maintenance:    "Maintenance Kit",
  material:       "Material",
};

const CATEGORY_TONE: Record<string, Tone> = {
  resin:          "primary",
  packaging:      "info",
  consumable:     "neutral",
  build_platform: "warning",
  maintenance:    "warning",
  material:       "neutral",
};

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all",            label: "All"             },
  { key: "resin",          label: "Resin"           },
  { key: "packaging",      label: "Packaging"       },
  { key: "consumable",     label: "Consumable"      },
  { key: "build_platform", label: "Build Platform"  },
  { key: "maintenance",    label: "Maintenance"     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCost(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-[color:var(--border)] last:border-0">
      <td className="px-4 py-3">
        <SkeletonBlock className="h-4 w-40" />
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <SkeletonBlock className="h-5 w-20 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <SkeletonBlock className="ml-auto h-4 w-14" />
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <SkeletonBlock className="ml-auto h-4 w-12" />
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        <SkeletonBlock className="ml-auto h-4 w-12" />
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1.5">
          <SkeletonBlock className="h-7 w-24" />
          <SkeletonBlock className="h-7 w-28" />
        </div>
      </td>
    </tr>
  );
}

// ─── Add Item Panel ───────────────────────────────────────────────────────────

const DEFAULT_NEW_ITEM = {
  name: "", sku: "", category: "resin",
  unit: "ml", reorderThreshold: "10", quantityOnHand: "0",
};

function AddItemPanel({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULT_NEW_ITEM);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Name is required", type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/lab/inventory/items", {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        category: form.category,
        unit: form.unit.trim() || "ea",
        reorderThreshold: Math.max(0, parseInt(form.reorderThreshold, 10) || 0),
        quantityOnHand: Math.max(0, parseInt(form.quantityOnHand, 10) || 0),
      });
      toast({ title: "Item added", type: "success" });
      onAdded();
      onClose();
    } catch (err) {
      toast({
        title: "Failed to add item",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30";
  const labelClass = "block text-xs font-semibold text-[color:var(--foreground)] mb-1";

  return (
    <div className="rounded-xl border border-[color:var(--primary)]/30 bg-[color:var(--card)] p-4">
      {/* Panel header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-[color:var(--primary)]" aria-hidden />
          <span className="text-sm font-semibold text-[color:var(--foreground)]">
            New Inventory Item
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--border)]/40 hover:text-[color:var(--foreground)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Form fields */}
      <form id="add-item-form" onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="inv-name">
            Name <span className="text-rose-500" aria-hidden>*</span>
          </label>
          <input
            id="inv-name"
            type="text"
            className={fieldClass}
            placeholder="e.g. Ortho Resin V2"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="inv-sku">SKU</label>
          <input
            id="inv-sku"
            type="text"
            className={fieldClass}
            placeholder="Optional"
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="inv-unit">Unit</label>
          <input
            id="inv-unit"
            type="text"
            className={fieldClass}
            placeholder="ml / ea / kg"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="inv-category">Category</label>
          <select
            id="inv-category"
            className={fieldClass + " appearance-none"}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {Object.entries(CATEGORY_LABEL).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="inv-qty">Qty on Hand</label>
          <input
            id="inv-qty"
            type="number"
            min={0}
            className={fieldClass}
            value={form.quantityOnHand}
            onChange={(e) => setForm((f) => ({ ...f, quantityOnHand: e.target.value }))}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="inv-reorder">Reorder Threshold</label>
          <input
            id="inv-reorder"
            type="number"
            min={0}
            className={fieldClass}
            value={form.reorderThreshold}
            onChange={(e) => setForm((f) => ({ ...f, reorderThreshold: e.target.value }))}
          />
        </div>
      </form>

      {/* Panel actions */}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          form="add-item-form"
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-4 py-1.5 text-sm font-semibold text-[color:var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
          ) : (
            <Plus size={14} aria-hidden />
          )}
          {submitting ? "Adding…" : "Add Item"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[color:var(--border)] px-4 py-1.5 text-sm font-semibold text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--border)]/40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Transaction Panel ────────────────────────────────────────────────────────

function TransactionPanel({
  itemId,
  itemName,
  type,
  onClose,
  onDone,
}: {
  itemId: string;
  itemName: string;
  type: "usage" | "receipt";
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [qty, setQty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isReceipt = type === "receipt";
  const Icon = isReceipt ? TrendingUp : TrendingDown;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(qty, 10);
    if (isNaN(n) || n <= 0) {
      toast({ title: "Enter a positive quantity", type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/lab/inventory/transactions", {
        itemId,
        transactionType: type,
        quantityDelta: isReceipt ? n : -n,
      });
      toast({ title: isReceipt ? "Receipt recorded" : "Usage recorded", type: "success" });
      onDone();
      onClose();
    } catch (err) {
      toast({
        title: "Transaction failed",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const accentClass = isReceipt
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-rose-700 dark:text-rose-400";

  return (
    <div className="rounded-xl border border-[color:var(--primary)]/30 bg-[color:var(--card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className={accentClass} aria-hidden />
          <span className="text-sm font-semibold text-[color:var(--foreground)]">
            Record {isReceipt ? "Receipt" : "Usage"}{" "}
            <span className="font-normal text-[color:var(--muted-foreground)]">— {itemName}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--border)]/40 hover:text-[color:var(--foreground)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          type="number"
          min={1}
          placeholder="Quantity"
          value={qty}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onChange={(e) => setQty(e.target.value)}
          className="w-32 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
        />
        <button
          type="submit"
          disabled={submitting || !qty}
          className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-[color:var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
          ) : (
            <Icon size={14} aria-hidden />
          )}
          {submitting ? "Saving…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--border)]/40"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { toast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<FilterKey>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [txn, setTxn] = useState<{
    itemId: string;
    itemName: string;
    type: "usage" | "receipt";
  } | null>(null);

  // ── Fetch items ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = catFilter !== "all" ? `?category=${catFilter}` : "";
      const data = await api.get<InventoryItem[]>(`/api/lab/inventory/items${qs}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({
        title: "Failed to load inventory",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [catFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Computed ─────────────────────────────────────────────────────────────
  const alertCount = items.filter((i) => i.belowReorder).length;

  // ── Interaction helpers ───────────────────────────────────────────────────
  const openUsage = useCallback((item: InventoryItem) => {
    setShowCreate(false);
    setTxn({ itemId: item.id, itemName: item.name, type: "usage" });
  }, []);

  const openReceipt = useCallback((item: InventoryItem) => {
    setShowCreate(false);
    setTxn({ itemId: item.id, itemName: item.name, type: "receipt" });
  }, []);

  const handleAddClick = () => {
    setTxn(null);
    setShowCreate((v) => !v);
  };

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height,60px)+var(--sa-bottom,0px)+1.5rem)] pt-4 sm:px-5">

      {/* ── Back link ── */}
      <Link
        href="/manufacturing"
        className="flex w-fit items-center gap-1 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="rotate-180" aria-hidden>
          <path d="M9 18l6-6-6-6" />
        </svg>
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
            Inventory
            {!loading && items.length > 0 && (
              <span className="rounded-full bg-[color:var(--primary)]/10 px-2.5 py-0.5 text-sm font-semibold text-[color:var(--primary)]">
                {items.length}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Track resin, packaging, and consumable stock
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddClick}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--primary-foreground)] transition hover:opacity-90 active:scale-95"
        >
          <Plus size={14} aria-hidden />
          Add Item
        </button>
      </div>

      {/* ── Reorder alert banner ── */}
      {!loading && alertCount > 0 && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-400"
        >
          <AlertCircle size={16} className="shrink-0" aria-hidden />
          <span>
            {alertCount} item{alertCount !== 1 ? "s" : ""} need{alertCount === 1 ? "s" : ""} reordering
          </span>
        </div>
      )}

      {/* ── Add Item panel ── */}
      {showCreate && (
        <AddItemPanel
          onClose={() => setShowCreate(false)}
          onAdded={() => void load()}
        />
      )}

      {/* ── Transaction panel ── */}
      {txn && (
        <TransactionPanel
          itemId={txn.itemId}
          itemName={txn.itemName}
          type={txn.type}
          onClose={() => setTxn(null)}
          onDone={() => void load()}
        />
      )}

      {/* ── Category filter pills ── */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCatFilter(tab.key)}
            className={[
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
              catFilter === tab.key
                ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Inventory table ── */}
      {loading ? (
        <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]">
          <table className="w-full text-sm" aria-label="Loading inventory">
            <thead className="border-b border-[color:var(--border)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Item</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] sm:table-cell">Category</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">In Stock</th>
                <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] md:table-cell">Reorder At</th>
                <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] lg:table-cell">Unit Cost</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowUpDown size={11} aria-hidden />
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Box}
          title="No inventory items"
          message={
            catFilter === "all"
              ? "Add items to track resin, packaging, and consumable stock."
              : `No ${CATEGORY_LABEL[catFilter] ?? catFilter} items found.`
          }
          action={
            catFilter === "all" ? (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--primary-foreground)] transition hover:opacity-90"
              >
                <Plus size={14} aria-hidden />
                Add Item
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Inventory items">
              <thead className="border-b border-[color:var(--border)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Item</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] sm:table-cell">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">In Stock</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] md:table-cell">Reorder At</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] lg:table-cell">Unit Cost</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                    <span className="flex items-center justify-end gap-1">
                      <ArrowUpDown size={11} aria-hidden />
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={[
                      "border-b border-[color:var(--border)] last:border-0",
                      item.belowReorder
                        ? "bg-amber-50/40 dark:bg-amber-900/10"
                        : "",
                    ].join(" ")}
                  >
                    {/* Name + SKU */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {item.belowReorder && (
                          <AlertCircle
                            size={13}
                            className="mt-0.5 shrink-0 text-amber-500"
                            aria-label="Below reorder threshold"
                          />
                        )}
                        <div>
                          <p className="font-medium text-[color:var(--foreground)]">
                            {item.name}
                          </p>
                          {item.sku && (
                            <p className="font-mono text-[11px] text-[color:var(--muted-foreground)]">
                              {item.sku}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category badge */}
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <StatusBadge tone={CATEGORY_TONE[item.category] ?? "neutral"}>
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </StatusBadge>
                    </td>

                    {/* Qty on hand — red when below reorder */}
                    <td
                      className={[
                        "px-4 py-3 text-right tabular-nums font-semibold",
                        item.belowReorder
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-[color:var(--foreground)]",
                      ].join(" ")}
                    >
                      {item.quantityOnHand}{" "}
                      <span className="text-xs font-normal text-[color:var(--muted-foreground)]">
                        {item.unit}
                      </span>
                    </td>

                    {/* Reorder threshold */}
                    <td className="hidden px-4 py-3 text-right tabular-nums text-[color:var(--muted-foreground)] md:table-cell">
                      {item.reorderThreshold}{" "}
                      <span className="text-xs">{item.unit}</span>
                    </td>

                    {/* Unit cost */}
                    <td className="hidden px-4 py-3 text-right tabular-nums text-[color:var(--muted-foreground)] lg:table-cell">
                      {fmtCost(item.unitCostCents)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openUsage(item)}
                          title="Record usage"
                          className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:border-rose-300 hover:bg-rose-50/60 hover:text-rose-700 dark:hover:border-rose-700/40 dark:hover:bg-rose-900/10 dark:hover:text-rose-400"
                        >
                          <TrendingDown size={12} aria-hidden />
                          Record Usage
                        </button>
                        <button
                          type="button"
                          onClick={() => openReceipt(item)}
                          title="Record receipt"
                          className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-700 dark:hover:border-emerald-700/40 dark:hover:bg-emerald-900/10 dark:hover:text-emerald-400"
                        >
                          <TrendingUp size={12} aria-hidden />
                          Record Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="border-t border-[color:var(--border)] px-4 py-2.5 text-xs text-[color:var(--muted-foreground)]">
            {items.length} item{items.length !== 1 ? "s" : ""}
            {alertCount > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                · {alertCount} need{alertCount === 1 ? "s" : ""} reordering
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
