"use client";

import React, { useState } from "react";
import { 
  Cpu, 
  TrendingUp, 
  BookOpen, 
  Globe, 
  Rss, 
  Search,
  CheckCircle,
  FileText,
  AlertCircle
} from "lucide-react";

interface IntelLog {
  id: string;
  category: "competitor" | "publication" | "regulatory" | "device";
  title: string;
  summary: string;
  confidenceScore: number;
  scrapedAt: string;
  source: string;
}

export default function CompetitiveIntel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [intelFeeds] = useState<IntelLog[]>([
    {
      id: "intel-101",
      category: "device",
      title: "Align Technology launches iTero Lumina scanner",
      summary: "Features a 3X wider field of capture and multi-aperture optical scanning. Eliminates the need for traditional wands, processing mesh decimations 40% faster.",
      confidenceScore: 0.98,
      scrapedAt: "2026-06-12",
      source: "AlignTech Pressroom"
    },
    {
      id: "intel-102",
      category: "competitor",
      title: "SmileDirectClub files intellectual property suit updates",
      summary: "Patent dispute centering around automated staging algorithm vectors and online dental monitoring photo evaluations.",
      confidenceScore: 0.92,
      scrapedAt: "2026-06-13",
      source: "USPTO Patent Gazette"
    },
    {
      id: "intel-103",
      category: "publication",
      title: "Periodontal Ligament Stress Tensors in Aligner Staging",
      summary: "Clinical trial published in American Journal of Orthodontics. Confirmed linear staging limits (0.25mm/stage) preserve PDL tissue health. Verified ischemic thresholds.",
      confidenceScore: 0.95,
      scrapedAt: "2026-06-14",
      source: "AJO-DO Journal"
    },
    {
      id: "intel-104",
      category: "regulatory",
      title: "FDA updates guidance for additive manufacturing resins",
      summary: "FDA 21 CFR changes enforce strict DHR batch tracking and toxicological clearance testing for Class II dental printing materials.",
      confidenceScore: 0.97,
      scrapedAt: "2026-06-14",
      source: "Federal Register Feed"
    }
  ]);

  const filteredFeeds = intelFeeds.filter(log => {
    const matchesSearch = log.title.toLowerCase().includes(searchTerm.toLowerCase()) || log.summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === "all" || log.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* AI Intelligence Scraping feed */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <Cpu size={20} className="text-teal-400" />
                AI Competitive Intelligence Engine
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Scrapes dental journals, patents, competitor press, and printer releases automatically.</p>
            </div>
            
            <div className="flex gap-1 bg-slate-900 border border-border p-0.5 rounded-lg">
              {["all", "competitor", "device", "publication", "regulatory"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all text-[10px] capitalize ${
                    categoryFilter === cat ? "bg-primary text-white" : "text-secondary hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-2.5 text-secondary" />
            <input
              type="text"
              placeholder="Search scraped industry intelligence..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            {filteredFeeds.map(feed => (
              <div key={feed.id} className="border border-border rounded-xl p-4 bg-slate-900/10 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                      feed.category === "device" 
                        ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                        : feed.category === "publication"
                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        : feed.category === "regulatory"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {feed.category}
                    </span>
                    <span className="text-secondary font-semibold">Source: {feed.source}</span>
                  </div>
                  <span className="text-slate-400">{feed.scrapedAt}</span>
                </div>

                <h4 className="font-bold text-sm text-primary">{feed.title}</h4>
                <p className="text-slate-300 leading-normal">{feed.summary}</p>

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1.5 border-t border-border/40 font-mono">
                  <Cpu size={10} className="text-teal-400" />
                  NLP Parsing Confidence Score: {(feed.confidenceScore * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-border mt-6 text-slate-400">
          NLP indexing agent executes every 6 hours targeting global healthcare feeds.
        </div>
      </div>

      {/* Intelligence Telemetry summary */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Rss size={16} className="text-teal-400" /> Scraping Telemetry
        </h4>

        <div className="space-y-3">
          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-border flex justify-between items-center">
            <div>
              <span className="text-secondary block uppercase font-bold text-[9px]">Indexed Sources</span>
              <span className="font-black text-primary text-sm mt-0.5">142 Outlets</span>
            </div>
            <Globe size={18} className="text-teal-400" />
          </div>

          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-border flex justify-between items-center">
            <div>
              <span className="text-secondary block uppercase font-bold text-[9px]">Monthly Scrapes Run</span>
              <span className="font-black text-primary text-sm mt-0.5">180 Executions</span>
            </div>
            <TrendingUp size={18} className="text-teal-400" />
          </div>

          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-border flex justify-between items-center">
            <div>
              <span className="text-secondary block uppercase font-bold text-[9px]">Mean NLP Accuracy</span>
              <span className="font-black text-teal-400 text-sm mt-0.5">94.8%</span>
            </div>
            <Cpu size={18} className="text-teal-400" />
          </div>
        </div>
      </div>

    </div>
  );
}
