"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eraser,
  History,
  Loader2,
  Maximize2,
  Minus,
  Paintbrush,
  Plus,
  RefreshCw,
  Scissors,
  Shuffle,
  Sliders,
  Sparkles,
  Undo2,
  Redo2,
  ZoomIn,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/DesignSystem";
import {
  editMask,
  undoMaskEdit,
  redoMaskEdit,
  getHistoryStack,
  getConfidenceHeatmap,
  type SegmentationMask,
  type MaskEditOperation,
  type MaskRegionType,
  type HistoryEntry,
} from "@/lib/api/segmentation";

// ─── Tool definitions ────────────────────────────────────────────────────────

interface Tool {
  key: MaskEditOperation;
  label: string;
  icon: React.ElementType;
  description: string;
  hasRadius: boolean;
}

const TOOLS: Tool[] = [
  { key: "brush",           label: "Brush",           icon: Paintbrush, description: "Add vertices to mask",              hasRadius: true  },
  { key: "erase",           label: "Erase",           icon: Eraser,     description: "Remove vertices from mask",         hasRadius: true  },
  { key: "grow",            label: "Grow",             icon: Plus,       description: "Expand mask boundary outward",      hasRadius: false },
  { key: "shrink",          label: "Shrink",           icon: Minus,      description: "Contract mask boundary inward",     hasRadius: false },
  { key: "boundary_smooth", label: "Smooth",           icon: Sliders,    description: "Smooth mask boundary",              hasRadius: false },
  { key: "region_grow",     label: "Region Grow",      icon: Maximize2,  description: "Flood-fill from seed vertex",       hasRadius: false },
  { key: "merge",           label: "Smart Merge",      icon: Shuffle,    description: "Merge adjacent tooth masks",        hasRadius: false },
  { key: "split",           label: "Smart Split",      icon: Scissors,   description: "Split mask at a plane",             hasRadius: false },
];

const REGION_TYPES: { key: MaskRegionType; label: string }[] = [
  { key: "crown",          label: "Crown" },
  { key: "root",           label: "Root" },
  { key: "gingiva",        label: "Gingiva" },
  { key: "implant",        label: "Implant" },
  { key: "restoration",    label: "Restoration" },
  { key: "supernumerary",  label: "Supernumerary" },
];

// ─── Confidence heatmap legend ────────────────────────────────────────────────

