"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock,
  ClipboardList,
  Download,
  Edit3,
  FileText,
  Layers3,
  Loader2,
  MessageSquare,
  MoveHorizontal,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wand2,
  X,
} from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import type { TreatmentPlanData, PlanStage, ApprovalStatus, MovementType } from "@/types/orthodontic";
import {
  listPlans,
  approvePlan,
  createPlan,
  type TreatmentPlanSummary,
} from "@/lib/api/treatmentPlans";
import {
  listStages as fetchAlignerStages,
  type AlignerStage,
} from "@/lib/api/stages";

// ─── AI disclaimer ────────────────────────────────────────────────────────────

const AI_DISCLAIMER =
  "AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist.";

// ─── Data mapping helpers ─────────────────────────────────────────────────────

function mapStage(s: AlignerStage, index: number, all: AlignerStage[]): PlanStage {
  const approvedCount = all.filter(x => x.isApproved).length;

  const movements = Object.entries(s.movementData).map(([fdiStr, mv]) => ({
    fdi: parseInt(fdiStr, 10) || 0,
    type: "translation" as MovementType,
    mesialDistal: mv.tx ?? 0,
    buccalLingual: mv.ty ?? 0,
    extrusionIntrusion: mv.tz ?? 0,
    rotation: mv.rz ?? 0,
    torque: mv.rx ?? 0,
    tipping: mv.ry ?? 0,
  }));

  const maxMovementMm = movements.reduce(
    (max, mv) =>
      Math.max(max, Math.abs(mv.mesialDistal), Math.abs(mv.buccalLingual), Math.abs(mv.extrusionIntrusion)),
    0,
  );

  return {
    stageNumber: s.stageNumber,
    movements,
    attachments: s.attachmentData.map(a => ({ fdi: parseInt(a.tooth, 10) || 0, type: a.type })),
    iprEvents: s.iprData.map(ipr => ({
      fdi: parseInt(ipr.toothA, 10) || 0,
      amountMm: ipr.amountMm,
      surface: "distal" as const,
    })),
    maxMovementMm,
    isActive: !s.isApproved && index === approvedCount,
    isComplete: s.isApproved,
  };
}

function mapPlanData(
  summary: TreatmentPlanSummary,
  alignerStages: AlignerStage[],
  caseId: string,
): TreatmentPlanData {
  const sorted = alignerStages.slice().sort((a, b) => a.stageNumber - b.stageNumber);
  const stages = sorted.map((s, i, arr) => mapStage(s, i, arr));

  const totalIPRMm = alignerStages.reduce(
    (sum, s) => sum + s.iprData.reduce((s2, ipr) => s2 + ipr.amountMm, 0),
    0,
  );
  const totalAttachments = alignerStages.reduce((sum, s) => sum + s.attachmentData.length, 0);

  const emailName = summary.createdByEmail.replace(/@.*$/, "");

  return {
    id: summary.id,
    caseId,
    patientName: "",
    orthodontistId: summary.createdByEmail,
    orthodontistName: emailName,
    complexityScore: 5.0,
    estimatedDurationWeeks: summary.estimatedStages * 2,
    totalStages: summary.estimatedStages,
    stages,
    totalIPRMm,
    totalAttachments,
    refinementProbability: 0,
    doctorApproval: (summary.doctorApproval ? "approved" : "pending") as ApprovalStatus,
    internalApproval: "pending" as ApprovalStatus,
    labApproval: "pending" as ApprovalStatus,
    approvedAt: summary.approvedAt ?? undefined,
    createdAt: summary.createdAt,
    version: 1,
  };
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-3 w-44 animate-pulse rounded bg-[color:var(--muted)]/40 mb-2" />
        <div className="h-7 w-56 animate-pulse rounded bg-[color:var(--muted)]/40" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="ios-card p-3 space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-[color:var(--muted)]/40" />
            <div className="h-7 w-12 animate-pulse rounded bg-[color:var(--muted)]/40" />
          </div>
        ))}
      </div>
      <div className="ios-card p-5 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-[color:var(--muted)]/40" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-[color:var(--muted)]/40" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-[color:var(--muted)]/40" />
      </div>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">
          Treatment Planning Engine
        </p>
        <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Treatment Plan</h2>
      </div>
      <div className="ios-card flex flex-col items-center gap-4 p-12 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-rose-500/10 text-rose-500">
          <AlertTriangle size={28} />
        </span>
        <div>
          <p className="text-base font-semibold text-[color:var(--foreground)]">Failed to load treatment plan</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{message}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-bold text-white"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    </div>
  );
}

