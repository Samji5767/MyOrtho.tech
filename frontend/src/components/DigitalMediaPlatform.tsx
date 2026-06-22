"use client";

import React, { useState } from "react";
import { 
  Image, 
  Presentation, 
  Sparkles, 
  Play, 
  Download, 
  Plus,
  ArrowRightLeft,
  Video
} from "lucide-react";

interface MediaAsset {
  id: string;
  patientName: string;
  type: "simulation" | "deck" | "video";
  title: string;
  createdAt: string;
}

export default function DigitalMediaPlatform() {
  const [activeTab, setActiveTab] = useState<"simulation" | "deck">("simulation");
  const [simulationDiff, setSimulationDiff] = useState(50); // slider before/after percentage
  
  const [assets] = useState<MediaAsset[]>([]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Simulation & slide editor */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <Image size={20} className="text-teal-400" />
                Digital Asset & Media Platform
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Generate photorealistic smile simulations, case slideshow decks, and treatment videos.</p>
            </div>
            
            <div className="flex gap-1 bg-slate-900 border border-border p-0.5 rounded-lg">
              <button
                onClick={() => setActiveTab("simulation")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeTab === "simulation" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                Smile Simulator
              </button>
              <button
                onClick={() => setActiveTab("deck")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeTab === "deck" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                Presentation Deck
              </button>
            </div>
          </div>

          {activeTab === "simulation" ? (
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                <Sparkles size={14} className="text-teal-400" /> Before / After Split Simulator
              </h4>

              {/* Split image preview frame */}
              <div className="relative aspect-video rounded-xl bg-slate-950/80 border border-border overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 flex">
                  {/* Left (Before) */}
                  <div className="flex-1 bg-gradient-to-br from-slate-900 to-slate-950 flex flex-col items-center justify-center border-r border-dashed border-border text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Initial Crowded Scan</span>
                    <span className="text-slate-400 font-medium block mt-1">Class II Malocclusion</span>
                  </div>
                  {/* Right (After) */}
                  <div className="flex-1 bg-gradient-to-bl from-teal-950/30 to-slate-950 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] uppercase font-bold text-teal-500 block">Simulated Post-Treatment</span>
                    <span className="text-teal-400 font-bold block mt-1">Straightened Alignment</span>
                  </div>
                </div>

                {/* Floating slider indicator overlay */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-teal-400 z-10 flex items-center justify-center"
                  style={{ left: `${simulationDiff}%` }}
                >
                  <div className="h-6 w-6 rounded-full bg-teal-500 text-white flex items-center justify-center shadow shadow-glow cursor-pointer pointer-events-none">
                    <ArrowRightLeft size={10} />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-semibold text-secondary">
                  <span>Simulation split percentage</span>
                  <span>{simulationDiff}%</span>
                </div>
                <input
                  type="range" min="0" max="100"
                  value={simulationDiff}
                  onChange={(e) => setSimulationDiff(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button className="px-3 py-1.5 border border-border hover:bg-slate-900 rounded-lg font-bold">
                  Upload Patient Photo
                </button>
                <button className="px-3 py-1.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover flex items-center gap-1">
                  <Download size={12} /> Export simulation
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                <Presentation size={14} className="text-teal-400" /> Patient Presentation Deck Builder
              </h4>

              <div className="border border-border rounded-xl p-4 bg-slate-900/10 space-y-3">
                <h5 className="font-bold text-xs text-primary">Slide #1: Staging Staging Summary</h5>
                <p className="text-secondary leading-normal">This slide summarizes the orthodontic treatment pathway: 18 alignment stages over 9 months. Expansion total: 1.5mm. Expected daily wear-time compliance: 22 hours.</p>
                <div className="flex gap-1.5">
                  <span className="px-2 py-0.5 bg-slate-900 border border-border rounded text-[9px] text-secondary">Slide: Title</span>
                  <span className="px-2 py-0.5 bg-slate-900 border border-border rounded text-[9px] text-secondary">Slide: 3D Render</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button className="px-3 py-1.5 border border-border hover:bg-slate-900 rounded-lg font-bold">
                  Add Slide
                </button>
                <button className="px-3 py-1.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover flex items-center gap-1">
                  <Download size={12} /> Download Presentation
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-border mt-6 text-slate-400">
          Media exports generate instantly using local WebGL canvas frame-grabbing buffers.
        </div>
      </div>

      {/* Asset library cards */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Presentation size={16} className="text-teal-400" /> Case Media Assets
        </h4>

        <div className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.id} className="border border-border rounded-xl p-3.5 bg-slate-900/10 space-y-2">
              <div className="flex justify-between items-center font-bold">
                <span className="text-primary truncate max-w-[140px]">{asset.title}</span>
                <span className={`px-2 py-0.5 rounded uppercase text-[8px] font-bold ${
                  asset.type === "simulation" 
                    ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                    : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                }`}>
                  {asset.type}
                </span>
              </div>
              <div className="space-y-1 text-slate-400 text-[10px]">
                <p><span className="font-bold text-secondary">Patient:</span> {asset.patientName}</p>
                <p><span className="font-bold text-secondary">Created:</span> {asset.createdAt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
