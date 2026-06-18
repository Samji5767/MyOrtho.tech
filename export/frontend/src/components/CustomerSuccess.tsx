"use client";

import React, { useState } from "react";
import { 
  Users, 
  LifeBuoy, 
  Clock, 
  Plus, 
  TrendingUp, 
  ShieldCheck, 
  CheckCircle,
  AlertTriangle
} from "lucide-react";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved";
  slaStatus: "within_sla" | "warning" | "breached";
  createdAt: string;
}

export default function CustomerSuccess() {
  const [activeTab, setActiveTab] = useState<"onboarding" | "tickets">("onboarding");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [desc, setDesc] = useState("");

  // Customer Success Metrics
  const healthScore = 88; // Excellent
  const churnProbability = 4.2; // Low risk

  const [tickets, setTickets] = useState<SupportTicket[]>([
    {
      id: "tkt-101",
      subject: "mTLS handshake certificate expiration warning",
      description: "Organization client mTLS token expiring on secondary region Standby replica.",
      status: "in_progress",
      slaStatus: "within_sla",
      createdAt: "2026-06-14 10:00"
    },
    {
      id: "tkt-102",
      subject: "Zendura aligner sheet cost calculations mismatch",
      description: "Procurement invoice showing 180 USD price index when reorder trigger logged 175 USD.",
      status: "resolved",
      slaStatus: "within_sla",
      createdAt: "2026-06-11 15:30"
    }
  ]);

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const newTkt: SupportTicket = {
      id: `tkt-${Math.floor(Math.random() * 900) + 100}`,
      subject,
      description: desc,
      status: "open",
      slaStatus: "within_sla",
      createdAt: new Date().toISOString().replace("T", " ").substring(0, 16)
    };
    setTickets([newTkt, ...tickets]);
    setSubject("");
    setDesc("");
    setShowTicketForm(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Customer Success Lifecyle CRM */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <Users size={20} className="text-teal-400" />
                Customer Success & SLA Ticketing
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Monitor clinic adoption metrics, system health scores, SLA statuses, and support tickets.</p>
            </div>
            
            <div className="flex gap-1 bg-slate-900 border border-border p-0.5 rounded-lg">
              <button
                onClick={() => setActiveTab("onboarding")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeTab === "onboarding" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                Adoption Analytics
              </button>
              <button
                onClick={() => setActiveTab("tickets")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeTab === "tickets" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                Support Tickets
              </button>
            </div>
          </div>

          {activeTab === "onboarding" ? (
            <div className="space-y-5">
              <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                <TrendingUp size={14} className="text-teal-400" /> Clinic Onboarding & Adoption metrics
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/10 border border-border rounded-xl p-4 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Health Score Status</span>
                  <span className="text-2xl font-black text-teal-400 block mt-1">{healthScore}%</span>
                  <p className="text-slate-400 mt-1 leading-normal">Your clinic displays excellent product usage; logins remain regular, with high print success rates.</p>
                </div>
                <div className="bg-slate-900/10 border border-border rounded-xl p-4 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Churn Probability Index</span>
                  <span className="text-2xl font-black text-primary block mt-1">{churnProbability}%</span>
                  <p className="text-slate-400 mt-1 leading-normal">Low risk of churn detected. Interactive 3D workspace case sessions are consistent weekly.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                  <LifeBuoy size={14} className="text-teal-400" /> Active SLA Support Tickets
                </h4>
                <button
                  onClick={() => setShowTicketForm(!showTicketForm)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition-colors"
                >
                  <Plus size={14} /> Open Ticket
                </button>
              </div>

              {showTicketForm && (
                <form onSubmit={handleCreateTicket} className="bg-slate-900/30 border border-border rounded-xl p-4 space-y-4">
                  <h5 className="font-bold text-xs text-primary">Open New SLA Support Ticket</h5>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-secondary">Subject / Issue Summary *</label>
                      <input
                        type="text" required
                        placeholder="Brief title..."
                        value={subject} onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-secondary">Problem Description *</label>
                      <textarea
                        required
                        placeholder="Provide details about the printer connection error, API webhook failure, or coordinate mismatch..."
                        value={desc} onChange={(e) => setDesc(e.target.value)}
                        className="w-full p-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none h-20 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button" onClick={() => setShowTicketForm(false)}
                        className="px-3 py-1.5 border border-border hover:bg-slate-900 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover"
                      >
                        Submit Ticket
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t.id} className="border border-border/80 rounded-xl p-4 bg-slate-900/10 space-y-2">
                    <div className="flex justify-between items-start font-bold">
                      <div className="flex items-center gap-2">
                        <span className="text-primary">{t.id}: {t.subject}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] uppercase ${
                          t.status === "resolved" 
                            ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <span className="text-slate-400 font-medium">{t.createdAt}</span>
                    </div>
                    <p className="text-slate-300 leading-normal">{t.description}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1.5 border-t border-border/40 font-mono">
                      <Clock size={10} className="text-teal-400" />
                      SLA Threshold Status: <span className="text-teal-400 font-bold uppercase">{t.slaStatus.replace("_", " ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-border mt-6 text-slate-400">
          SLA support requests trigger automated NATS alert notifications to laboratory technician channels.
        </div>
      </div>

      {/* Customer Success Highlights */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <ShieldCheck size={16} className="text-teal-400" /> Enterprise SLA Guarantees
        </h4>

        <div className="space-y-3">
          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-border flex gap-3">
            <Clock size={18} className="text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-primary">1 Hour RTO Failover</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Failover systems automatically spin up standbys replica instances in secondary region.</span>
            </div>
          </div>

          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-border flex gap-3">
            <CheckCircle size={18} className="text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-primary">SLA Tier 1 Severity</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Critical printability anomalies resolved within 4 hours by engineering success managers.</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
