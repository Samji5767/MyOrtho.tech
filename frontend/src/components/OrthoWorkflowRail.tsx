"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/components/ToastContext";
import {
  useCasePlanning,
  type WorkflowStepStatus,
} from "@/components/CasePlanningContext";

// ─── Re-export so consumers can still import from here ────────────────────────

export type { WorkflowStepStatus };

interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  action: string;
}

// ─── 12-step Pronto-inspired workflow ─────────────────────────────────────────

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: "import",      label: "Import Scan",         description: "Upload STL, OBJ, or PLY for upper and lower arches.",     action: "Upload scan" },
  { id: "orient",      label: "Orient Model",         description: "Align arch to standard occlusal orientation.",             action: "Check orientation" },
  { id: "define_jaws", label: "Define Jaws",          description: "Confirm maxillary and mandibular arch assignments.",        action: "Assign arches" },
  { id: "segment",     label: "Segment Teeth",        description: "Review AI tooth segmentation or adjust manually.",          action: "Review segments" },
  { id: "numbering",   label: "Review Numbering",     description: "Verify FDI tooth numbers and flag any missing/extra.",      action: "Verify FDI labels" },
  { id: "occlusion",   label: "Analyze Occlusion",   description: "Record overjet, overbite, midline, and Angle class.",       action: "Record occlusion" },
  { id: "movements",   label: "Plan Movements",       description: "Set per-tooth translation, tip, torque, and rotation.",     action: "Enter movements" },
  { id: "attachments", label: "Add Attachments",      description: "Place attachment type and position per tooth.",             action: "Plan attachments" },
  { id: "ipr",         label: "Plan IPR",             description: "Record interproximal reduction amounts between contacts.",   action: "Set IPR sites" },
  { id: "stages",      label: "Generate Stages",      description: "Create aligner stages and review movement per step.",       action: "Generate stages" },
  { id: "simulation",  label: "Review Simulation",    description: "Play through treatment timeline and confirm movements.",    action: "Run simulation" },
  { id: "export",      label: "Export",                  description: "Export STL, 3MF, or ZIP for the lab or in-house printer.",  action: "Export plan" },
];

const STATUS_COLORS: Record<WorkflowStepStatus, string> = {
  not_started: "text-[color:var(--muted-foreground)]",
  in_progress:  "text-amber-500",
  complete:     "text-emerald-500",
  needs_review: "text-red-500",
};

const STATUS_LABELS: Record<WorkflowStepStatus, string> = {
  not_started:  "Not started",
  in_progress:  "In progress",
  complete:     "Complete",
  needs_review: "Needs review",
};

function StatusIcon({ status }: { status: WorkflowStepStatus }) {
  const cls = `shrink-0 ${STATUS_COLORS[status]}`;
  if (status === "complete")     return <CheckCircle2 size={15} className={cls} />;
  if (status === "in_progress")  return <Clock size={15} className={cls} />;
  if (status === "needs_review") return <AlertCircle size={15} className={cls} />;
  return <Circle size={15} className={cls} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OrthoWorkflowRailProps {
  caseId: string | null;
  collapsed?: boolean;
}

const CYCLE: WorkflowStepStatus[] = ["not_started", "in_progress", "complete", "needs_review"];

export default function OrthoWorkflowRail({ caseId: _caseId, collapsed: initialCollapsed = false }: OrthoWorkflowRailProps) {
  const { toast } = useToast();
  const { state, dispatch } = useCasePlanning();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const steps = state.workflowSteps;

  function statusFor(stepId: string): WorkflowStepStatus {
    return steps[stepId] ?? "not_started";
  }

  function cycleStatus(stepId: string) {
    const current = statusFor(stepId);
    const idx = CYCLE.indexOf(current);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    dispatch({ type: "SET_WORKFLOW_STEP", stepId, status: next });
    const label = WORKFLOW_STEPS.find((s) => s.id === stepId)?.label ?? stepId;
    if (next === "complete") {
      toast({ title: `${label} complete`, type: "success" });
    } else if (next === "in_progress") {
      toast({ title: `${label} started`, type: "info" });
    }
  }

  const completedCount = WORKFLOW_STEPS.filter((s) => statusFor(s.id) === "complete").length;
  const progressPct = Math.round((completedCount / WORKFLOW_STEPS.length) * 100);

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[color-mix(in_srgb,var(--border)_30%,transparent)] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">
            Clinical Workflow
          </p>
          <p className="text-xs font-semibold text-[color:var(--foreground)] mt-0.5">
            {completedCount} / {WORKFLOW_STEPS.length} steps complete
          </p>
        </div>
        {/* Progress ring (mini) */}
        <div className="relative h-9 w-9 shrink-0">
          <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeDasharray={`${(progressPct / 100) * 94.2} 94.2`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[color:var(--primary)]">
            {progressPct}%
          </span>
        </div>
        {collapsed ? <ChevronDown size={14} className="shrink-0 text-[color:var(--muted-foreground)]" /> : <ChevronUp size={14} className="shrink-0 text-[color:var(--muted-foreground)]" />}
      </button>

      {/* Progress bar */}
      <div className="h-1 w-full bg-[color-mix(in_srgb,var(--border)_50%,transparent)]">
        <div
          className="h-1 bg-[color:var(--primary)] transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step list */}
      {!collapsed && (
        <div className="divide-y divide-[color:var(--border)]">
          {WORKFLOW_STEPS.map((step, i) => {
            const status = statusFor(step.id);
            return (
              <div key={step.id} className="flex items-start gap-3 px-4 py-3">
                {/* Step number */}
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--border)_60%,transparent)] text-[9px] font-bold text-[color:var(--muted-foreground)]">
                  {i + 1}
                </span>
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[color:var(--foreground)] leading-snug">{step.label}</p>
                  <p className="mt-0.5 text-[10px] text-[color:var(--muted-foreground)] leading-snug">{step.description}</p>
                  {/* Status badge */}
                  <span className={`mt-1 inline-block text-[9px] font-bold uppercase tracking-wide ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                {/* Toggle button */}
                <button
                  type="button"
                  onClick={() => cycleStatus(step.id)}
                  aria-label={`Toggle ${step.label} status`}
                  title="Click to cycle status"
                  className="mt-0.5 shrink-0 rounded-lg p-1 transition-colors hover:bg-[color-mix(in_srgb,var(--border)_50%,transparent)]"
                >
                  <StatusIcon status={status} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      {!collapsed && (
        <div className="border-t border-[color:var(--border)] px-4 py-2.5">
          <p className="text-[9px] text-[color:var(--muted-foreground)]">
            Click any status icon to cycle: Not started → In progress → Complete → Needs review
            {!_caseId && " · Load a case to persist progress"}
          </p>
        </div>
      )}
    </div>
  );
}
