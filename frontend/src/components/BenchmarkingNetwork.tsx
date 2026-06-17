"use client";

import React, { useState } from "react";
import { 
  BarChart3, 
  Activity, 
  TrendingUp, 
  ShieldCheck, 
  RefreshCw,
  Award,
  Users
} from "lucide-react";

interface BenchmarkMetric {
  name: string;
  clinicValue: number;
  globalAverage: number;
  unit: string;
  status: "excellent" | "average" | "needs_improvement";
}

export default function BenchmarkingNetwork() {
  const [metrics, setMetrics] = useState<BenchmarkMetric[]>([
    {
      name: "Mean Treatment Stages Count",
      clinicValue: 18.2,
      globalAverage: 22.4,
      unit: "Stages",
      status: "excellent" // Lower stages means faster/better treatment planning
    },
    {
      name: "Case Refinement Rate",
      clinicValue: 14.5,
      globalAverage: 18.2,
      unit: "%",
      status: "excellent" // Lower refinements means more accurate staging
    },
    {
      name: "SLA Print Success Ratio",
      clinicValue: 98.4,
      globalAverage: 95.8,
      unit: "%",
      status: "excellent"
    },
    {
      name: "Mean Patient Compliance Score",
      clinicValue: 82.5,
      globalAverage: 84.1,
      unit: "/100",
      status: "average"
    }
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Benchmarking dashboards charts */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <BarChart3 size={20} className="text-teal-400" />
                Global Clinical Benchmarking Network
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Compare treatment efficacy, staging accuracy, and print success rates against anonymized global datasets.</p>
            </div>
            
            <span className="flex items-center gap-1.5 text-teal-400 font-bold bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 rounded uppercase text-[9px]">
              <ShieldCheck size={11} /> Anonymized Moat Active
            </span>
          </div>

          <div className="space-y-4">
            {metrics.map((m, idx) => (
              <div key={idx} className="border border-border rounded-xl p-4 bg-slate-900/10 space-y-3.5">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-primary">{m.name}</h4>
                  <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                    m.status === "excellent" 
                      ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    {m.status.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-slate-950/40 p-2 rounded-lg border border-border/80">
                    <span className="text-[9px] uppercase font-bold text-secondary">Your Clinic</span>
                    <span className="text-base font-extrabold text-primary block mt-0.5">{m.clinicValue} {m.unit}</span>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded-lg border border-border/80">
                    <span className="text-[9px] uppercase font-bold text-secondary">Global Average</span>
                    <span className="text-base font-extrabold text-slate-300 block mt-0.5">{m.globalAverage} {m.unit}</span>
                  </div>
                </div>

                {/* Progress comparator line */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-800 h-1.5 rounded-full relative overflow-hidden">
                    <div 
                      className="bg-primary h-full absolute" 
                      style={{ width: `${(m.clinicValue / (m.clinicValue + m.globalAverage)) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                    <span>0</span>
                    <span>Target Range</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-border mt-6 text-slate-400">
          Clinic comparisons run against aggregated datasets of over 4.2 million cases worldwide.
        </div>
      </div>

      {/* Network moats highlights */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Award size={16} className="text-teal-400" /> Clinic Network Moat
        </h4>

        <div className="space-y-3">
          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-border flex gap-3">
            <Users size={18} className="text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-primary">Outcome Intelligence</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Aggregate staging algorithms predict outcome compliance using actual intraoral scans feedback loop.</span>
            </div>
          </div>

          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-border flex gap-3">
            <Activity size={18} className="text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-primary">Efficacy Benchmarks</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Automated refinement analysis targets anomalous print batch settings or technician planning errors.</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
