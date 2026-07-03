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
  listAttachments,
  addAttachment,
  deleteAttachment,
  approveAttachment,
  autoRecommendAttachments,
  ATTACHMENT_TYPE_LABELS,
  type TreatmentAttachment,
  type AttachmentType,
  type CreateAttachmentDto,
} from "@/lib/api/attachments";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ATTACHMENT_TYPES: AttachmentType[] = [
  "vertical_rectangular", "horizontal_rectangular", "optimized",
  "rotation", "extrusion", "root_control", "retention", "beveled",
];

const SURFACES = ["buccal", "lingual", "occlusal"] as const;

// ─── Row ─────────────────────────────────────────────────────────────────────

function AttachmentRow({
  att,
  onDelete,
  onApprove,
}: {
  att: TreatmentAttachment;
  onDelete: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 border-b border-[color:var(--border)] last:border-0">
      <div className="min-w-0 flex-1 grid grid-cols-[4rem_1fr_auto] items-center gap-3 text-sm">
        <span className="font-semibold text-[color:var(--primary)] tabular-nums">FDI {att.fdiNumber}</span>
        <div className="min-w-0">
          <p className="font-medium text-[color:var(--foreground)] truncate">
            {ATTACHMENT_TYPE_LABELS[att.attachmentType] ?? att.attachmentType}
          </p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {att.surface} · Stage {att.activationStage}
            {att.deactivationStage ? `–${att.deactivationStage}` : "+"}
            {" "}· {att.widthMm}×{att.heightMm}×{att.depthMm} mm
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {att.isAutoRecommended && (
            <StatusBadge tone="info">AI</StatusBadge>
          )}
          {att.isApproved ? (
            <StatusBadge tone="success">Approved</StatusBadge>
          ) : (
            <button
              type="button"
              onClick={onApprove}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 transition-colors"
            >
              Approve
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="ml-1 shrink-0 rounded-lg p-1.5 text-[color:var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-600 transition-colors"
        aria-label="Delete attachment"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Add Form ─────────────────────────────────────────────────────────────────

function AddForm({ onAdd }: { onAdd: (dto: CreateAttachmentDto) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dto, setDto] = useState<CreateAttachmentDto>({
    fdiNumber: 11,
    attachmentType: "optimized",
    surface: "buccal",
    activationStage: 1,
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
        <PlusCircle size={13} /> Add attachment
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
      <p className="text-sm font-semibold text-[color:var(--foreground)]">Add Attachment</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">FDI</label>
          <input
            type="number" min={11} max={48}
            value={dto.fdiNumber}
            onChange={(e) => setDto((d) => ({ ...d, fdiNumber: Number(e.target.value) }))}
            className="h-8 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">Type</label>
          <select
            value={dto.attachmentType}
            onChange={(e) => setDto((d) => ({ ...d, attachmentType: e.target.value as AttachmentType }))}
            className="h-8 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)]"
          >
            {ATTACHMENT_TYPES.map((t) => (
              <option key={t} value={t}>{ATTACHMENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">Surface</label>
          <select
            value={dto.surface}
            onChange={(e) => setDto((d) => ({ ...d, surface: e.target.value as "buccal" | "lingual" | "occlusal" }))}
            className="h-8 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)]"
          >
            {SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">Activation stage</label>
          <input
            type="number" min={1}
            value={dto.activationStage ?? 1}
            onChange={(e) => setDto((d) => ({ ...d, activationStage: Number(e.target.value) }))}
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

export default function AttachmentPlanner({ caseId, planId }: Props) {
  const [attachments, setAttachments] = useState<TreatmentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommending, setRecommending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAttachments(await listAttachments(caseId, planId)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [caseId, planId]);

  async function handleAdd(dto: CreateAttachmentDto) {
    const att = await addAttachment(caseId, planId, dto);
    setAttachments((prev) => [...prev, att]);
  }

  async function handleDelete(id: string) {
    await deleteAttachment(caseId, planId, id);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleApprove(id: string) {
    const updated = await approveAttachment(caseId, planId, id);
    setAttachments((prev) => prev.map((a) => a.id === id ? updated : a));
  }

  async function handleRecommend() {
    setRecommending(true);
    try {
      const { recommended, attachments: newAtts } = await autoRecommendAttachments(caseId, planId);
      if (recommended > 0) setAttachments((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        return [...prev, ...newAtts.filter((a) => !existingIds.has(a.id))];
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRecommending(false);
    }
  }

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="shrink-0" />
        All attachments require clinician review before treatment delivery.
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">
          Attachments
          {attachments.length > 0 && (
            <span className="ml-1.5 rounded-full bg-[color:var(--primary-glow)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--primary)]">
              {attachments.length}
            </span>
          )}
        </p>
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

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-[color:var(--muted-foreground)]" /></div>
      ) : (
        <Card className="p-4">
          {attachments.length === 0 ? (
            <div className="py-4 text-center text-sm text-[color:var(--muted-foreground)]">
              No attachments planned.
              {" "}Use <strong>AI recommend</strong> or add manually.
            </div>
          ) : (
            <div>
              {attachments.map((att) => (
                <AttachmentRow
                  key={att.id}
                  att={att}
                  onDelete={() => handleDelete(att.id)}
                  onApprove={() => handleApprove(att.id)}
                />
              ))}
              <div className="mt-3 pt-3 border-t border-[color:var(--border)] text-xs text-[color:var(--muted-foreground)] flex gap-3">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-emerald-500" />
                  {attachments.filter((a) => a.isApproved).length} approved
                </span>
                <span className="flex items-center gap-1 text-blue-500">
                  <Sparkles size={11} />
                  {attachments.filter((a) => a.isAutoRecommended).length} AI
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      <AddForm onAdd={handleAdd} />
    </div>
  );
}
