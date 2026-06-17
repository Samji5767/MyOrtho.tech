"use client";

import React, { useState } from "react";
import { 
  Package, 
  Truck, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  Warehouse,
  History,
  TrendingDown
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  category: "resin" | "aligner_sheets" | "packaging" | "accessories";
  quantity: number;
  unit: string;
  reorderLevel: number;
  vendor: string;
  warehouseLocation: string;
}

export default function SupplyChain() {
  const [items, setItems] = useState<InventoryItem[]>([
    {
      id: "inv-101",
      name: "SprintRay Model Resin (1L)",
      category: "resin",
      quantity: 3.5,
      unit: "Liters",
      reorderLevel: 5.0,
      vendor: "SprintRay Inc",
      warehouseLocation: "Bin-A3"
    },
    {
      id: "inv-102",
      name: "Zendura FLX Thermoforming Sheets",
      category: "aligner_sheets",
      quantity: 240,
      unit: "Pieces",
      reorderLevel: 100,
      vendor: "Zendura Dental",
      warehouseLocation: "Bin-B12"
    },
    {
      id: "inv-103",
      name: "Orthodontic Retainer Cases (Blue)",
      category: "accessories",
      quantity: 45,
      unit: "Pieces",
      reorderLevel: 50,
      vendor: "OrthoSupply Corp",
      warehouseLocation: "Bin-C9"
    }
  ]);

  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState<"resin" | "aligner_sheets" | "packaging" | "accessories">("resin");
  const [qty, setQty] = useState(10);
  const [reorder, setReorder] = useState(5);
  const [vendor, setVendor] = useState("SprintRay Inc");
  const [location, setLocation] = useState("Bin-A4");
  const [showOrderModal, setShowOrderModal] = useState(false);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem: InventoryItem = {
      id: `inv-${Math.floor(Math.random() * 900) + 100}`,
      name: itemName,
      category,
      quantity: qty,
      unit: category === "resin" ? "Liters" : "Pieces",
      reorderLevel: reorder,
      vendor,
      warehouseLocation: location
    };
    setItems([...items, newItem]);
    setItemName("");
    setShowOrderModal(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Supply Chain Inventory Tracker */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <Package size={20} className="text-teal-400" />
                Warehouse & Supply Chain
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Track raw resin reserves, packaging materials, and automate reorder alerts.</p>
            </div>
            
            <button
              onClick={() => setShowOrderModal(!showOrderModal)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition-colors"
            >
              <Plus size={14} /> Place Order
            </button>
          </div>

          {showOrderModal && (
            <form onSubmit={handleCreateOrder} className="bg-slate-900/30 border border-border rounded-xl p-4 space-y-4">
              <h4 className="font-bold text-xs text-primary">Log Procurement Stock Order</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-secondary">Material Name</label>
                  <input
                    type="text" required
                    placeholder="e.g. Formlabs Clear Resin"
                    value={itemName} onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-semibold text-secondary">Category</label>
                  <select
                    value={category} onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                  >
                    <option value="resin">Photopolymer Resin (L)</option>
                    <option value="aligner_sheets">Thermoforming Sheets (pcs)</option>
                    <option value="accessories">Retainer cases / Accessories</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block font-semibold text-secondary">Quantity</label>
                  <input
                    type="number" required
                    value={qty} onChange={(e) => setQty(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-semibold text-secondary">Reorder Threshold Alert</label>
                  <input
                    type="number" required
                    value={reorder} onChange={(e) => setReorder(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button" onClick={() => setShowOrderModal(false)}
                  className="px-3 py-1.5 border border-border hover:bg-slate-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover"
                >
                  Log Order
                </button>
              </div>
            </form>
          )}

          {/* Inventory Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/80 text-secondary font-bold uppercase text-[10px]">
                  <th className="pb-3">Material / Item</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Current Stock</th>
                  <th className="pb-3">Reorder Alert</th>
                  <th className="pb-3">Location</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => {
                  const needsReorder = item.quantity <= item.reorderLevel;
                  return (
                    <tr key={item.id} className="hover:bg-slate-900/20">
                      <td className="py-3 font-semibold text-primary">{item.name}</td>
                      <td className="py-3 capitalize text-secondary">{item.category.replace("_", " ")}</td>
                      <td className="py-3 font-bold text-primary">{item.quantity} {item.unit}</td>
                      <td className="py-3 text-secondary">{item.reorderLevel} {item.unit}</td>
                      <td className="py-3 font-mono text-slate-400">{item.warehouseLocation}</td>
                      <td className="py-3">
                        {needsReorder ? (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-bold uppercase text-[9px] flex items-center gap-1 w-max">
                            <TrendingDown size={10} /> Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded font-bold uppercase text-[9px] flex items-center gap-1 w-max">
                            <CheckCircle size={10} /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pt-6 border-t border-border mt-6 text-slate-400">
          Warehouse tracking syncs automatically with active print farm usage counters.
        </div>
      </div>

      {/* Procurement Logs */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Truck size={16} className="text-teal-400" /> Procurement Shipping Feeds
        </h4>

        <div className="space-y-3">
          <div className="border border-border rounded-xl p-3.5 bg-slate-900/10 space-y-2">
            <div className="flex justify-between items-center font-bold">
              <span className="text-primary">Order #PO-8812</span>
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded uppercase text-[8px] font-bold">
                In Transit
              </span>
            </div>
            <div className="space-y-1 text-slate-400 text-[10px]">
              <p><span className="font-bold text-secondary">Vendor:</span> SprintRay Inc</p>
              <p><span className="font-bold text-secondary">Material:</span> Model Resin (10L)</p>
              <p><span className="font-bold text-secondary">ETA:</span> 2026-06-17</p>
            </div>
          </div>

          <div className="border border-border rounded-xl p-3.5 bg-slate-900/10 space-y-2">
            <div className="flex justify-between items-center font-bold">
              <span className="text-primary">Order #PO-8799</span>
              <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded uppercase text-[8px] font-bold">
                Delivered
              </span>
            </div>
            <div className="space-y-1 text-slate-400 text-[10px]">
              <p><span className="font-bold text-secondary">Vendor:</span> Zendura Dental</p>
              <p><span className="font-bold text-secondary">Material:</span> FLX Sheets (500 pcs)</p>
              <p><span className="font-bold text-secondary">Date:</span> 2026-06-11</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
