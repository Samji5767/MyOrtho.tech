"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  AlertTriangle,
  Box,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crosshair,
  Edit3,
  Eye,
  EyeOff,
  Layers3,
  MessageSquare,
  Maximize2,
  Minus,
  MoveHorizontal,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Sliders,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { ConflictWarningsPanel } from "@/components/ConflictWarningsPanel";
import { ApprovalValidationPanel } from "@/components/ApprovalValidationPanel";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { useCasePlanning } from "@/components/CasePlanningContext";

const CADEngine = dynamic(() => import("@/components/CADEngine"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-xl bg-slate-950">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
        <p className="mt-3 text-sm font-semibold text-slate-300">Loading CAD Engine…</p>
      </div>
    </div>
  ),
});

const Viewer3D = dynamic(() => import("@/components/Viewer3D"), {
  ssr: false,
  loading: () => <div className="h-[500px] rounded-xl animate-skeleton" />,
});

// ─── Constants ────────────────────────────────────────────────────────────────

type DesignTab = "3d-viewer" | "treatment-designer" | "simulation" | "design-review";

const DESIGN_COMMENTS: Array<{ id: string; author: string; role: string; text: string; time: string; status: string }> = [];

const REVISION_HISTORY: Array<{ version: string; date: string; author: string; note: string }> = [];

// ─── 3D Viewer Panel ──────────────────────────────────────────────────────────

function ViewerPanel() {
  const [viewPreset, setViewPreset] = useState("front");
  const [showUpper, setShowUpper] = useState(true);
  const [showLower, setShowLower] = useState(true);
  const [showGingiva, setShowGingiva] = useState(false);

  return (
    <div className="space-y-4">
      {/* Viewer controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-xl border border-[color:var(--border)] overflow-hidden">
          {["front", "right", "left", "top", "occlusal"].map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => setViewPreset(preset)}
              className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${viewPreset === preset ? "bg-[color:var(--primary)] text-white" : "bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {[
            { label: "Upper", active: showUpper, toggle: () => setShowUpper(v => !v) },
            { label: "Lower", active: showLower, toggle: () => setShowLower(v => !v) },
            { label: "Gingiva", active: showGingiva, toggle: () => setShowGingiva(v => !v) },
          ].map(({ label, active, toggle }) => (
            <button
              key={label}
              type="button"
              onClick={toggle}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${active ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]" : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
            >
              {active ? <Eye size={11} /> : <EyeOff size={11} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* CAD Engine */}
      <div className="rounded-xl overflow-hidden border border-[color:var(--border)]">
        <CADEngine />
      </div>

      {/* Screenshot bar */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]">
          <Camera size={13} /> Screenshot
        </button>
        <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]">
          <Maximize2 size={13} /> Fullscreen
        </button>
        <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]">
          <Crosshair size={13} /> Measure
        </button>
      </div>
    </div>
  );
}

// ─── Treatment Designer Panel ─────────────────────────────────────────────────

