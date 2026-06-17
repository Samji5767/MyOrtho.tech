"use client";

import React, { useState } from "react";
import { useSecurity, useAuditLogs } from "@/hooks/useApi";
import { 
  ShieldAlert, 
  Users, 
  ToggleLeft, 
  ToggleRight, 
  FileSpreadsheet, 
  Lock,
  TrendingUp,
  Percent,
  Activity,
  Building
} from "lucide-react";

interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  ip: string;
  severity: "info" | "warning" | "critical";
}

const initialLogs: AuditLog[] = [
  { timestamp: "2026-06-14 21:12:05", user: "sarah.jenkins@myortho.tech", action: "Approved Case #c1 Staging Plan", ip: "192.168.1.104", severity: "info" },
  { timestamp: "2026-06-14 20:45:12", user: "system-worker", action: "AI Scan Segmentation Completed", ip: "10.0.4.88", severity: "info" },
  { timestamp: "2026-06-14 18:22:30", user: "operator-bill", action: "Resin Low Warning: Formlabs Printer 1", ip: "192.168.1.45", severity: "warning" },
  { timestamp: "2026-06-14 15:10:04", user: "unknown-admin", action: "Failed Login Attempt: Tenant Portal", ip: "203.0.113.19", severity: "critical" }
];

interface GrowthData {
  month: string;
  actual: number;
  forecast: number;
}

const growthMetrics: GrowthData[] = [
  { month: "Jan", actual: 120, forecast: 120 },
  { month: "Feb", actual: 150, forecast: 145 },
  { month: "Mar", actual: 190, forecast: 180 },
  { month: "Apr", actual: 240, forecast: 220 },
  { month: "May", actual: 310, forecast: 280 },
  { month: "Jun", actual: 380, forecast: 350 },
  { month: "Jul", actual: 0, forecast: 430 },
  { month: "Aug", actual: 0, forecast: 510 }
];

