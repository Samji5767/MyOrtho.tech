"use client";

import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Cpu, 
  Terminal, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

interface TraceNode {
  spanId: string;
  name: string;
  durationMs: number;
  status: "success" | "error";
  timestamp: string;
}

export default function ObservabilityConsole() {
  const [metrics, setMetrics] = useState({
    activeWs: 14,
    latencyMs: 22,
    cpuPercent: 12,
    memoryMb: 245
  });

  const [traces] = useState<TraceNode[]>([
    { spanId: "spn-7710", name: "ImportScan (3Shape API)", durationMs: 485, status: "success", timestamp: "22:54:12" },
    { spanId: "spn-7711", name: "DecimateMesh (Web Worker)", durationMs: 125, status: "success", timestamp: "22:54:13" },
    { spanId: "spn-7712", name: "RunSLAQeCheck (AI Engine)", durationMs: 1420, status: "error", timestamp: "22:54:15" },
    { spanId: "spn-7713", name: "WriteDHRLog (PostgreSQL)", durationMs: 45, status: "success", timestamp: "22:54:16" }
  ]);

  const [logs, setLogs] = useState<string[]>([
    "[INFO] 22:54:12 [ScannerService] Authenticated with 3Shape Communicate CDN gateway.",
    "[INFO] 22:54:13 [MeshDecimation] Mesh reduced to 15% ratio in decimation background worker.",
    "[WARN] 22:54:15 [AIEngine] SLA printability check threshold alert: thin walls detected FDI 14.",
    "[INFO] 22:54:16 [DHRRegistry] DB transaction committed. DHR hash registered: f1a8e94..."
  ]);

  // Simulate metrics ticking in real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics({
        activeWs: Math.floor(Math.random() * 5) + 12,
        latencyMs: Math.floor(Math.random() * 15) + 15,
        cpuPercent: Math.floor(Math.random() * 8) + 10,
        memoryMb: Math.floor(Math.random() * 20) + 235
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Telemetry charts dashboard */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <Activity size={20} className="text-teal-400" />
                OpenTelemetry Observability Console
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Scrape real-time WebSockets, latency, process memory, and distributed tracing spans.</p>
            </div>
            
            <span className="flex items-center gap-1.5 text-teal-400 font-bold bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 rounded uppercase text-[9px] animate-pulse">
              <RefreshCw size={11} className="animate-spin" /> Scrape Active
            </span>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/40 p-4 rounded-xl border border-border text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Latency</span>
              <span className="text-lg font-black text-teal-400 block mt-1">{metrics.latencyMs} ms</span>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-border text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold">WS Sockets</span>
              <span className="text-lg font-black text-primary block mt-1">{metrics.activeWs} Nodes</span>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-border text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold">CPU Load</span>
              <span className="text-lg font-black text-primary block mt-1">{metrics.cpuPercent} %</span>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-border text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Heap Used</span>
              <span className="text-lg font-black text-primary block mt-1">{metrics.memoryMb} MB</span>
            </div>
          </div>

          {/* Distributed traces timeline */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
              <Cpu size={14} className="text-teal-400" /> Distributed Tracing Spans (OpenTelemetry)
            </h4>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {traces.map((trace) => (
                <div key={trace.spanId} className="border border-border rounded-xl p-3 bg-slate-900/10 flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-primary">{trace.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono font-medium">({trace.spanId})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">Duration: {trace.durationMs}ms | timestamp: {trace.timestamp}</span>
                  </div>

                  {trace.status === "success" ? (
                    <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded font-bold uppercase text-[9px] flex items-center gap-1">
                      <CheckCircle2 size={10} /> Success
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-bold uppercase text-[9px] flex items-center gap-1">
                      <AlertCircle size={10} /> Error
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border mt-6 text-slate-400">
          Telemetry configurations route directly using standard OTLP gRPC endpoint buffers.
        </div>
      </div>

      {/* Raw logs terminal output */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-4 flex-1 flex flex-col">
          <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
            <Terminal size={16} className="text-teal-400" /> Centralized System Logs
          </h4>
          <p className="text-[10px] text-secondary">Observational log collector aggregates from API and AI endpoints.</p>
          
          <div className="flex-1 p-3.5 bg-slate-950/80 border border-border rounded-xl font-mono text-[9px] text-slate-300 space-y-2 max-h-[360px] overflow-y-auto select-none">
            {logs.map((log, idx) => (
              <p key={idx} className={log.includes("[WARN]") ? "text-amber-400" : log.includes("[ERROR]") ? "text-red-400" : "text-slate-300"}>
                {log}
              </p>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
