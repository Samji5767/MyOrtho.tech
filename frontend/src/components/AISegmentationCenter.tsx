"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Crosshair,
  Eye,
  Layers3,
  Loader2,
  RotateCcw,
  Scan,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import type { SegmentationResult, ToothSegment } from "@/types/orthodontic";
import { FDI_LOWER, FDI_UPPER, toothClassName } from "@/types/orthodontic";

// ─── Deterministic mock data (seeded by FDI to avoid hydration issues) ────────

function seeded(fdi: number, range: number): number {
  return ((fdi * 9301 + 49297) % 233280) / 233280 * range;
}

const FLAGGED_FDIS = new Set([14, 21]);
const MISSING_FDIS = new Set([18, 28, 38, 48]);
const ATTACHMENT_FDIS = new Set([13, 23, 43, 33]);
const IPR_FDIS = new Set([12, 11, 22, 21]);

function makeTooth(fdi: number): ToothSegment {
  const isUpper = FDI_UPPER.includes(fdi);
  return {
    fdi,
    arch: isUpper ? "maxillary" : "mandibular",
    toothClass: toothClassName(fdi),
    confidence: FLAGGED_FDIS.has(fdi) ? 68 + Math.round(seeded(fdi, 15)) : 88 + Math.round(seeded(fdi, 11)),
    isPresent: !MISSING_FDIS.has(fdi),
    isMissing: MISSING_FDIS.has(fdi),
    isExtracted: false,
    hasRootFlag: FLAGGED_FDIS.has(fdi),
    hasGingivaWarning: seeded(fdi, 10) < 1.5,
    contactPoints: 2 + Math.round(seeded(fdi, 2)),
    crownFaces: 4 + Math.round(seeded(fdi, 3)),
    archWidthMm: 60 + seeded(fdi, 12),
    iprMm: IPR_FDIS.has(fdi) ? 0.3 + seeded(fdi, 0.4) : undefined,
    attachments: ATTACHMENT_FDIS.has(fdi) ? ["Rectangular horizontal"] : [],
    position: { x: seeded(fdi, 40) - 20, y: seeded(fdi, 15), z: isUpper ? 5 : -5 },
  };
}

const ALL_TEETH: ToothSegment[] = [...FDI_UPPER, ...FDI_LOWER].map(makeTooth);

const MOCK_RESULT: SegmentationResult = {
  id: "seg-001",
  caseId: "",
  scanId: "scn-01",
  status: "review_needed",
  overallConfidence: 81.4,
  teeth: ALL_TEETH,
  landmarks: [
    { id: "lm-01", type: "cusp",        fdi: 13, coordinates: { x: -18, y: 8, z: 4  }, confidence: 94 },
    { id: "lm-02", type: "cusp",        fdi: 23, coordinates: { x: 18,  y: 8, z: 4  }, confidence: 93 },
    { id: "lm-03", type: "incisal_edge",fdi: 11, coordinates: { x: -2,  y: 12, z: 3 }, confidence: 97 },
    { id: "lm-04", type: "incisal_edge",fdi: 21, coordinates: { x: 2,   y: 12, z: 3 }, confidence: 91 },
    { id: "lm-05", type: "contact_point",fdi:12, coordinates: { x: -7,  y: 10, z: 3 }, confidence: 89 },
    { id: "lm-06", type: "fossa",       fdi: 16, coordinates: { x: -28, y: 2,  z: 2 }, confidence: 85 },
    { id: "lm-07", type: "fossa",       fdi: 26, coordinates: { x: 28,  y: 2,  z: 2 }, confidence: 86 },
  ],
  occlusalPlane: { a: 0.02, b: 0.03, c: 1, d: -4.2 },
  midlineDeviation: -0.8,
  arch: { upperWidth: 64.2, lowerWidth: 61.8, overjet: 3.0, overbite: 2.0 },
  processingTimeMs: 252000,
  reviewNotes: "Root anatomy flagged on teeth 14 and 21. Manual segmentation correction recommended before proceeding to CAD.",
  createdAt: "2024-06-21 10:34",
};

// ─── ToothInspector ───────────────────────────────────────────────────────────

