"use client";

import React, { useState } from "react";
import { useBilling } from "@/hooks/useApi";
import { 
  CreditCard, 
  FileText, 
  Download, 
  Sliders, 
  Activity, 
  TrendingUp, 
  CheckCircle,
  HelpCircle
} from "lucide-react";

interface InvoiceRecord {
  id: string;
  billingPeriod: string;
  totalCost: number;
  status: "paid" | "open";
  invoiceDate: string;
}

export default function BillingManager() {
  const [activeTab, setActiveTab] = useState<"meters" | "plan">("meters");
  const [selectedPlan, setSelectedPlan] = useState("premium");

  const { billingData, loading: billingLoading } = useBilling();

  const meters = billingData?.meters || {
    caseExports: 12,
    apiCalls: 1245,
    resinMl: 450,
    storageGb: 48,
  };

  const invoices: InvoiceRecord[] = billingData?.invoices || [
    { id: "inv-9901", billingPeriod: "May 2026", totalCost: 485.45, status: "paid", invoiceDate: "2026-06-01" },
    { id: "inv-9854", billingPeriod: "Apr 2026", totalCost: 390.12, status: "paid", invoiceDate: "2026-05-01" }
  ];

  const calculateMeterCost = (qty: number, rate: number) => {
    return (qty * rate).toFixed(2);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* SaaS billing & meters */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <CreditCard size={20} className="text-teal-400" />
                Usage Metering & Billing Engine
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Track real-time case volumes, API requests, resin printing metrics, and storage use.</p>
            </div>
            
            <div className="flex gap-1 bg-slate-900 border border-border p-0.5 rounded-lg">
              <button
                onClick={() => setActiveTab("meters")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeTab === "meters" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                Usage Meters
              </button>
              <button
                onClick={() => setActiveTab("plan")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeTab === "plan" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                SaaS Subscriptions
              </button>
            </div>
          </div>

          {activeTab === "meters" ? (
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                <Activity size={14} className="text-teal-400" /> Current Billing Cycle Usage (June)
              </h4>

              <div className="space-y-3">
                {/* Case exports */}
                <div className="p-3 bg-slate-900/10 border border-border rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-bold block text-primary">Case Staging Exports</span>
                    <span className="text-[10px] text-slate-400">Total exports logged: {meters.caseExports} cases (@ $15.00)</span>
                  </div>
                  <span className="text-sm font-extrabold text-primary">${calculateMeterCost(meters.caseExports, 15)}</span>
                </div>

                {/* API calls */}
                <div className="p-3 bg-slate-900/10 border border-border rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-bold block text-primary">API Developer Calls</span>
                    <span className="text-[10px] text-slate-400">Total request volume: {meters.apiCalls} calls (@ $0.05)</span>
                  </div>
                  <span className="text-sm font-extrabold text-primary">${calculateMeterCost(meters.apiCalls, 0.05)}</span>
                </div>

                {/* Resin printed */}
                <div className="p-3 bg-slate-900/10 border border-border rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-bold block text-primary">Resin Volume Printed (mL)</span>
                    <span className="text-[10px] text-slate-400">Total SLA print usage: {meters.resinMl} mL (@ $0.25)</span>
                  </div>
                  <span className="text-sm font-extrabold text-primary">${calculateMeterCost(meters.resinMl, 0.25)}</span>
                </div>

                {/* Storage usage */}
                <div className="p-3 bg-slate-900/10 border border-border rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-bold block text-primary">Cloud Object Storage (GB)</span>
                    <span className="text-[10px] text-slate-400">Total models size: {meters.storageGb} GB (@ $0.10)</span>
                  </div>
                  <span className="text-sm font-extrabold text-primary">${calculateMeterCost(meters.storageGb, 0.10)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                <Sliders size={14} className="text-teal-400" /> Choose Clinic Subscription Tier
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div 
                  onClick={() => setSelectedPlan("standard")}
                  className={`border rounded-2xl p-4 cursor-pointer transition-all space-y-3 flex flex-col justify-between ${
                    selectedPlan === "standard" ? "border-primary bg-primary/5 shadow-glow" : "border-border hover:bg-slate-900/15"
                  }`}
                >
                  <div>
                    <span className="font-extrabold text-xs text-primary">Standard</span>
                    <span className="text-xl font-black block mt-1">$299 / Mo</span>
                  </div>
                  <span className="text-[9px] text-slate-400">Up to 2 printers, mTLS security.</span>
                </div>

                <div 
                  onClick={() => setSelectedPlan("premium")}
                  className={`border rounded-2xl p-4 cursor-pointer transition-all space-y-3 flex flex-col justify-between ${
                    selectedPlan === "premium" ? "border-primary bg-primary/5 shadow-glow" : "border-border hover:bg-slate-900/15"
                  }`}
                >
                  <div>
                    <span className="font-extrabold text-xs text-primary">Premium Clinic</span>
                    <span className="text-xl font-black block mt-1">$599 / Mo</span>
                  </div>
                  <span className="text-[9px] text-slate-400">Up to 10 printers, custom DNS.</span>
                </div>

                <div 
                  onClick={() => setSelectedPlan("enterprise")}
                  className={`border rounded-2xl p-4 cursor-pointer transition-all space-y-3 flex flex-col justify-between ${
                    selectedPlan === "enterprise" ? "border-primary bg-primary/5 shadow-glow" : "border-border hover:bg-slate-900/15"
                  }`}
                >
                  <div>
                    <span className="font-extrabold text-xs text-primary">Enterprise Group</span>
                    <span className="text-xl font-black block mt-1">Custom Quote</span>
                  </div>
                  <span className="text-[9px] text-slate-400">Unlimited nodes, SAML SSO.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-border mt-6 text-slate-400">
          Usage statistics recalculate dynamically at midnight (UTC).
        </div>
      </div>

      {/* Invoice history */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <FileText size={16} /> Past Invoice History
        </h4>

        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="border border-border rounded-xl p-3.5 bg-slate-900/10 space-y-2 flex justify-between items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-primary">{inv.billingPeriod}</span>
                  <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-[8px]">
                    {inv.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  <p><span className="font-bold text-secondary">Date:</span> {inv.invoiceDate}</p>
                  <p><span className="font-bold text-secondary">Charged:</span> ${inv.totalCost.toFixed(2)} USD</p>
                </div>
              </div>
              
              <button className="p-2 border border-border hover:bg-slate-900 rounded-lg">
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
