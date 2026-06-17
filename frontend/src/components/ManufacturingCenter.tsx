"use client";

import React, { useState, useEffect } from "react";
import { usePrinters, usePrintJobs } from "@/hooks/useApi";
import { Cpu, Printer, Server, Activity, AlertTriangle, RefreshCw, XCircle } from "lucide-react";

export default function ManufacturingCenter() {
  const { printers, loading: printersLoading, simulateCycle } = usePrinters();
  const { jobs, loading: jobsLoading } = usePrintJobs();
  
  const [activeSegment, setActiveSegment] = useState<"printers" | "queue">("printers");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "idle": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      case "printing": return "text-primary bg-primary/10 border-primary/20";
      case "offline": return "text-slate-400 bg-slate-500/10 border-slate-500/20";
      case "error": return "text-rose-500 bg-rose-500/10 border-rose-500/20";
      default: return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case "printing": return "text-primary bg-primary/10";
      case "completed": return "text-emerald-500 bg-emerald-500/10";
      case "failed": return "text-rose-500 bg-rose-500/10";
      case "queued": return "text-blue-500 bg-blue-500/10";
      default: return "text-slate-400 bg-slate-500/10";
    }
  };

  const handleSimulateCycle = async (printerId: string) => {
    try {
      await simulateCycle(printerId);
    } catch (err) {
      console.error("Simulation failed:", err);
    }
  };

  // Calculate dynamic stats
  const activeCount = printers.filter(p => p.status !== "offline").length;
  const avgResin = printers.length > 0 
    ? Math.round(printers.reduce((acc, p) => acc + p.materialVolumeMl, 0) / printers.length) 
    : 0;

  return (
    <div className="space-y-6">
      
      {/* KPI Stats Header Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Printers", val: `${activeCount} / ${printers.length} Online`, icon: Server, color: "text-primary" },
          { label: "Daily Throughput", val: "36 Aligners", icon: Activity, color: "text-emerald-500" },
          { label: "Print Error Rate", val: "2.7%", icon: XCircle, color: "text-rose-500" },
          { label: "Avg Material Vol", val: `${avgResin} ml`, icon: Cpu, color: "text-blue-500" }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-bold mt-1 tracking-tight">{stat.val}</p>
              </div>
              <Icon className={stat.color} size={20} />
            </div>
          );
        })}
      </div>

      {/* iOS styled Segment picker on Mobile screen */}
      {isMobile && (
        <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex relative w-full border border-border/40 select-none">
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(10);
              }
              setActiveSegment("printers");
            }}
            className={`flex-1 py-2 text-xs font-bold text-center z-10 transition-colors ${
              activeSegment === "printers" ? "text-foreground" : "text-secondary"
            }`}
          >
            Printers Array
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(10);
              }
              setActiveSegment("queue");
            }}
            className={`flex-1 py-2 text-xs font-bold text-center z-10 transition-colors ${
              activeSegment === "queue" ? "text-foreground" : "text-secondary"
            }`}
          >
            Print Queue
          </button>
          <div
            className="absolute top-1 bottom-1 bg-card rounded-lg shadow-sm transition-all duration-300"
            style={{
              left: activeSegment === "printers" ? "4px" : "50%",
              width: "calc(50% - 6px)",
            }}
          />
        </div>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Printers Catalog card */}
        <div className={`xl:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-5 shadow-sm ${
          isMobile && activeSegment !== "printers" ? "hidden" : "block"
        }`}>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-sm">Universal Printers Array</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Plugin-based device integrations and telemetry status</p>
            </div>
            <span className="text-[10px] text-primary font-bold flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>LIVE TELEMETRY</span>
            </span>
          </div>

          {printersLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="h-44 w-full animate-skeleton rounded-xl border border-border" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {printers.map(printer => (
                <div 
                  key={printer.id} 
                  className="border border-border rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/10 flex flex-col justify-between space-y-4 hover:border-slate-350 dark:hover:border-slate-800 transition-spring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs truncate">{printer.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{printer.brand} • {printer.model}</p>
                    </div>
                    <span className={`text-[8px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full border shrink-0 ${getStatusColor(printer.status)}`}>
                      {printer.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Material Type:</span>
                      <span className="font-bold text-foreground truncate max-w-[120px]">{printer.materialType || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Volume Level:</span>
                      <span className={`font-bold ${printer.materialVolumeMl < 500 ? "text-amber-500" : "text-foreground"}`}>
                        {printer.materialVolumeMl} ml
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">IP address:</span>
                      <span className="font-mono text-[9px] text-slate-400">{printer.ipAddress}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50 flex gap-2">
                    <button 
                      onClick={() => handleSimulateCycle(printer.id)}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-border text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 focus-ring"
                    >
                      <RefreshCw size={11} />
                      <span>Simulate Telemetry</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manufacturing active queue jobs */}
        <div className={`bg-card border border-border rounded-2xl p-5 space-y-5 shadow-sm ${
          isMobile && activeSegment !== "queue" ? "hidden" : "block"
        }`}>
          <div className="border-b border-border pb-3">
            <h3 className="font-bold text-sm">Active Printing Queue</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Slices model files registered for print</p>
          </div>

          {jobsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 w-full animate-skeleton rounded-xl border border-border" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => (
                <div 
                  key={job.id} 
                  className="p-3 border border-border rounded-xl space-y-2.5 hover:border-slate-350 dark:hover:border-slate-800 transition-spring bg-slate-50/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold truncate">{job.patientName}</span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0 ${getJobStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Stage #{job.stageNumber}</span>
                    {job.qualityScore && (
                      <span className="flex items-center gap-1 font-bold text-primary">
                        AI QC: {Math.round(job.qualityScore * 100)}%
                      </span>
                    )}
                  </div>

                  {job.status === "failed" && job.qcNotes && (
                    <div className="flex items-start gap-1.5 p-2 bg-rose-500/5 text-rose-500 border border-rose-500/10 rounded-lg text-[10px] leading-relaxed">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <span>{job.qcNotes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
