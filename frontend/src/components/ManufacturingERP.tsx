"use client";

import React, { useState } from "react";
import { 
  Building2, 
  FileSpreadsheet, 
  DollarSign, 
  CheckCircle, 
  Plus, 
  TrendingUp, 
  Percent, 
  Truck 
} from "lucide-react";

interface PurchaseOrder {
  id: string;
  vendorName: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  status: "draft" | "ordered" | "received" | "billed";
}

interface Vendor {
  id: string;
  name: string;
  category: string;
  rating: number;
  contact: string;
}

export default function ManufacturingERP() {
  const [activeTab, setActiveTab] = useState<"po" | "margin">("po");
  const [showPOModal, setShowPOModal] = useState(false);
  const [vendorName, setVendorName] = useState("SprintRay Inc");
  const [itemName, setItemName] = useState("SprintRay Model Resin (1L)");
  const [qty, setQty] = useState(5);
  const [unitPrice, setUnitPrice] = useState(120);

  const [vendors] = useState<Vendor[]>([
    { id: "v-1", name: "SprintRay Inc", category: "Resins & Printers", rating: 4.8, contact: "orders@sprintray.com" },
    { id: "v-2", name: "Zendura Dental", category: "Thermoforming Sheets", rating: 4.9, contact: "support@zenduradental.com" },
    { id: "v-3", name: "Formlabs Dental", category: "Printers & Resins", rating: 4.7, contact: "sales@formlabs.com" }
  ]);

  const [pos, setPos] = useState<PurchaseOrder[]>([
    {
      id: "po-101",
      vendorName: "SprintRay Inc",
      itemName: "SprintRay Model Resin (1L)",
      quantity: 8,
      unitPrice: 120,
      totalCost: 960,
      status: "received"
    },
    {
      id: "po-102",
      vendorName: "Zendura Dental",
      itemName: "Zendura FLX Aligner Sheets (100pcs)",
      quantity: 3,
      unitPrice: 180,
      totalCost: 540,
      status: "ordered"
    }
  ]);

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    const newPO: PurchaseOrder = {
      id: `po-${Math.floor(Math.random() * 900) + 100}`,
      vendorName,
      itemName,
      quantity: qty,
      unitPrice,
      totalCost: qty * unitPrice,
      status: "ordered"
    };
    setPos([newPO, ...pos]);
    setShowPOModal(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Manufacturing operations */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <Building2 size={20} className="text-teal-400" />
                Manufacturing ERP & Cost Accounting
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Manage material procurement purchase orders, vendor indexes, and production margins.</p>
            </div>
            
            <div className="flex gap-1 bg-slate-900 border border-border p-0.5 rounded-lg">
              <button
                onClick={() => setActiveTab("po")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeTab === "po" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                Purchase Orders
              </button>
              <button
                onClick={() => setActiveTab("margin")}
                className={`px-3 py-1 rounded-md font-bold transition-all text-[10px] ${
                  activeTab === "margin" ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                }`}
              >
                Margin Analysis
              </button>
            </div>
          </div>

          {activeTab === "po" ? (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                  <FileSpreadsheet size={14} className="text-teal-400" /> Procurement Purchase Orders
                </h4>
                <button
                  onClick={() => setShowPOModal(!showPOModal)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition-colors"
                >
                  <Plus size={14} /> Create PO
                </button>
              </div>

              {showPOModal && (
                <form onSubmit={handleCreatePO} className="bg-slate-900/30 border border-border rounded-xl p-4 space-y-4">
                  <h5 className="font-bold text-xs text-primary">Draft New Purchase Order</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-secondary">Vendor</label>
                      <select
                        value={vendorName} onChange={(e) => setVendorName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                      >
                        {vendors.map(v => (
                          <option key={v.id} value={v.name}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-secondary">Item Details</label>
                      <input
                        type="text" required
                        value={itemName} onChange={(e) => setItemName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-secondary">Quantity</label>
                      <input
                        type="number" required
                        value={qty} onChange={(e) => setQty(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-secondary">Unit Price (USD)</label>
                      <input
                        type="number" required
                        value={unitPrice} onChange={(e) => setUnitPrice(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button" onClick={() => setShowPOModal(false)}
                      className="px-3 py-1.5 border border-border hover:bg-slate-900 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover"
                    >
                      Issue PO
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-secondary font-bold uppercase text-[10px]">
                      <th className="pb-3">PO ID</th>
                      <th className="pb-3">Vendor</th>
                      <th className="pb-3">Item Details</th>
                      <th className="pb-3">Qty</th>
                      <th className="pb-3">Total Cost</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {pos.map(po => (
                      <tr key={po.id} className="hover:bg-slate-900/20">
                        <td className="py-3 font-semibold text-primary">{po.id}</td>
                        <td className="py-3 text-secondary">{po.vendorName}</td>
                        <td className="py-3 text-primary font-medium">{po.itemName}</td>
                        <td className="py-3">{po.quantity}</td>
                        <td className="py-3 font-bold text-primary">${po.totalCost.toLocaleString()}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                            po.status === "received" 
                              ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}>
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                <Percent size={14} className="text-teal-400" /> Cost Accounting & Margin Analysis
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/40 p-4 rounded-xl border border-border">
                  <span className="text-[10px] text-secondary font-semibold uppercase block">Resin Cost per Stage</span>
                  <span className="text-base font-extrabold text-primary block mt-1">$4.20 USD</span>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-xl border border-border">
                  <span className="text-[10px] text-secondary font-semibold uppercase block">Thermoforming Sheet</span>
                  <span className="text-base font-extrabold text-primary block mt-1">$3.10 USD</span>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-xl border border-border">
                  <span className="text-[10px] text-secondary font-semibold uppercase block">Labor & Packaging</span>
                  <span className="text-base font-extrabold text-primary block mt-1">$5.50 USD</span>
                </div>
              </div>

              <div className="border border-border rounded-xl p-4 bg-teal-500/5 text-teal-400 border-teal-500/10 flex justify-between items-center">
                <div>
                  <span className="font-bold block">Estimated Gross Margin (20-Stage Case)</span>
                  <span className="text-[10px] block mt-0.5">Sale price: $1,200.00 | Cost of Goods Sold (COGS): $256.00</span>
                </div>
                <span className="text-lg font-black">78.6% Margin</span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-border mt-6 text-slate-400">
          Cost analyses adapt dynamically according to raw material purchase invoice updates.
        </div>
      </div>

      {/* Vendor List Panel */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Truck size={16} className="text-teal-400" /> Verified Vendor Sheets
        </h4>

        <div className="space-y-3">
          {vendors.map(v => (
            <div key={v.id} className="border border-border rounded-xl p-3 bg-slate-900/10 space-y-2">
              <div className="flex justify-between items-center font-bold">
                <span className="text-primary">{v.name}</span>
                <span className="text-amber-400 font-extrabold">★ {v.rating.toFixed(1)}</span>
              </div>
              <div className="text-[10px] text-slate-400 space-y-0.5">
                <p><span className="font-bold text-secondary">Category:</span> {v.category}</p>
                <p><span className="font-bold text-secondary">Contact:</span> {v.contact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
