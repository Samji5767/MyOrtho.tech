"use client";

import React, { useState } from "react";
import { Sparkles, Save, CheckCircle2, AlertTriangle, ShieldCheck, Ruler } from "lucide-react";

export default function ImplantPlanner() {
  const [selectedTooth, setSelectedTooth] = useState(16);
  const [fixtureBrand, setFixtureBrand] = useState("Straumann");
  const [diameter, setDiameter] = useState(4.1); // mm
  const [length, setLength] = useState(10.0);   // mm
  const [pitch, setPitch] = useState(5.0);       // degrees
  const [roll, setRoll] = useState(2.0);        // degrees

  // Collision state
  const isCollisionWarning = pitch > 12.0 || roll > 12.0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full min-h-[500px]">
      
      {/* 3D Implant view workspace simulator */}
      <div className="lg:col-span-3 bg-slate-950 border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between p-6 text-white min-h-[400px]">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <span className="px-3 py-1 bg-slate-900 border border-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 text-slate-400">
            <Ruler size={12} /> Sleeve Offset: 4.0mm
          </span>
        </div>

        {/* Surgical Guide 3D Canvas cylinder preview */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Surgical Guide Drill Sleeve Alignment</p>
          
          <div className="relative h-48 w-32 flex items-center justify-center">
            {/* Crown mock */}
            <div className="absolute top-0 h-16 w-20 border-2 border-white/50 bg-white/10 rounded-xl flex items-center justify-center font-bold text-xs">
              FDI #{selectedTooth} prep
            </div>
            
            {/* Guide Sleeve Cylinder cylinder representation */}
            <div 
              className={`absolute top-12 h-24 w-8 border-2 rounded-lg transition-transform duration-300 ${
                isCollisionWarning 
                  ? "border-red-500 bg-red-500/10 shadow-glow" 
                  : "border-teal-400 bg-teal-500/10 shadow-glow"
              }`}
              style={{ transform: `rotate(${pitch}deg)` }}
            >
              <div className="h-full w-0.5 bg-dashed bg-white/50 mx-auto" />
            </div>

            {/* Estimated Root trajectory */}
            <div className="absolute bottom-0 h-12 w-0.5 border-r border-dashed border-red-400" />
          </div>
          
          {isCollisionWarning && (
            <div className="p-3 bg-red-500/5 text-red-400 border border-red-500/10 rounded-xl text-xs flex items-center gap-2 max-w-sm">
              <AlertTriangle size={14} className="shrink-0" />
              <span>ROOT COLLISION WARNING: Fixture angle intersects with FDI #15 root boundary.</span>
            </div>
          )}
        </div>

        {/* Viewport footer */}
        <div className="flex justify-between items-center text-xs text-slate-400 pt-4 border-t border-slate-900">
          <span>Surgical Guide: Tooth-Supported Template design</span>
          <span className="flex items-center gap-1.5 text-teal-400 font-bold">
            <CheckCircle2 size={12} /> CBCT Mesh Aligned
          </span>
        </div>
      </div>

      {/* Side tools panel */}
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between shadow-sm">
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg border-b border-border pb-3 mb-2">Implant Planner</h3>
            <p className="text-[11px] text-secondary">Surgical plan, fixture parameters, and sleeve coordinates</p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Fixture Brands */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Fixture System</label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                value={fixtureBrand} onChange={(e) => setFixtureBrand(e.target.value)}
              >
                <option value="Straumann">Straumann Bone Level</option>
                <option value="Nobel">Nobel Biocare Active</option>
                <option value="Zimmer">Zimmer Tapered Screw-Vent</option>
              </select>
            </div>

            {/* Length and Diameter */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Diameter (mm)</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                  value={diameter} onChange={(e) => setDiameter(parseFloat(e.target.value))}
                >
                  <option value={3.3}>3.3 mm</option>
                  <option value={4.1}>4.1 mm</option>
                  <option value={4.8}>4.8 mm</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Length (mm)</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                  value={length} onChange={(e) => setLength(parseFloat(e.target.value))}
                >
                  <option value={8.0}>8.0 mm</option>
                  <option value={10.0}>10.0 mm</option>
                  <option value={12.0}>12.0 mm</option>
                </select>
              </div>
            </div>

            {/* Pitch slider */}
            <div className="pt-2 border-t border-border/50 space-y-3">
              <div className="flex justify-between font-semibold">
                <span>Mesio-Distal Inclination</span>
                <span className="text-primary font-bold">{pitch.toFixed(1)}°</span>
              </div>
              <input
                type="range" min="-20" max="20" step="0.5"
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))}
              />
            </div>

            {/* Roll slider */}
            <div className="space-y-3">
              <div className="flex justify-between font-semibold">
                <span>Bucco-Lingual Tilt</span>
                <span className="text-primary font-bold">{roll.toFixed(1)}°</span>
              </div>
              <input
                type="range" min="-20" max="20" step="0.5"
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                value={roll} onChange={(e) => setRoll(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border mt-6">
          <button className="flex items-center justify-center gap-1.5 w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-all shadow-sm">
            <Save size={14} /> Export Surgical Guide STL
          </button>
        </div>
      </div>

    </div>
  );
}
