"use client";

import React, { useState, useEffect } from "react";
import { useCases } from "@/hooks/useApi";
import { Play, Pause, Info, Sparkles, CheckSquare, Layers, AlertCircle } from "lucide-react";

interface AlignerStagingProps {
  caseId: string;
  patientName: string;
}

export default function AlignerStaging({ caseId, patientName }: AlignerStagingProps) {
  const { updateCaseStatus } = useCases();
  
  const [currentStage, setCurrentStage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalStages] = useState(22);
  const [velocityLimit, setVelocityLimit] = useState(0.25);
  const [aiApproved, setAiApproved] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStage((prev) => {
          if (prev >= totalStages) {
            setIsPlaying(false);
            return totalStages;
          }
          return prev + 1;
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, totalStages]);

  const handleTimelineScrub = (val: number) => {
    setCurrentStage(val);
    if (isPlaying) setIsPlaying(false);
  };

  const handleToggleApproval = async () => {
    const nextApproved = !aiApproved;
    setAiApproved(nextApproved);
    try {
      // Approve treatment plan updates the case state to approved in local storage
      await updateCaseStatus(caseId, nextApproved ? "approved" : "planning");
    } catch (err) {
      console.error("Failed to sign plan status:", err);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-md overflow-hidden">
      
      {/* Header */}
      <div className="p-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Staging Timeline Simulator</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Tooth displacement mapping for {patientName}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold">Spacing Limit:</span>
          <select 
            value={velocityLimit}
            onChange={(e) => setVelocityLimit(parseFloat(e.target.value))}
            className="bg-card border border-border rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary font-semibold focus-ring"
          >
            <option value={0.20}>Conservative (0.20mm)</option>
            <option value={0.25}>Standard (0.25mm)</option>
            <option value={0.30}>Accelerated (0.30mm)</option>
          </select>
        </div>
      </div>

      <div className="p-6 space-y-6">
        
        {/* Scrubbing timeline */}
        <div className="p-5 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2.5 bg-primary hover:bg-primary-hover text-white rounded-full transition-colors shadow-sm focus-ring"
                aria-label={isPlaying ? "Pause simulation playback" : "Play simulation playback"}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div className="text-xs font-bold text-foreground">
                Stage {currentStage} <span className="text-slate-400 font-medium">of {totalStages}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
              <span>STAGING TELEMETRY</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-slate-400">Start</span>
            <input
              type="range" min="1" max={totalStages}
              className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary focus-ring"
              value={currentStage}
              onChange={(e) => handleTimelineScrub(parseInt(e.target.value))}
              aria-label="Orthodontic Stage timeline slider"
            />
            <span className="text-[10px] font-black uppercase text-slate-400">End</span>
          </div>
        </div>

        {/* AI Predictions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Estimated Count */}
          <div className="p-4 bg-card border border-border rounded-xl space-y-1.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-lg pointer-events-none" />
            <div className="flex items-center gap-1 text-[9px] font-black tracking-widest text-primary">
              <Sparkles size={11} />
              <span>ESTIMATED ALIGNERS</span>
            </div>
            <p className="text-xl font-bold tracking-tight">22 Stages</p>
            <p className="text-[9px] text-slate-400">Based on anatomical root limit</p>
          </div>

          {/* Attachments */}
          <div className="p-4 bg-card border border-border rounded-xl space-y-1.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-lg pointer-events-none" />
            <div className="flex items-center gap-1 text-[9px] font-black tracking-widest text-blue-500">
              <Layers size={11} />
              <span>ATTACHMENTS</span>
            </div>
            <p className="text-xl font-bold tracking-tight">4 placements</p>
            <p className="text-[9px] text-slate-400">Tooth 13, 23, 34, 44</p>
          </div>

          {/* IPR Clearance */}
          <div className="p-4 bg-card border border-border rounded-xl space-y-1.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-lg pointer-events-none" />
            <div className="flex items-center gap-1 text-[9px] font-black tracking-widest text-amber-600 dark:text-amber-400">
              <AlertCircle size={11} />
              <span>IPR CLEARANCE</span>
            </div>
            <p className="text-xl font-bold tracking-tight">0.2 mm</p>
            <p className="text-[9px] text-slate-400">Required at tooth contact 11/21</p>
          </div>
        </div>

        {/* Approval box */}
        <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <Info size={15} className="text-primary mt-0.5 shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <p className="font-bold text-primary">Clinical Authorization Required</p>
              <p className="text-slate-400 mt-0.5">
                Ensure interproximal reduction (IPR) checks and local root spacing velocities conform to medical protocols before locking manufacturing stages.
              </p>
            </div>
          </div>
          <button 
            onClick={handleToggleApproval}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-spring shrink-0 focus-ring ${
              aiApproved 
                ? "bg-primary text-white shadow-glow" 
                : "bg-card border border-border text-secondary hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            aria-label="Approve staging plan details"
          >
            <CheckSquare size={14} />
            <span>{aiApproved ? "Plan Authorized" : "Authorize Staging Plan"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