function ToothInspector({ tooth }: { tooth: ToothSegment }) {
  const conf = tooth.confidence;
  const confColor = conf >= 90 ? "text-emerald-600" : conf >= 80 ? "text-teal-600" : conf >= 70 ? "text-amber-600" : "text-rose-500";

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <span className="text-xl font-black tabular-nums text-[color:var(--primary)]">{tooth.fdi}</span>
          <p className="text-xs text-[color:var(--muted-foreground)] capitalize">{tooth.toothClass.replace(/_/g, " ")}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {tooth.isMissing && <span className="rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Missing</span>}
          {tooth.hasRootFlag && <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-500">Root Flag</span>}
          {tooth.hasGingivaWarning && <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">Gingiva</span>}
          {tooth.attachments.length > 0 && <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">Attachment</span>}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-[color:var(--muted-foreground)]">Confidence</span>
          <span className={`font-bold ${confColor}`}>{conf.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[color:var(--border)]">
          <div className={`h-full rounded-full transition-all ${conf >= 90 ? "bg-emerald-500" : conf >= 80 ? "bg-teal-500" : conf >= 70 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${conf}%` }} />
        </div>
        {tooth.iprMm != null && <p className="text-xs text-amber-600"><span className="font-bold">IPR:</span> {tooth.iprMm.toFixed(2)} mm</p>}
        {tooth.attachments.length > 0 && <p className="text-xs text-violet-600"><span className="font-bold">Att:</span> {tooth.attachments[0]}</p>}
        <p className="text-xs text-[color:var(--muted-foreground)]">Crown faces: {tooth.crownFaces} · Contact pts: {tooth.contactPoints}</p>
      </div>
    </div>
  );
}

// ─── Arch map (visual tooth grid) ────────────────────────────────────────────

function ArchMap({ teeth, onSelect, selectedFdi }: { teeth: ToothSegment[]; onSelect: (t: ToothSegment) => void; selectedFdi: number | null }) {
  const upper = [...FDI_UPPER].reverse();
  const lower = FDI_LOWER;

  function toothCell(fdi: number) {
    const tooth = teeth.find(t => t.fdi === fdi);
    if (!tooth) return null;
    const conf = tooth.confidence;
    let cellColor = "bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/30";
    if (!tooth.isPresent) cellColor = "bg-slate-500/10 border-slate-300/30 hover:bg-slate-500/20";
    else if (tooth.hasRootFlag) cellColor = "bg-rose-500/20 border-rose-500/40 hover:bg-rose-500/30";
    else if (tooth.hasGingivaWarning || conf < 80) cellColor = "bg-amber-500/20 border-amber-500/30 hover:bg-amber-500/30";
    const isSelected = selectedFdi === fdi;

    return (
      <button
        key={fdi}
        type="button"
        onClick={() => onSelect(tooth)}
        title={`FDI ${fdi} — Confidence ${conf.toFixed(0)}%`}
        className={`relative flex h-9 w-9 flex-col items-center justify-center rounded-lg border text-[10px] font-black transition-all ${cellColor} ${isSelected ? "ring-2 ring-[color:var(--primary)] ring-offset-1" : ""}`}
      >
        <span className={tooth.isPresent ? "text-[color:var(--foreground)]" : "text-slate-400"}>{fdi}</span>
        {tooth.attachments.length > 0 && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-violet-500" />}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">Arch Map — FDI Notation</p>
      {/* Upper arch */}
      <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)] mb-1.5">Maxillary (Upper)</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {upper.map(fdi => toothCell(fdi))}
      </div>
      <div className="my-2 h-px bg-[color:var(--border)]" />
      {/* Lower arch */}
      <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)] mb-1.5">Mandibular (Lower)</p>
      <div className="flex flex-wrap gap-1">
        {lower.map(fdi => toothCell(fdi))}
      </div>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {[
          { color: "bg-emerald-500/30", label: "Segmented" },
          { color: "bg-amber-500/30",   label: "Low confidence / Gingiva" },
          { color: "bg-rose-500/30",    label: "Root flag" },
          { color: "bg-slate-500/10",   label: "Missing" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm border border-[color:var(--border)] ${l.color}`} />
            <span className="text-[10px] text-[color:var(--muted-foreground)]">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LandmarkViewer ───────────────────────────────────────────────────────────

function LandmarkViewer({ result }: { result: SegmentationResult }) {
  const LANDMARK_LABELS: Record<string, string> = {
    cusp: "Cusp tip",
    incisal_edge: "Incisal edge",
    contact_point: "Contact point",
    fossa: "Central fossa",
    marginal_ridge: "Marginal ridge",
  };

  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target size={16} className="text-indigo-500" />
        <h3 className="font-bold text-[color:var(--foreground)]">Landmark Detection</h3>
        <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">{result.landmarks.length} landmarks</span>
      </div>
      <div className="space-y-2">
        {result.landmarks.map((lm) => (
          <div key={lm.id} className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-bold text-[color:var(--primary)]">FDI {lm.fdi}</span>
                <span className="text-sm font-semibold text-[color:var(--foreground)]">{LANDMARK_LABELS[lm.type] ?? lm.type}</span>
              </div>
              <p className="text-xs text-[color:var(--muted-foreground)]">
                x:{lm.coordinates.x.toFixed(1)} y:{lm.coordinates.y.toFixed(1)} z:{lm.coordinates.z.toFixed(1)}
              </p>
            </div>
            <span className={`text-xs font-bold ${lm.confidence >= 90 ? "text-emerald-600" : lm.confidence >= 80 ? "text-amber-600" : "text-rose-500"}`}>
              {lm.confidence}%
            </span>
          </div>
        ))}
      </div>

      {/* Arch measurements */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: "Upper Arch Width",   value: `${result.arch.upperWidth} mm` },
          { label: "Lower Arch Width",   value: `${result.arch.lowerWidth} mm` },
          { label: "Overjet",            value: `${result.arch.overjet} mm` },
          { label: "Overbite",           value: `${result.arch.overbite} mm` },
          { label: "Midline Deviation",  value: `${Math.abs(result.midlineDeviation)} mm ${result.midlineDeviation < 0 ? "(L)" : "(R)"}` },
          { label: "Occlusal Plane",     value: "Detected" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-2.5">
            <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">{label}</p>
            <p className="mt-0.5 text-sm font-bold text-[color:var(--foreground)]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── QualityAssessmentPanel ───────────────────────────────────────────────────

function QualityAssessmentPanel({ result }: { result: SegmentationResult }) {
  const conf = result.overallConfidence;
  const flagCount = result.teeth.filter(t => t.hasRootFlag).length;
  const missingCount = result.teeth.filter(t => t.isMissing).length;
  const gingivaWarnings = result.teeth.filter(t => t.hasGingivaWarning).length;
  const presentTeeth = result.teeth.filter(t => t.isPresent).length;

  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-violet-500" />
        <h3 className="font-bold text-[color:var(--foreground)]">Segmentation Quality</h3>
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${result.status === "review_needed" ? "bg-amber-500/10 text-amber-600" : result.status === "complete" ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"}`}>
          {result.status === "review_needed" ? "Review Required" : result.status === "complete" ? "Approved" : result.status}
        </span>
      </div>

      {/* Overall confidence */}
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">Overall Confidence Score</p>
          <span className={`text-2xl font-black tabular-nums ${conf >= 90 ? "text-emerald-600" : conf >= 80 ? "text-teal-600" : conf >= 70 ? "text-amber-600" : "text-rose-500"}`}>
            {conf.toFixed(1)}%
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-[color:var(--border)]">
          <div className={`h-full rounded-full transition-all ${conf >= 90 ? "bg-emerald-500" : conf >= 80 ? "bg-teal-500" : conf >= 70 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${conf}%` }} />
        </div>
        <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
          Processing time: {(result.processingTimeMs / 1000 / 60).toFixed(1)} min
        </p>
      </div>

      {/* Detection metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Teeth Detected",  value: presentTeeth,      color: "text-emerald-600" },
          { label: "Missing Teeth",   value: missingCount,      color: "text-slate-500" },
          { label: "Root Flags",      value: flagCount,         color: flagCount > 0 ? "text-rose-500" : "text-emerald-600" },
          { label: "Gingiva Warnings",value: gingivaWarnings,   color: gingivaWarnings > 0 ? "text-amber-600" : "text-emerald-600" },
          { label: "Landmarks",       value: result.landmarks.length, color: "text-indigo-600" },
          { label: "Attachments",     value: result.teeth.filter(t => t.attachments.length > 0).length, color: "text-violet-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-3">
            <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">{label}</p>
            <p className={`mt-1 text-xl font-black tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Review notes */}
      {result.reviewNotes && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 px-3 py-3 dark:border-amber-700/40 dark:bg-amber-900/10 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">{result.reviewNotes}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {result.status === "review_needed" && (
          <>
            <button type="button" className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-3 py-2.5 text-sm font-bold text-white">
              <CheckCircle2 size={14} /> Approve Segmentation
            </button>
            <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm font-bold text-[color:var(--foreground)]">
              <RotateCcw size={14} /> Re-run AI
            </button>
          </>
        )}
        {result.status !== "review_needed" && (
          <button type="button" className="flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white">
            <Zap size={14} /> Proceed to CAD
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Pipeline status bar ──────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  "Scan Analysis", "Mesh Validation", "AI Tooth Detection", "FDI Assignment",
  "Gingiva Detection", "Crown Extraction", "Contact Points", "Arch Curve",
  "Midline", "Occlusion Map", "Quality Check",
];

function PipelineStatus({ currentStep = 11 }: { currentStep?: number }) {
  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={15} className="text-violet-500" />
        <h3 className="font-bold text-[color:var(--foreground)]">AI Segmentation Pipeline</h3>
        <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600">Complete</span>
      </div>
      <div className="space-y-2">
        {PIPELINE_STEPS.map((step, i) => {
          const done = i < currentStep;
          return (
            <div key={step} className="flex items-center gap-2.5">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-black ${done ? "bg-emerald-500 text-white" : "border border-[color:var(--border)] text-[color:var(--muted-foreground)]"}`}>
                {done ? "✓" : i + 1}
              </span>
              <span className={`text-sm ${done ? "font-medium text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>{step}</span>
              {done && <CheckCircle2 size={13} className="ml-auto text-emerald-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AISegmentationCenter() {
  const [selectedTooth, setSelectedTooth] = useState<ToothSegment | null>(null);
  const [activeTab, setActiveTab] = useState<"analysis" | "landmarks" | "quality" | "edit">("analysis");

  const result = MOCK_RESULT;
  const conf = result.overallConfidence;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">AI Segmentation Center</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Segmentation Workspace</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Case {result.caseId} · Confidence{" "}
            <span className={`font-bold ${conf >= 90 ? "text-emerald-600" : conf >= 80 ? "text-teal-600" : "text-amber-600"}`}>{conf.toFixed(1)}%</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]">
            <Eye size={13} /> 3D View
          </button>
          <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-3 py-2 text-xs font-bold text-white">
            <Sparkles size={13} /> Re-run AI
          </button>
        </div>
      </div>

      <MedicalDisclaimer variant="inline" />

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(["analysis", "landmarks", "quality", "edit"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all capitalize ${activeTab === tab ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
          >
            {tab === "analysis" ? "Tooth Analysis" : tab === "landmarks" ? "Landmarks" : tab === "quality" ? "Quality" : "Manual Edit"}
          </button>
        ))}
      </div>

      {/* Analysis tab */}
      {activeTab === "analysis" && (
        <div className="space-y-5">
          <ArchMap teeth={result.teeth} onSelect={setSelectedTooth} selectedFdi={selectedTooth?.fdi ?? null} />

          {/* Selected tooth inspector */}
          {selectedTooth ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target size={15} className="text-[color:var(--primary)]" />
                <h3 className="font-bold text-[color:var(--foreground)]">Tooth Inspector — FDI {selectedTooth.fdi}</h3>
                <button type="button" onClick={() => setSelectedTooth(null)} className="ml-auto text-xs text-[color:var(--muted-foreground)]">
                  ✕ Clear
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {[selectedTooth, ...result.teeth.filter(t => t.fdi !== selectedTooth.fdi && t.arch === selectedTooth.arch).slice(0, 7)].map(t => (
                  <ToothInspector key={t.fdi} tooth={t} />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {result.teeth.filter(t => t.hasRootFlag || t.hasGingivaWarning).map(t => (
                <ToothInspector key={t.fdi} tooth={t} />
              ))}
            </div>
          )}
          <PipelineStatus />
        </div>
      )}

      {/* Landmarks tab */}
      {activeTab === "landmarks" && <LandmarkViewer result={result} />}

      {/* Quality tab */}
      {activeTab === "quality" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <QualityAssessmentPanel result={result} />
          <PipelineStatus />
        </div>
      )}

      {/* Manual edit tab */}
      {activeTab === "edit" && (
        <div className="ios-card p-6 text-center">
          <Scan size={32} className="mx-auto mb-3 text-[color:var(--muted-foreground)]" />
          <h3 className="font-bold text-[color:var(--foreground)] mb-2">Manual Segmentation Editor</h3>
          <p className="text-sm text-[color:var(--muted-foreground)] mb-4">
            Use brush, split, and merge tools to correct AI segmentation on flagged teeth.
          </p>
          <div className="flex justify-center gap-2">
            {["Brush", "Split", "Merge"].map(tool => (
              <button key={tool} type="button" className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--primary-glow)]">
                {tool}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">
            3D mesh editor requires desktop Chrome or Safari. Load the desktop workspace for full editing capabilities.
          </p>
        </div>
      )}
    </div>
  );
}

export default AISegmentationCenter;
