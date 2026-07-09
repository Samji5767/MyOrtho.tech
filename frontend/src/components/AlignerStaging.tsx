"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Info,
  Sparkles,
  CheckSquare,
  Layers,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { listPlans } from "@/lib/api/treatmentPlans";
import { listAttachments } from "@/lib/api/attachments";
import { listIprItems } from "@/lib/api/ipr";
import { transitionCase } from "@/lib/api/cases";

interface AlignerStagingProps {
  caseId: string;
  patientName: string;
}

export default function AlignerStaging({ caseId, patientName }: AlignerStagingProps) {

  // ── Simulation state (UX only) ──────────────────────────────────────────────
  const [currentStage, setCurrentStage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [velocityLimit, setVelocityLimit] = useState(0.25);
  const [aiApproved, setAiApproved] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // ── Real data state ─────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [apiTotalStages, setApiTotalStages] = useState<number | null>(null);
  const [attachmentCount, setAttachmentCount] = useState<number | null>(null);
  const [attachmentTeeth, setAttachmentTeeth] = useState<string | null>(null);
  const [totalIprMm, setTotalIprMm] = useState<number | null>(null);
  const [iprLocation, setIprLocation] = useState<string | null>(null);

  // UX slider max: use real count if available, else 22 for simulation continuity
  const sliderMax = apiTotalStages ?? 22;

  const fetchStagingData = useCallback(async () => {
    setLoadingData(true);
    setFetchError(null);
    try {
      const plans = await listPlans(caseId);
      const activePlan = plans[0] ?? null;
      if (activePlan) {
        setApiTotalStages(activePlan.estimatedStages);
        const [atts, iprData] = await Promise.all([
          listAttachments(caseId, activePlan.id),
          listIprItems(caseId, activePlan.id),
        ]);
        setAttachmentCount(atts.length);
        if (atts.length > 0) {
          const teethList = atts
            .slice(0, 4)
            .map((a) => String(a.fdiNumber))
            .join(", ");
          setAttachmentTeeth(teethList);
        }
        const iprTotal = iprData.reduce((sum, item) => sum + item.amountMm, 0);
        setTotalIprMm(iprTotal);
        if (iprData.length > 0) {
          setIprLocation(`${iprData[0].toothAFdi}/${iprData[0].toothBFdi}`);
        }
      }
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load staging data",
      );
    } finally {
      setLoadingData(false);
    }
  }, [caseId]);

  useEffect(() => {
    void fetchStagingData();
  }, [fetchStagingData]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStage((prev) => {
          if (prev >= sliderMax) {
            setIsPlaying(false);
            return sliderMax;
          }
          return prev + 1;
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, sliderMax]);

  const handleTimelineScrub = (val: number) => {
    setCurrentStage(val);
    if (isPlaying) setIsPlaying(false);
  };

  const handleToggleApproval = async () => {
    const nextApproved = !aiApproved;
    setAiApproved(nextApproved);
    setApprovalError(null);
    try {
      await transitionCase(caseId, nextApproved ? "approved" : "planning");
    } catch (err) {
      setAiApproved(!nextApproved);
      setApprovalError(
        err instanceof Error ? err.message : "Failed to update plan status",
      );
    }
  };

  // ── Display values (never hardcoded — real data or "—") ─────────────────────
  const alignersDisplay = loadingData
    ? "…"
    : apiTotalStages != null
    ? `${apiTotalStages} Stages`
    : "—";

  const attachmentsDisplay = loadingData
    ? "…"
    : attachmentCount != null
    ? `${attachmentCount} placements`
    : "—";

  const iprDisplay = loadingData
    ? "…"
    : totalIprMm != null
    ? `${totalIprMm.toFixed(1)} mm`
    : "—";

  const stageTotalLabel = loadingData
    ? "…"
    : apiTotalStages != null
    ? String(apiTotalStages)
    : "—";

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

      {approvalError && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-xl border border-rose-300/50 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/10 dark:text-rose-400">
          <AlertCircle size={12} className="shrink-0" />
          {approvalError}
        </div>
      )}

      {fetchError && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/10 dark:text-amber-400">
          <AlertCircle size={12} className="shrink-0" />
          {fetchError}
        </div>
      )}

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
                Stage {currentStage}{" "}
                <span className="text-slate-400 font-medium">of {stageTotalLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
              {loadingData ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
              )}
              <span>STAGING TELEMETRY</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-slate-400">Start</span>
            <input
              type="range"
              min="1"
              max={sliderMax}
              className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary focus-ring"
              value={currentStage}
              onChange={(e) => handleTimelineScrub(parseInt(e.target.value))}
              aria-label="Orthodontic Stage timeline slider"
            />
            <span className="text-[10px] font-black uppercase text-slate-400">End</span>
          </div>
        </div>

        {/* AI Predictions — all values from API, never hardcoded */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Estimated Count */}
          <div className="p-4 bg-card border border-border rounded-xl space-y-1.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-lg pointer-events-none" />
            <div className="flex items-center gap-1 text-[9px] font-black tracking-widest text-primary">
              <Sparkles size={11} />
              <span>ESTIMATED ALIGNERS</span>
            </div>
            <p className="text-xl font-bold tracking-tight">{alignersDisplay}</p>
            <p className="text-[9px] text-slate-400">Based on anatomical root limit</p>
          </div>

          {/* Attachments */}
          <div className="p-4 bg-card border border-border rounded-xl space-y-1.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-lg pointer-events-none" />
            <div className="flex items-center gap-1 text-[9px] font-black tracking-widest text-blue-500">
              <Layers size={11} />
              <span>ATTACHMENTS</span>
            </div>
            <p className="text-xl font-bold tracking-tight">{attachmentsDisplay}</p>
            <p className="text-[9px] text-slate-400">
              {attachmentTeeth != null
                ? `Tooth ${attachmentTeeth}`
                : loadingData
                ? "Loading…"
                : "No attachment data"}
            </p>
          </div>

          {/* IPR Clearance */}
          <div className="p-4 bg-card border border-border rounded-xl space-y-1.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-lg pointer-events-none" />
            <div className="flex items-center gap-1 text-[9px] font-black tracking-widest text-amber-600 dark:text-amber-400">
              <AlertCircle size={11} />
              <span>IPR CLEARANCE</span>
            </div>
            <p className="text-xl font-bold tracking-tight">{iprDisplay}</p>
            <p className="text-[9px] text-slate-400">
              {iprLocation != null
                ? `Required at tooth contact ${iprLocation}`
                : loadingData
                ? "Loading…"
                : "No IPR data"}
            </p>
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
