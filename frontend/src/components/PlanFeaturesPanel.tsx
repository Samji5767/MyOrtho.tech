"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, Scissors, Shapes, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/DesignSystem";
import { ApiError } from "@/lib/api/client";
import {
  ATTACHMENT_TYPES,
  deleteAttachment,
  deleteIpr,
  listAttachments,
  listIpr,
  upsertAttachment,
  upsertIpr,
  type AttachmentItem,
  type AttachmentType,
  type IprItem,
} from "@/lib/api/planFeatures";

const FDI_ALL = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
  38, 37, 36, 35, 34, 33, 32, 31, 41, 42, 43, 44, 45, 46, 47, 48,
];

/** Adjacent same-arch contacts, matching the backend rule. */
function adjacentTo(a: number): number[] {
  const q = Math.floor(a / 10), p = a % 10;
  const out: number[] = [];
  if (p > 1) out.push(q * 10 + (p - 1));
  if (p < 8) out.push(q * 10 + (p + 1));
  if (p === 1) {
    const mirror = (q === 1 ? 2 : q === 2 ? 1 : q === 3 ? 4 : 3) * 10 + 1;
    out.push(mirror);
  }
  return out;
}

function safetyTone(s: string): "success" | "warning" | "danger" {
  return s === "safe" ? "success" : s === "warning" ? "warning" : "danger";
}

const inputCls =
  "rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-xs tabular-nums text-[color:var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)] disabled:opacity-50";

