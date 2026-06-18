"use client";

import React, { useState } from "react";
import { ShieldCheck, MessageSquare, AlertTriangle, CheckCircle2, ChevronRight, UploadCloud, RefreshCw } from "lucide-react";

interface MonitoringLog {
  id: string;
  stage: number;
  fitScore: number;
  gapMm: number;
  attachmentsIntact: boolean;
  hygieneGood: boolean;
  alertLevel: "none" | "low" | "medium" | "high";
  recommendedActions: string;
  date: string;
}

const initialLogs: MonitoringLog[] = [
  { id: "log1", stage: 4, fitScore: 92, gapMm: 0.2, attachmentsIntact: true, hygieneGood: true, alertLevel: "none", recommendedActions: "Tracking perfectly. Proceed to next aligner stage.", date: "2026-06-14" },
  { id: "log2", stage: 3, fitScore: 78, gapMm: 0.6, attachmentsIntact: true, hygieneGood: true, alertLevel: "medium", recommendedActions: "Tracking gap detected. Instruct patient to use chewies for 3 days.", date: "2026-06-07" },
  { id: "log3", stage: 2, fitScore: 65, gapMm: 0.1, attachmentsIntact: false, hygieneGood: true, alertLevel: "high", recommendedActions: "Composite attachment sheared off at tooth 13. Schedule clinic appointment.", date: "2026-05-30" }
];

export default function RemoteMonitoring() {
  const [logs, setLogs] = useState<MonitoringLog[]>(initialLogs);
  const [selectedLog, setSelectedLog] = useState<MonitoringLog>(initialLogs[0]);

  const handleSimulateUpload = () => {
    const gap = Math.random() > 0.5 ? 0.15 : 0.7;
    const ok = gap < 0.5;
    const newLog: MonitoringLog = {
      id: `log${logs.length + 1}`,
      stage: selectedLog.stage + 1,
      fitScore: Math.round((1.0 - (gap / 2)) * 100),
      gapMm: gap,
      attachmentsIntact: Math.random() > 0.1,
      hygieneGood: Math.random() > 0.15,
      alertLevel: gap > 0.5 ? "medium" : "none",
      recommendedActions: gap > 0.5 ? "Air gap detected. Instruct chewies use." : "Tracking within normal thresholds.",
      date: new Date().toISOString().split("T")[0]
    };
    setLogs([newLog, ...logs]);
    setSelectedLog(newLog);
  };

  const getAlertBadge = (lvl: MonitoringLog["alertLevel"]) => {
    switch (lvl) {
      case "high": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "medium": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "low": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      default: return "bg-teal-500/10 text-teal-400 border-teal-500/20";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full min-h-[500px]">
      
      {/* Logs directory list */}
      <div className="bg-card border border-border rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm">
        <div>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h4 className="font-semibold text-sm">Tracking Uploads</h4>
            <button 
              onClick={handleSimulateUpload}
              className="p-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
              title="Simulate Patient Photo Submission"
            >
              <UploadCloud size={14} />
            </button>
          </div>
          <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map(log => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                  selectedLog.id === log.id
                    ? "bg-primary/5 border-primary shadow-glow"
                    : "border-border hover:bg-slate-50 dark:hover:bg-slate-900/40"
                }`}
              >
                <div className="flex justify-between font-bold">
                  <span>Aligner Stage #{log.stage}</span>
                  <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded border ${getAlertBadge(log.alertLevel)}`}>
                    {log.alertLevel}
                  </span>
                </div>
                <div className="flex justify-between text-secondary mt-2">
                  <span>Date: {log.date}</span>
                  <span className="font-semibold text-primary">Fit: {log.fitScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-950/20 border-t border-border text-[10px] text-slate-400">
          Simulate uploads using the cloud upload button.
        </div>
      </div>

      {/* Log detailed viewer */}
      <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-6 flex flex-col justify-between shadow-card">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-semibold text-lg">Aligner Fit Analysis</h3>
              <p className="text-xs text-secondary mt-0.5">Automated image evaluation of tracking gaps and attachments</p>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-xs font-bold">
              <ShieldCheck size={14} /> Tele-orthodontics Approved
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Fit score */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl">
              <span className="text-[10px] uppercase font-bold text-secondary">Fit accuracy</span>
              <p className="text-2xl font-bold mt-1 text-primary">{selectedLog.fitScore}%</p>
              <span className="text-[9px] text-slate-400 mt-1 block">Est. Air Gap: {selectedLog.gapMm.toFixed(2)}mm</span>
            </div>

            {/* Attachments intact */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl">
              <span className="text-[10px] uppercase font-bold text-secondary">Attachments Status</span>
              <p className={`text-xl font-bold mt-1.5 ${selectedLog.attachmentsIntact ? "text-teal-400" : "text-red-400"}`}>
                {selectedLog.attachmentsIntact ? "All Intact" : "Broken detected"}
              </p>
              <span className="text-[9px] text-slate-400 mt-1 block">Check Canine overlays</span>
            </div>

            {/* Hygiene */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl">
              <span className="text-[10px] uppercase font-bold text-secondary">Oral Hygiene Index</span>
              <p className={`text-xl font-bold mt-1.5 ${selectedLog.hygieneGood ? "text-green-400" : "text-amber-500"}`}>
                {selectedLog.hygieneGood ? "Excellent" : "Plaque Detected"}
              </p>
              <span className="text-[9px] text-slate-400 mt-1 block">Calculated via composite teeth stains</span>
            </div>
          </div>

          {/* AI Recommended Actions */}
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-2">
            <span className="text-xs font-bold text-primary flex items-center gap-1">
              <AlertTriangle size={14} />
              AI Clinical Guidance
            </span>
            <p className="text-xs text-secondary leading-relaxed">{selectedLog.recommendedActions}</p>
          </div>
        </div>

        <div className="pt-6 border-t border-border mt-6 flex justify-end gap-3">
          <button className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Contact Patient via Portal
          </button>
          <button className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1">
            Accept Fit & Progress Stage
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
