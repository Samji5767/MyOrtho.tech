"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Command,
  Home,
  MessageSquare,
  Printer,
  PlusCircle,
  ScanLine,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
  UploadCloud,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";

type CommandSection = "navigate" | "action" | "patient";

interface CommandItem {
  id: string;
  section: CommandSection;
  name: string;
  description: string;
  shortcut?: string;
  icon: LucideIcon;
  iconColor?: string;
  href: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS: CommandItem[] = [
  { id: "home", section: "navigate", name: "Home", description: "Today's clinic command center", shortcut: "H", icon: Home, href: "/" },
  { id: "patients", section: "navigate", name: "Patients", description: "Cases and treatment tracking", shortcut: "P", icon: Users, href: "/patients" },
  { id: "workspace", section: "navigate", name: "Case Workspace", description: "3D viewer, scans, approvals", shortcut: "W", icon: ScanLine, href: "/ai-analysis" },
  { id: "settings", section: "navigate", name: "Settings", description: "Doctor, lab, and clinic controls", shortcut: "S", icon: Settings, href: "/settings" },
];

const ACTION_ITEMS: CommandItem[] = [
  { id: "new-patient", section: "action", name: "New Patient", description: "Register a fresh clinic profile", icon: PlusCircle, iconColor: "text-emerald-500", href: "/patients" },
  { id: "upload-scan", section: "action", name: "Upload Scan", description: "Start an STL or CBCT import", icon: UploadCloud, iconColor: "text-blue-500", href: "/ai-analysis" },
  { id: "prescribe", section: "action", name: "Create Prescription", description: "Prepare a treatment plan update", icon: Stethoscope, iconColor: "text-[color:var(--primary)]", href: "/patients" },
  { id: "ask-ai", section: "action", name: "Ask AI Assistant", description: "Open AI case analysis workspace", icon: Sparkles, iconColor: "text-violet-500", href: "/ai-analysis" },
  { id: "approve-cases", section: "action", name: "Approve Cases", description: "Review and approve pending cases", icon: CheckCircle2, iconColor: "text-amber-500", href: "/settings" },
  { id: "print-queue", section: "action", name: "Manufacturing Queue", description: "View print jobs and SLA status", icon: Printer, iconColor: "text-[color:var(--primary)]", href: "/settings" },
  { id: "messages", section: "action", name: "Team Messages", description: "Open clinic communication feed", icon: MessageSquare, iconColor: "text-blue-500", href: "/#messages" },
];

const PATIENT_ITEMS: CommandItem[] = [];

const ALL_ITEMS = [...NAV_ITEMS, ...ACTION_ITEMS, ...PATIENT_ITEMS];

const SECTION_LABELS: Record<CommandSection, string> = {
  navigate: "Navigate",
  action: "Quick Actions",
  patient: "Patients",
};

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredItems = query.trim()
    ? ALL_ITEMS.filter(
        (item) =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_ITEMS;

  const execute = useCallback(
    (item: CommandItem) => {
      router.push(item.href);
      onClose();
    },
    [router, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) execute(item);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, filteredItems, selectedIndex, execute, onClose]);

  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector("[data-selected='true']");
    selectedEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const groupedItems = filteredItems.reduce(
    (acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    },
    {} as Record<CommandSection, CommandItem[]>
  );

  const sectionOrder: CommandSection[] = ["navigate", "action", "patient"];

  let globalIdx = 0;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-start justify-center px-4 pt-14 sm:pt-20"
      style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(8px) saturate(1.1)" }}
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-lg overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 border-b border-[color:var(--border)]/70 px-4 py-3.5">
          <Command size={15} className="shrink-0 text-[color:var(--primary)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search patients, cases, or type an action…"
            className="flex-1 bg-transparent text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="shrink-0 rounded-md border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_60%,transparent)] px-2 py-1 text-[10px] font-semibold text-[color:var(--muted-foreground)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="no-scrollbar max-h-[min(420px,72vh)] overflow-y-auto p-2">
          {filteredItems.length > 0 ? (
            sectionOrder.map((section) => {
              const items = groupedItems[section];
              if (!items?.length) return null;
              return (
                <div key={section} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[9px] font-black uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                    {SECTION_LABELS[section]}
                  </p>
                  {items.map((item) => {
                    const isSelected = globalIdx === selectedIndex;
                    const currentIdx = globalIdx;
                    globalIdx++;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-selected={isSelected}
                        onClick={() => execute(item)}
                        onMouseEnter={() => setSelectedIndex(currentIdx)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-100 ${
                          isSelected
                            ? "bg-[color:var(--primary-glow)]"
                            : "hover:bg-[color-mix(in_srgb,var(--card)_90%,transparent)]"
                        }`}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${
                            isSelected
                              ? "border-[color:var(--primary)]/30 bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                              : "border-[color:var(--border)]/70 bg-[color-mix(in_srgb,var(--card)_80%,transparent)]"
                          }`}
                        >
                          <Icon
                            size={14}
                            className={isSelected ? undefined : (item.iconColor ?? "text-[color:var(--muted-foreground)]")}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-[color:var(--foreground)]">
                            {item.name}
                          </span>
                          <span className="block truncate text-xs text-[color:var(--muted-foreground)]">
                            {item.description}
                          </span>
                        </span>
                        {item.shortcut ? (
                          <kbd className="shrink-0 rounded-md border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--muted-foreground)]">
                            {item.shortcut}
                          </kbd>
                        ) : isSelected ? (
                          <ChevronRight size={14} className="shrink-0 text-[color:var(--primary)]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search size={22} className="text-[color:var(--muted-foreground)]" />
              <p className="text-sm font-semibold text-[color:var(--foreground)]">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Try a patient name, case ID, or action like &ldquo;approve&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Footer keyboard hints */}
        <div className="flex items-center gap-4 border-t border-[color:var(--border)]/70 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[10px] text-[color:var(--muted-foreground)]">
            <kbd className="rounded border border-[color:var(--border)] px-1.5 py-0.5 font-semibold">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[color:var(--muted-foreground)]">
            <kbd className="rounded border border-[color:var(--border)] px-1.5 py-0.5 font-semibold">↵</kbd>
            Open
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[color:var(--muted-foreground)]">
            <kbd className="rounded border border-[color:var(--border)] px-1.5 py-0.5 font-semibold">Esc</kbd>
            Close
          </span>
          <span className="ml-auto text-[10px] text-[color:var(--muted-foreground)]">
            {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
