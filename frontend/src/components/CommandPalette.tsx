"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Users,
  ClipboardList,
  Layers,
  BarChart2,
  Settings,
  Plus,
  Upload,
  FileSearch,
  ChevronRight,
} from "lucide-react";
import { globalSearch, type SearchResult } from "@/lib/api/search";
import { Spinner } from "./DesignSystem";
import { clsx } from "clsx";

interface CommandItem {
  id: string;
  group: string;
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  shortcut?: string;
  action: () => void;
}

interface GroupedItems {
  group: string;
  items: CommandItem[];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchItems, setSearchItems] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
    setSearchItems([]);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const staticItems = useMemo<CommandItem[]>(
    () => [
      {
        id: "nav-cases",
        group: "Navigate",
        icon: <ClipboardList size={16} />,
        label: "Cases",
        subtitle: "Browse all cases",
        shortcut: "C",
        action: () => go("/cases"),
      },
      {
        id: "nav-patients",
        group: "Navigate",
        icon: <Users size={16} />,
        label: "Patients",
        subtitle: "Browse all patients",
        shortcut: "P",
        action: () => go("/patients"),
      },
      {
        id: "nav-studio",
        group: "Navigate",
        icon: <Layers size={16} />,
        label: "Studio",
        subtitle: "3D workspace",
        shortcut: "S",
        action: () => go("/studio"),
      },
      {
        id: "nav-analytics",
        group: "Navigate",
        icon: <BarChart2 size={16} />,
        label: "Analytics",
        subtitle: "Clinical metrics & KPIs",
        action: () => go("/analytics"),
      },
      {
        id: "nav-settings",
        group: "Navigate",
        icon: <Settings size={16} />,
        label: "Settings",
        subtitle: "Preferences, branding, security",
        action: () => go("/settings"),
      },
      {
        id: "action-new-case",
        group: "Actions",
        icon: <Plus size={16} />,
        label: "New Case",
        subtitle: "Create a new patient case",
        action: () => go("/cases?new=1"),
      },
      {
        id: "action-upload-scan",
        group: "Actions",
        icon: <Upload size={16} />,
        label: "Upload Scan",
        subtitle: "Import STL / OBJ / PLY to Studio",
        action: () => go("/studio"),
      },
    ],
    [go],
  );

  const TYPE_ICONS: Record<string, React.ReactNode> = {
    patient:  <Users size={16} />,
    case:     <ClipboardList size={16} />,
    protocol: <FileSearch size={16} />,
    material: <Layers size={16} />,
    batch:    <BarChart2 size={16} />,
  };

  const GROUP_LABELS: Record<string, string> = {
    patient: 'Patients', case: 'Cases', protocol: 'Protocols',
    material: 'Materials', batch: 'Batches',
  };

  const doSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setSearchItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { results } = await globalSearch(trimmed, 'all', 20);
        setSearchItems(
          results.map((r: SearchResult) => ({
            id: `${r.type}-${r.id}`,
            group: GROUP_LABELS[r.type] ?? r.type,
            icon: TYPE_ICONS[r.type] ?? <FileSearch size={16} />,
            label: r.title,
            subtitle: r.subtitle ?? r.meta,
            action: () => go(r.href),
          })),
        );
      } catch {
        setSearchItems([]);
      } finally {
        setLoading(false);
      }
    },
    [go],
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void doSearch(query), 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, doSearch]);

  const grouped = useMemo<GroupedItems[]>(() => {
    if (!query.trim()) {
      const map = new Map<string, CommandItem[]>();
      for (const item of staticItems) {
        const list = map.get(item.group) ?? [];
        list.push(item);
        map.set(item.group, list);
      }
      return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
    }
    const map = new Map<string, CommandItem[]>();
    for (const item of searchItems) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [query, staticItems, searchItems]);

  const flatItems = useMemo(
    () => grouped.flatMap((g) => g.items),
    [grouped],
  );

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, flatItems.length - 1)));
  }, [flatItems]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (!open) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          flatItems[selectedIndex]?.action();
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [open, flatItems, selectedIndex, close]);

  useEffect(() => {
    const onEvent = () => setOpen(true);
    window.addEventListener("open-command-palette", onEvent);
    return () => window.removeEventListener("open-command-palette", onEvent);
  }, []);

  if (!open) return null;

  let cursor = 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-[10vh] sm:pt-[12vh]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={18} className="shrink-0 text-secondary" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search cases, patients, or navigate…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            aria-label="Command search"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <Spinner size={14} />}
          {query && !loading && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-secondary hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden h-5 items-center rounded border border-border bg-slate-100 px-1.5 text-[10px] font-medium text-secondary dark:bg-slate-800 sm:inline-flex">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2" role="listbox">
          {flatItems.length === 0 && query.trim() && !loading && (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-secondary">
              <FileSearch size={24} className="opacity-40" aria-hidden />
              <span>No results for &ldquo;{query}&rdquo;</span>
            </div>
          )}

          {grouped.map(({ group, items }) => (
            <div key={group} role="group" aria-label={group}>
              <p className="px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                {group}
              </p>
              {items.map((item) => {
                const idx = cursor++;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={clsx(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-slate-100 dark:hover:bg-slate-900",
                    )}
                  >
                    <span
                      className={clsx(
                        "shrink-0",
                        isSelected ? "text-primary" : "text-secondary",
                      )}
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {item.label}
                      </span>
                      {item.subtitle && (
                        <span className="block truncate text-xs text-secondary">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    {item.shortcut && !isSelected && (
                      <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-slate-100 px-1 text-[10px] text-muted-foreground dark:bg-slate-800 sm:inline">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <ChevronRight
                        size={14}
                        className="ml-auto shrink-0 text-primary"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono">↵</kbd> open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono">esc</kbd> close
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="font-mono">⌘K</kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}