// ─── Empty state (no plans exist) ────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      await onCreate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">
          Treatment Planning Engine
        </p>
        <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Treatment Plan</h2>
      </div>
      <MedicalDisclaimer variant="inline" />
      <div className="ios-card flex flex-col items-center gap-4 p-12 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
          <Layers3 size={28} />
        </span>
        <div>
          <p className="text-base font-semibold text-[color:var(--foreground)]">No treatment plan for this case</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Create a treatment plan to begin staging and movement planning.
          </p>
        </div>
        {createError && (
          <p className="text-xs text-rose-500">{createError}</p>
        )}
        <button
          type="button"
          disabled={creating}
          onClick={() => { void handleCreate(); }}
          className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {creating ? "Creating…" : "Create Treatment Plan"}
        </button>
      </div>
    </div>
  );
}

// ─── No-case state (caseId not yet provided) ──────────────────────────────────

function NoCaseState() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">
          Treatment Planning Engine
        </p>
        <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Treatment Plan</h2>
      </div>
      <MedicalDisclaimer variant="inline" />
      <div className="ios-card flex flex-col items-center gap-4 p-12 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
          <Layers3 size={28} />
        </span>
        <div>
          <p className="text-base font-semibold text-[color:var(--foreground)]">No treatment plan loaded</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Upload a scan and complete AI segmentation to generate a treatment plan.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Stage dot timeline ───────────────────────────────────────────────────────

