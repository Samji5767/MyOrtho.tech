"use client";

import React, { useState } from "react";
import { 
  CreditCard, 
  FileSpreadsheet, 
  DollarSign, 
  Activity, 
  ShieldCheck, 
  Plus, 
  Trash2,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

interface ClaimRecord {
  id: string;
  insuranceName: string;
  policyId: string;
  authCode: string | null;
  amount: number;
  status: "approved" | "pending" | "rejected";
  createdAt: string;
}

export default function InsuranceFinancing() {
  const [activeSegment, setActiveSegment] = useState<"insurance" | "financing">("insurance");
  
  // Financing calculator states
  const [totalCost, setTotalCost] = useState(4500);
  const [apr, setApr] = useState(3.5);
  const [months, setMonths] = useState(24);

  // Insurance Eligibility checker states
  const [carrier, setCarrier] = useState("Delta Dental");
  const [policyNum, setPolicyNum] = useState("DD-891-AA");
  const [eligibilityResult, setEligibilityResult] = useState<"idle" | "eligible" | "ineligible">("idle");

  const [claims, setClaims] = useState<ClaimRecord[]>([
    {
      id: "clm-401",
      insuranceName: "Delta Dental PPO",
      policyId: "DD-891-AA",
      authCode: "AUTH-89102",
      amount: 1500,
      status: "approved",
      createdAt: "2026-06-10"
    },
    {
      id: "clm-402",
      insuranceName: "Aetna Dental",
      policyId: "AE-201-92",
      authCode: null,
      amount: 1800,
      status: "pending",
      createdAt: "2026-06-13"
    }
  ]);

  const handleCheckEligibility = () => {
    setEligibilityResult("eligible");
  };

  // Monthly EMI calculations: P * r * (1+r)^n / ((1+r)^n - 1)
  const calculateEMI = () => {
    const P = totalCost;
    const r = apr / 12 / 100;
    const n = months;
    if (r === 0) return (P / n).toFixed(2);
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return emi.toFixed(2);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Dynamic Claims & EMI calculators */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <CreditCard size={20} className="text-teal-400" />
                Insurance & Patient Financing
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Automate prior authorizations, claims filing, and monthly payment plans.</p>
            </div>
            
            <div className="flex gap-1 bg-slate-900 border border-border p-0.5 rounded-lg">
              <button
                onClick={() => setActiveSegment("insurance")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeSegment === "insurance" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                Claims & Auth
              </button>
              <button
                onClick={() => setActiveSegment("financing")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeSegment === "financing" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                Financing EMI
              </button>
            </div>
          </div>

          {activeSegment === "insurance" ? (
            <div className="space-y-5">
              <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-teal-400" /> Prior Authorization & Eligibility Check
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-secondary">Insurance Provider Carrier</label>
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                  >
                    <option value="Delta Dental">Delta Dental</option>
                    <option value="Aetna Dental">Aetna Dental</option>
                    <option value="MetLife Dental">MetLife Dental</option>
                    <option value="Cigna Dental">Cigna Dental</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-secondary">Policy Member ID</label>
                  <input
                    type="text"
                    value={policyNum}
                    onChange={(e) => setPolicyNum(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleCheckEligibility}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                Verify Coverage Eligibility
              </button>

              {eligibilityResult === "eligible" && (
                <div className="bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl p-3 flex gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Patient Eligible for Aligner Coverage</span>
                    <span className="text-[10px] block mt-0.5">
                      Delta Dental policy authorizes up to $1,500.00 in clear aligner benefits (Code: D8080).
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                <DollarSign size={14} className="text-teal-400" /> Patient Payment Installment Calculator
              </h4>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-secondary">Total Financed Principal</span>
                    <span className="text-primary font-bold">${totalCost} USD</span>
                  </div>
                  <input
                    type="range" min="1000" max="10000" step="100"
                    value={totalCost}
                    onChange={(e) => setTotalCost(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-secondary">Financing interest rate APR (%)</span>
                    <span className="text-primary font-bold">{apr.toFixed(2)} %</span>
                  </div>
                  <input
                    type="range" min="0" max="15" step="0.25"
                    value={apr}
                    onChange={(e) => setApr(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-secondary">Term Length (Months)</span>
                    <span className="text-primary font-bold">{months} Months</span>
                  </div>
                  <input
                    type="range" min="6" max="36" step="6"
                    value={months}
                    onChange={(e) => setMonths(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {activeSegment === "financing" && (
          <div className="bg-slate-900/40 border border-border rounded-xl p-4 mt-6 flex justify-between items-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-secondary">Estimated Monthly Instalment</span>
              <span className="text-base font-extrabold text-teal-400 block mt-0.5">${calculateEMI()} / Month</span>
            </div>
            <button className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg">
              Activate Plan
            </button>
          </div>
        )}
      </div>

      {/* Claims log database list */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <FileSpreadsheet size={16} /> Claims Tracker Ledger
        </h4>

        <div className="space-y-3">
          {claims.map((claim) => (
            <div key={claim.id} className="border border-border rounded-xl p-3.5 bg-slate-900/10 space-y-2">
              <div className="flex justify-between items-center font-bold">
                <span className="text-primary">{claim.insuranceName}</span>
                <span className={`px-2 py-0.5 rounded uppercase text-[8px] font-bold ${
                  claim.status === "approved" 
                    ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                    : claim.status === "pending"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>
                  {claim.status}
                </span>
              </div>
              <div className="space-y-1 text-slate-400 text-[10px]">
                <p><span className="font-bold text-secondary">Policy Num:</span> {claim.policyId}</p>
                <p><span className="font-bold text-secondary">Claim Amount:</span> ${claim.amount} USD</p>
                <p><span className="font-bold text-secondary">Auth Code:</span> {claim.authCode || "N/A"}</p>
                <p><span className="font-bold text-secondary">Date:</span> {claim.createdAt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
