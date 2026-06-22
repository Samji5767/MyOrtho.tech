"use client";

import React, { useState } from "react";
import { 
  ShieldCheck, 
  FileSpreadsheet, 
  ClipboardList, 
  History, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  FileText, 
  Lock,
  UserCheck
} from "lucide-react";

// Types corresponding to DB schemas
interface DHRRecord {
  id: string;
  caseId: string;
  patientName: string;
  batchNumber: string;
  manufacturedAt: string;
  operatorName: string;
  qcPassed: boolean;
  dhrHash: string;
}

interface CAPALog {
  id: string;
  reporterName: string;
  description: string;
  rootCause: string | null;
  correctiveAction: string | null;
  preventiveAction: string | null;
  status: "open" | "investigating" | "completed";
  createdAt: string;
}

interface AuditLog {
  id: string;
  userName: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export default function RegulatoryCompliance() {
  const [activeSubTab, setActiveSubTab] = useState<"dhr" | "capa" | "dhf" | "audit">("dhr");
  const [searchTerm, setSearchTerm] = useState("");
  
  // CAPA Form state
  const [showNewCAPA, setShowNewCAPA] = useState(false);
  const [capaDesc, setCapaDesc] = useState("");
  const [capaRoot, setCapaRoot] = useState("");
  const [capaCorrective, setCapaCorrective] = useState("");
  const [capaPreventive, setCapaPreventive] = useState("");

  const [dhrRecords, setDhrRecords] = useState<DHRRecord[]>([]);

  const [capaLogs, setCapaLogs] = useState<CAPALog[]>([]);

  const [auditLogs] = useState<AuditLog[]>([]);

  const handleCreateCAPA = (e: React.FormEvent) => {
    e.preventDefault();
    const newLog: CAPALog = {
      id: `capa-${Math.floor(Math.random() * 900) + 100}`,
      reporterName: "Lab Operator",
      description: capaDesc,
      rootCause: capaRoot || null,
      correctiveAction: capaCorrective || null,
      preventiveAction: capaPreventive || null,
      status: "open",
      createdAt: new Date().toISOString().split("T")[0]
    };
    setCapaLogs([newLog, ...capaLogs]);
    setCapaDesc("");
    setCapaRoot("");
    setCapaCorrective("");
    setCapaPreventive("");
    setShowNewCAPA(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full min-h-[600px] text-xs">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950/40 to-slate-900 border border-teal-500/20 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2 text-teal-400">
            <ShieldCheck size={20} />
            ISO 13485 & FDA Part 11 Regulatory Hub
          </h3>
          <p className="text-secondary mt-1 max-w-xl">
            Audit logs, Device History Records (DHR), Quality Management CAPA trackers, and Design History File version control ledgers.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 bg-slate-900/60 border border-border rounded-lg text-slate-300 flex items-center gap-1.5 font-semibold">
            <UserCheck size={14} className="text-teal-400" />
            21 CFR Part 11 Active
          </div>
        </div>
      </div>

      {/* Sub tabs and Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center border-b border-border pb-2">
        <div className="flex gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab("dhr")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "dhr"
                ? "bg-slate-800 text-teal-400 border border-teal-500/20"
                : "text-secondary hover:text-foreground hover:bg-slate-900/40"
            }`}
          >
            <FileSpreadsheet size={14} />
            Device History (DHR)
          </button>
          <button
            onClick={() => setActiveSubTab("capa")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "capa"
                ? "bg-slate-800 text-teal-400 border border-teal-500/20"
                : "text-secondary hover:text-foreground hover:bg-slate-900/40"
            }`}
          >
            <AlertTriangle size={14} />
            CAPA Register
          </button>
          <button
            onClick={() => setActiveSubTab("dhf")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "dhf"
                ? "bg-slate-800 text-teal-400 border border-teal-500/20"
                : "text-secondary hover:text-foreground hover:bg-slate-900/40"
            }`}
          >
            <FileText size={14} />
            Design History (DHF)
          </button>
          <button
            onClick={() => setActiveSubTab("audit")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "audit"
                ? "bg-slate-800 text-teal-400 border border-teal-500/20"
                : "text-secondary hover:text-foreground hover:bg-slate-900/40"
            }`}
          >
            <History size={14} />
            System Audit Trail
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-2.5 text-secondary" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Workspace Area */}
      <div className="flex-1 bg-card border border-border rounded-2xl p-6 min-h-[400px]">
        {activeSubTab === "dhr" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-sm text-primary">Device History Records</h4>
                <p className="text-secondary text-[11px]">Audit ledger mapping patient cases to print batches and quality control signatures.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-secondary font-bold uppercase text-[10px]">
                    <th className="pb-3">Batch ID</th>
                    <th className="pb-3">Patient Case</th>
                    <th className="pb-3">Operator</th>
                    <th className="pb-3">Date/Time</th>
                    <th className="pb-3">QC Status</th>
                    <th className="pb-3">Cryptographic SHA-256 Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {dhrRecords
                    .filter(rec => rec.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) || rec.patientName.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-900/20">
                        <td className="py-3 font-semibold text-primary">{rec.batchNumber}</td>
                        <td className="py-3">{rec.patientName}</td>
                        <td className="py-3">{rec.operatorName}</td>
                        <td className="py-3 text-secondary">{rec.manufacturedAt}</td>
                        <td className="py-3">
                          {rec.qcPassed ? (
                            <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded font-bold uppercase text-[9px] flex items-center gap-1 w-max">
                              <CheckCircle2 size={10} /> Passed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-bold uppercase text-[9px] flex items-center gap-1 w-max">
                              <AlertTriangle size={10} /> Rejected
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-mono text-slate-400 text-[10px] truncate max-w-[180px]" title={rec.dhrHash}>
                          {rec.dhrHash}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === "capa" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-sm text-primary">Quality CAPA Register (Corrective & Preventive Actions)</h4>
                <p className="text-secondary text-[11px]">Formal record of defects, root-cause analyses, and mitigation updates conforming to ISO 13485.</p>
              </div>
              <button
                onClick={() => setShowNewCAPA(!showNewCAPA)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition-colors"
              >
                <Plus size={14} /> Log Issue
              </button>
            </div>

            {showNewCAPA && (
              <form onSubmit={handleCreateCAPA} className="bg-slate-900/30 border border-border rounded-xl p-4 space-y-4">
                <h5 className="font-bold text-xs text-primary">Log New Corrective/Preventive Action Request</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-secondary">Defect Description *</label>
                    <textarea
                      required
                      value={capaDesc}
                      onChange={(e) => setCapaDesc(e.target.value)}
                      placeholder="Describe the issue or dimensional anomaly..."
                      className="w-full p-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs h-20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-secondary">Root Cause Analysis</label>
                    <textarea
                      value={capaRoot}
                      onChange={(e) => setCapaRoot(e.target.value)}
                      placeholder="Root cause parameters identified..."
                      className="w-full p-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs h-20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-secondary">Corrective Action Taken</label>
                    <textarea
                      value={capaCorrective}
                      onChange={(e) => setCapaCorrective(e.target.value)}
                      placeholder="Immediate fix applied to active batch..."
                      className="w-full p-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs h-20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-secondary">Preventive Action Plan</label>
                    <textarea
                      value={capaPreventive}
                      onChange={(e) => setCapaPreventive(e.target.value)}
                      placeholder="System-wide preventative updates..."
                      className="w-full p-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs h-20"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewCAPA(false)}
                    className="px-3 py-1.5 border border-border hover:bg-slate-900 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover"
                  >
                    Submit CAPA Log
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {capaLogs
                .filter(log => log.description.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((log) => (
                  <div key={log.id} className="border border-border/80 rounded-xl p-4 bg-slate-900/10 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{log.id}</span>
                        <span className="text-secondary">• Logged by {log.reporterName}</span>
                        <span className="text-slate-400 font-medium">({log.createdAt})</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                        log.status === "completed" 
                          ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {log.status}
                      </span>
                    </div>

                    <p className="text-primary font-medium">{log.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] pt-2 border-t border-border/50">
                      <div>
                        <span className="font-bold text-secondary block mb-0.5">Root Cause</span>
                        <p className="text-slate-300">{log.rootCause || "Under analysis..."}</p>
                      </div>
                      <div>
                        <span className="font-bold text-secondary block mb-0.5">Corrective Action</span>
                        <p className="text-slate-300">{log.correctiveAction || "Pending..."}</p>
                      </div>
                      <div>
                        <span className="font-bold text-secondary block mb-0.5">Preventive Action</span>
                        <p className="text-slate-300">{log.preventiveAction || "Pending..."}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeSubTab === "dhf" && (
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-sm text-primary">Design History File (DHF) Version Audit</h4>
              <p className="text-secondary text-[11px]">Cryptographic audit trail tracking STL scans, segmentation files, and aligner stage matrix configurations.</p>
            </div>

            <div className="border border-border rounded-xl p-4 space-y-4 bg-slate-900/10">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Lock size={16} className="text-teal-400" />
                  <span className="font-bold text-primary">DHF-001: Aligner CAD System Engine</span>
                </div>
                <span className="px-2.5 py-0.5 bg-slate-900 border border-border text-teal-400 rounded-full font-bold uppercase text-[9px]">
                  Version 4.8.2-Locked
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-secondary">Lower Arch Model (Mandibular)</span>
                  <span className="font-mono text-slate-400">SHA-256: 0ae37c...18f3a5</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-secondary">Upper Arch Model (Maxillary)</span>
                  <span className="font-mono text-slate-400">SHA-256: e8c2a9...d5b12a</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-secondary">PDL Finite Element Matrix Coefficients</span>
                  <span className="font-mono text-slate-400">SHA-256: 3c9e8d...a5c102</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === "audit" && (
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-sm text-primary">System-Wide Audit Trails</h4>
              <p className="text-secondary text-[11px]">Strict, immutable log of patient metadata updates, prescriptions, and device exports (Part 11 compliance).</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-secondary font-bold uppercase text-[10px]">
                    <th className="pb-3">Timestamp</th>
                    <th className="pb-3">Actor / User</th>
                    <th className="pb-3">Action performed</th>
                    <th className="pb-3">Details</th>
                    <th className="pb-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {auditLogs
                    .filter(log => log.action.toLowerCase().includes(searchTerm.toLowerCase()) || log.userName.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(log => (
                      <tr key={log.id} className="hover:bg-slate-900/20">
                        <td className="py-3 text-secondary font-mono">{log.createdAt}</td>
                        <td className="py-3 font-semibold text-primary">{log.userName}</td>
                        <td className="py-3 font-semibold text-teal-400">{log.action}</td>
                        <td className="py-3 text-slate-300 max-w-xs truncate" title={log.details}>{log.details}</td>
                        <td className="py-3 text-slate-400 font-mono text-[10px]">{log.ipAddress}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
