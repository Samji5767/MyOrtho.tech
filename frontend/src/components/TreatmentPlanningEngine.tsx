"use client";

import { useState } from "react";
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
  MessageSquare,
  MoveHorizontal,
  Plus,
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
import type { TreatmentPlanData, PlanStage, ApprovalStatus } from "@/types/orthodontic";

// ─── Mock treatment plan data ─────────────────────────────────────────────────

const MOCK_PLAN: TreatmentPlanData | null = null;

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

function ApprovalWorkflow({ plan }: { plan: TreatmentPlanData }) {
  const [doctorApproval, setDoctorApproval] = useState<ApprovalStatus>(plan.doctorApproval);
  const [doctorNote, setDoctorNote] = useState("");

  const APPROVALS = [
    { role: "Doctor Review", name: plan.orthodontistName, status: doctorApproval, onChange: setDoctorApproval },
    { role: "Internal Review", name: "Treatment Planning Team", status: plan.internalApproval, onChange: undefined },
    { role: "Lab Review", name: "Lab Technician", status: plan.labApproval, onChange: undefined },
  ];

  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-5">
        <ClipboardList size={16} className="text-[color:var(--primary)]" />
        <h4 className="font-bold text-[color:var(--foreground)]">Approval Workflow</h4>
      </div>

      <div className="space-y-4">
        {APPROVALS.map(({ role, name, status, onChange }) => (
          <div key={role} className={`rounded-xl border p-4 ${status === "approved" ? "border-emerald-300/50 bg-emerald-50/40 dark:border-emerald-700/40 dark:bg-emerald-900/10" : status === "rejected" ? "border-rose-300/50 bg-rose-50/40 dark:border-rose-700/40 dark:bg-rose-900/10" : "border-[color:var(--border)] bg-[color:var(--card)]"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{role}</p>
                <p className="text-sm font-bold text-[color:var(--foreground)]">{name}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${status === "approved" ? "bg-emerald-500/10 text-emerald-600" : status === "rejected" ? "bg-rose-500/10 text-rose-500" : status === "revision_requested" ? "bg-orange-500/10 text-orange-600" : "bg-amber-500/10 text-amber-600"}`}>
                {status === "approved" ? "✓ Approved" : status === "rejected" ? "✕ Rejected" : status === "revision_requested" ? "↩ Revision" : "⏳ Pending"}
              </span>
            </div>
            {onChange && status === "pending" && (
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
                    onClick={() => onChange("approved")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white"
                  >
                    <ThumbsUp size={14} /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange("revision_requested")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-amber-400 bg-amber-50 py-2.5 text-sm font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                  >
                    <Edit3 size={14} /> Request Revision
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange("rejected")}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-400 bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-600 dark:bg-rose-900/20"
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

export function TreatmentPlanningEngine() {
  const [currentStage, setCurrentStage] = useState(9);
  const [activeTab, setActiveTab] = useState<"overview" | "stages" | "approval" | "report">("overview");

  const plan = MOCK_PLAN;

  if (!plan) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Treatment Planning Engine</p>
            <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Treatment Plan</h2>
          </div>
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
            {plan.patientName} · {plan.caseId} · v{plan.version} · {plan.orthodontistName}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm font-bold text-[color:var(--foreground)]">
            <Download size={14} /> Export PDF
          </button>
          <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-bold text-white">
            <Send size={14} /> Submit for Approval
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
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all capitalize ${activeTab === tab ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
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
              { label: "Total Stages",      value: plan.totalStages,                    unit: "",     color: "text-[color:var(--primary)]" },
              { label: "Duration",          value: Math.round(plan.estimatedDurationWeeks / 4.3), unit: "mo", color: "text-[color:var(--foreground)]" },
              { label: "Complexity Score",  value: plan.complexityScore.toFixed(1),     unit: "/10",  color: plan.complexityScore > 7 ? "text-rose-500" : plan.complexityScore > 5 ? "text-amber-600" : "text-emerald-600" },
              { label: "Refinement Risk",   value: plan.refinementProbability,          unit: "%",    color: plan.refinementProbability > 30 ? "text-amber-600" : "text-emerald-600" },
              { label: "Completed Stages",  value: completedStages,                     unit: `/${plan.totalStages}`, color: "text-emerald-600" },
              { label: "Total IPR",         value: plan.totalIPRMm.toFixed(1),          unit: " mm",  color: "text-amber-600" },
              { label: "Attachments",       value: plan.totalAttachments,               unit: "",     color: "text-violet-600" },
              { label: "Version",           value: `v${plan.version}`,                 unit: "",     color: "text-[color:var(--muted-foreground)]" },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="ios-card p-3">
                <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">{label}</p>
                <p className={`mt-1 text-xl font-black tabular-nums ${color}`}>{value}<span className="text-sm font-bold">{unit}</span></p>
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
              <div className="h-full rounded-full bg-[color:var(--primary)] transition-all" style={{ width: `${(completedStages / plan.totalStages) * 100}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { label: "Completed",  value: completedStages, color: "bg-emerald-500/10 text-emerald-600" },
                { label: "Active",     value: 1,               color: "bg-amber-500/10 text-amber-600" },
                { label: "Remaining",  value: plan.totalStages - completedStages - 1, color: "bg-slate-500/10 text-slate-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-lg p-3 text-center ${color.split(" ")[0]}`}>
                  <p className={`text-lg font-black tabular-nums ${color.split(" ")[1]}`}>{value}</p>
                  <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stages */}
      {activeTab === "stages" && (
        <div className="space-y-5">
          <StageDotTimeline
            stages={plan.stages}
            currentStage={currentStage}
            onSelect={setCurrentStage}
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCurrentStage(s => Math.max(1, s - 1))} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-2.5">
              <ChevronLeft size={18} />
            </button>
            <span className="flex-1 text-center text-sm font-bold text-[color:var(--foreground)]">Stage {currentStage} of {plan.totalStages}</span>
            <button type="button" onClick={() => setCurrentStage(s => Math.min(plan.totalStages, s + 1))} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-2.5">
              <ChevronRight size={18} />
            </button>
          </div>
          <StageDetail stage={currentStageData} />
        </div>
      )}

      {/* Approval */}
      {activeTab === "approval" && <ApprovalWorkflow plan={plan} />}

      {/* Report */}
      {activeTab === "report" && (
        <div className="ios-card p-6 text-center">
          <FileText size={32} className="mx-auto mb-3 text-[color:var(--muted-foreground)]" />
          <h3 className="font-bold text-[color:var(--foreground)] mb-2">Treatment Report</h3>
          <p className="text-sm text-[color:var(--muted-foreground)] mb-5">
            Generate a comprehensive PDF treatment report including patient details, diagnosis, stage-by-stage movement data, attachment plan, IPR schedule, and approval signatures.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            {["Doctor Report", "Lab Package", "Patient Summary"].map(r => (
              <button key={r} type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2.5 text-sm font-bold text-[color:var(--foreground)]">
                <Download size={14} /> {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TreatmentPlanningEngine;