function StageDotTimeline({ stages, currentStage, onSelect }: {
  stages: PlanStage[];
  currentStage: number;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="ios-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-[color:var(--foreground)]">Stage Timeline</h4>
        <span className="text-xs text-[color:var(--muted-foreground)]">{stages.length} stages</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {stages.map(s => {
          const isSelected = currentStage === s.stageNumber;
          const hasIPR = s.iprEvents.length > 0;
          const hasAttachment = s.attachments.length > 0;
          return (
            <button
              key={s.stageNumber}
              type="button"
              onClick={() => onSelect(s.stageNumber)}
              title={`Stage ${s.stageNumber}${s.isComplete ? " — Complete" : s.isActive ? " — Active" : ""}`}
              className={`relative flex h-9 w-9 flex-col items-center justify-center rounded-lg text-xs font-black transition-all ${
                isSelected
                  ? "bg-[color:var(--primary)] text-white ring-2 ring-[color:var(--primary)] ring-offset-1"
                  : s.isComplete
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                  : s.isActive
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40"
                  : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"
              }`}
            >
              {s.stageNumber}
              {hasIPR && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 border border-white" />}
              {hasAttachment && !hasIPR && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-violet-500 border border-white" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 flex-wrap">
        {[
          { color: "bg-emerald-500/30", label: "Complete" },
          { color: "bg-amber-500/30",   label: "Active" },
          { color: "bg-violet-500",     label: "Attachment" },
          { color: "bg-amber-500",      label: "IPR" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm ${l.color}`} />
            <span className="text-[10px] text-[color:var(--muted-foreground)]">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stage detail card ────────────────────────────────────────────────────────

function StageDetail({ stage }: { stage: PlanStage }) {
  return (
    <div className="ios-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--primary-glow)] text-sm font-black text-[color:var(--primary)]">
            {stage.stageNumber}
          </span>
          <div>
            <h4 className="font-bold text-[color:var(--foreground)]">Stage {stage.stageNumber}</h4>
            <p className="text-xs text-[color:var(--muted-foreground)]">Max movement {stage.maxMovementMm.toFixed(2)} mm</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${stage.isComplete ? "bg-emerald-500/10 text-emerald-600" : stage.isActive ? "bg-amber-500/10 text-amber-600" : "bg-slate-500/10 text-slate-500"}`}>
          {stage.isComplete ? "Complete" : stage.isActive ? "Active" : "Queued"}
        </span>
      </div>

      {/* Movements table */}
      <div className="mb-4 overflow-x-auto rounded-xl border border-[color:var(--border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[color:var(--border)] bg-[color:var(--card)]">
              <th className="px-3 py-2.5 text-left font-bold text-[color:var(--muted-foreground)]">FDI</th>
              <th className="px-3 py-2.5 text-left font-bold text-[color:var(--muted-foreground)]">Type</th>
              <th className="px-3 py-2.5 text-right font-bold text-[color:var(--muted-foreground)]">M/D mm</th>
              <th className="px-3 py-2.5 text-right font-bold text-[color:var(--muted-foreground)]">B/L mm</th>
              <th className="px-3 py-2.5 text-right font-bold text-[color:var(--muted-foreground)]">E/I mm</th>
              <th className="px-3 py-2.5 text-right font-bold text-[color:var(--muted-foreground)]">Rot °</th>
              <th className="px-3 py-2.5 text-right font-bold text-[color:var(--muted-foreground)]">Torque °</th>
            </tr>
          </thead>
          <tbody>
            {stage.movements.map(mv => (
              <tr key={mv.fdi} className="border-b border-[color:var(--border)] last:border-0">
                <td className="px-3 py-2 font-black text-[color:var(--primary)]">{mv.fdi}</td>
                <td className="px-3 py-2 capitalize text-[color:var(--muted-foreground)]">{mv.type}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--foreground)]">{mv.mesialDistal.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--foreground)]">{mv.buccalLingual.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--foreground)]">{mv.extrusionIntrusion.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--foreground)]">{mv.rotation.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--foreground)]">{mv.torque.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Attachments & IPR events */}
      {stage.attachments.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-bold text-[color:var(--muted-foreground)] mb-1.5">Attachments This Stage</p>
          <div className="flex flex-wrap gap-1.5">
            {stage.attachments.map(att => (
              <span key={att.fdi} className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-600">
                FDI {att.fdi} — {att.type}
              </span>
            ))}
          </div>
        </div>
      )}

      {stage.iprEvents.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-bold text-[color:var(--muted-foreground)] mb-1.5">IPR This Stage</p>
          <div className="flex flex-wrap gap-1.5">
            {stage.iprEvents.map((ipr, i) => (
              <span key={i} className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                FDI {ipr.fdi} {ipr.surface} — {ipr.amountMm.toFixed(2)} mm
              </span>
            ))}
          </div>
        </div>
      )}

      {stage.clinicianNote && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/60 px-3 py-2.5 dark:border-amber-700/40 dark:bg-amber-900/10">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800 dark:text-amber-300">{stage.clinicianNote}</p>
        </div>
      )}

      {stage.trackingScore !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-[color:var(--muted-foreground)]">Tracking Score:</span>
          <span className={`text-xs font-bold ${stage.trackingScore >= 90 ? "text-emerald-600" : stage.trackingScore >= 80 ? "text-teal-600" : "text-amber-600"}`}>
            {stage.trackingScore}%
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Approval Workflow ────────────────────────────────────────────────────────

function ApprovalWorkflow({
  plan,
  onApprove,
  approving,
  approveError,
}: {
  plan: TreatmentPlanData;
  onApprove: (signature: string) => Promise<void>;
  approving: boolean;
  approveError: string | null;
}) {
  const [doctorApproval, setDoctorApproval] = useState<ApprovalStatus>(plan.doctorApproval);
  const [doctorNote, setDoctorNote] = useState("");

  // Sync from parent when plan approval status changes (e.g. after API success)
  useEffect(() => {
    setDoctorApproval(plan.doctorApproval);
  }, [plan.doctorApproval]);

  const APPROVALS: { role: string; name: string; status: ApprovalStatus; isDoctor: boolean }[] = [
    { role: "Doctor Review",    name: plan.orthodontistName,    status: doctorApproval,        isDoctor: true  },
    { role: "Internal Review",  name: "Treatment Planning Team", status: plan.internalApproval, isDoctor: false },
    { role: "Lab Review",       name: "Lab Technician",          status: plan.labApproval,      isDoctor: false },
  ];

  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-5">
        <ClipboardList size={16} className="text-[color:var(--primary)]" />
        <h4 className="font-bold text-[color:var(--foreground)]">Approval Workflow</h4>
      </div>

      {approveError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-300/50 bg-rose-50/60 px-3 py-2.5 dark:border-rose-700/40 dark:bg-rose-900/10">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-rose-500" />
          <p className="text-xs text-rose-600 dark:text-rose-400">{approveError}</p>
        </div>
      )}

      <div className="space-y-4">
        {APPROVALS.map(({ role, name, status, isDoctor }) => (
          <div
            key={role}
            className={`rounded-xl border p-4 ${
              status === "approved"
                ? "border-emerald-300/50 bg-emerald-50/40 dark:border-emerald-700/40 dark:bg-emerald-900/10"
                : status === "rejected"
                ? "border-rose-300/50 bg-rose-50/40 dark:border-rose-700/40 dark:bg-rose-900/10"
                : "border-[color:var(--border)] bg-[color:var(--card)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{role}</p>
                <p className="text-sm font-bold text-[color:var(--foreground)]">{name}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                  status === "approved"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : status === "rejected"
                    ? "bg-rose-500/10 text-rose-500"
                    : status === "revision_requested"
                    ? "bg-orange-500/10 text-orange-600"
                    : "bg-amber-500/10 text-amber-600"
                }`}
              >
                {status === "approved"
                  ? "✓ Approved"
                  : status === "rejected"
                  ? "✕ Rejected"
                  : status === "revision_requested"
                  ? "↩ Revision"
                  : "⏳ Pending"}
              </span>
            </div>
            {isDoctor && status === "pending" && (
              <div className="mt-3 space-y-2">
                <textarea
                  placeholder="Doctor notes (optional)..."
                  value={doctorNote}
                  onChange={e => setDoctorNote(e.target.value)}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none resize-none"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={approving}
                    onClick={() => { void onApprove(doctorNote || "Approved"); }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {approving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ThumbsUp size={14} />
                    )}
                    {approving ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={approving}
                    onClick={() => setDoctorApproval("revision_requested")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-amber-400 bg-amber-50 py-2.5 text-sm font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 disabled:opacity-60"
                  >
                    <Edit3 size={14} /> Request Revision
                  </button>
                  <button
                    type="button"
                    disabled={approving}
                    onClick={() => setDoctorApproval("rejected")}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-400 bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-600 dark:bg-rose-900/20 disabled:opacity-60"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TreatmentPlanningEngine({ caseId }: { caseId: string | null }) {
  const [plan, setPlan] = useState<TreatmentPlanData | null>(null);
  const [planSummary, setPlanSummary] = useState<TreatmentPlanSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "stages" | "approval" | "report">("overview");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caseId) {
      setPlan(null);
      setPlanSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const plans = await listPlans(caseId);
      // Prefer the first plan that hasn't been doctor-approved yet; fall back to most recent
      const activeSummary = plans.find(p => !p.doctorApproval) ?? plans[0] ?? null;
      if (!activeSummary) {
        setPlanSummary(null);
        setPlan(null);
        return;
      }
      setPlanSummary(activeSummary);
      const stages = await fetchAlignerStages(caseId, activeSummary.id);
      const mapped = mapPlanData(activeSummary, stages, caseId);
      setPlan(mapped);
      // Default current stage to the first incomplete stage, or stage 1
      const sorted = stages.slice().sort((a, b) => a.stageNumber - b.stageNumber);
      const firstActive = sorted.find(s => !s.isApproved);
      setCurrentStage(firstActive?.stageNumber ?? sorted[0]?.stageNumber ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load treatment plan");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreatePlan = useCallback(async () => {
    if (!caseId) return;
    await createPlan(caseId, { estimatedStages: 14 });
    await load();
  }, [caseId, load]);

  const handleApprove = useCallback(async (signature: string) => {
    if (!plan || !caseId) return;
    setApproving(true);
    setApproveError(null);
    try {
      await approvePlan(caseId, plan.id, signature || "Approved by doctor");
      setPlan(prev => prev ? { ...prev, doctorApproval: "approved" as ApprovalStatus } : prev);
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }, [plan, caseId]);

  // No case ID provided yet
  if (!caseId) {
    return <NoCaseState />;
  }

  // Loading
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Error
  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  // Empty — no plans exist for this case
  if (!plan) {
    return <EmptyState onCreate={handleCreatePlan} />;
  }

  const currentStageData = plan.stages.find(s => s.stageNumber === currentStage) ?? plan.stages[0];
  const completedStages = plan.stages.filter(s => s.isComplete).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Treatment Planning Engine</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Treatment Plan</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            {plan.caseId} · {plan.orthodontistName} · Plan {plan.id.slice(0, 8)}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm font-bold text-[color:var(--foreground)]">
            <Download size={14} /> Export PDF
          </button>
          <button
            type="button"
            disabled={plan.doctorApproval === "approved"}
            onClick={() => setActiveTab("approval")}
            className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            <Send size={14} />
            {plan.doctorApproval === "approved" ? "Approved" : "Submit for Approval"}
          </button>
        </div>
      </div>

      <MedicalDisclaimer variant="inline" />

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(["overview", "stages", "approval", "report"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all capitalize ${
              activeTab === tab
                ? "bg-[color:var(--primary)] text-white"
                : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"
            }`}
          >
            {tab === "approval" ? "Approval Workflow" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Stages",      value: plan.totalStages,                                unit: "",     color: "text-[color:var(--primary)]" },
              { label: "Duration",          value: Math.round(plan.estimatedDurationWeeks / 4.3),   unit: " mo",  color: "text-[color:var(--foreground)]" },
              { label: "Complexity Score",  value: plan.complexityScore.toFixed(1),                 unit: "/10",  color: plan.complexityScore > 7 ? "text-rose-500" : plan.complexityScore > 5 ? "text-amber-600" : "text-emerald-600" },
              { label: "Refinement Risk",   value: plan.refinementProbability,                      unit: "%",    color: plan.refinementProbability > 30 ? "text-amber-600" : "text-emerald-600" },
              { label: "Completed Stages",  value: completedStages,                                 unit: `/${plan.totalStages}`, color: "text-emerald-600" },
              { label: "Total IPR",         value: plan.totalIPRMm.toFixed(1),                     unit: " mm",  color: "text-amber-600" },
              { label: "Attachments",       value: plan.totalAttachments,                           unit: "",     color: "text-violet-600" },
              { label: "Approval",          value: plan.doctorApproval === "approved" ? "✓" : "—", unit: "",     color: plan.doctorApproval === "approved" ? "text-emerald-600" : "text-[color:var(--muted-foreground)]" },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="ios-card p-3">
                <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">{label}</p>
                <p className={`mt-1 text-xl font-black tabular-nums ${color}`}>
                  {value}<span className="text-sm font-bold">{unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="ios-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-[color:var(--foreground)]">Treatment Progress</h4>
              <span className="text-sm font-bold text-[color:var(--primary)]">{completedStages}/{plan.totalStages} stages</span>
            </div>
            <div className="h-3 rounded-full bg-[color:var(--border)]">
              <div
                className="h-full rounded-full bg-[color:var(--primary)] transition-all"
                style={{ width: plan.totalStages > 0 ? `${(completedStages / plan.totalStages) * 100}%` : "0%" }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { label: "Completed", value: completedStages,                                 color: "bg-emerald-500/10 text-emerald-600" },
                { label: "Active",    value: plan.stages.filter(s => s.isActive).length,      color: "bg-amber-500/10 text-amber-600" },
                { label: "Remaining", value: plan.totalStages - completedStages,              color: "bg-slate-500/10 text-slate-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-lg p-3 text-center ${color.split(" ")[0]}`}>
                  <p className={`text-lg font-black tabular-nums ${color.split(" ")[1]}`}>{value}</p>
                  <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI recommendation notes */}
          {planSummary?.aiRecommendationNotes && (
            <div className="ios-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-[color:var(--primary)]" />
                <h4 className="font-bold text-[color:var(--foreground)]">AI Recommendation Notes</h4>
              </div>
              <p className="text-sm text-[color:var(--foreground)] mb-3 whitespace-pre-wrap leading-relaxed">
                {planSummary.aiRecommendationNotes}
              </p>
              <div className="flex items-start gap-2 rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{AI_DISCLAIMER}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stages */}
      {activeTab === "stages" && (
        <div className="space-y-5">
          {plan.stages.length === 0 ? (
            <div className="ios-card flex flex-col items-center gap-3 p-10 text-center">
              <Layers3 size={24} className="text-[color:var(--muted-foreground)]" />
              <p className="text-sm font-semibold text-[color:var(--foreground)]">No stages generated yet</p>
              <p className="text-xs text-[color:var(--muted-foreground)]">Stages will appear here once generated from the treatment plan.</p>
            </div>
          ) : (
            <>
              <StageDotTimeline
                stages={plan.stages}
                currentStage={currentStage}
                onSelect={setCurrentStage}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStage(s => Math.max(1, s - 1))}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-2.5"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="flex-1 text-center text-sm font-bold text-[color:var(--foreground)]">
                  Stage {currentStage} of {plan.totalStages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStage(s => Math.min(plan.totalStages, s + 1))}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-2.5"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              {currentStageData && <StageDetail stage={currentStageData} />}
            </>
          )}
        </div>
      )}

      {/* Approval */}
      {activeTab === "approval" && (
        <ApprovalWorkflow
          plan={plan}
          onApprove={handleApprove}
          approving={approving}
          approveError={approveError}
        />
      )}

      {/* Report */}
      {activeTab === "report" && (
        <div className="space-y-5">
          <div className="ios-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-[color:var(--primary)]" />
              <h4 className="font-bold text-[color:var(--foreground)]">Treatment Report</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
              <div>
                <p className="text-[color:var(--muted-foreground)]">Plan ID</p>
                <p className="font-mono font-semibold text-[color:var(--foreground)]">{plan.id.slice(0, 12)}…</p>
              </div>
              <div>
                <p className="text-[color:var(--muted-foreground)]">Created</p>
                <p className="font-semibold text-[color:var(--foreground)]">
                  {new Date(plan.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-[color:var(--muted-foreground)]">Orthodontist</p>
                <p className="font-semibold text-[color:var(--foreground)]">{plan.orthodontistName}</p>
              </div>
              <div>
                <p className="text-[color:var(--muted-foreground)]">Doctor Approval</p>
                <p className={`font-semibold ${plan.doctorApproval === "approved" ? "text-emerald-600" : "text-amber-600"}`}>
                  {plan.doctorApproval === "approved" ? "Approved" : "Pending"}
                  {plan.approvedAt ? ` · ${new Date(plan.approvedAt).toLocaleDateString()}` : ""}
                </p>
              </div>
            </div>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-5">
              Generate a comprehensive PDF treatment report including stage-by-stage movement data, attachment plan, IPR schedule, and approval signatures.
            </p>
            <div className="flex flex-wrap gap-3">
              {["Doctor Report", "Lab Package", "Patient Summary"].map(r => (
                <button
                  key={r}
                  type="button"
                  className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2.5 text-sm font-bold text-[color:var(--foreground)]"
                >
                  <Download size={14} /> {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>{AI_DISCLAIMER}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TreatmentPlanningEngine;
