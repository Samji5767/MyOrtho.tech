"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Copy, Trash, AlertTriangle, Sparkles, Plus } from "lucide-react";
import { validateMovements, ToothDisplacement } from "@/lib/biomechanics/vectorMath";

interface TimelineControllerProps {
  caseId: string;
  patientName: string;
  onStageChange: (stageNum: number) => void;
  currentDisplacements: Record<number, ToothDisplacement>;
}

export default function TimelineController({ 
  caseId, 
  patientName, 
  onStageChange,
  currentDisplacements 
}: TimelineControllerProps) {
  const [stagesList, setStagesList] = useState<number[]>([1, 2, 3, 4, 5]);
  const [activeStage, setActiveStage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Telemetry loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setActiveStage((prev) => {
          const next = prev + 1;
          if (next > stagesList.length) {
            setIsPlaying(false);
            return prev;
          }
          onStageChange(next);
          return next;
        });
      }, 600);
    }
    return () => clearInterval(interval);
  }, [isPlaying, stagesList, onStageChange]);

  // Evaluate clinical safety limits whenever the active displacements change
  useEffect(() => {
    const activeWarnings: string[] = [];
    Object.entries(currentDisplacements).forEach(([idStr, disp]) => {
      const toothId = parseInt(idStr);
      const warn = validateMovements(toothId, disp);
      if (warn) {
        activeWarnings.push(warn.message);
      }
    });
    setWarnings(activeWarnings);
  }, [currentDisplacements]);

  const handleDuplicate = () => {
    const newStageNum = stagesList.length + 1;
    setStagesList([...stagesList, newStageNum]);
    setActiveStage(newStageNum);
    onStageChange(newStageNum);
  };

  const handleRollback = () => {
    alert(`Rolling back stage #${activeStage} coordinates to match original starting parameters.`);
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Staging Timeline Engine</h3>
          <p className="text-xs text-secondary mt-0.5">Scrub aligner sequences and analyze biological limits</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleDuplicate}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-border text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus size={14} /> Duplicate Stage
          </button>
          <button 
            onClick={handleRollback}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/10 text-xs font-semibold rounded-lg transition-colors"
          >
            <RotateCcw size={14} /> Rollback
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Playback Controls & Slider */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2.5 bg-primary hover:bg-primary-hover text-white rounded-full transition-colors shadow-sm"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div className="text-sm font-bold">
                Active Stage: {activeStage} <span className="text-xs text-secondary font-medium">of {stagesList.length}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
              <Sparkles size={12} className="text-primary animate-pulse" />
              SLERP Arch Interpolation Active
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-secondary font-semibold">1</span>
            <input
              type="range" min="1" max={stagesList.length}
              className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
              value={activeStage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setActiveStage(val);
                onStageChange(val);
              }}
            />
            <span className="text-xs text-secondary font-semibold">{stagesList.length}</span>
          </div>
        </div>

        {/* Warnings & Threshold Errors */}
        {warnings.length > 0 ? (
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider flex items-center gap-1">
              <AlertTriangle size={12} /> Clinical Velocity Violations
            </span>
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
              {warnings.map((w, idx) => (
                <div key={idx} className="p-3 bg-red-500/5 text-red-400 border border-red-500/10 rounded-lg text-xs flex gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-teal-500/5 text-teal-400 border border-teal-500/10 rounded-lg text-xs flex items-center gap-2">
            <CheckSquareIcon size={14} />
            <span>All orthodontic movements fall within safe anatomical thresholds (&lt; 0.25mm/stage).</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckSquareIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-check-square"
    >
      <path d="m9 11 3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
