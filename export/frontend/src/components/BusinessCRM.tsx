"use client";

import React, { useState } from "react";
import { 
  Building2, 
  Users, 
  TrendingUp, 
  Layers, 
  Briefcase, 
  DollarSign, 
  Plus, 
  CheckCircle2, 
  ChevronRight 
} from "lucide-react";

interface CRMLead {
  id: string;
  name: string;
  contactEmail: string;
  stage: "discovery" | "demo_scheduled" | "negotiation" | "partnered";
  expectedValue: number;
  assignedTo: string;
}

interface BrandNode {
  id: string;
  brandName: string;
  relationship: "subsidiary" | "franchise" | "division";
  monthlyRevenue: number;
  totalCasesCount: number;
  status: string;
}

export default function BusinessCRM() {
  const [activeTab, setActiveTab] = useState<"crm" | "mna">("crm");
  
  // Mock CRM leads
  const [leads, setLeads] = useState<CRMLead[]>([
    {
      id: "ld-101",
      name: "Aesthetic Smile Dental Group (12 clinics)",
      contactEmail: "onboarding@aestheticsmile.com",
      stage: "negotiation",
      expectedValue: 45000,
      assignedTo: "Marcus Sterling"
    },
    {
      id: "ld-102",
      name: "Summit Orthodontics Center",
      contactEmail: "info@summitortho.com",
      stage: "demo_scheduled",
      expectedValue: 12000,
      assignedTo: "Elena Rostova"
    },
    {
      id: "ld-103",
      name: "Metro Dental Labs (Distributor)",
      contactEmail: "partner@metrodentallabs.de",
      stage: "partnered",
      expectedValue: 85000,
      assignedTo: "Marcus Sterling"
    }
  ]);

  // Mock M&A multi-brands
  const [brands, setBrands] = useState<BrandNode[]>([
    {
      id: "br-1",
      brandName: "MyOrtho Premium Clear Aligners",
      relationship: "division",
      monthlyRevenue: 125000,
      totalCasesCount: 420,
      status: "active"
    },
    {
      id: "br-2",
      brandName: "AlignExpress White-Label Franchise",
      relationship: "franchise",
      monthlyRevenue: 48000,
      totalCasesCount: 180,
      status: "active"
    },
    {
      id: "br-3",
      brandName: "RestorCrown Laboratory Subsidiary",
      relationship: "subsidiary",
      monthlyRevenue: 62000,
      totalCasesCount: 290,
      status: "integration_phase"
    }
  ]);

  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadValue, setNewLeadValue] = useState(15000);
  const [newLeadEmail, setNewLeadEmail] = useState("");

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    const newLd: CRMLead = {
      id: `ld-${Math.floor(Math.random() * 900) + 100}`,
      name: newLeadName,
      contactEmail: newLeadEmail,
      stage: "discovery",
      expectedValue: newLeadValue,
      assignedTo: "Dr. Sarah Jenkins"
    };
    setLeads([...leads, newLd]);
    setNewLeadName("");
    setNewLeadEmail("");
  };

  const getPipelineSum = () => {
    return leads.reduce((sum, current) => sum + current.expectedValue, 0);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Business CRM & Franchise Viewport */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <Building2 size={20} className="text-teal-400" />
                CRM & Corporate Brand Ecosystem
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Manage partner clinic pipelines, laboratory distributors, and subsidiary brand integrations.</p>
            </div>
            
            <div className="flex gap-1 bg-slate-900 border border-border p-0.5 rounded-lg">
              <button
                onClick={() => setActiveTab("crm")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeTab === "crm" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                CRM Leads
              </button>
              <button
                onClick={() => setActiveTab("mna")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeTab === "mna" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                M&A Portfolio
              </button>
            </div>
          </div>

          {activeTab === "crm" ? (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                  <Briefcase size={14} className="text-teal-400" /> Sales Funnel & Lead Register
                </h4>
                <div className="text-right">
                  <span className="text-[10px] text-secondary font-semibold block uppercase">Total Pipeline Valuation</span>
                  <span className="text-sm font-extrabold text-teal-400">${getPipelineSum().toLocaleString()} USD</span>
                </div>
              </div>

              {/* Lead placement funnel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/10 border border-border rounded-xl p-4 space-y-3">
                  <h5 className="font-bold text-xs text-primary">Add Opportunity Lead</h5>
                  <form onSubmit={handleCreateLead} className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-secondary">Clinic/Group Name</label>
                      <input
                        type="text" required
                        placeholder="e.g. Pacific Dental"
                        value={newLeadName} onChange={(e) => setNewLeadName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-secondary">Contact Email</label>
                      <input
                        type="email" required
                        placeholder="contact@pacificdental.com"
                        value={newLeadEmail} onChange={(e) => setNewLeadEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-secondary">Expected Deal Value (USD)</label>
                      <input
                        type="number" required
                        value={newLeadValue} onChange={(e) => setNewLeadValue(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg"
                    >
                      Log Lead
                    </button>
                  </form>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {leads.map(lead => (
                    <div key={lead.id} className="p-3 bg-slate-900/30 border border-border rounded-xl space-y-1.5">
                      <div className="flex justify-between font-bold">
                        <span className="text-primary truncate max-w-[150px]">{lead.name}</span>
                        <span className="text-teal-400 font-bold">${lead.expectedValue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span className="capitalize">{lead.stage.replace("_", " ")}</span>
                        <span>Rep: {lead.assignedTo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                <Layers size={14} className="text-teal-400" /> Multi-Brand Franchise & Corporate Governance
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-secondary font-bold uppercase text-[10px]">
                      <th className="pb-3">Brand Name</th>
                      <th className="pb-3">Relation</th>
                      <th className="pb-3">Monthly Rev</th>
                      <th className="pb-3">Total Cases</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {brands.map(brand => (
                      <tr key={brand.id} className="hover:bg-slate-900/20">
                        <td className="py-3 font-semibold text-primary">{brand.brandName}</td>
                        <td className="py-3 capitalize text-secondary">{brand.relationship}</td>
                        <td className="py-3 font-bold text-primary">${brand.monthlyRevenue.toLocaleString()}</td>
                        <td className="py-3 text-secondary">{brand.totalCasesCount}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                            brand.status === "active" 
                              ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}>
                            {brand.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-border mt-6 text-slate-400">
          Governance dashboard locks credentials based on multi-region enterprise access setups.
        </div>
      </div>

      {/* CRM activity summary */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <TrendingUp size={16} className="text-teal-400" /> Executive M&A Metrics
        </h4>

        <div className="grid grid-cols-1 gap-3 text-center">
          <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-border">
            <span className="text-[10px] text-secondary font-semibold uppercase block">Total Managed Brands</span>
            <span className="text-xl font-black text-primary block mt-1">3 Brands</span>
          </div>
          <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-border">
            <span className="text-[10px] text-secondary font-semibold uppercase block">Portfolio Monthly Revenue</span>
            <span className="text-xl font-black text-teal-400 block mt-1">$235,000 USD</span>
          </div>
          <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-border">
            <span className="text-[10px] text-secondary font-semibold uppercase block">Total Case Throughput</span>
            <span className="text-xl font-black text-primary block mt-1">890 Cases</span>
          </div>
        </div>
      </div>

    </div>
  );
}