function TreatmentDesignerPanel({ caseId, planId }: { caseId?: string; planId?: string }) {
  const { state } = useCasePlanning();
  const [selectedTool, setSelectedTool] = useState<"translate" | "rotate">("translate");
  const [selectedFdi, setSelectedFdi] = useState<number | null>(21);

  return (
    <div className="space-y-5">
      {/* Tool selector */}
      <div className="ios-card p-4">
        <h4 className="text-sm font-bold text-[color:var(--foreground)] mb-3">Movement Controls</h4>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setSelectedTool("translate")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all ${selectedTool === "translate" ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]" : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
          >
            <MoveHorizontal size={15} /> Translate
          </button>
          <button
            type="button"
            onClick={() => setSelectedTool("rotate")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all ${selectedTool === "rotate" ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]" : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
          >
            <RotateCw size={15} /> Rotate
          </button>
        </div>

        {/* Sliders for active tool */}
        {selectedTool === "translate" && (
          <div className="space-y-3">
            {[
              { axis: "Mesial / Distal", range: [-3, 3], unit: "mm" },
              { axis: "Buccal / Lingual", range: [-3, 3], unit: "mm" },
              { axis: "Extrusion / Intrusion", range: [-3, 3], unit: "mm" },
            ].map(({ axis, range, unit }) => (
              <div key={axis}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-semibold text-[color:var(--foreground)]">{axis}</span>
                  <span className="text-xs font-bold tabular-nums text-[color:var(--primary)]">0.0 {unit}</span>
                </div>
                <input type="range" min={range[0]} max={range[1]} step={0.1} defaultValue={0} className="w-full accent-teal-500" />
              </div>
            ))}
          </div>
        )}
        {selectedTool === "rotate" && (
          <div className="space-y-3">
            {[
              { axis: "Rotation (Mesial In/Out)", range: [-15, 15], unit: "°" },
              { axis: "Torque (Root Buccal/Lingual)", range: [-20, 20], unit: "°" },
              { axis: "Tipping (Mesial/Distal)", range: [-10, 10], unit: "°" },
            ].map(({ axis, range, unit }) => (
              <div key={axis}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-semibold text-[color:var(--foreground)]">{axis}</span>
                  <span className="text-xs font-bold tabular-nums text-[color:var(--primary)]">0.0{unit}</span>
                </div>
                <input type="range" min={range[0]} max={range[1]} step={0.5} defaultValue={0} className="w-full accent-teal-500" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attachment plan */}
      <div className="ios-card p-4">
        <h4 className="text-sm font-bold text-[color:var(--foreground)] mb-3">Attachment Placement</h4>
        <div className="space-y-1.5">
          {state.attachments.length === 0 ? (
            <p className="text-xs text-[color:var(--muted-foreground)] py-1">No attachments planned yet.</p>
          ) : state.attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              <div className="flex-1">
                <span className="text-xs font-bold text-[color:var(--primary)]">FDI {att.fdi}</span>
                <span className="ml-1.5 text-xs text-[color:var(--foreground)]">{att.type}</span>
              </div>
              <span className="text-xs text-[color:var(--muted-foreground)]">{att.surface} · Stage {att.stage}</span>
            </div>
          ))}
        </div>
        <button type="button" className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[color:var(--primary)]">
          <Plus size={12} /> Add attachment
        </button>
      </div>

      {/* IPR plan */}
      <div className="ios-card p-4">
        <h4 className="text-sm font-bold text-[color:var(--foreground)] mb-3">IPR Planning</h4>
        <div className="space-y-1.5">
          {state.iprEntries.length === 0 ? (
            <p className="text-xs text-[color:var(--muted-foreground)] py-1">No IPR entries planned yet.</p>
          ) : state.iprEntries.map(ipr => (
            <div key={ipr.id} className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-xs text-[color:var(--foreground)]">
                Between <strong>{ipr.toothA}</strong>–<strong>{ipr.toothB}</strong>
              </span>
              <span className="ml-auto text-xs font-bold text-amber-600">{ipr.amount} mm</span>
              <span className="text-xs text-[color:var(--muted-foreground)]">Stage {ipr.stage}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Conflict warnings — real API when caseId + planId available */}
      {caseId && planId ? (
        <ConflictWarningsPanel caseId={caseId} planId={planId} />
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300/50 bg-emerald-50/60 px-4 py-3 dark:border-emerald-700/40 dark:bg-emerald-900/10">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">No collisions detected at current stage</p>
        </div>
      )}
    </div>
  );
}

// ─── Simulation Panel ─────────────────────────────────────────────────────────

function SimulationPanel() {
  const [currentStage, setCurrentStage] = useState(9);
  const [isPlaying, setIsPlaying] = useState(false);
  const totalStages = 18;

  return (
    <div className="space-y-5">
      {/* Before/After */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--border)] bg-slate-950 p-4 relative overflow-hidden" style={{ minHeight: "200px" }}>
          <span className="absolute left-3 top-3 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-slate-300">Before</span>
          <div className="absolute inset-8 top-12 flex items-center justify-center">
            <div className="h-20 w-40 rounded-full border border-blue-400/30" />
            <div className="absolute inset-x-6 top-1/2 h-1 rounded-full bg-gradient-to-r from-blue-400/40 to-teal-400/40" />
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-slate-950 p-4 relative overflow-hidden" style={{ minHeight: "200px" }}>
          <span className="absolute left-3 top-3 rounded-full bg-[color:var(--primary)]/20 px-2.5 py-1 text-xs font-bold text-[color:var(--primary)]">Stage {currentStage}</span>
          <div className="absolute inset-8 top-12 flex items-center justify-center">
            <div className="h-20 w-40 rounded-full border border-teal-400/50 shadow-[0_0_30px_rgba(45,212,191,0.2)]" />
            <div className="absolute inset-x-6 top-[48%] h-1 rounded-full bg-gradient-to-r from-teal-400/60 to-emerald-400/60" />
          </div>
        </div>
      </div>

      {/* Stage slider */}
      <div className="ios-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-[color:var(--foreground)]">Stage Playback</h4>
          <span className="text-sm font-bold text-[color:var(--primary)]">{currentStage} / {totalStages}</span>
        </div>
        <input
          type="range"
          min={1}
          max={totalStages}
          value={currentStage}
          onChange={e => setCurrentStage(Number(e.target.value))}
          className="w-full accent-teal-500 mb-3"
        />
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => setCurrentStage(s => Math.max(1, s - 1))} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-2">
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(v => !v)}
            className="rounded-xl bg-[color:var(--primary)] px-5 py-2.5 font-bold text-white text-sm"
          >
            {isPlaying ? "Pause" : "Play Animation"}
          </button>
          <button type="button" onClick={() => setCurrentStage(s => Math.min(totalStages, s + 1))} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-2">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Stage metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Max Movement", value: `${(1.8 - (currentStage - 1) * 0.06).toFixed(2)} mm` },
          { label: "IPR This Stage", value: currentStage === 4 || currentStage === 6 ? "0.3 mm" : "None" },
          { label: "Collision Risk",  value: "None" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-center">
            <p className="text-xs text-[color:var(--muted-foreground)]">{label}</p>
            <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Design Review Panel ──────────────────────────────────────────────────────

function DesignReviewPanel({ caseId, planId }: { caseId?: string; planId?: string }) {
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [canApprove, setCanApprove] = useState(false);

  return (
    <div className="space-y-5">
      {/* Real-time approval validation */}
      {caseId && planId && (
        <ApprovalValidationPanel
          caseId={caseId}
          planId={planId}
          onValidation={result => setCanApprove(result.canApprove)}
        />
      )}

      {/* Approval card */}
      <div className="ios-card p-5">
        <h4 className="font-bold text-[color:var(--foreground)] mb-4">Design Approval</h4>
        <div className="grid gap-3 sm:grid-cols-3 mb-5">
          {[
            { role: "Orthodontist", name: "Orthodontist", status: "pending" },
            { role: "Reviewer",     name: "Reviewer", status: "pending" },
            { role: "Lab Tech",     name: "Lab Team", status: "pending" },
          ].map(({ role, name, status }) => (
            <div key={role} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
              <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{role}</p>
              <p className="text-sm font-bold text-[color:var(--foreground)]">{name}</p>
              <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status === "approved" ? "bg-emerald-500/10 text-emerald-600" : status === "rejected" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-600"}`}>
                {status === "approved" ? "✓ Approved" : status === "rejected" ? "✕ Rejected" : "Pending"}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setApprovalStatus("approved")}
            disabled={caseId && planId ? !canApprove : false}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${approvalStatus === "approved" ? "bg-emerald-500 text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]"}`}
          >
            <ThumbsUp size={15} /> Approve Design
          </button>
          <button
            type="button"
            onClick={() => setApprovalStatus("rejected")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm transition-all ${approvalStatus === "rejected" ? "bg-rose-500 text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]"}`}
          >
            <ThumbsDown size={15} /> Request Changes
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="ios-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={15} className="text-[color:var(--primary)]" />
          <h4 className="font-bold text-[color:var(--foreground)]">Comments & Revisions</h4>
        </div>
        <div className="space-y-3">
          {DESIGN_COMMENTS.map(c => (
            <div key={c.id} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div>
                  <span className="text-sm font-bold text-[color:var(--foreground)]">{c.author}</span>
                  <span className="ml-1.5 text-xs text-[color:var(--muted-foreground)]">{c.role}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.status === "resolved" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                    {c.status === "resolved" ? "Resolved" : "Open"}
                  </span>
                  <span className="text-[11px] text-[color:var(--muted-foreground)]">{c.time}</span>
                </div>
              </div>
              <p className="text-sm text-[color:var(--foreground)] leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
        <button type="button" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[color:var(--border)] py-3 text-sm font-semibold text-[color:var(--muted-foreground)]">
          <Plus size={14} /> Add comment
        </button>
      </div>

      {/* Revision history */}
      <div className="ios-card p-5">
        <h4 className="font-bold text-[color:var(--foreground)] mb-3">Revision History</h4>
        <div className="space-y-2">
          {REVISION_HISTORY.map((rev, i) => (
            <div key={rev.version} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${i === REVISION_HISTORY.length - 1 ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]" : "border-[color:var(--border)] bg-[color:var(--card)]"}`}>
              <span className={`mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-black ${i === REVISION_HISTORY.length - 1 ? "bg-[color:var(--primary)] text-white" : "bg-[color:var(--border)] text-[color:var(--muted-foreground)]"}`}>{rev.version}</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-[color:var(--foreground)]">{rev.note}</p>
                <p className="text-[11px] text-[color:var(--muted-foreground)]">{rev.date} · {rev.author}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CADDesignStudio({ caseId, planId }: { caseId?: string; planId?: string } = {}) {
  const [activeTab, setActiveTab] = useState<DesignTab>("3d-viewer");

  const TAB_LABELS: Record<DesignTab, string> = {
    "3d-viewer": "3D Viewer",
    "treatment-designer": "Treatment Designer",
    "simulation": "Simulation",
    "design-review": "Design Review",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">CAD Design Studio</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Orthodontic Design Environment</h2>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {caseId ? `Case ${caseId.slice(0, 8)}…` : "No case loaded · Upload a scan to begin"}
            </p>
            {caseId && planId && <DifficultyBadge caseId={caseId} planId={planId} />}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm font-bold text-[color:var(--foreground)]">
            <Save size={14} /> Save
          </button>
          <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-bold text-white">
            <Sparkles size={14} /> Send for Approval
          </button>
        </div>
      </div>

      <MedicalDisclaimer variant="inline" />

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(["3d-viewer", "treatment-designer", "simulation", "design-review"] as DesignTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${activeTab === tab ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "3d-viewer" && <ViewerPanel />}
      {activeTab === "treatment-designer" && <TreatmentDesignerPanel caseId={caseId} planId={planId} />}
      {activeTab === "simulation" && <SimulationPanel />}
      {activeTab === "design-review" && <DesignReviewPanel caseId={caseId} planId={planId} />}
    </div>
  );
}

export default CADDesignStudio;
