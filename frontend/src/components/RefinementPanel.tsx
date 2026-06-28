"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/DesignSystem";
import {
  listRefinementCycles,
  createRefinementCycle,
  updateRefinementStatus,
  deleteRefinementCycle,
  type RefinementCycle,
  type CreateRefinementDto,
} from "@/lib/api/refinement";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<RefinementCycle["status"], string> = {
  pending: "Pending",
  planning: "Planning",
  stages_generated: "Stages Generated",
  approved: "Approved",
};

const STATUS_TONE: Record<RefinementCycle["status"], "neutral" | "info" | "success" | "warning"> = {
  pending: "neutral",
  planning: "info",
  stages_generated: "warning",
  approved: "success",
};

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Cycle Card ───────────────────────────────────────────────────────────────

function CycleCard({
  cycle,
  onDelete,
  onAdvance,
}: {
  cycle: RefinementCycle;
  onDelete: () => void;
  onAdvance: (status: RefinementCycle["status"]) => void;
}) {
  const [open, setOpen] = useState(cycle.cycleNumber === 1);
  const nextStatus: Record<RefinementCycle["status"], RefinementCycle["status"] | null> = {
    pending: "planning",
    planning: "stages_generated",
    stages_generated: "approved",
    approved: null,
  };
  const next = nextStatus[cycle.status];

  return (
    <div className="rounded-xl border border-[color:var(--border)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            Refinement Cycle {cycle.cycleNumber}
          </p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            Restart from stage {cycle.restartFromStage} · {formatDate(cycle.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={STATUS_TONE[cycle.status]}>{STATUS_LABELS[cycle.status]}</StatusBadge>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-[color:var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-600 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[color:var(--border)] px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-[color:var(--muted-foreground)]">Status</span>
            <span className="font-medium text-[color:var(--foreground)]">{STATUS_LABELS[cycle.status]}</span>
            <span className="text-[color:var(--muted-foreground)]">Restart stage</span>
            <span className="font-medium text-[color:var(--foreground)]">{cycle.restartFromStage}</span>
            {cycle.newStagesGenerated > 0 && (
              <>
                <span className="text-[color:var(--muted-foreground)]">New stages</span>
                <span className="font-medium text-[color:var(--foreground)]">{cycle.newStagesGenerated}</span>
              </>
            )}
            {cycle.notes && (
              <>
                <span className="text-[color:var(--muted-foreground)]">Notes</span>
                <span className="font-medium text-[color:var(--foreground)]">{cycle.notes}</span>
              </>
            )}
          </div>
          {next && (
            <button
              type="button"
              onClick={() => onAdvance(next)}
              className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={12} />
              Advance to: {STATUS_LABELS[next]}
            </button>
          )}
          {cycle.status === "approved" && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={12} />
              Cycle approved
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create Form ─────────────────────────────────────────────────────────────

function CreateForm({ onSubmit }: { onSubmit: (dto: CreateRefinementDto) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dto, setDto] = useState<CreateRefinementDto>({ restartFromStage: 1 });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSubmit(dto); setOpen(false); }
    finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm font-medium text-[color:var(--primary)] hover:border-[color:var(--primary)]/40 transition-colors w-full justify-center"
      >
        <RefreshCw size={14} /> Start Refinement Cycle
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
      <p className="text-sm font-semibold text-[color:var(--foreground)]">New Refinement Cycle</p>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">
          Restart from stage #
        </label>
        <input
          type="number" min={1}
          value={dto.restartFromStage}
          onChange={(e) => setDto((d) => ({ ...d, restartFromStage: Number(e.target.value) }))}
          className="h-8 w-28 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)]"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">
          Notes (optional)
        </label>
        <input
          type="text"
          value={dto.notes ?? ""}
          onChange={(e) => setDto((d) => ({ ...d, notes: e.target.value || null }))}
          placeholder="e.g. Lower arch insufficient response"
          className="h-8 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:border-[color:var(--primary)]"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Create cycle
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

export default function RefinementPanel({ caseId, planId }: Props) {
  const [cycles, setCycles] = useState<RefinementCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setCycles(await listRefinementCycles(caseId, planId)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleCreate(dto: CreateRefinementDto) {
    const cycle = await createRefinementCycle(caseId, planId, dto);
    setCycles((prev) => [cycle, ...prev]);
  }

  async function handleDelete(id: string) {
    await deleteRefinementCycle(caseId, planId, id);
    setCycles((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleAdvance(id: string, status: RefinementCycle["status"]) {
    const updated = await updateRefinementStatus(caseId, planId, id, status);
    setCycles((prev) => prev.map((c) => c.id === id ? updated : c));
  }

  useEffect(() => { void load(); }, [caseId, planId]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Refinement cycles require a new mid-treatment scan and clinician re-planning approval before proceeding.
      </div>

      {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin text-[color:var(--muted-foreground)]" />
        </div>
      ) : cycles.length === 0 ? (
        <Card className="p-6 text-center">
          <Clock size={24} className="mx-auto mb-2 text-[color:var(--muted-foreground)]" />
          <p className="text-sm font-semibold text-[color:var(--foreground)]">No refinement cycles</p>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
            Start a cycle if the patient needs a mid-treatment correction with a new scan.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {cycles.map((c) => (
            <CycleCard
              key={c.id}
              cycle={c}
              onDelete={() => handleDelete(c.id)}
              onAdvance={(status) => handleAdvance(c.id, status)}
            />
          ))}
        </div>
      )}

      <CreateForm onSubmit={handleCreate} />
    </div>
  );
}