export default function EnterpriseDashboard() {
  const { settings, loading: securityLoading, saveSettings } = useSecurity();
  const { logs, loading: logsLoading } = useAuditLogs();
  const [activeMonthIdx, setActiveMonthIdx] = useState<number | null>(5);

  const handleToggleSSO = async () => {
    if (!settings) return;
    try {
      await saveSettings(!settings.ssoEnabled, settings.mfaEnforced);
    } catch (err) {
      console.error("Failed updating SSO settings:", err);
    }
  };

  const handleToggleMFA = async () => {
    if (!settings) return;
    try {
      await saveSettings(settings.ssoEnabled, !settings.mfaEnforced);
    } catch (err) {
      console.error("Failed updating MFA settings:", err);
    }
  };

  const getSeverityBadge = (sev: AuditLog["severity"]) => {
    switch (sev) {
      case "critical": return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "warning": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  const chartWidth = 500;
  const chartHeight = 160;
  const padding = 30;
  
  const getX = (index: number) => padding + (index * (chartWidth - 2 * padding)) / (growthMetrics.length - 1);
  const getY = (value: number) => chartHeight - padding - (value * (chartHeight - 2 * padding)) / 550;

  const actualPoints = growthMetrics
    .filter(d => d.actual > 0)
    .map((d, i) => `${getX(i)},${getY(d.actual)}`)
    .join(" L ");

  const forecastPoints = growthMetrics
    .map((d, i) => `${getX(i)},${getY(d.forecast)}`)
    .join(" L ");

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Overview Card */}
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Building size={16} className="text-primary" />
            <span>Enterprise Management Hub</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Audit compliance logs, DSO clinic regions and security configs</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 border border-border text-[11px] font-bold rounded-lg transition-colors focus-ring">
          <FileSpreadsheet size={13} />
          <span>Export Compliance Audit</span>
        </button>
      </div>

      {/* Grid Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Growth Forecast SVG Graph */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h4 className="font-bold text-xs flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-primary" />
                  <span>Case Volume Performance Forecast</span>
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Historical actual run-rate vs predictive H2 scaling forecast</p>
              </div>
              
              {activeMonthIdx !== null && (
                <div className="bg-slate-950 px-2.5 py-1 border border-border rounded-xl text-[9px] text-right font-bold select-none shrink-0">
                  <span className="text-slate-400 block text-[8px] uppercase">{growthMetrics[activeMonthIdx].month} Metrics</span>
                  <span className="text-primary mr-2">Act: {growthMetrics[activeMonthIdx].actual || "N/A"}</span>
                  <span className="text-indigo-400">Fore: {growthMetrics[activeMonthIdx].forecast}</span>
                </div>
              )}
            </div>

            {/* SVG Chart area */}
            <div className="h-44 w-full bg-slate-950/40 rounded-xl border border-slate-900 p-2 relative">
              <svg className="w-full h-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                {[100, 200, 300, 400, 500].map(v => (
                  <line 
                    key={v}
                    x1={padding}
                    y1={getY(v)}
                    x2={chartWidth - padding}
                    y2={getY(v)}
                    stroke="#1e293b"
                    strokeWidth="0.5"
                    strokeDasharray="2 4"
                  />
                ))}

                <path 
                  aria-label="Forecast volume trend line"
                  d={`M ${forecastPoints}`}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  strokeLinecap="round"
                />

                {actualPoints && (
                  <path 
                    aria-label="Actual volume trend line"
                    d={`M ${actualPoints}`}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                )}

                {growthMetrics.map((d, idx) => (
                  <g key={idx} className="cursor-pointer" onClick={() => setActiveMonthIdx(idx)}>
                    {d.actual > 0 && (
                      <circle 
                        cx={getX(idx)}
                        cy={getY(d.actual)}
                        r={activeMonthIdx === idx ? 5 : 3.5}
                        fill="#14b8a6"
                        className="transition-all"
                      />
                    )}
                    <circle 
                      cx={getX(idx)}
                      cy={getY(d.forecast)}
                      r={activeMonthIdx === idx ? 4 : 3}
                      fill="#6366f1"
                      className="transition-all"
                    />
                    <rect 
                      x={getX(idx) - 15}
                      y={0}
                      width={30}
                      height={chartHeight}
                      fill="transparent"
                      onMouseEnter={() => setActiveMonthIdx(idx)}
                    />
                  </g>
                ))}

                {growthMetrics.map((d, idx) => (
                  <text 
                    key={idx}
                    x={getX(idx)}
                    y={chartHeight - 8}
                    fill="#64748b"
                    fontSize="8"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {d.month}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          <div className="flex gap-4 text-[9px] text-slate-400 font-bold uppercase mt-3 pt-3 border-t border-slate-900">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500 block" /> Actual cases</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 block" /> Forecast cases</span>
          </div>
        </div>

        {/* Capacity meters card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div>
            <h4 className="font-bold text-xs flex items-center gap-1.5">
              <Activity size={14} className="text-primary" />
              <span>Location Printing Array Load</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Printer load volumes and regional SLAs met</p>
          </div>

          <div className="space-y-3">
            {[
              { name: "Stuttgart, DE (EU-Central)", load: 78, status: "Optimal", color: "bg-primary", sla: "98.4%" },
              { name: "Boston, US (US-East)", load: 92, status: "Critical Load", color: "bg-rose-500", sla: "94.2%" },
              { name: "Tokyo, JP (Asia-Pacific)", load: 45, status: "Optimal", color: "bg-primary", sla: "99.1%" }
            ].map((loc, idx) => (
              <div key={idx} className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-border rounded-xl space-y-1.5 text-xs hover:border-slate-350 transition-colors">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-200">{loc.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wide ${
                    loc.load >= 90 ? "bg-rose-500/10 text-rose-500 border border-rose-500/15" : "bg-primary/10 text-primary border border-primary/15"
                  }`}>
                    {loc.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Load: {loc.load}%</span>
                  <span className="flex items-center gap-0.5">
                    <Percent size={10} className="text-primary animate-pulse" /> SLA: {loc.sla}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className={`h-full ${loc.color}`} style={{ width: `${loc.load}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* DSO regional metrics KPI list */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h4 className="font-bold text-xs flex items-center gap-1.5">
            <Building size={14} className="text-primary" />
            <span>Clinic Groups (DSO) Regional KPIs</span>
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Operational consolidation metrics across DSO regional sites</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {[
            { region: "North America Hub", clinics: 18, cases: 1420, refinement: "10.5%", sla: "2.1 hrs", SLAColor: "text-emerald-500" },
            { region: "Europe Central Hub", clinics: 15, cases: 1240, refinement: "12.1%", sla: "3.4 hrs", SLAColor: "text-amber-500" },
            { region: "Asia Pacific Hub", clinics: 9, cases: 790, refinement: "9.8%", sla: "1.8 hrs", SLAColor: "text-emerald-500" }
          ].map((item, idx) => (
            <div key={idx} className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-border rounded-xl space-y-2">
              <span className="font-bold text-foreground block border-b border-border pb-1.5">{item.region}</span>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                <div>
                  <span>Active Sites:</span>
                  <p className="font-bold text-foreground mt-0.5">{item.clinics}</p>
                </div>
                <div>
                  <span>Total Cases:</span>
                  <p className="font-bold text-foreground mt-0.5">{item.cases}</p>
                </div>
                <div>
                  <span>Refinements:</span>
                  <p className="font-bold text-foreground mt-0.5">{item.refinement}</p>
                </div>
                <div>
                  <span>Avg SLA Speed:</span>
                  <p className={`font-bold mt-0.5 ${item.SLAColor}`}>{item.sla}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security & Audit logging */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Security toggles */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-5 shadow-sm">
          <div className="border-b border-border pb-3">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Lock size={15} className="text-primary" />
              <span>SSO & MFA Policies</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Configure compliance login requirements</p>
          </div>

          {securityLoading || !settings ? (
            <div className="space-y-4" aria-label="Loading security config">
              <div className="h-16 w-full animate-skeleton rounded-xl" />
              <div className="h-16 w-full animate-skeleton rounded-xl" />
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* SSO toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950/25 border border-border rounded-xl">
                <div>
                  <p className="text-xs font-bold text-foreground">SSO Provider Auth</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Force Okta/SAML login path</p>
                </div>
                <button 
                  onClick={handleToggleSSO} 
                  className="text-primary transition-spring focus-ring"
                  aria-label={`Toggle SSO Authentication: currently ${settings.ssoEnabled ? "Enabled" : "Disabled"}`}
                >
                  {settings.ssoEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </div>

              {/* MFA toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950/25 border border-border rounded-xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Multi-Factor MFA</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Enforce TOTP validation checks</p>
                </div>
                <button 
                  onClick={handleToggleMFA} 
                  className="text-primary transition-spring focus-ring"
                  aria-label={`Toggle Multi-Factor MFA: currently ${settings.mfaEnforced ? "Enforced" : "Not Enforced"}`}
                >
                  {settings.mfaEnforced ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </div>

              {/* domain */}
              <div className="space-y-1 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[9px]">Portal custom domain</span>
                <div className="flex gap-2">
                  <input
                    type="text" readOnly
                    value={settings.domain}
                    className="flex-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-slate-400 font-mono text-[10px] outline-none"
                  />
                  <button className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-[10px] font-bold transition-colors focus-ring">
                    Save Domain
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compliance logs trail */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-5 shadow-sm">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm flex items-center gap-2">
                <ShieldAlert size={15} className="text-primary" />
                <span>HIPAA Immutable Security Audit logs</span>
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Immutable record of patient data reads and authorization locks</p>
            </div>
            <span className="text-[8px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary select-none">
              COMPLIANT
            </span>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {logsLoading ? (
              <div className="space-y-2">
                <div className="h-12 w-full animate-skeleton rounded-xl" />
                <div className="h-12 w-full animate-skeleton rounded-xl" />
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="p-3 border border-border rounded-xl flex items-start justify-between gap-4 text-xs hover:border-slate-350 dark:hover:border-slate-800 transition-spring bg-slate-50/10">
                  <div className="space-y-1">
                    <p className="font-bold text-foreground text-xs leading-tight">{log.action}</p>
                    <div className="flex items-center gap-3 text-[9px] text-slate-400">
                      <span className="font-mono text-slate-350 dark:text-slate-500">{log.user}</span>
                      <span>IP: {log.ip}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[8px] uppercase font-black tracking-wide px-2 py-0.5 border rounded-full ${getSeverityBadge(log.severity)}`}>
                      {log.severity}
                    </span>
                    <p className="text-[9px] text-slate-400 mt-1.5">{log.timestamp}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
