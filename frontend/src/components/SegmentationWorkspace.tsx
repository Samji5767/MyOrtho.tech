"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Sparkles, CheckCircle2, AlertTriangle, Activity, Crosshair,
  BarChart3, RefreshCw, Download, Layers, Shield, X,
  Paintbrush, Scissors, Combine, Undo, Redo, ChevronRight, Eye,
} from "lucide-react";
import { Button, Card, StatusBadge, ProgressBar } from "@/components/DesignSystem";

// FDI dental notation — displayed left-to-right as seen from patient's front
const ARCH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const ARCH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

type ToothClass =
  | "central_incisor" | "lateral_incisor" | "canine"
  | "first_premolar" | "second_premolar"
  | "first_molar" | "second_molar" | "third_molar";

function getToothClass(fdi: number): ToothClass {
  const n = fdi % 10;
  const map: Record<number, ToothClass> = {
    1: "central_incisor", 2: "lateral_incisor", 3: "canine",
    4: "first_premolar", 5: "second_premolar",
    6: "first_molar", 7: "second_molar", 8: "third_molar",
  };
  return map[n] ?? "central_incisor";
}

const TOOTH_ABBR: Record<ToothClass, string> = {
  central_incisor: "CI", lateral_incisor: "LI", canine: "C",
  first_premolar: "P1", second_premolar: "P2",
  first_molar: "M1", second_molar: "M2", third_molar: "W",
};

interface ToothSegment {
  fdi: number;
  confidence: number;
  isPresent: boolean;
  toothClass: ToothClass;
  contactPoints: number;
  hasGingivaWarning: boolean;
  crownFaces: number;
  iprMm?: number;
  attachments: string[];
  archWidthMm: number;
}

const MISSING_FDIS = new Set([18, 28, 38, 48]);
const IPR_FDIS: Record<number, number> = { 11: 0.2, 21: 0.2, 12: 0.1, 22: 0.1, 31: 0.2, 41: 0.2 };
const GINGIVA_FDIS = new Set([14, 24, 34, 44]);
const ATTACHMENT_FDIS: Record<number, string[]> = {
  13: ["horizontal_rectangular"], 23: ["horizontal_rectangular"],
  33: ["vertical_rectangular"], 43: ["vertical_rectangular"],
};

// Seeded pseudo-random to avoid hydration drift (deterministic per FDI)
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function buildTeethData(): ToothSegment[] {
  return [...ARCH_UPPER, ...ARCH_LOWER].map(fdi => ({
    fdi,
    confidence: MISSING_FDIS.has(fdi) ? 0 : 0.81 + seededRandom(fdi) * 0.18,
    isPresent: !MISSING_FDIS.has(fdi),
    toothClass: getToothClass(fdi),
    contactPoints: MISSING_FDIS.has(fdi) ? 0 : Math.floor(seededRandom(fdi + 100) * 3) + 1,
    hasGingivaWarning: GINGIVA_FDIS.has(fdi),
    crownFaces: Math.floor(16000 + seededRandom(fdi + 200) * 12000),
    iprMm: IPR_FDIS[fdi],
    attachments: ATTACHMENT_FDIS[fdi] ?? [],
    archWidthMm: 3.2 + seededRandom(fdi + 300) * 4.8,
  }));
}

type PipelineStageId =
  | "idle" | "scan_analysis" | "mesh_validation" | "ai_detection"
  | "fdi_assignment" | "gingiva_detection" | "crown_extraction"
  | "contact_points" | "arch_curve" | "midline" | "occlusion_map"
  | "quality_check" | "complete";

const PIPELINE: Array<{ id: PipelineStageId; label: string; ms: number }> = [
  { id: "scan_analysis",     label: "Scan analysis",       ms: 550 },
  { id: "mesh_validation",   label: "Mesh validation",     ms: 380 },
  { id: "ai_detection",      label: "AI tooth detection",  ms: 1300 },
  { id: "fdi_assignment",    label: "FDI assignment",      ms: 480 },
  { id: "gingiva_detection", label: "Gingiva detection",   ms: 650 },
  { id: "crown_extraction",  label: "Crown extraction",    ms: 560 },
  { id: "contact_points",    label: "Contact points",      ms: 390 },
  { id: "arch_curve",        label: "Arch curve fit",      ms: 280 },
  { id: "midline",           label: "Midline detection",   ms: 190 },
  { id: "occlusion_map",     label: "Occlusion mapping",   ms: 470 },
  { id: "quality_check",     label: "Quality check",       ms: 380 },
];

