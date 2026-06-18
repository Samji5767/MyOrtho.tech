"use client";

import React, { useState } from "react";
import { Sparkles, Undo, Redo, Paintbrush, Scissors, Combine, Info, CheckCircle2, ChevronRight } from "lucide-react";

interface HistoryRecord {
  action: string;
  timestamp: string;
}

export default function SegmentationWorkspace() {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(11);
  const [brushRadius, setBrushRadius] = useState(3.5);
  const [activeTool, setActiveTool] = useState<"brush" | "split" | "merge">("brush");
  const [history, setHistory] = useState<HistoryRecord[]>([
    { action: "Initial AI segmentation generation", timestamp: "21:40:02" },
    { action: "Auto-repaired gap at tooth 11", timestamp: "21:40:05" }
  ]);
  const [undoneHistory, setUndoneHistory] = useState<HistoryRecord[]>([]);

  // Simulation of tooth colors corresponding to FDI numbers
  const toothColors: Record<number, string> = {
    11: "bg-teal-500", 12: "bg-blue-500", 13: "bg-indigo-500", 14: "bg-purple-500",
    15: "bg-pink-500", 16: "bg-rose-500", 17: "bg-red-500",
    21: "bg-orange-500", 22: "bg-amber-500", 23: "bg-yellow-500", 24: "bg-lime-500",
    25: "bg-green-500", 26: "bg-emerald-500", 27: "bg-cyan-500"
  };

  const executeAction = (actionText: string) => {
    const record: HistoryRecord = {
      action: actionText,
      timestamp: new Date().toTimeString().split(" ")[0]
    };
    setHistory([...history, record]);
    setUndoneHistory([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const updated = [...history];
    const last = updated.pop()!;
    setHistory(updated);
    setUndoneHistory([last, ...undoneHistory]);
  };

  const handleRedo = () => {
    if (undoneHistory.length === 0) return;
    const updated = [...undoneHistory];
    const next = updated.shift()!;
    setUndoneHistory(updated);
    setHistory([...history, next]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full min-h-[500px]">
      
      {/* 3D Segmentation Canvas Mock viewport */}
      <div className="lg:col-span-3 bg-slate-950 border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between p-6 text-white min-h-[400px]">
        {/* Tool overlay */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={() => setActiveTool("brush")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activeTool === "brush" 
                ? "bg-primary text-white border-primary" 
                : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            <Paintbrush size={14} /> Brush Color
          </button>
          <button
            onClick={() => {
              setActiveTool("split");
              executeAction("Triggered manual tooth split cut");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activeTool === "split" 
                ? "bg-primary text-white border-primary" 
                : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            <Scissors size={14} /> Split Tool
          </button>
          <button
            onClick={() => {
              setActiveTool("merge");
              executeAction("Triggered boundary vertices merge");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activeTool === "merge" 
                ? "bg-primary text-white border-primary" 
                : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            <Combine size={14} /> Merge Tool
          </button>
        </div>

        {/* Undo/Redo overlay */}
        <div className="absolute top-4 right-4 z-10 flex gap-1 bg-slate-900/80 border border-slate-800 p-1.5 rounded-lg">
          <button 
            onClick={handleUndo} disabled={history.length <= 1}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <Undo size={14} />
          </button>
          <button 
            onClick={handleRedo} disabled={undoneHistory.length === 0}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <Redo size={14} />
          </button>
        </div>

        {/* Visualized dental jaw segments mapping */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Maxillary Tooth Segmentation Boundaries</p>
          
          <div className="flex items-center gap-1.5 justify-center flex-wrap max-w-lg">
            {Object.keys(toothColors).map((fdiStr) => {
              const fdi = parseInt(fdiStr);
              const isSelected = selectedTooth === fdi;
              const color = toothColors[fdi];
              return (
                <div
                  key={fdi}
                  onClick={() => {
                    setSelectedTooth(fdi);
                    executeAction(`Selected active tooth index FDI ${fdi}`);
                  }}
                  className={`h-16 w-10 flex flex-col justify-between items-center p-1.5 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? "border-white scale-110 shadow-glow"
                      : "border-transparent opacity-85 hover:opacity-100"
                  } ${color}`}
                >
                  <span className="text-[10px] font-bold text-white">{fdi}</span>
                  <div className="h-1.5 w-1.5 rounded-full bg-white/50" />
                </div>
              );
            })}
          </div>
          
          <div className="p-3 bg-red-400/5 text-red-300 border border-red-500/10 rounded-xl max-w-sm text-center text-[10px]">
            Gingiva boundary (Pink background) separated by 1.8mm safety buffer.
          </div>
        </div>

        {/* Viewport bottom diagnostics */}
        <div className="flex justify-between items-center text-xs text-slate-400 pt-4 border-t border-slate-900">
          <span className="flex items-center gap-1"><Sparkles size={12} className="text-teal-400" /> Active Brush Radius: {brushRadius}mm</span>
          <span className="flex items-center gap-1 text-teal-400 font-bold"><CheckCircle2 size={12} /> Watertight Mesh Verified</span>
        </div>
      </div>

      {/* Side tools editor details */}
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between">
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg border-b border-border pb-3 mb-2">Segmentation Editor</h3>
            <p className="text-[11px] text-secondary">Manual correction tool for FDI boundaries and gingiva offsets</p>
          </div>

          {/* Active tooth details */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl space-y-2">
            <span className="text-[10px] uppercase font-bold text-secondary">Selected FDI Target</span>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Tooth Index #{selectedTooth}</p>
              <div className={`h-3 w-3 rounded-full ${toothColors[selectedTooth || 11]}`} />
            </div>
            <p className="text-[10px] text-secondary">Class: Anterior Incisor • Mesh Density: 24,000 faces</p>
          </div>

          {/* Brush configurations */}
          {activeTool === "brush" && (
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span>Paint Brush Diameter</span>
                <span className="text-primary font-bold">{brushRadius.toFixed(1)} mm</span>
              </div>
              <input
                type="range" min="1.0" max="10.0" step="0.5"
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                value={brushRadius}
                onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
              />
            </div>
          )}

          {/* History details */}
          <div className="space-y-3 pt-3 border-t border-border/60">
            <span className="text-[10px] uppercase font-bold text-secondary tracking-wider block">History Trail</span>
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
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
          <button className="flex items-center justify-center gap-1.5 w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-all shadow-sm">
            Save Boundary Mappings
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
