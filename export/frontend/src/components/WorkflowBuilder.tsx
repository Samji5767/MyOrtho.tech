"use client";

import React, { useState } from "react";
import { GitFork, Mail, Trash, Save, Plus, ArrowRight, ShieldCheck, Settings, Activity, Play, Terminal } from "lucide-react";

interface WorkflowRule {
  id: string;
  trigger: string;
  condition: string;
  action: string;
  isActive: boolean;
}

const initialRules: WorkflowRule[] = [
  { id: "rule1", trigger: "Scan Uploaded", condition: "If Region is EU-Central", action: "Route to Stuttgart Lab", isActive: true },
  { id: "rule2", trigger: "Staging Setup", condition: "If Overjet > 4.5mm", action: "Flag for Senior Clinician Review", isActive: true },
  { id: "rule3", trigger: "Print Job Failed", condition: "If Maint Status is Error", action: "SMS Operator & Escalate Job", isActive: false }
];

export default function WorkflowBuilder() {
  const [rules, setRules] = useState<WorkflowRule[]>(initialRules);
  const [newTrigger, setNewTrigger] = useState("Scan Uploaded");
  const [newCondition, setNewCondition] = useState("If Region is EU-Central");
  const [newAction, setNewAction] = useState("Route to Stuttgart Lab");

  const [logs, setLogs] = useState([
    { id: "log-1", timestamp: "17:01:22", rule: "Staging Setup", message: "Rule Staging Setup fired: Tooth FDI #12 overjet detected as 4.8mm. Case flagged for Senior Review.", status: "fired" },
    { id: "log-2", timestamp: "16:55:04", rule: "Scan Uploaded", message: "Rule Scan Uploaded triggered: case Eleanor Vance routed to Stuttgart Lab.", status: "success" }
  ]);

  const triggerSimulationEvent = () => {
    const activeRules = rules.filter(r => r.isActive);
    if (activeRules.length === 0) return;
    const rule = activeRules[Math.floor(Math.random() * activeRules.length)];
    const time = new Date().toLocaleTimeString();
    
    let msg = "";
    if (rule.trigger === "Scan Uploaded") {
      msg = `Rule Scan Uploaded triggered: case patient Marcus Aurelius (${rule.condition}) routed successfully.`;
    } else if (rule.trigger === "Staging Setup") {
      msg = `Rule Staging Setup fired: case FDI 11-21 setup verified. Action: ${rule.action}`;
    } else {
      msg = `Rule ${rule.trigger} fired. Executed: ${rule.action}`;
    }

    setLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: time,
        rule: rule.trigger,
        message: msg,
        status: "fired"
      },
      ...prev
    ]);
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const newRule: WorkflowRule = {
      id: `rule${rules.length + 1}`,
      trigger: newTrigger,
      condition: newCondition,
      action: newAction,
      isActive: true
    };
    setRules([...rules, newRule]);
  };

  const handleToggle = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  const handleDelete = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* List of active workflows */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 flex flex-col justify-between shadow-card">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <GitFork size={20} className="text-primary" />
                  Workflow Automation Rules
                </h3>
                <p className="text-xs text-secondary mt-0.5">Automate clinic notifications, case routing, and approvals</p>
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-xs font-bold">
                <ShieldCheck size={14} /> HIPAA Compliant
              </span>
            </div>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {rules.map(rule => (
                <div 
                  key={rule.id} 
                  className={`p-4 border rounded-xl flex items-center justify-between gap-4 transition-all text-xs ${
                    rule.isActive ? "border-border bg-slate-50/20" : "border-border/40 opacity-50 bg-slate-100/10"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {rule.trigger}
                    </span>
                    <ArrowRight size={12} className="text-slate-400" />
                    <span className="text-secondary font-medium">
                      {rule.condition}
                    </span>
                    <ArrowRight size={12} className="text-slate-400" />
                    <span className="font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                      {rule.action.includes("Mail") || rule.action.includes("SMS") ? <Mail size={12} /> : <Settings size={12} />}
                      {rule.action}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Toggle switch */}
                    <button 
                      onClick={() => handleToggle(rule.id)}
                      className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                        rule.isActive ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-full bg-white transition-transform ${
                        rule.isActive ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>
                    <button 
                      onClick={() => handleDelete(rule.id)}
                      className="p-1 hover:text-red-400 transition-colors text-slate-400"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-border mt-6 flex justify-end">
            <button className="flex items-center gap-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors shadow-sm">
              <Save size={14} /> Save Configuration
            </button>
          </div>
        </div>

        {/* No-code builder creation form */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <form onSubmit={handleAddRule} className="space-y-6">
            <div>
              <h4 className="font-semibold text-sm border-b border-border pb-3 flex items-center gap-2">
                <Plus size={16} className="text-primary" />
                Add Rule Logic
              </h4>
              <p className="text-[11px] text-secondary mt-0.5">Create trigger-conditional events</p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Trigger Selection */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Trigger Event</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                  value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)}
                >
                  <option value="Scan Uploaded">Scan Uploaded</option>
                  <option value="Staging Setup">Staging Setup</option>
                  <option value="Print Job Failed">Print Job Failed</option>
                  <option value="Clinic Approved">Clinic Approved</option>
                </select>
              </div>

              {/* Condition input */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Condition Parameters</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                  value={newCondition} onChange={(e) => setNewCondition(e.target.value)}
                >
                  <option value="If Region is EU-Central">If Region is EU-Central</option>
                  <option value="If Overjet > 4.5mm">If Overjet &gt; 4.5mm</option>
                  <option value="If Maint Status is Error">If Maint Status is Error</option>
                  <option value="If Class is Class III">If Class is Class III</option>
                </select>
              </div>

              {/* Action Selection */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Route / Trigger Action</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                  value={newAction} onChange={(e) => setNewAction(e.target.value)}
                >
                  <option value="Route to Stuttgart Lab">Route to Stuttgart Lab</option>
                  <option value="Flag for Senior Clinician Review">Flag for Senior Clinician Review</option>
                  <option value="SMS Operator & Escalate Job">SMS Operator & Escalate Job</option>
                  <option value="Email Accounting invoice">Email Accounting invoice</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={14} /> Add Automation
            </button>
          </form>
        </div>
      </div>

      {/* Live Event Router & Logs Feed */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="space-y-0.5">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Terminal size={16} className="text-teal-400" />
              Live Event Router & Execution Feed
            </h4>
            <p className="text-[11px] text-secondary">Monitor live web-hook evaluations, case routing, and email alerts</p>
          </div>
          <button
            onClick={triggerSimulationEvent}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-border rounded-lg text-secondary hover:text-foreground text-xs font-bold transition-all shadow-sm"
          >
            <Play size={12} className="text-teal-400 animate-pulse" /> Simulate Event Trigger
          </button>
        </div>

        <div className="h-48 overflow-y-auto bg-slate-950/80 rounded-xl border border-slate-900 p-4 font-mono text-[11px] space-y-2.5">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-4 items-start hover:bg-slate-900/40 p-1.5 rounded transition-all">
              <span className="text-slate-500 shrink-0 font-bold select-none">{log.timestamp}</span>
              <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-teal-400 rounded text-[9px] shrink-0 font-bold uppercase tracking-wider">
                {log.rule}
              </span>
              <p className="text-slate-300 leading-normal flex-1">{log.message}</p>
              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                log.status === "fired" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-teal-500/10 text-teal-400 border border-teal-500/20"
              }`}>
                {log.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
