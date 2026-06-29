"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  Settings2,
  Sparkles,
  Zap,
} from "lucide-react";
import { Card, ProgressBar, StatusBadge } from "@/components/DesignSystem";
import {
  generateAlignerPlan,
  getAlignerGenerationPlan,
  approveAlignerPlan,
  type AlignerGenerationPlan,
  type StageAllocationSummary,
  type StagingStrategy,
  type IprScheduleEntry,
  type ElasticScheduleEntry,
} from "@/lib/api/aligner-generation";

// ─── Status tones ─────────────────────────────────────────────────────────────

const STATUS_TONE = {
  draft:         "neutral",
  approved:      "success",
  manufacturing: "info",
  complete:      "success",
} as const;

const STRATEGY_LABELS: Record<StagingStrategy, string> = {
  balanced:          "Balanced (all teeth simultaneous)",
  anterior_first:    "Anterior First (front teeth lead)",
  posterior_first:   "Posterior First (back teeth lead)",
  arch_coordinated:  "Arch Coordinated (upper/lower sync)",
};

// ─── Stage timeline strip ─────────────────────────────────────────────────────

function StageTimeline({
  allocations,
  totalActive,
  passive,
  retention,
}: {
  allocations: StageAllocationSummary[];
  totalActive: number;
  passive: number;
  retention: number;
}) {
  const [hovered, setHovered] = useState<StageAllocationSummary | null>(null);
  const total = allocations.length;

  if (total === 0) return null;

  function stageColor(s: StageAllocationSummary): string {
    if (s.isRetention) return "bg-purple-400/60";
    if (s.isPassive)   return "bg-gray-400/60";
    if (s.maxTranslationMm > 0.2) return "bg-red-400/60";
    if (s.maxTranslationMm > 0.1) return "bg-amber-400/60";
    return "bg-emerald-400/60";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
        <span>Stage 1</span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400/60 inline-block"/>Active</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-400/60 inline-block"/>Passive</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-purple-400/60 inline-block"/>Retention</span>
        </span>
        <span>Stage {total}</span>
      </div>
      <div className="flex h-7 gap-px overflow-hidden rounded-lg">
        {allocations.map(s => (
          <div
            key={s.stageNum}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(null)}
            className={`relative flex-1 cursor-default transition-opacity hover:opacity-80 ${stageColor(s)} ${
              s.hasAttachment ? "ring-1 ring-inset ring-blue-400/60" : ""
            } ${s.hasIpr ? "ring-1 ring-inset ring-orange-400/60" : ""}`}
            title={`Stage ${s.stageNum}${s.hasAttachment ? " · Attachment" : ""}${s.hasIpr ? " · IPR" : ""}`}
          />
        ))}
      </div>
      {hovered && (
        <div className="rounded-lg bg-[color:var(--muted)]/30 px-3 py-2 text-xs space-y-0.5">
          <p className="font-semibold text-[color:var(--foreground)]">
            Stage {hovered.stageNum}
            {hovered.isPassive ? " — Passive" : hovered.isRetention ? " — Retention" : ""}
          </p>
          {!hovered.isPassive && !hovered.isRetention && (
            <>
              <p className="text-[color:var(--muted-foreground)]">Teeth moved: <strong>{hovered.teethMoved}</strong></p>
              <p className="text-[color:var(--muted-foreground)]">Max translation: <strong>{hovered.maxTranslationMm.toFixed(3)} mm</strong></p>
              <p className="text-[color:var(--muted-foreground)]">Max rotation: <strong>{hovered.maxRotationDeg.toFixed(2)}°</strong></p>
            </>
          )}
          {hovered.hasAttachment && <p className="text-blue-500 font-medium">Attachment required</p>}
          {hovered.hasIpr && <p className="text-orange-500 font-medium">IPR required at this stage</p>}
        </div>
      )}
    </div>
  );
}

// ─── IPR schedule ─────────────────────────────────────────────────────────────

