"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

// ─── Step definition ──────────────────────────────────────────────────────────

export type WorkflowStepStatus = "pending" | "in_progress" | "completed" | "skipped" | "error";

export interface WorkflowStep {
  key: string;
  label: string;
  status: WorkflowStepStatus;
}

// ─── Default pipeline definition ─────────────────────────────────────────────

export const DEFAULT_PIPELINE_STEPS: Omit<WorkflowStep, "status">[] = [
  { key: "patient",         label: "Patient" },
  { key: "scan_upload",     label: "Scan" },
  { key: "segmentation",    label: "Segment" },
  { key: "clinical_analysis", label: "Analysis" },
  { key: "treatment_plan",  label: "Plan" },
  { key: "biomechanics",    label: "Biomechanics" },
  { key: "attachments",     label: "Attachments" },
  { key: "ipr",             label: "IPR" },
  { key: "stage_generation", label: "Stages" },
  { key: "qa",              label: "QA" },
  { key: "approval",        label: "Approval" },
  { key: "export",          label: "Export" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepNode({ step, isLast }: { step: WorkflowStep; isLast: boolean }) {
  const dotClass: Record<WorkflowStepStatus, string> = {
    completed:   "bg-emerald-500 text-white border-emerald-500",
    in_progress: "bg-[color:var(--primary)] text-white border-[color:var(--primary)] animate-pulse",
    pending:     "bg-[color:var(--card)] text-[color:var(--muted-foreground)] border-[color:var(--border)]",
    skipped:     "bg-[color:var(--muted)] text-[color:var(--muted-foreground)] border-[color:var(--border)] opacity-50",
    error:       "bg-red-500 text-white border-red-500",
  };
  const labelClass: Record<WorkflowStepStatus, string> = {
    completed:   "text-emerald-600 dark:text-emerald-400 font-semibold",
    in_progress: "text-[color:var(--primary)] font-semibold",
    pending:     "text-[color:var(--muted-foreground)]",
    skipped:     "text-[color:var(--muted-foreground)] line-through opacity-50",
    error:       "text-red-600 dark:text-red-400 font-semibold",
  };
  const connectorClass = step.status === "completed"
    ? "bg-emerald-500/50"
    : "bg-[color:var(--border)]";

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] ${dotClass[step.status]}`}
        >
          {step.status === "completed" ? (
            <CheckCircle2 size={14} />
          ) : step.status === "in_progress" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : step.status === "error" ? (
            "!"
          ) : (
            <Circle size={10} />
          )}
        </div>
        {!isLast && (
          <div className={`h-0.5 w-8 sm:w-10 ${connectorClass} transition-colors`} />
        )}
      </div>
      <p className={`mt-1.5 max-w-[3.5rem] text-center text-[9px] leading-tight ${labelClass[step.status]}`}>
        {step.label}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  steps?: WorkflowStep[];
  completedKeys?: string[];
  inProgressKey?: string;
}

export default function WorkflowPipelineBar({ steps, completedKeys, inProgressKey }: Props) {
  // If steps are not provided, derive from completedKeys/inProgressKey
  const resolvedSteps: WorkflowStep[] = steps ?? DEFAULT_PIPELINE_STEPS.map((s) => ({
    ...s,
    status: completedKeys?.includes(s.key)
      ? "completed"
      : s.key === inProgressKey
      ? "in_progress"
      : "pending",
  }));

  const completed = resolvedSteps.filter((s) => s.status === "completed").length;
  const total = resolvedSteps.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[color:var(--foreground)]">Treatment Workflow</span>
        <span className="text-[color:var(--muted-foreground)] tabular-nums">{completed}/{total} steps</span>
      </div>
      {/* Progress fill */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--border)]">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Step nodes — horizontal scroll on small screens */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-start min-w-max">
          {resolvedSteps.map((step, i) => (
            <StepNode key={step.key} step={step} isLast={i === resolvedSteps.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
