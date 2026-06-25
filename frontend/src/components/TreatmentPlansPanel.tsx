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
  XCircle,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";
import {
  listPlans,
  createPlan,
  approvePlan,
  listStages,
  type TreatmentPlanSummary,
  type AlignStage,
} from "@/lib/api/treatmentPlans";
import { ApiError } from "@/lib/api/client";

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
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  async function handleExpand() {
    if (!expanded && stages.length === 0) {
      setStagesLoading(true);
      try {
        setStages(await listStages(caseId, plan.id));
      } catch { /* swallow */ }
      setStagesLoading(false);
    }
    setExpanded((v) => !v);
  }

  async function handleApprove() {
    const sig = window.prompt(
      "Enter doctor name / signature to approve this treatment plan:",
    );
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

  return (
    <div className="border-b border-[color:var(--border)] last:border-0">
      <div className="px-4 py-3">
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
            </div>
            <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
              {plan.estimatedStages} stages · {new Date(plan.createdAt).toLocaleDateString()}
            </p>
            {plan.aiRecommendationNotes && (
              <p className="mt-0.5 text-xs italic text-[color:var(--muted-foreground)]">
                AI note: {plan.aiRecommendationNotes}
              </p>
            )}
            {approveError && (
              <p className="mt-1 text-xs text-red-500">{approveError}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {!plan.doctorApproval && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleApprove}
                disabled={approving}
              >
                {approving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ClipboardCheck size={12} />
                )}
                Approve
              </Button>
            )}
            <button
              type="button"
              onClick={handleExpand}
              className="rounded-lg border border-[color:var(--border)] p-1.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              aria-label={expanded ? "Collapse stages" : "Expand stages"}
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
            {stagesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="animate-spin text-[color:var(--muted-foreground)]" />
              </div>
            ) : stages.length === 0 ? (
              <p className="py-2 text-center text-xs text-[color:var(--muted-foreground)]">
                No stages defined yet
              </p>
            ) : (
              <div className="space-y-1.5">
                {stages.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 text-xs">
                    <span className="w-14 shrink-0 font-mono text-[color:var(--muted-foreground)]">
                      Stage {s.stageNumber}
                    </span>
                    <span className="text-[color:var(--foreground)]">
                      {Object.keys(s.movements).length} tooth movement
                      {Object.keys(s.movements).length !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(stages, 10);
    if (isNaN(n) || n < 1 || n > 100) {
      setError("Stage count must be between 1 and 100");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const plan = await createPlan(caseId, {
        estimatedStages: n,
        ...(notes.trim() ? { aiRecommendationNotes: notes.trim() } : {}),
      });
      onCreated(plan);
      setStages("24");
      setNotes("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create plan");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-b border-[color:var(--border)] px-4 py-3">
      <div className="flex gap-3">
        <div className="w-36 shrink-0">
          <label className="mb-1 block text-xs font-medium text-[color:var(--muted-foreground)]">
            Estimated stages
          </label>
          <input
            type="number"
            min={1}
            max={100}
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
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button variant="primary" size="sm" type="submit" disabled={creating}>
        {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Create Plan
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
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div className="space-y-4">
      {/* AI disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Treatment plans are generated by a research-stage AI model.{" "}
        <strong>Not clinically validated.</strong> All stage movements and recommendations require
        review and written approval by a licensed orthodontist before any clinical action.
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
          <div className="px-4 py-10 text-center text-sm text-[color:var(--muted-foreground)]">
            No treatment plans yet
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