function IprSchedule({ entries }: { entries: IprScheduleEntry[] }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return (
    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
      <CheckCircle2 size={11} />No IPR scheduled
    </p>
  );
  return (
    <div className="rounded-xl border border-[color:var(--border)]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]"
      >
        <Package size={11} className="text-orange-500" />
        IPR Schedule ({entries.length} pair{entries.length !== 1 ? "s" : ""})
        {open ? <ChevronDown size={11} className="ml-auto" /> : <ChevronRight size={11} className="ml-auto" />}
      </button>
      {open && (
        <div className="border-t border-[color:var(--border)] px-3 py-2 space-y-1.5">
          {entries.map((e, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-[color:var(--muted-foreground)]">
                Stage <strong className="text-[color:var(--foreground)]">{e.stageNum}</strong>
                {" "}— FDI {e.fdiA}↔{e.fdiB}
              </span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">{e.amountMm.toFixed(2)} mm</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Elastic schedule ─────────────────────────────────────────────────────────

function ElasticSchedule({ entries }: { entries: ElasticScheduleEntry[] }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return (
    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
      <CheckCircle2 size={11} />No elastics required
    </p>
  );
  const byClass = new Map<string, number[]>();
  for (const e of entries) {
    if (!byClass.has(e.classification)) byClass.set(e.classification, []);
    byClass.get(e.classification)!.push(e.stageNum);
  }
  return (
    <div className="rounded-xl border border-[color:var(--border)]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]"
      >
        <Layers size={11} className="text-blue-500" />
        Elastic Schedule ({entries.length} stage{entries.length !== 1 ? "s" : ""})
        {open ? <ChevronDown size={11} className="ml-auto" /> : <ChevronRight size={11} className="ml-auto" />}
      </button>
      {open && (
        <div className="border-t border-[color:var(--border)] px-3 py-2 space-y-1.5 text-xs">
          {Array.from(byClass.entries()).map(([cls, stages]) => (
            <div key={cls}>
              <p className="font-semibold text-[color:var(--foreground)] capitalize mb-0.5">
                {cls.replace("_", " ")} elastic
              </p>
              <p className="text-[color:var(--muted-foreground)]">
                Stages: {stages.join(", ")}
              </p>
              <p className="text-[color:var(--muted-foreground)] mt-0.5">
                {entries.find(e => e.classification === cls)?.notes}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Generate form ────────────────────────────────────────────────────────────

function GenerateForm({
  caseId,
  planId,
  onGenerated,
}: {
  caseId: string;
  planId: string;
  onGenerated: (plan: AlignerGenerationPlan) => void;
}) {
  const [strategy, setStrategy] = useState<StagingStrategy>("balanced");
  const [changeWeeks, setChangeWeeks] = useState(2);
  const [passive, setPassive] = useState(2);
  const [retention, setRetention] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const plan = await generateAlignerPlan(caseId, planId, {
        stagingStrategy: strategy,
        alignerChangeWeeks: changeWeeks,
        passiveAlignerCount: passive,
        retentionStageCount: retention,
      });
      onGenerated(plan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1.5">
          Staging Strategy
        </label>
        <select
          value={strategy}
          onChange={e => setStrategy(e.target.value as StagingStrategy)}
          className="h-9 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)]"
        >
          {(Object.entries(STRATEGY_LABELS) as [StagingStrategy, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">Change (wks)</label>
          <input type="number" value={changeWeeks} min={1} max={4} onChange={e => setChangeWeeks(parseInt(e.target.value))}
            className="h-9 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">Passive</label>
          <input type="number" value={passive} min={0} max={6} onChange={e => setPassive(parseInt(e.target.value))}
            className="h-9 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">Retention</label>
          <input type="number" value={retention} min={0} max={10} onChange={e => setRetention(parseInt(e.target.value))}
            className="h-9 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none" />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={generating}
        className="flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {generating ? "Generating…" : "Generate Aligner Plan"}
      </button>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

export default function AlignerGenerationPanel({ caseId, planId }: Props) {
  const [plan, setPlan] = useState<AlignerGenerationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [approveNote, setApproveNote] = useState("");

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      setPlan(await getAlignerGenerationPlan(caseId, planId));
    } catch { /* no plan yet */ }
    setLoading(false);
  }, [caseId, planId]);

  useEffect(() => { void loadPlan(); }, [loadPlan]);

  async function handleApprove() {
    setApproving(true);
    try {
      const updated = await approveAlignerPlan(caseId, planId, approveNote || undefined);
      setPlan(updated);
    } catch { /* swallow */ }
    setApproving(false);
  }

  const totalAlligners = plan
    ? plan.totalActiveStages + plan.passiveAlignerCount + plan.retentionStageCount
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Aligner plan must be reviewed and approved by the treating clinician before manufacturing.
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={18} className="animate-spin text-[color:var(--muted-foreground)]" />
        </div>
      ) : !plan ? (
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 size={14} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Generate Aligner Plan</h3>
          </div>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            Distributes movement prescriptions across stages using per-type Kravitz limits. Schedules IPR, elastic, and attachment timing automatically.
          </p>
          <GenerateForm caseId={caseId} planId={planId} onGenerated={p => { setPlan(p); }} />
        </Card>
      ) : (
        <>
          {/* Header */}
          <Card className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Aligner Generation Plan</h3>
                  <StatusBadge tone={STATUS_TONE[plan.status]}>{plan.status}</StatusBadge>
                </div>
                <p className="mt-0.5 text-[10px] text-[color:var(--muted-foreground)]">
                  Generated {new Date(plan.generatedAt).toLocaleString()}
                  {" · "}{STRATEGY_LABELS[plan.stagingStrategy]}
                </p>
              </div>
              <button
                type="button"
                onClick={loadPlan}
                className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Active stages",  value: plan.totalActiveStages },
                { label: "Total aligners", value: totalAlligners },
                { label: "Est. weeks",     value: plan.estimatedTotalWeeks ?? "—" },
                { label: "Change cycle",   value: `${plan.alignerChangeWeeks}w` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-[color:var(--muted)]/30 px-2.5 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums text-[color:var(--foreground)]">{value}</p>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">{label}</p>
                </div>
              ))}
            </div>

            {/* Attachment window */}
            {plan.attachmentStartStage && plan.attachmentEndStage && (
              <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                <Calendar size={11} />
                Attachment window: <strong className="text-[color:var(--foreground)]">
                  Stage {plan.attachmentStartStage} → {plan.attachmentEndStage}
                </strong>
              </div>
            )}

            {/* Timeline */}
            {plan.stageAllocations.length > 0 && (
              <StageTimeline
                allocations={plan.stageAllocations}
                totalActive={plan.totalActiveStages}
                passive={plan.passiveAlignerCount}
                retention={plan.retentionStageCount}
              />
            )}
          </Card>

          {/* Schedules */}
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Clinical Schedules</h3>
            <IprSchedule entries={plan.iprStageSchedule} />
            <ElasticSchedule entries={plan.elasticStageSchedule} />
          </Card>

          {/* Approve / Re-generate */}
          <Card className="p-4 space-y-3">
            {plan.status === "draft" ? (
              <>
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Clinician Approval</h3>
                <textarea
                  value={approveNote}
                  onChange={e => setApproveNote(e.target.value)}
                  placeholder="Optional clinical notes…"
                  rows={2}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1.5 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)] resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={approving}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {approving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    {approving ? "Approving…" : "Approve Aligner Plan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlan(null)}
                    className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] px-4 py-2.5 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
                  >
                    <RefreshCw size={13} />
                    Re-generate
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} />
                <span>
                  Approved {plan.approvedAt ? new Date(plan.approvedAt).toLocaleDateString() : ""}
                  {plan.notes && <span className="ml-1 text-[color:var(--muted-foreground)]">· {plan.notes}</span>}
                </span>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
