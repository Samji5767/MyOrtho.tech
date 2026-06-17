"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Compass, Shield, Terminal, Settings, CreditCard, LifeBuoy } from "lucide-react";

interface CommandItem {
  id: string;
  category: string;
  name: string;
  description: string;
  action: () => void;
  icon: React.ReactNode;
}

interface CommandPaletteProps {
  active: boolean;
  onClose: () => void;
  onNavigate: (tab: any) => void;
  onToggleTheme: () => void;
  onResetArch: () => void;
}

export default function CommandPalette({
  active,
  onClose,
  onNavigate,
  onToggleTheme,
  onResetArch
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch("");
    }
  }, [active]);

  const commands: CommandItem[] = [
    {
      id: "cases",
      category: "Workspaces",
      name: "Go to Case Directory",
      description: "Manage clinical patient intake files and status logs",
      icon: <Compass className="text-teal-400" size={16} />,
      action: () => onNavigate("cases")
    },
    {
      id: "upload",
      category: "Workspaces",
      name: "Go to Scan Acquisition",
      description: "Upload intraoral raw STL / CBCT volumetric data",
      icon: <Compass className="text-teal-400" size={16} />,
      action: () => onNavigate("upload")
    },
    {
      id: "viewer",
      category: "Workspaces",
      name: "Go to 3D Studio Viewport",
      description: "Examine segmented crown meshes and verify alignments",
      icon: <Compass className="text-teal-400" size={16} />,
      action: () => onNavigate("viewer")
    },
    {
      id: "staging",
      category: "Workspaces",
      name: "Go to Aligner Staging",
      description: "Perform coordinate displacements and target steps",
      icon: <Compass className="text-teal-400" size={16} />,
      action: () => onNavigate("staging")
    },
    {
      id: "billing",
      category: "Business",
      name: "Go to Billing Manager",
      description: "View usage-based invoice calculations and tiers",
      icon: <CreditCard className="text-amber-400" size={16} />,
      action: () => onNavigate("billing")
    },
    {
      id: "observability",
      category: "Operations",
      name: "Go to System Observability",
      description: "Scrape telemetry, Prometheus metrics, and OTEL spans",
      icon: <Terminal className="text-blue-400" size={16} />,
      action: () => onNavigate("observability")
    },
    {
      id: "theme",
      category: "Preferences",
      name: "Toggle Light / Dark Mode",
      description: "Switch appearance styling variables",
      icon: <Settings className="text-slate-400" size={16} />,
      action: () => onToggleTheme()
    },
    {
      id: "reset",
      category: "Commands",
      name: "Reset Arch Coordinates",
      description: "Clear translation offsets and re-align crowns",
      icon: <Settings className="text-slate-400" size={16} />,
      action: () => onResetArch()
    }
  ];

  const filteredCommands = commands.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  if (!active) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-start justify-center p-4 pt-20"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a workspace name, billing key, or command..."
            className="flex-1 bg-transparent text-sm text-foreground focus:outline-none placeholder-slate-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd className="px-2 py-0.5 border border-border bg-slate-900 rounded text-[10px] font-semibold text-secondary">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length > 0 ? (
            Object.entries(
              filteredCommands.reduce((groups, item) => {
                groups[item.category] = groups[item.category] || [];
                groups[item.category].push(item);
                return groups;
              }, {} as Record<string, CommandItem[]>)
            ).map(([category, items]) => (
              <div key={category} className="space-y-1 mb-3">
                <span className="block text-[9px] uppercase font-black text-secondary tracking-wider px-3 mb-1">
                  {category}
                </span>
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors group"
                  >
                    <span className="p-2 border border-border/80 bg-slate-900 rounded-lg group-hover:border-primary transition-colors">
                      {item.icon}
                    </span>
                    <div className="flex-1">
                      <span className="block text-xs font-bold text-slate-200 group-hover:text-primary transition-colors">
                        {item.name}
                      </span>
                      <span className="block text-[10px] text-secondary">
                        {item.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-secondary text-xs">
              No commands found matching "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
