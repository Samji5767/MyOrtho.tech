"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Loader2,
  Plus,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";
import {
  listPlans,
  createPlan,
  approvePlan,
  listStages,
  generateStages,
  type TreatmentPlanSummary,
  type AlignStage,
} from "@/lib/api/treatmentPlans";
import { ApiError } from "@/lib/api/client";

// ─── Stage movement detail ────────────────────────────────────────────────────

function MovementTable({ movements }: { movements: Record<string, Record<string, number>> }) {
  const teeth = Object.keys(movements).map(Number).sort((a, b) => a - b);
  if (teeth.length === 0) return null;

  // Show only teeth with non-trivial movement (any component > 0.05 mm or > 0.5 deg)
  const significant = teeth.filter((fdi) => {
    const m = movements[String(fdi)];
    return Object.values(m).some((v) => Math.abs(v) > 0.05);
  });

  if (significant.length === 0) {
    return <p className="text-xs text-[color:var(--muted-foreground)]">No significant movements at this stage</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] tabular-nums">
        <thead>
          <tr className="border-b border-[color:var(--border)] text-[color:var(--muted-foreground)]">
            <th className="py-1 text-left font-semibold w-10">FDI</th>
            <th className="py-1 text-right font-semibold">M (mm)</th>
            <th className="py-1 text-right font-semibold">D (mm)</th>
            <th className="py-1 text-right font-semibold">B (mm)</th>
            <th className="py-1 text-right font-semibold">L (mm)</th>
            <th className="py-1 text-right font-semibold">Torq (°)</th>
          </tr>
        </thead>
        <tbody>
          {significant.map((fdi) => {
            const m = movements[String(fdi)] ?? {};
            const val = (k: string) => {
              const v = m[k] ?? 0;
              return v === 0 ? "—" : (v > 0 ? "+" : "") + v.toFixed(2);
            };
            return (
              <tr key={fdi} className="border-b border-[color:var(--border)]/40 last:border-0">
                <td className="py-0.5 font-mono font-semibold text-[color:var(--foreground)]">{fdi}</td>
                <td className={`py-0.5 text-right ${(m.mesialMm ?? 0) !== 0 ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>{val("mesialMm")}</td>
                <td className={`py-0.5 text-right ${(m.distalMm ?? 0) !== 0 ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>{val("distalMm")}</td>
                <td className={`py-0.5 text-right ${(m.buccalMm ?? 0) !== 0 ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>{val("buccalMm")}</td>
                <td className={`py-0.5 text-right ${(m.lingualMm ?? 0) !== 0 ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>{val("lingualMm")}</td>
                <td className={`py-0.5 text-right ${(m.torqueDeg ?? 0) !== 0 ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>{val("torqueDeg")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1.5 text-[9px] text-[color:var(--muted-foreground)]">
        M=Mesial · D=Distal · B=Buccal · L=Lingual · Cumulative position at this stage
      </p>
    </div>
  );
}

// ─── Stage chip strip ─────────────────────────────────────────────────────────

function StageStrip({
  stages,
  activeStage,
  onSelect,
}: {
  stages: AlignStage[];
  activeStage: number | null;
  onSelect: (n: number) => void;
}) {
  if (stages.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 py-2">
      {stages.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.stageNumber)}
          className={[
            "h-6 min-w-[1.75rem] rounded-md border px-1.5 text-[10px] font-semibold transition-colors",
            activeStage === s.stageNumber
              ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
              : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/50",
          ].join(" ")}
        >
          {s.stageNumber}
        </button>
      ))}
    </div>
  );
}

// ─── Plan row ────────────────────────────────────────────────────────────────

function PlanRow({
  plan,
  caseId,
  onApproved,
}: {
  plan: TreatmentPlanSummary;
  caseId: string;
  onApproved: (p: TreatmentPlanSummary) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stages, setStages] = useState<AlignStage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  async function loadStages() {
    setStagesLoading(true);
    try {
      const loaded = await listStages(caseId, plan.id);
      setStages(loaded);
      if (loaded.length > 0 && activeStage === null) {
        setActiveStage(loaded[0].stageNumber);
      }
    } catch { /* swallow */ }
    setStagesLoading(false);
  }

  async function handleExpand() {
    if (!expanded && stages.length === 0) {
      await loadStages();
    }
    setExpanded((v) => !v);
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      await generateStages(caseId, plan.id, plan.estimatedStages);
      await loadStages();
    } catch (e) {
      setGenerateError(e instanceof ApiError ? e.message : "Stage generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    const sig = window.prompt("Enter doctor name / signature to approve this treatment plan:");
    if (!sig?.trim()) return;
    setApproving(true);
    setApproveError(null);
    try {
      onApproved(await approvePlan(caseId, plan.id, sig.trim()));
    } catch (e) {
      setApproveError(e instanceof ApiError ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }

  const activeStageData = stages.find((s) => s.stageNumber === activeStage);

  return (
    <div className="border-b border-[color:var(--border)] last:border-0">
      <div className="px-4 py-3">
        {/* Plan header */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                {plan.id.slice(0, 8)}…
              </span>
              {plan.doctorApproval ? (
                <StatusBadge tone="success">
                  <CheckCircle2 size={10} className="mr-1 inline" />Approved
                </StatusBadge>
              ) : (
                <StatusBadge tone="warning">Pending approval</StatusBadge>
              )}
              <StatusBadge tone="neutral">{plan.estimatedStages} stages</StatusBadge>
            </div>
            <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
              Created {new Date(plan.createdAt).toLocaleDateString()}
              {plan.approvedAt && ` · Approved ${new Date(plan.approvedAt).toLocaleDateString()}`}
            </p>
            {plan.aiRecommendationNotes && (
              <p className="mt-0.5 text-xs italic text-[color:var(--muted-foreground)]">
                {plan.aiRecommendationNotes}
              </p>
            )}
            {(approveError || generateError) && (
              <p className="mt-1 text-xs text-red-500">{approveError ?? generateError}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {!plan.doctorApproval && (
              <Button variant="primary" size="sm" onClick={handleApprove} disabled={approving}>
                {approving ? <Loader2 size={12} className="animate-spin" /> : <ClipboardCheck size={12} />}
                Approve
              </Button>
            )}
            <button
              type="button"
              onClick={handleExpand}
              className="rounded-lg border border-[color:var(--border)] p-1.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* Stage detail */}
        {expanded && (
          <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]">
            {stagesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={16} className="animate-spin text-[color:var(--muted-foreground)]" />
              </div>
            ) : stages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  No stages yet · Generate {plan.estimatedStages} stages from this plan
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating
                    ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
                    : <><Sparkles size={13} /> Generate {plan.estimatedStages} stages</>
                  }
                </Button>
                {generateError && (
                  <p className="text-xs text-red-500">{generateError}</p>
                )}
              </div>
            ) : (
              <div className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[color:var(--foreground)]">
                    {stages.length} aligner stages
                  </span>
                  <span className="text-xs text-[color:var(--muted-foreground)]">
                    Select a stage to see movements
                  </span>
                </div>

                <StageStrip stages={stages} activeStage={activeStage} onSelect={setActiveStage} />

                {activeStageData && (
                  <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-3">
                    <p className="mb-2 text-xs font-semibold text-[color:var(--foreground)]">
                      Stage {activeStageData.stageNumber} — cumulative tooth positions
                    </p>
                    <MovementTable
                      movements={activeStageData.movements as Record<string, Record<string, number>>}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create form ─────────────────────────────────────────────────────────────

function CreatePlanForm({
  caseId,
  onCreated,
}: {
  caseId: string;
  onCreated: (p: TreatmentPlanSummary) => void;
}) {
  const [stages, setStages] = useState("24");
  const [notes, setNotes] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(stages, 10);
    if (isNaN(n) || n < 1 || n > 60) {
      setError("Stage count must be between 1 and 60");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const plan = await createPlan(caseId, {
        estimatedStages: n,
        ...(notes.trim() ? { aiRecommendationNotes: notes.trim() } : {}),
      });
      if (autoGenerate) {
        await generateStages(caseId, plan.id, n);
      }
      onCreated({ ...plan, estimatedStages: n });
      setStages("24");
      setNotes("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create plan");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-b border-[color:var(--border)] px-4 py-4">
      <div className="flex gap-3">
        <div className="w-36 shrink-0">
          <label className="mb-1 block text-xs font-medium text-[color:var(--muted-foreground)]">
            Estimated stages
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={stages}
            onChange={(e) => setStages(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[color:var(--muted-foreground)]">
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Manual review required…"
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoGenerate}
          onChange={(e) => setAutoGenerate(e.target.checked)}
          className="rounded border-[color:var(--border)] accent-[color:var(--primary)]"
        />
        <span className="text-xs text-[color:var(--muted-foreground)]">
          Auto-generate movement stages after creating
        </span>
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button variant="primary" size="sm" type="submit" disabled={creating}>
        {creating
          ? <><Loader2 size={13} className="animate-spin" /> {autoGenerate ? "Creating + generating…" : "Creating…"}</>
          : <><Plus size={13} /> Create Plan</>
        }
      </Button>
    </form>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function TreatmentPlansPanel({ caseId }: { caseId: string }) {
  const [plans, setPlans] = useState<TreatmentPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoadError(null);
    try {
      setPlans(await listPlans(caseId));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Failed to load treatment plans");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  function handleCreated(plan: TreatmentPlanSummary) {
    setPlans((prev) => [plan, ...prev]);
    setShowCreate(false);
  }

  function handleApproved(updated: TreatmentPlanSummary) {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }

  return (
    <div className="space-y-4">
      {/* AI disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Treatment plans and stage movements are generated by a rule-based model.{" "}
        <strong>Clinical decision support only.</strong> All stage movements and
        recommendations require review and written approval by a licensed orthodontist
        before any clinical action.
      </div>

      {/* Plans list */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={15} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
              Treatment Plans
              {!loading && (
                <span className="ml-1.5 font-normal text-[color:var(--muted-foreground)]">
                  ({plans.length})
                </span>
              )}
            </h3>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus size={12} /> New
          </Button>
        </div>

        {showCreate && (
          <CreatePlanForm caseId={caseId} onCreated={handleCreated} />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-[color:var(--muted-foreground)]" />
          </div>
        ) : loadError ? (
          <div className="px-4 py-8 text-center">
            <XCircle size={20} className="mx-auto mb-2 text-red-400" />
            <p className="text-sm text-[color:var(--muted-foreground)]">{loadError}</p>
          </div>
        ) : plans.length === 0 && !showCreate ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm text-[color:var(--muted-foreground)]">No treatment plans yet</p>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> Create first plan
            </Button>
          </div>
        ) : (
          plans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              caseId={caseId}
              onApproved={handleApproved}
            />
          ))
        )}
      </Card>
    </div>
  );
}