export default function PlanFeaturesPanel({ caseId, planId, locked }: {
  caseId: string;
  planId: string;
  /** True when the plan is approved — planning data is read-only. */
  locked: boolean;
}) {
  const [ipr, setIpr] = useState<IprItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // IPR form
  const [iprA, setIprA] = useState(11);
  const [iprB, setIprB] = useState(21);
  const [iprAmount, setIprAmount] = useState("0.2");
  // Attachment form
  const [attFdi, setAttFdi] = useState(13);
  const [attType, setAttType] = useState<AttachmentType>("optimized");
  const [attSurface, setAttSurface] = useState<"buccal" | "lingual" | "occlusal">("buccal");
  const [attStage, setAttStage] = useState("1");

  const load = useCallback(() => {
    Promise.all([listIpr(caseId, planId), listAttachments(caseId, planId)])
      .then(([i, a]) => { setIpr(i); setAttachments(a); setError(null); })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load planning data"));
  }, [caseId, planId]);

  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const iprBOptions = adjacentTo(iprA);

  return (
    <div className="space-y-4">
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-500">
          <AlertTriangle size={12} className="shrink-0" /> {error}
        </p>
      )}

      {/* ── IPR ─────────────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[color:var(--foreground)]">
          <Scissors size={12} /> Interproximal reduction
        </p>
        {ipr.length === 0 ? (
          <p className="text-xs text-[color:var(--muted-foreground)]">No IPR planned</p>
        ) : (
          <div className="space-y-1">
            {ipr.map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs">
                <span className="font-mono font-semibold text-[color:var(--foreground)]">
                  {i.toothAFdi}–{i.toothBFdi}
                </span>
                <span className="tabular-nums text-[color:var(--foreground)]">{i.amountMm.toFixed(2)} mm</span>
                <span className="text-[color:var(--muted-foreground)]">before stage {i.beforeStage}</span>
                <StatusBadge tone={safetyTone(i.safetyStatus)}>{i.safetyStatus}</StatusBadge>
                {!locked && (
                  <button
                    type="button"
                    aria-label={`Remove IPR ${i.toothAFdi}-${i.toothBFdi}`}
                    disabled={busy}
                    onClick={() => run(() => deleteIpr(caseId, planId, i.toothAFdi, i.toothBFdi))}
                    className="ml-auto text-[color:var(--muted-foreground)] hover:text-rose-500 disabled:opacity-40"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {!locked && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <select value={iprA} className={inputCls} disabled={busy}
              onChange={(e) => {
                const a = Number(e.target.value);
                setIprA(a);
                if (!adjacentTo(a).includes(iprB)) setIprB(adjacentTo(a)[0]);
              }}>
              {FDI_ALL.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <span className="text-[color:var(--muted-foreground)]">–</span>
            <select value={iprB} className={inputCls} disabled={busy}
              onChange={(e) => setIprB(Number(e.target.value))}>
              {iprBOptions.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="number" step={0.05} min={0.05} max={2} value={iprAmount}
              className={`${inputCls} w-16`} disabled={busy} aria-label="IPR amount (mm)"
              onChange={(e) => setIprAmount(e.target.value)} />
            <span className="text-[color:var(--muted-foreground)]">mm</span>
            <button type="button" disabled={busy || !Number.isFinite(Number(iprAmount))}
              onClick={() => run(() => upsertIpr(caseId, planId, {
                toothAFdi: iprA, toothBFdi: iprB, amountMm: Number(iprAmount),
              }))}
              className="inline-flex items-center gap-1 rounded-md bg-[color:var(--primary)] px-2.5 py-1 text-xs font-medium text-[color:var(--primary-foreground)] disabled:opacity-40">
              <Plus size={11} /> Add IPR
            </button>
            <span className="basis-full text-[10px] text-[color:var(--muted-foreground)]">
              ≤0.25 mm safe · ≤0.5 mm review · above flagged unsafe (guidance, not clinical validation)
            </span>
          </div>
        )}
      </div>

      {/* ── Attachments ─────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[color:var(--foreground)]">
          <Shapes size={12} /> Attachments
        </p>
        {attachments.length === 0 ? (
          <p className="text-xs text-[color:var(--muted-foreground)]">No attachments planned</p>
        ) : (
          <div className="space-y-1">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs">
                <span className="font-mono font-semibold text-[color:var(--foreground)]">{a.fdiNumber}</span>
                <span className="text-[color:var(--foreground)]">{a.attachmentType.replace(/_/g, " ")}</span>
                <span className="text-[color:var(--muted-foreground)]">
                  {a.surface} · {a.widthMm}×{a.heightMm}×{a.depthMm} mm · stage {a.activationStage}
                  {a.deactivationStage ? `–${a.deactivationStage}` : "+"}
                </span>
                {!locked && (
                  <button
                    type="button"
                    aria-label={`Remove ${a.attachmentType} on ${a.fdiNumber}`}
                    disabled={busy}
                    onClick={() => run(() => deleteAttachment(caseId, planId, a.fdiNumber, a.attachmentType))}
                    className="ml-auto text-[color:var(--muted-foreground)] hover:text-rose-500 disabled:opacity-40"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {!locked && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <select value={attFdi} className={inputCls} disabled={busy}
              onChange={(e) => setAttFdi(Number(e.target.value))}>
              {FDI_ALL.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={attType} className={inputCls} disabled={busy}
              onChange={(e) => setAttType(e.target.value as AttachmentType)}>
              {ATTACHMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <select value={attSurface} className={inputCls} disabled={busy}
              onChange={(e) => setAttSurface(e.target.value as typeof attSurface)}>
              <option value="buccal">buccal</option>
              <option value="lingual">lingual</option>
              <option value="occlusal">occlusal</option>
            </select>
            <input type="number" min={1} max={120} value={attStage}
              className={`${inputCls} w-14`} disabled={busy} aria-label="Activation stage"
              onChange={(e) => setAttStage(e.target.value)} />
            <button type="button" disabled={busy}
              onClick={() => run(() => upsertAttachment(caseId, planId, {
                fdiNumber: attFdi, attachmentType: attType, surface: attSurface,
                activationStage: Math.max(1, Number(attStage) || 1),
              }))}
              className="inline-flex items-center gap-1 rounded-md bg-[color:var(--primary)] px-2.5 py-1 text-xs font-medium text-[color:var(--primary-foreground)] disabled:opacity-40">
              <Plus size={11} /> Add attachment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