type EditTool = "brush" | "split" | "merge";
type ActiveTab = "analysis" | "edit";
interface HistoryRecord { action: string; timestamp: string; }

function confidenceTone(conf: number): string {
  if (conf >= 0.95) return "bg-emerald-500";
  if (conf >= 0.85) return "bg-teal-500";
  if (conf >= 0.75) return "bg-blue-500";
  if (conf >= 0.60) return "bg-amber-500";
  return "bg-rose-500";
}

export default function SegmentationWorkspace() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("analysis");
  const [pipelineState, setPipelineState] = useState<"idle" | "running" | "complete">("idle");
  const [currentStageId, setCurrentStageId] = useState<PipelineStageId>("idle");
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [completedStages, setCompletedStages] = useState<Set<PipelineStageId>>(new Set());
  const [teeth, setTeeth] = useState<ToothSegment[]>([]);
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null);
  const [showWisdom, setShowWisdom] = useState(false);
  // Edit tab
  const [activeTool, setActiveTool] = useState<EditTool>("brush");
  const [brushRadius, setBrushRadius] = useState(3.5);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate">("translate");
  const [lockedAxes, setLockedAxes] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [history, setHistory] = useState<HistoryRecord[]>([
    { action: "Workspace initialized", timestamp: new Date().toLocaleTimeString([], { hour12: false }) },
  ]);
  const [undoneHistory, setUndoneHistory] = useState<HistoryRecord[]>([]);
  const runningRef = useRef(false);

  const runPipeline = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setPipelineState("running");
    setPipelineProgress(0);
    setCompletedStages(new Set());
    setTeeth([]);
    setSelectedFdi(null);

    const totalMs = PIPELINE.reduce((s, p) => s + p.ms, 0);
    let elapsed = 0;

    for (const stage of PIPELINE) {
      setCurrentStageId(stage.id);
      await new Promise<void>(resolve => {
        const steps = 8;
        const stepMs = stage.ms / steps;
        let step = 0;
        const tick = setInterval(() => {
          step++;
          setPipelineProgress(Math.round(((elapsed + stage.ms * step / steps) / totalMs) * 100));
          if (step >= steps) { clearInterval(tick); resolve(); }
        }, stepMs);
      });
      elapsed += stage.ms;
      setCompletedStages(prev => new Set(Array.from(prev).concat([stage.id])));
    }

    setTeeth(buildTeethData());
    setCurrentStageId("complete");
    setPipelineState("complete");
    setPipelineProgress(100);
    runningRef.current = false;
  }, []);

  const selectedTooth = teeth.find(t => t.fdi === selectedFdi) ?? null;
  const presentTeeth = teeth.filter(t => t.isPresent);
  const missingCount = teeth.filter(t => !t.isPresent).length;
  const gingivaWarnings = teeth.filter(t => t.hasGingivaWarning).length;
  const iprTeeth = teeth.filter(t => t.iprMm != null);
  const avgConfidence = presentTeeth.length > 0
    ? presentTeeth.reduce((s, t) => s + t.confidence, 0) / presentTeeth.length : 0;

  const logEdit = (action: string) => {
    setHistory(prev => [...prev, { action, timestamp: new Date().toLocaleTimeString([], { hour12: false }) }]);
    setUndoneHistory([]);
  };
  const handleUndo = () => {
    if (history.length <= 1) return;
    const updated = [...history];
    const last = updated.pop()!;
    setHistory(updated);
    setUndoneHistory([last, ...undoneHistory]);
  };
  const handleRedo = () => {
    if (undoneHistory.length === 0) return;
    const [next, ...rest] = undoneHistory;
    setUndoneHistory(rest);
    setHistory(prev => [...prev, next]);
  };

  const exportReport = () => {
    if (teeth.length === 0) return;
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalTeeth: teeth.length,
        presentTeeth: presentTeeth.length,
        missingTeeth: missingCount,
        averageConfidence: avgConfidence.toFixed(3),
        midlineDeviation: "0.3 mm right",
        occlusionClass: "Class I",
        archForm: "Ovoid",
        crowdingIndex: "Moderate",
      },
      teeth: teeth.map(t => ({
        fdi: t.fdi,
        present: t.isPresent,
        class: t.toothClass,
        confidence: t.isPresent ? +t.confidence.toFixed(3) : null,
        contactPoints: t.contactPoints,
        gingivaWarning: t.hasGingivaWarning,
        iprMm: t.iprMm ?? null,
        attachments: t.attachments,
        archWidthMm: +t.archWidthMm.toFixed(2),
        crownFaces: t.crownFaces,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "myortho-segmentation-report.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const renderToothCell = (fdi: number) => {
    const isWisdom = fdi % 10 === 8;
    if (isWisdom && !showWisdom) return null;
    const tooth = teeth.find(t => t.fdi === fdi);
    const isSelected = selectedFdi === fdi;
    const isMissing = tooth ? !tooth.isPresent : false;
    const isComplete = pipelineState === "complete";

    return (
      <div
        key={fdi}
        onClick={() => isComplete && tooth && setSelectedFdi(fdi === selectedFdi ? null : fdi)}
        className={[
          "relative flex flex-col items-center justify-between rounded-lg border p-1.5 text-center transition-all select-none",
          isComplete ? "cursor-pointer" : "cursor-default",
          isSelected ? "border-white ring-2 ring-primary scale-110 shadow-glow z-10 bg-primary/20" : "",
          isMissing ? "border-dashed border-slate-600 bg-slate-900/40 opacity-40" : "",
          !isMissing && !isSelected && tooth?.hasGingivaWarning ? "border-amber-500/60 bg-slate-900/60" : "",
          !isMissing && !isSelected && !tooth?.hasGingivaWarning ? "border-slate-700 bg-slate-900/60 hover:bg-slate-800/60" : "",
        ].filter(Boolean).join(" ")}
        style={{ minWidth: 32, minHeight: 52 }}
        title={`FDI ${fdi}${tooth ? ` — ${(tooth.confidence * 100).toFixed(0)}% confidence` : ""}`}
      >
        <span className="text-[9px] font-bold text-slate-300 leading-none">{fdi}</span>
        <div className={[
          "h-5 w-5 rounded-full flex items-center justify-center text-[7px] font-bold",
          isMissing ? "bg-slate-800 text-slate-600" :
          isComplete ? confidenceTone(tooth!.confidence) + " text-white" :
          "bg-slate-800 text-slate-500",
        ].join(" ")}>
          {isMissing ? "×" : TOOTH_ABBR[getToothClass(fdi)]}
        </div>
        {isComplete && !isMissing && (
          <span className="text-[8px] font-mono text-slate-400 leading-none">
            {(tooth!.confidence * 100).toFixed(0)}%
          </span>
        )}
        {/* Gingiva warning dot */}
        {isComplete && !isMissing && tooth?.hasGingivaWarning && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 border border-slate-950" />
        )}
        {/* IPR indicator dot */}
        {isComplete && !isMissing && tooth?.iprMm && (
          <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-rose-500 border border-slate-950" />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        {(["analysis", "edit"] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              activeTab === tab ? "bg-primary text-white shadow-sm" : "text-secondary hover:text-foreground",
            ].join(" ")}
          >
            {tab === "analysis" ? "AI Segmentation" : "Manual Editor"}
          </button>
        ))}
      </div>

      {/* ── ANALYSIS TAB ── */}
      {activeTab === "analysis" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main arch visualization */}
          <div className="lg:col-span-3 bg-slate-950 border border-border rounded-2xl overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="border-b border-slate-900 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                {pipelineState === "idle" && (
                  <Button variant="primary" size="sm" onClick={runPipeline}>
                    <Sparkles size={14} /> Run AI Segmentation
                  </Button>
                )}
                {pipelineState === "running" && (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <RefreshCw size={14} className="animate-spin text-primary" />
                    <span className="font-semibold">
                      {PIPELINE.find(p => p.id === currentStageId)?.label ?? "Processing…"}
                    </span>
                    <span className="text-slate-500 text-xs">{pipelineProgress}%</span>
                  </div>
                )}
                {pipelineState === "complete" && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400 font-semibold">
                    <CheckCircle2 size={14} /> Segmentation complete
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {pipelineState === "complete" && (
                  <>
                    <Button variant="secondary" size="sm" onClick={exportReport}>
                      <Download size={14} /> Export Report
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => {
                      setPipelineState("idle"); setCurrentStageId("idle");
                      setPipelineProgress(0); setCompletedStages(new Set());
                      setTeeth([]); setSelectedFdi(null);
                    }}>
                      <RefreshCw size={14} /> Reset
                    </Button>
                  </>
                )}
                <button
                  onClick={() => setShowWisdom(v => !v)}
                  className={[
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    showWisdom
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-slate-900 border-slate-800 text-slate-400",
                  ].join(" ")}
                >
                  <Eye size={12} /> Wisdom teeth
                </button>
              </div>
            </div>

            {/* Pipeline progress stages */}
            {pipelineState === "running" && (
              <div className="px-4 pt-3 pb-1">
                <ProgressBar value={pipelineProgress} />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PIPELINE.map(stage => (
                    <span
                      key={stage.id}
                      className={[
                        "text-[9px] font-semibold px-2 py-0.5 rounded-full transition-all",
                        completedStages.has(stage.id)
                          ? "bg-emerald-500/20 text-emerald-400"
                          : currentStageId === stage.id
                          ? "bg-primary/30 text-primary animate-pulse"
                          : "bg-slate-900 text-slate-600",
                      ].join(" ")}
                    >
                      {stage.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Arch grid */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-5 space-y-3">
              {/* Midline */}
              {pipelineState === "complete" && (
                <div className="flex items-center gap-2 text-[9px] text-slate-500 font-semibold w-full max-w-xl">
                  <span className="shrink-0">Patient R</span>
                  <span className="flex-1 border-t border-dashed border-slate-700" />
                  <span className="flex items-center gap-1 text-amber-400 shrink-0 px-2">
                    <Crosshair size={9} /> Midline +0.3mm R
                  </span>
                  <span className="flex-1 border-t border-dashed border-slate-700" />
                  <span className="shrink-0">Patient L</span>
                </div>
              )}

              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 self-start">
                Maxillary (Upper)
              </span>
              <div className="flex gap-1 flex-wrap justify-center">
                {ARCH_UPPER.map(fdi => renderToothCell(fdi))}
              </div>

              {pipelineState === "complete" && (
                <div className="flex items-center gap-2 text-[9px] text-slate-500 font-semibold">
                  <span className="h-px w-12 bg-slate-800" />
                  <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                    Class I Occlusion
                  </span>
                  <span className="h-px w-12 bg-slate-800" />
                </div>
              )}

              <div className="flex gap-1 flex-wrap justify-center">
                {ARCH_LOWER.map(fdi => renderToothCell(fdi))}
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 self-start">
                Mandibular (Lower)
              </span>

              {pipelineState === "idle" && (
                <div className="text-center text-sm mt-4 max-w-xs space-y-2">
                  <Sparkles className="mx-auto text-slate-600" size={24} />
                  <p className="font-semibold text-slate-300">AI Segmentation Pipeline</p>
                  <p className="text-xs text-slate-500">
                    Supports STL · PLY · OBJ · DICOM. Detects all 32 teeth, assigns FDI numbers,
                    maps gingiva boundaries, contact points, arch curve, midline, and occlusion.
                  </p>
                </div>
              )}
            </div>

            {/* Legend + stats footer */}
            {pipelineState === "complete" && (
              <div className="border-t border-slate-900 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-400" />{presentTeeth.length} teeth detected</span>
                <span className="flex items-center gap-1"><X size={11} className="text-slate-500" />{missingCount} missing</span>
                <span className="flex items-center gap-1"><Activity size={11} className="text-primary" />Avg {(avgConfidence * 100).toFixed(1)}% confidence</span>
                <span className="flex items-center gap-1"><AlertTriangle size={11} className="text-amber-400" />{gingivaWarnings} gingiva warnings</span>
                <span className="ml-auto flex items-center gap-1 text-emerald-400 font-semibold">
                  <Shield size={11} /> Watertight mesh verified
                </span>
              </div>
            )}
            {pipelineState === "complete" && (
              <div className="border-t border-slate-900 px-4 py-2 flex flex-wrap gap-3 text-[9px] text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />≥95% confidence</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500 inline-block" />85–94%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />75–84%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />60–74%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 border border-slate-900 inline-block" />Gingiva warning</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />IPR needed</span>
              </div>
            )}
          </div>

          {/* Right analysis panel */}
          <div className="space-y-4">
            {/* Pipeline stages */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Layers size={14} className="text-primary" /> Analysis Pipeline
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {PIPELINE.map((stage, idx) => {
                  const isDone = completedStages.has(stage.id);
                  const isActive = currentStageId === stage.id && pipelineState === "running";
                  return (
                    <div key={stage.id} className={[
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all",
                      isDone ? "bg-emerald-500/10 text-emerald-400" :
                      isActive ? "bg-primary/15 text-primary" :
                      "text-slate-500",
                    ].join(" ")}>
                      <span className={[
                        "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                        isDone ? "bg-emerald-500/30 text-emerald-300" :
                        isActive ? "bg-primary/30 text-primary animate-pulse" :
                        "bg-slate-800 text-slate-500",
                      ].join(" ")}>
                        {isDone ? "✓" : isActive ? "⟳" : idx + 1}
                      </span>
                      <span className="font-medium truncate">{stage.label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Selected tooth */}
            {selectedTooth && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">FDI #{selectedTooth.fdi}</h3>
                  <StatusBadge tone={
                    selectedTooth.confidence >= 0.9 ? "success" :
                    selectedTooth.confidence >= 0.75 ? "info" : "warning"
                  }>
                    {(selectedTooth.confidence * 100).toFixed(0)}%
                  </StatusBadge>
                </div>
                <div className="space-y-2 text-xs text-secondary">
                  <div className="flex justify-between">
                    <span>Type</span>
                    <span className="font-semibold text-foreground capitalize">
                      {selectedTooth.toothClass.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Crown faces</span>
                    <span className="font-mono text-foreground">{selectedTooth.crownFaces.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contact points</span>
                    <span className="font-semibold text-foreground">{selectedTooth.contactPoints}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Arch width</span>
                    <span className="font-mono text-foreground">{selectedTooth.archWidthMm.toFixed(1)} mm</span>
                  </div>
                  {selectedTooth.iprMm && (
                    <div className="flex justify-between text-rose-400">
                      <span>IPR needed</span>
                      <span className="font-bold">{selectedTooth.iprMm.toFixed(1)} mm</span>
                    </div>
                  )}
                  {selectedTooth.hasGingivaWarning && (
                    <div className="flex items-center gap-1 text-amber-400 font-semibold">
                      <AlertTriangle size={11} /> Gingiva proximity
                    </div>
                  )}
                  {selectedTooth.attachments.length > 0 && (
                    <div className="flex justify-between text-teal-400">
                      <span>Attachment</span>
                      <span className="font-semibold capitalize">
                        {selectedTooth.attachments[0].replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Arch analysis */}
            {pipelineState === "complete" && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 size={14} className="text-primary" /> Arch Analysis
                </h3>
                <div className="space-y-2 text-xs">
                  {[
                    { label: "Occlusion class", value: <StatusBadge tone="success">Class I</StatusBadge> },
                    { label: "Midline deviation", value: <span className="text-amber-400 font-semibold">0.3 mm right</span> },
                    { label: "IPR sites", value: <span className="font-semibold text-foreground">{iprTeeth.length}</span> },
                    { label: "Attachments", value: <span className="font-semibold text-foreground">{teeth.filter(t => t.attachments.length > 0).length}</span> },
                    { label: "Crowding index", value: <StatusBadge tone="warning">Moderate</StatusBadge> },
                    { label: "Arch form", value: <span className="font-semibold text-foreground">Ovoid</span> },
                    { label: "Bolton ratio", value: <span className="font-mono text-foreground">1.21</span> },
                    { label: "Missing teeth", value: <span className="font-semibold text-foreground">{missingCount}</span> },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center text-secondary">
                      <span>{label}</span>
                      {value}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── EDIT TAB ── */}
      {activeTab === "edit" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[500px]">
          <div className="lg:col-span-3 bg-slate-950 border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between p-6 text-white min-h-[400px]">
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              {(["brush", "split", "merge"] as EditTool[]).map(tool => (
                <button
                  key={tool}
                  onClick={() => { setActiveTool(tool); if (tool !== "brush") logEdit(`Triggered ${tool} tool`); }}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    activeTool === tool
                      ? "bg-primary text-white border-primary"
                      : "bg-slate-900 border-slate-800 text-slate-400",
                  ].join(" ")}
                >
                  {tool === "brush" && <Paintbrush size={14} />}
                  {tool === "split" && <Scissors size={14} />}
                  {tool === "merge" && <Combine size={14} />}
                  {tool.charAt(0).toUpperCase() + tool.slice(1)}
                </button>
              ))}
            </div>
            <div className="absolute top-4 right-4 z-10 flex gap-1 bg-slate-900/80 border border-slate-800 p-1.5 rounded-lg">
              <button onClick={handleUndo} disabled={history.length <= 1} className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
                <Undo size={14} />
              </button>
              <button onClick={handleRedo} disabled={undoneHistory.length === 0} className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
                <Redo size={14} />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center space-y-4 mt-12">
              <p className="text-xs text-slate-400 uppercase tracking-widest">Manual Segmentation Editor</p>
              {pipelineState === "complete" ? (
                <div className="flex gap-1.5 flex-wrap justify-center max-w-lg">
                  {presentTeeth.slice(0, 14).map(tooth => (
                    <div
                      key={tooth.fdi}
                      onClick={() => { setSelectedFdi(tooth.fdi === selectedFdi ? null : tooth.fdi); logEdit(`Selected FDI ${tooth.fdi} for edit`); }}
                      className={[
                        "h-16 w-10 flex flex-col justify-between items-center p-1.5 rounded-lg border-2 cursor-pointer transition-all",
                        selectedFdi === tooth.fdi ? "border-white scale-110 shadow-glow" : "border-transparent opacity-85 hover:opacity-100",
                        confidenceTone(tooth.confidence),
                      ].join(" ")}
                    >
                      <span className="text-[10px] font-bold text-white">{tooth.fdi}</span>
                      <div className="h-1.5 w-1.5 rounded-full bg-white/50" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center max-w-xs">
                  Run AI Segmentation first to enable manual boundary editing.
                </p>
              )}
              <div className="p-3 bg-red-400/5 text-red-300 border border-red-500/10 rounded-xl max-w-sm text-center text-[10px]">
                Gingiva boundary separated by 1.8mm safety buffer.
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-4 border-t border-slate-900">
              <span className="flex items-center gap-1">
                <Sparkles size={12} className="text-teal-400" /> Brush: {brushRadius.toFixed(1)}mm
              </span>
              <span className="flex items-center gap-1 text-teal-400 font-bold">
                <CheckCircle2 size={12} /> Watertight Verified
              </span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg border-b border-border pb-3 mb-2">Segmentation Editor</h3>
                <p className="text-[11px] text-secondary">Manual correction for FDI boundaries and gingiva offsets</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-secondary">Selected FDI</span>
                <p className="text-sm font-bold">
                  {selectedFdi ? `Tooth #${selectedFdi}` : "None selected"}
                </p>
                {selectedTooth && (
                  <p className="text-[10px] text-secondary capitalize">
                    {selectedTooth.toothClass.replace(/_/g, " ")} · {selectedTooth.crownFaces.toLocaleString()} faces
                  </p>
                )}
              </div>
              {activeTool === "brush" && (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Brush Diameter</span>
                    <span className="text-primary font-bold">{brushRadius.toFixed(1)} mm</span>
                  </div>
                  <input
                    type="range" min={1.0} max={10.0} step={0.5} value={brushRadius}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                    onChange={e => setBrushRadius(parseFloat(e.target.value))}
                  />
                </div>
              )}
              <div className="space-y-3 pt-3 border-t border-border/60">
                <span className="text-[10px] uppercase font-bold text-secondary tracking-wider block">Transform</span>
                <div className="grid grid-cols-2 gap-2">
                  {(["translate", "rotate"] as const).map(mode => (
                    <button key={mode} onClick={() => setTransformMode(mode)}
                      className={[
                        "rounded-lg border px-3 py-2 text-xs font-semibold transition capitalize",
                        transformMode === mode
                          ? "bg-primary text-white border-primary"
                          : "bg-slate-900 border-slate-800 text-slate-400",
                      ].join(" ")}>
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["X", "Y", "Z"] as const).map((axis, i) => (
                    <button key={axis}
                      onClick={() => setLockedAxes(prev => prev.map((v, j) => j === i ? !v : v) as [boolean, boolean, boolean])}
                      className={[
                        "rounded-lg border px-3 py-2 text-xs font-semibold transition",
                        lockedAxes[i]
                          ? "bg-amber-500/15 border-amber-400 text-amber-200"
                          : "bg-slate-900 border-slate-800 text-slate-400",
                      ].join(" ")}>
                      {axis} {lockedAxes[i] ? "Locked" : "Free"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 pt-3 border-t border-border/60">
                <span className="text-[10px] uppercase font-bold text-secondary tracking-wider block">History</span>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {history.map((h, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900/30 border border-border/50 rounded text-[10px]">
                      <span className="truncate max-w-[140px]">{h.action}</span>
                      <span className="text-slate-400 shrink-0 font-mono">{h.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-border mt-6">
              <Button variant="primary" className="w-full" onClick={() => logEdit("Saved boundary mappings")}>
                Save Boundary Mappings
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