function HeatmapLegend() {
  const stops = [
    { pct: 0,   label: "0%",   cls: "bg-red-500" },
    { pct: 50,  label: "50%",  cls: "bg-amber-500" },
    { pct: 80,  label: "80%",  cls: "bg-yellow-400" },
    { pct: 100, label: "100%", cls: "bg-emerald-500" },
  ];
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
        Confidence
      </span>
      <div className="flex items-center gap-1">
        {stops.map((s) => (
          <div key={s.pct} className="flex flex-col items-center gap-0.5">
            <div className={`h-3 w-5 rounded-sm ${s.cls}`} />
            <span className="text-[8px] text-[color:var(--muted-foreground)]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tooth confidence grid ────────────────────────────────────────────────────

function ToothConfidenceGrid({
  heatmapByTooth,
  selectedTooth,
  onSelect,
}: {
  heatmapByTooth: Record<number, { confidence: number | null }>;
  selectedTooth: number | null;
  onSelect: (fdi: number) => void;
}) {
  const upper = [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28];
  const lower = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

  function confColor(conf: number | null) {
    if (conf === null || conf === 0) return "bg-[color:var(--border)] text-[color:var(--muted-foreground)]";
    if (conf >= 0.9) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    if (conf >= 0.75) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300";
    return "bg-red-500/20 text-red-700 dark:text-red-300";
  }

  function renderRow(fdis: number[], label: string) {
    return (
      <div className="space-y-1">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">{label}</p>
        <div className="flex gap-1 flex-wrap">
          {fdis.map((fdi) => {
            const data = heatmapByTooth[fdi];
            const conf = data?.confidence ?? null;
            const isSelected = selectedTooth === fdi;
            return (
              <button
                key={fdi}
                type="button"
                onClick={() => onSelect(fdi)}
                className={[
                  "flex h-8 w-8 flex-col items-center justify-center rounded-lg border text-[9px] font-bold transition-all",
                  confColor(conf),
                  isSelected ? "ring-2 ring-[color:var(--primary)] ring-offset-1" : "",
                ].join(" ")}
                title={`FDI ${fdi}: ${conf !== null ? `${(conf * 100).toFixed(0)}%` : "missing"}`}
              >
                <span className="leading-none">{fdi}</span>
                {conf !== null && (
                  <span className="text-[7px] leading-none opacity-70">{(conf * 100).toFixed(0)}%</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renderRow(upper, "Upper arch")}
      {renderRow(lower, "Lower arch")}
    </div>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({ entries }: { entries: HistoryEntry[] }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-[color:var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]"
      >
        <History size={12} />
        Edit History ({entries.filter((e) => !e.isUndone).length} active)
        {open ? <ChevronDown size={11} className="ml-auto" /> : <ChevronRight size={11} className="ml-auto" />}
      </button>
      {open && (
        <div className="border-t border-[color:var(--border)] px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
          {entries.map((e) => (
            <div
              key={e.id}
              className={`flex items-center justify-between gap-2 text-[10px] ${e.isUndone ? "opacity-40 line-through" : ""}`}
            >
              <span className="font-mono text-[color:var(--muted-foreground)]">#{e.sequenceNum}</span>
              <span className="flex-1 font-medium text-[color:var(--foreground)]">
                {e.actionType} {e.toothNumber ? `(FDI ${e.toothNumber})` : ""}
              </span>
              <span className="text-[color:var(--muted-foreground)]">
                {new Date(e.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  jobId: string;
}

export default function SegmentationMaskEditor({ caseId, jobId }: Props) {
  const [activeTool, setActiveTool] = useState<MaskEditOperation>("brush");
  const [activeRegion, setActiveRegion] = useState<MaskRegionType>("crown");
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [brushRadius, setBrushRadius] = useState(2.0);
  const [growIterations, setGrowIterations] = useState(5);
  const [operating, setOperating] = useState(false);
  const [lastMask, setLastMask] = useState<SegmentationMask | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [heatmap, setHeatmap] = useState<Record<number, { confidence: number | null }>>({});
  const [loadingHeatmap, setLoadingHeatmap] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHeatmap = useCallback(async () => {
    setLoadingHeatmap(true);
    try {
      const data = await getConfidenceHeatmap(caseId, jobId);
      setHeatmap(data.heatmapByTooth);
    } catch { /* heatmap is optional */ }
    setLoadingHeatmap(false);
  }, [caseId, jobId]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await getHistoryStack(caseId, jobId));
    } catch { /* swallow */ }
  }, [caseId, jobId]);

  useEffect(() => { void loadHeatmap(); void loadHistory(); }, [loadHeatmap, loadHistory]);

  async function applyTool() {
    if (!selectedTooth) {
      setError("Select a tooth from the confidence grid first");
      return;
    }
    setOperating(true);
    setError(null);
    try {
      const result = await editMask(caseId, jobId, {
        toothNumber: selectedTooth,
        regionType: activeRegion,
        operation: activeTool,
        radiusMm: brushRadius,
        growIterations,
      });
      setLastMask(result);
      setStatusMsg(`${activeTool} applied to FDI ${selectedTooth} (${result.maskData.vertices.length} vertices)`);
      await loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperating(false);
    }
  }

  async function handleUndo() {
    setOperating(true);
    try {
      const res = await undoMaskEdit(caseId, jobId);
      setStatusMsg(res.undone ? `Undid: ${res.action ?? "action"}` : "Nothing to undo");
      await loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperating(false);
    }
  }

  async function handleRedo() {
    setOperating(true);
    try {
      const res = await redoMaskEdit(caseId, jobId);
      setStatusMsg(res.redone ? `Redid: ${res.action ?? "action"}` : "Nothing to redo");
      await loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperating(false);
    }
  }

  const activeTooData = TOOLS.find((t) => t.key === activeTool);

  return (
    <div className="space-y-4">
      {/* AI disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Mask edits modify AI segmentation output. Clinician review and approval required before using for treatment planning.
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        {/* Left: confidence grid + heatmap */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                Select Tooth to Edit
              </h3>
              {loadingHeatmap
                ? <Loader2 size={12} className="animate-spin text-[color:var(--muted-foreground)]" />
                : <HeatmapLegend />
              }
            </div>
            <ToothConfidenceGrid
              heatmapByTooth={heatmap}
              selectedTooth={selectedTooth}
              onSelect={setSelectedTooth}
            />
            {selectedTooth && (
              <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                Selected: <strong className="text-[color:var(--foreground)]">FDI {selectedTooth}</strong>
                {heatmap[selectedTooth]?.confidence !== null && heatmap[selectedTooth]?.confidence !== undefined && (
                  <> · Confidence: <strong>{((heatmap[selectedTooth].confidence ?? 0) * 100).toFixed(0)}%</strong></>
                )}
              </p>
            )}
          </Card>

          {/* Status / result */}
          {(statusMsg || error) && (
            <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
              error
                ? "border-red-200/60 bg-red-50/60 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                : "border-emerald-200/60 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
            }`}>
              {error ? <AlertTriangle size={12} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={12} className="mt-0.5 shrink-0" />}
              {error ?? statusMsg}
            </div>
          )}

          {lastMask && (
            <Card className="p-3">
              <p className="text-xs font-semibold text-[color:var(--foreground)] mb-1">Last Edit Result</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-[color:var(--muted-foreground)]">Tooth</span><br/><strong>FDI {lastMask.toothNumber}</strong></div>
                <div><span className="text-[color:var(--muted-foreground)]">Region</span><br/><strong>{lastMask.regionType}</strong></div>
                <div><span className="text-[color:var(--muted-foreground)]">Vertices</span><br/><strong>{lastMask.maskData.vertices.length}</strong></div>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-[color:var(--muted-foreground)]">
                <Sparkles size={10} className="text-amber-500" />
                {lastMask.isManuallyEdited ? "Manually edited" : "AI-generated"}
              </div>
            </Card>
          )}

          <HistoryPanel entries={history} />
        </div>

        {/* Right: tool palette */}
        <div className="space-y-3">
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Editing Tools</h3>

            {/* Undo / Redo */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={operating}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] py-2 text-xs font-medium text-[color:var(--foreground)] hover:border-[color:var(--primary)]/40 disabled:opacity-50 transition-colors"
              >
                <Undo2 size={12} /> Undo
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={operating}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] py-2 text-xs font-medium text-[color:var(--foreground)] hover:border-[color:var(--primary)]/40 disabled:opacity-50 transition-colors"
              >
                <Redo2 size={12} /> Redo
              </button>
            </div>

            {/* Region type */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-2">
                Region Type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {REGION_TYPES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setActiveRegion(r.key)}
                    className={[
                      "rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                      activeRegion === r.key
                        ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-white"
                        : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/40",
                    ].join(" ")}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tool list */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-2">
                Tool
              </label>
              <div className="space-y-1">
                {TOOLS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTool(t.key)}
                      className={[
                        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                        activeTool === t.key
                          ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]"
                          : "border-transparent bg-transparent text-[color:var(--foreground)] hover:bg-[color:var(--muted)]/30",
                      ].join(" ")}
                    >
                      <Icon size={13} className="shrink-0" />
                      <span className="font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Brush parameters */}
            {activeTooData?.hasRadius && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">
                  Radius: {brushRadius.toFixed(1)} mm
                </label>
                <input
                  type="range" min={0.5} max={8} step={0.5}
                  value={brushRadius}
                  onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
                  className="w-full accent-[color:var(--primary)]"
                />
              </div>
            )}

            {activeTool === "region_grow" && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1">
                  Grow iterations: {growIterations}
                </label>
                <input
                  type="range" min={1} max={30} step={1}
                  value={growIterations}
                  onChange={(e) => setGrowIterations(parseInt(e.target.value, 10))}
                  className="w-full accent-[color:var(--primary)]"
                />
              </div>
            )}

            {activeTooData && (
              <p className="text-[10px] text-[color:var(--muted-foreground)]">{activeTooData.description}</p>
            )}

            {/* Apply button */}
            <button
              type="button"
              onClick={applyTool}
              disabled={operating || !selectedTooth}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {operating ? <Loader2 size={14} className="animate-spin" /> : null}
              {operating ? "Applying…" : `Apply ${activeTooData?.label ?? "Tool"}`}
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
