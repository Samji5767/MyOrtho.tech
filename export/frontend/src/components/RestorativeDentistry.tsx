"use client";

import React, { useState } from "react";
import { Sparkles, Save, CheckCircle2, AlertTriangle, ShieldCheck, Settings } from "lucide-react";

export default function RestorativeDentistry() {
  const [restorationType, setRestorationType] = useState<"crown" | "bridge" | "veneer">("crown");
  const [minThickness, setMinThickness] = useState(0.8); // mm
  const [material, setMaterial] = useState("Zirconia Multi-layer");
  const [tracingActive, setTracingActive] = useState(false);
  const [tracingProgress, setTracingProgress] = useState<number | null>(null);

  const handleStartTracing = () => {
    setTracingActive(true);
    setTracingProgress(0);
    const interval = setInterval(() => {
      setTracingProgress(prev => {
        if (prev === null || prev >= 100) {
          clearInterval(interval);
          setTracingActive(false);
          setTracingProgress(null);
          return 100;
        }
        return prev + 25;
      });
    }, 200);
  };

  const isThicknessWarning = minThickness < 0.6;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full min-h-[500px]">
      
      {/* 3D Restorative workspace viewer */}
      <div className="lg:col-span-3 bg-slate-950 border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between p-6 text-white min-h-[400px]">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <span className="px-3 py-1 bg-slate-900 border border-slate-800 text-xs font-semibold rounded-lg text-slate-400">
            Preped Crown margins designer
          </span>
        </div>

        {/* 3D margin trace view */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Restorative Prep margin loops</p>
          
          <div className="relative h-48 w-48 flex items-center justify-center">
            {/* Prep crown geometry representation */}
            <div className="h-24 w-24 rounded-full border-4 border-dashed border-teal-400 animate-spin flex items-center justify-center">
              <div className="h-16 w-16 rounded-full border-2 border-white bg-teal-500/10" />
            </div>
            {tracingActive && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl flex items-center justify-center text-xs font-semibold">
                AI Prep Margin Tracing ({tracingProgress}%)
              </div>
            )}
          </div>

          {isThicknessWarning && (
            <div className="p-3 bg-red-500/5 text-red-400 border border-red-500/10 rounded-xl text-xs flex items-center gap-2 max-w-sm">
              <AlertTriangle size={14} className="shrink-0" />
              <span>CROWN THICKNESS ALERT: Zirconia requires at least 0.6mm thickness to prevent fracturing.</span>
            </div>
          )}
        </div>

        {/* Viewport footer */}
        <div className="flex justify-between items-center text-xs text-slate-400 pt-4 border-t border-slate-900">
          <button 
            onClick={handleStartTracing} disabled={tracingActive}
            className="text-primary hover:underline text-xs font-semibold disabled:opacity-50"
          >
            Run Auto-Trace Prep margin
          </button>
          <span className="flex items-center gap-1.5 text-teal-400 font-bold">
            <CheckCircle2 size={12} /> Watertight Restoration Mesh
          </span>
        </div>
      </div>

      {/* Side settings controls */}
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between shadow-sm">
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg border-b border-border pb-3 mb-2">Restorative Dentistry</h3>
            <p className="text-[11px] text-secondary">Veneers, crowns prep designs, and margin margins thickness</p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Restoration selection */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Restoration Type</label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                value={restorationType} onChange={(e) => setRestorationType(e.target.value as any)}
              >
                <option value="crown">Full Crown</option>
                <option value="bridge">Dental Bridge</option>
                <option value="veneer">Esthetic Veneer</option>
              </select>
            </div>

            {/* Material */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Material Selection</label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                value={material} onChange={(e) => setMaterial(e.target.value)}
              >
                <option value="Zirconia Multi-layer">Zirconia Multi-layer</option>
                <option value="Lithium Disilicate">IPS e.max (Lithium Disilicate)</option>
                <option value="Composite Resin">Temp PMMA Resin</option>
              </select>
            </div>

            {/* Thickness slider */}
            <div className="pt-2 border-t border-border/50 space-y-3">
              <div className="flex justify-between font-semibold">
                <span>Minimum Thickness</span>
                <span className="text-primary font-bold">{minThickness.toFixed(2)} mm</span>
              </div>
              <input
                type="range" min="0.4" max="1.5" step="0.05"
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                value={minThickness} onChange={(e) => setMinThickness(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border mt-6">
          <button className="flex items-center justify-center gap-1.5 w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-all shadow-sm">
            <Save size={14} /> Export Watertight Restoration
          </button>
        </div>
      </div>

    </div>
  );
}
