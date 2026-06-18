"use client";

import React, { useState } from "react";
import { Sparkles, MessageSquare, Plus, ChevronRight, BadgePercent, DollarSign, Store } from "lucide-react";

interface MarketplaceOffer {
  id: string;
  title: string;
  provider: string;
  serviceType: string;
  price: number;
  deliverySla: string;
  rating: number;
}

const initialOffers: MarketplaceOffer[] = [
  { id: "off1", title: "Premium Clear Aligner 3D Slicing & Planning", provider: "Stuttgart Ortho Labs", serviceType: "design", price: 45.00, deliverySla: "24 Hours", rating: 4.9 },
  { id: "off2", title: "NextDent Model Resin Printing & Washing", provider: "APAC Manufacturing Hub", serviceType: "printing", price: 15.00, deliverySla: "48 Hours", rating: 4.8 },
  { id: "off3", title: "Complex Molar Tipping Clinical Consultation", provider: "Dr. Sarah Jenkins Clinic", serviceType: "consulting", price: 120.00, deliverySla: "12 Hours", rating: 5.0 }
];

export default function Marketplace() {
  const [offers, setOffers] = useState<MarketplaceOffer[]>(initialOffers);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Listing state
  const [newTitle, setNewTitle] = useState("");
  const [newService, setNewService] = useState("design");
  const [newPrice, setNewPrice] = useState(25);
  const [newSla, setNewSla] = useState("24 Hours");

  const handleAddOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    const newOff: MarketplaceOffer = {
      id: `off${offers.length + 1}`,
      title: newTitle,
      provider: "SJ Clinical Labs",
      serviceType: newService,
      price: newPrice,
      deliverySla: newSla,
      rating: 5.0
    };
    setOffers([...offers, newOff]);
    setShowAddModal(false);
  };

  const getServiceTypeColor = (type: string) => {
    switch (type) {
      case "design": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "printing": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default: return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-2xl shadow-card overflow-hidden">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Marketplace & Case Outsourcing</h2>
          <p className="text-xs text-secondary mt-0.5">Outsource aligner printing, surgical design, and clinical consults</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Store size={16} />
          Post Listing
        </button>
      </div>

      {/* Directory list */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {offers.map(offer => (
          <div key={offer.id} className="border border-border rounded-2xl p-5 bg-slate-50/20 dark:bg-slate-950/10 flex flex-col justify-between space-y-4 hover:border-slate-400 dark:hover:border-slate-700 transition-all">
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${getServiceTypeColor(offer.serviceType)}`}>
                  {offer.serviceType}
                </span>
                <span className="text-xs text-secondary font-semibold">★ {offer.rating.toFixed(1)}</span>
              </div>
              <h4 className="font-semibold text-sm leading-tight text-slate-100">{offer.title}</h4>
              <p className="text-xs text-secondary mt-1">Provider: {offer.provider}</p>
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-secondary uppercase block">SLA Delivery</span>
                <span className="text-xs font-bold">{offer.deliverySla}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-secondary uppercase block font-semibold">Price</span>
                <span className="text-sm font-bold text-teal-400 font-mono">${offer.price.toFixed(2)}</span>
              </div>
            </div>

            <button className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1">
              Order Service
              <ChevronRight size={14} />
            </button>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddOffer} className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">Post Marketplace Listing</h3>
              <p className="text-xs text-secondary mt-1">Offer design, printing, or clinical reviews to dental clinics</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-secondary mb-1">Listing Title</label>
                <input
                  type="text" required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. CBCT root segmentation"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold uppercase text-secondary mb-1">Service Class</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                    value={newService} onChange={(e) => setNewService(e.target.value)}
                  >
                    <option value="design">CAD Design</option>
                    <option value="printing">3D Printing</option>
                    <option value="consulting">Clinical Consult</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-secondary mb-1">Price ($)</label>
                  <input
                    type="number" required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                    value={newPrice} onChange={(e) => setNewPrice(parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-border flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-border text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
              >
                Post Listing
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
