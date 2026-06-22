"use client";

import React, { useState } from "react";
import { 
  Search, 
  Sparkles, 
  FileCode, 
  Users, 
  ClipboardList, 
  MessageSquare, 
  Printer, 
  ArrowRight 
} from "lucide-react";

interface SearchResult {
  id: string;
  category: "patient" | "case" | "file" | "message" | "job";
  title: string;
  subtitle: string;
  score?: number; // Semantic matching score
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [useSemantic, setUseSemantic] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const [results] = useState<SearchResult[]>([]);

  const filteredResults = results.filter(res => {
    const matchesQuery = res.title.toLowerCase().includes(query.toLowerCase()) || res.subtitle.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || res.category === filter;
    return matchesQuery && matchesFilter;
  });

  return (
    <div className="space-y-6 text-xs">
      
      {/* Search Input Box */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
            <Search size={20} className="text-teal-400" />
            Global Enterprise Search
          </h3>
          <p className="text-secondary text-[11px] mt-0.5">Locate patients, cases, STLs, messages, printing runs, or documentation across your clinic.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-secondary" />
            <input
              type="text"
              placeholder="Search patients, files, orders..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-border rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={useSemantic}
              onChange={(e) => setUseSemantic(e.target.checked)}
              className="accent-teal-500 rounded"
            />
            <span className="font-semibold text-secondary flex items-center gap-1">
              <Sparkles size={12} className="text-teal-400" /> AI Semantic Match
            </span>
          </label>
        </div>

        {/* Filter categories */}
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          {["all", "patient", "case", "file", "message", "job"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-md font-bold uppercase text-[9px] border transition-all ${
                filter === cat 
                  ? "bg-primary border-primary text-white" 
                  : "bg-slate-950/20 border-border text-secondary hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Search results list */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 min-h-[300px]">
        <h4 className="font-bold text-xs text-primary">Search Results</h4>
        
        <div className="space-y-3">
          {filteredResults.map((res) => (
            <div key={res.id} className="border border-border/80 rounded-xl p-4 bg-slate-900/10 flex justify-between items-center hover:bg-slate-900/20 transition-all cursor-pointer">
              <div className="flex gap-3 items-center">
                <div className="p-2 bg-slate-950/40 border border-border/80 rounded-lg text-teal-400">
                  {res.category === "patient" && <Users size={16} />}
                  {res.category === "case" && <ClipboardList size={16} />}
                  {res.category === "file" && <FileCode size={16} />}
                  {res.category === "message" && <MessageSquare size={16} />}
                  {res.category === "job" && <Printer size={16} />}
                </div>
                <div>
                  <span className="font-bold text-primary block">{res.title}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{res.subtitle}</span>
                </div>
              </div>

              {useSemantic && res.score && (
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-secondary block">AI Score</span>
                  <span className="text-teal-400 font-extrabold block mt-0.5">{(res.score * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          ))}

          {filteredResults.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              No records found. Add patients and cases to enable search.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
