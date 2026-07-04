"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PlusCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/DesignSystem";
import {
  listIprItems,
  addIprItem,
  deleteIprItem,
  autoRecommendIpr,
  type IprPlanItem,
  type CreateIprItemDto,
} from "@/lib/api/ipr";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SAFETY_TONE = { safe: "success", warning: "warning", unsafe: "danger" } as const;

function safetyTone(s: string) {
  return SAFETY_TONE[s as keyof typeof SAFETY_TONE] ?? "neutral";
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function IprRow({ item, onDelete }: { item: IprPlanItem; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] py-2.5 last:border-0">
      <div className="min-w-0 flex-1 grid grid-cols-[5rem_auto_auto_auto] items-center gap-3 text-sm">
        <span className="font-semibold tabular-nums text-[color:var(--primary)]">
          {item.toothAFdi}|{item.toothBFdi}
        </span>
        <span className="tabular-nums font-medium text-[color:var(--foreground)]">
          {item.amountMm.toFixed(2)} mm
        </span>
        <span className="text-xs text-[color:var(--muted-foreground)]">
          Before stage {item.beforeStage}
        </span>
        <div className="flex items-center gap-1">
          <StatusBadge tone={safetyTone(item.safetyStatus)}>
            {item.safetyStatus}
          </StatusBadge>
          {item.isAutoRecommended && <StatusBadge tone="info">AI</StatusBadge>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {item.remainingEnamelA !== null && (
          <p className="text-[10px] text-[color:var(--muted-foreground)]">
            Rem: {item.remainingEnamelA.toFixed(2)} / {item.remainingEnamelB?.toFixed(2)} mm
          </p>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="mt-0.5 rounded-lg p-1.5 text-[color:var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-600 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Add Form ─────────────────────────────────────────────────────────────────

function AddForm({ onAdd }: { onAdd: (dto: CreateIprItemDto) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dto, setDto] = useState<CreateIprItemDto>({
    toothAFdi: 11,
    toothBFdi: 12,
    amountMm: 0.25,
    beforeStage: 5,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onAdd(dto); setOpen(false); }
    finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--primary)] hover:underline"
      >
        <PlusCircle size={13} /> Add IPR site
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
      <p className="text-sm font-semibold text-[color:var(--foreground)]">Add IPR Site</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["toothAFdi", "toothBFdi"] as const).map((key) => (
          <div key={key}>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">
              {key === "toothAFdi" ? "Tooth A FDI" : "Tooth B FDI"}
            </label>
            <input
              type="number" min={11} max={48}
              value={dto[key]}
              onChange={(e) => setDto((d) => ({ ...d, [key]: Number(e.target.value) }))}
              className="h-8 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)]"
            />
          </div>
        ))}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">Amount (mm)</label>
          <input
            type="number" min={0.1} max={2.0} step={0.05}
            value={dto.amountMm}
            onChange={(e) => setDto((d) => ({ ...d, amountMm: parseFloat(e.target.value) }))}
            className="h-8 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">Before stage</label>
          <input
            type="number" min={1}
            value={dto.beforeStage}
            onChange={(e) => setDto((d) => ({ ...d, beforeStage: Number(e.target.value) }))}
            className="h-8 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)]"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Add
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">Cancel</button>
      </div>
    </form>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

export default function IPRPlanner({ caseId, planId }: Props) {
  const [items, setItems] = useState<IprPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommending, setRecommending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listIprItems(caseId, planId)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [caseId, planId]);

  async function handleAdd(dto: CreateIprItemDto) {
    try {
      const item = await addIprItem(caseId, planId, dto);
      setItems((prev) => [...prev, item]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add IPR site');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteIprItem(caseId, planId, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete IPR site');
    }
  }

  async function handleRecommend() {
    setRecommending(true);
    try {
      const { items: newItems } = await autoRecommendIpr(caseId, planId);
      setItems((prev) => {
        const ids = new Set(prev.map((i) => i.id));
        return [...prev, ...newItems.filter((i) => !ids.has(i.id))];
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRecommending(false);
    }
  }

  useEffect(() => { void load(); }, [load]);

  const unsafeItems = items.filter((i) => i.safetyStatus === "unsafe");
  const totalMm = items.reduce((s, i) => s + i.amountMm, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        IPR recommendations are for clinical planning only. Verify enamel thickness and safety before performing IPR.
      </div>

      {unsafeItems.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {unsafeItems.length} IPR site{unsafeItems.length !== 1 ? "s" : ""} flagged as unsafe — enamel would be over-reduced. Review or remove.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            IPR Schedule
            {items.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[color:var(--primary-glow)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--primary)]">
                {items.length}
              </span>
            )}
          </p>
          {items.length > 0 && (
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Total: {totalMm.toFixed(2)} mm reduction
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRecommend}
          disabled={recommending}
          className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] hover:border-[color:var(--primary)]/40 disabled:opacity-50 transition-colors"
        >
          {recommending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          AI recommend
        </button>
      </div>

      {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-[color:var(--muted-foreground)]" /></div>
      ) : (
        <Card className="p-4">
          {items.length === 0 ? (
            <div className="py-4 text-center text-sm text-[color:var(--muted-foreground)]">
              No IPR sites planned.
              {" "}Use <strong>AI recommend</strong> (based on crowding analysis) or add manually.
            </div>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-[5rem_auto_auto_auto] gap-3 px-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                <span>Contact</span>
                <span>Amount</span>
                <span>Timing</span>
                <span>Safety</span>
              </div>
              {items.map((item) => (
                <IprRow key={item.id} item={item} onDelete={() => handleDelete(item.id)} />
              ))}
              <div className="mt-3 border-t border-[color:var(--border)] pt-2 flex gap-3 text-xs text-[color:var(--muted-foreground)]">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-emerald-500" />
                  {items.filter((i) => i.safetyStatus === "safe").length} safe
                </span>
                <span className="flex items-center gap-1 text-amber-500">
                  <AlertTriangle size={11} />
                  {items.filter((i) => i.safetyStatus === "warning").length} warning
                </span>
              </div>
            </>
          )}
        </Card>
      )}

      <AddForm onAdd={handleAdd} />
    </div>
  );
}
