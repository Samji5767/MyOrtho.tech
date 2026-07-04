"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowDownUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FolderKanban,
  Plus,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import { Button, Card, ProgressBar, StatusBadge } from "@/components/DesignSystem";

// ─── Types ─────────────────────────────────────────────────────────────────────

type CaseUrgency = "routine" | "urgent" | "critical";
type CaseStageStatus =
  | "draft" | "scan_review" | "clinical_review" | "approved"
  | "active_treatment" | "completed";
type FilterKey = "all" | "review" | "approved" | "active_treatment" | "completed" | "sla";
type SortKey = "newest" | "oldest" | "urgency" | "progress_desc" | "progress_asc";

interface DemoCase {
  id: string;
  patient: string;
  initials: string;
  accentClass: string;
  status: CaseStageStatus;
  urgency: CaseUrgency;
  doctor: string;
  type: string;
  age: string;
  lastModifiedMs: number;
  progress: number;
  slaRisk: boolean;
  estWeeksRemaining?: number;
}

// ─── Demo data ─────────────────────────────────────────────────────────────────

const _t = Date.now();
const H = 3600000;

const DEMO_CASES: DemoCase[] = [
  {
    id: "C-2883", patient: "Oliver T.", initials: "OT", accentClass: "bg-rose-500",
    status: "clinical_review", urgency: "critical", doctor: "Dr. Park",
    type: "Class II Div1 — Canine reposition", age: "4 h",
    lastModifiedMs: _t - 4 * H, progress: 45, slaRisk: true, estWeeksRemaining: 12,
  },
  {
    id: "C-2847", patient: "Sarah M.", initials: "SM", accentClass: "bg-amber-500",
    status: "approved", urgency: "urgent", doctor: "Dr. Chen",
    type: "Aligner Stage 14 approval", age: "2 d",
    lastModifiedMs: _t - 48 * H, progress: 72, slaRisk: false, estWeeksRemaining: 6,
  },
  {
    id: "C-2876", patient: "Emma K.", initials: "EK", accentClass: "bg-violet-500",
    status: "active_treatment", urgency: "urgent", doctor: "Dr. Chen",
    type: "Refinement — 8 upper aligners", age: "3 d",
    lastModifiedMs: _t - 72 * H, progress: 85, slaRisk: false, estWeeksRemaining: 3,
  },
  {
    id: "C-2901", patient: "James R.", initials: "JR", accentClass: "bg-teal-500",
    status: "clinical_review", urgency: "routine", doctor: "Dr. Lee",
    type: "Class I — Upper arch IPR 0.3 mm", age: "1 d",
    lastModifiedMs: _t - 24 * H, progress: 35, slaRisk: false, estWeeksRemaining: 18,
  },
  {
    id: "C-2859", patient: "Marcus D.", initials: "MD", accentClass: "bg-blue-500",
    status: "scan_review", urgency: "urgent", doctor: "Dr. Torres",
    type: "Full-arch correction — 7 attachments", age: "3 d",
    lastModifiedMs: _t - 72 * H, progress: 60, slaRisk: true, estWeeksRemaining: 10,
  },
  {
    id: "C-2912", patient: "Ava N.", initials: "AN", accentClass: "bg-emerald-500",
    status: "completed", urgency: "routine", doctor: "Dr. Lee",
    type: "Retention Phase — Hawley + Vivera", age: "5 d",
    lastModifiedMs: _t - 120 * H, progress: 100, slaRisk: false,
  },
  {
    id: "C-2900", patient: "Lily S.", initials: "LS", accentClass: "bg-indigo-500",
    status: "draft", urgency: "routine", doctor: "Dr. Nguyen",
    type: "Initial consultation — Class I moderate crowding", age: "12 h",
    lastModifiedMs: _t - 12 * H, progress: 15, slaRisk: false, estWeeksRemaining: 24,
  },
];

const ALL_DOCTORS = Array.from(new Set(DEMO_CASES.map((c) => c.doctor))).sort();

// ─── Lookup maps ───────────────────────────────────────────────────────────────

const STATUS_META: Record<CaseStageStatus, {
  label: string;
  tone: "neutral" | "info" | "primary" | "warning" | "success" | "danger";
}> = {
  draft:            { label: "Draft",            tone: "neutral" },
  scan_review:      { label: "Scan Review",      tone: "info"    },
  clinical_review:  { label: "Clinical Review",  tone: "primary" },
  approved:         { label: "Approved",         tone: "success" },
  active_treatment: { label: "Active Treatment", tone: "info"    },
  completed:        { label: "Completed",        tone: "success" },
};

const URGENCY_ORDER: Record<CaseUrgency, number> = { critical: 3, urgent: 2, routine: 1 };
const URGENCY_TONE: Record<CaseUrgency, "neutral" | "warning" | "danger"> = {
  routine: "neutral", urgent: "warning", critical: "danger",
};

const FILTER_SPECS: { key: FilterKey; label: string }[] = [
  { key: "all",              label: "All"           },
  { key: "review",           label: "Needs Review"  },
  { key: "approved",         label: "Approved"      },
  { key: "active_treatment", label: "Active"        },
  { key: "completed",        label: "Completed"     },
  { key: "sla",              label: "SLA Risk"      },
];

const SORT_SPECS: { key: SortKey; label: string }[] = [
  { key: "newest",        label: "Newest first"    },
  { key: "oldest",        label: "Oldest first"    },
  { key: "urgency",       label: "By urgency"      },
  { key: "progress_desc", label: "Furthest along"  },
  { key: "progress_asc",  label: "Needs work first"},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterCases(cases: DemoCase[], key: FilterKey): DemoCase[] {
  switch (key) {
    case "review":           return cases.filter((c) => c.status === "clinical_review" || c.status === "scan_review");
    case "approved":         return cases.filter((c) => c.status === "approved");
    case "active_treatment": return cases.filter((c) => c.status === "active_treatment");
    case "completed":        return cases.filter((c) => c.status === "completed");
    case "sla":              return cases.filter((c) => c.slaRisk);
    default:                 return cases;
  }
}

function sortCases(cases: DemoCase[], key: SortKey): DemoCase[] {
  const arr = [...cases];
  switch (key) {
    case "newest":        return arr.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs);
    case "oldest":        return arr.sort((a, b) => a.lastModifiedMs - b.lastModifiedMs);
    case "urgency":       return arr.sort((a, b) => URGENCY_ORDER[b.urgency] - URGENCY_ORDER[a.urgency]);
    case "progress_desc": return arr.sort((a, b) => b.progress - a.progress);
    case "progress_asc":  return arr.sort((a, b) => a.progress - b.progress);
    default:              return arr;
  }
}

function statusToProgress(status: string): number {
  const map: Record<string, number> = {
    draft: 10, scan_review: 25, segmentation: 40, planning: 55,
    clinical_review: 70, approved: 85, active_treatment: 90,
    monitoring: 95, retention: 98, completed: 100, archived: 100, cancelled: 0,
  };
  return map[status] ?? 50;
}

// ─── Demo CaseRow ─────────────────────────────────────────────────────────────

function CaseRow({
  c, bulkMode, selected, onToggleSelect, onArchive,
}: {
  c: DemoCase;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const statusMeta = STATUS_META[c.status];

  return (
    <div
      className={[
        "group relative flex items-center gap-3 px-4 py-3 transition-colors",
        selected ? "bg-[color:var(--primary-glow)]" : "hover:bg-[color:var(--border)]/40",
      ].join(" ")}
    >
      {/* Bulk checkbox */}
      {bulkMode && (
        <button
          type="button"
          onClick={() => onToggleSelect(c.id)}
          className={[
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all",
            selected
              ? "border-[color:var(--primary)] bg-[color:var(--primary)]"
              : "border-[color:var(--border)]",
          ].join(" ")}
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected && <Check size={10} className="text-[color:var(--primary-foreground)]" />}
        </button>
      )}

      {/* Avatar with SLA indicator */}
      <div className="relative shrink-0">
        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${c.accentClass}`}>
          {c.initials}
        </span>
        {c.slaRisk && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-[color:var(--background)] bg-rose-500" />
        )}
      </div>

      {/* Main content → navigates */}
      <Link href={`/cases/${c.id}`} className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-[color:var(--foreground)]">{c.patient}</span>
          <span className="font-mono text-[10px] text-[color:var(--muted-foreground)]">{c.id}</span>
          {c.urgency === "critical" && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/15 text-rose-500">
              <AlertTriangle size={9} />
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-[color:var(--muted-foreground)]">
          {c.type} · <span className="font-medium">{c.doctor}</span>
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar
              value={c.progress}
              tone={c.progress >= 80 ? "success" : c.progress >= 50 ? "primary" : "warning"}
            />
          </div>
          <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
            {c.progress}%
          </span>
          {c.estWeeksRemaining !== undefined && c.status !== "completed" && (
            <span className="shrink-0 rounded-full bg-[color:var(--border)] px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-[color:var(--muted-foreground)]">
              ~{c.estWeeksRemaining}w
            </span>
          )}
        </div>
      </Link>

      {/* Right: badges + hover quick actions */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
        <div className="flex items-center gap-1.5">
          {!bulkMode && (
            <>
              {/* Quick actions — visible on hover */}
              <div className="hidden items-center gap-0.5 group-hover:flex">
                <button
                  type="button"
                  title="Archive case"
                  onClick={(e) => { e.preventDefault(); onArchive(c.id); }}
                  className="grid h-6 w-6 place-items-center rounded text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--border)]/70 hover:text-[color:var(--foreground)]"
                >
                  <Archive size={11} />
                </button>
                <Link
                  href={`/export?caseId=${c.id}`}
                  title="Export case"
                  className="grid h-6 w-6 place-items-center rounded text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--border)]/70 hover:text-[color:var(--foreground)]"
                >
                  <Download size={11} />
                </Link>
              </div>
              {/* Normal state — hidden on hover */}
              <div className="flex items-center gap-1.5 group-hover:hidden">
                <StatusBadge tone={URGENCY_TONE[c.urgency]}>{c.urgency}</StatusBadge>
                <ChevronRight size={14} className="text-[color:var(--muted-foreground)]" />
              </div>
            </>
          )}
          {bulkMode && <ChevronRight size={14} className="text-[color:var(--muted-foreground)]" />}
        </div>
      </div>
    </div>
  );
}

// ─── Live CaseRow (API) ───────────────────────────────────────────────────────

function LiveCaseRow({ c }: { c: CaseListItem }) {
  const patientName = `${c.patient.firstName} ${c.patient.lastName}`;
  const initials = `${c.patient.firstName[0] ?? "?"}${c.patient.lastName[0] ?? "?"}`.toUpperCase();
  const progress = statusToProgress(c.status);
  const statusTone: "neutral" | "info" | "warning" | "success" =
    c.status === "completed" ? "success"
    : c.status === "scan_review" || c.status === "segmentation" || c.status === "active_treatment" ? "info"
    : c.status === "clinical_review" || c.status === "planning" ? "warning"
    : "neutral";
  const label = c.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--border)]/40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-xs font-bold text-[color:var(--primary-foreground)]">
        {initials}
      </span>
      <Link href={`/cases/${c.id}`} className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-[color:var(--foreground)]">{patientName}</span>
          <span className="font-mono text-[10px] text-[color:var(--muted-foreground)] truncate">
            {c.id.slice(0, 8)}…
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-[color:var(--muted-foreground)]">
          {c.chiefComplaint ?? c.malocclusionClass ?? "—"}
          {c.assignedTo ? ` · ${c.assignedTo.name}` : ""}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar value={progress} tone={progress >= 80 ? "success" : progress >= 50 ? "primary" : "warning"} />
          </div>
          <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
            {progress}%
          </span>
        </div>
      </Link>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge tone={statusTone}>{label}</StatusBadge>
        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-0.5 group-hover:flex">
            <Link
              href={`/export?caseId=${c.id}`}
              title="Export"
              className="grid h-6 w-6 place-items-center rounded text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--border)]/70 hover:text-[color:var(--foreground)]"
            >
              <Download size={11} />
            </Link>
          </div>
          <div className="flex items-center gap-1.5 group-hover:hidden">
            <span className="text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
              {new Date(c.updatedAt).toLocaleDateString()}
            </span>
            <ChevronRight size={14} className="text-[color:var(--muted-foreground)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const router = useRouter();
  const [previewMode, setPreviewMode] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [apiCases, setApiCases] = useState<CaseListItem[]>([]);
  const [apiSource, setApiSource] = useState<"loading" | "api" | "demo">("loading");
  const [hiddenDemoCaseIds, setHiddenDemoCaseIds] = useState<Set<string>>(new Set());

  const sortRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Load saved filter state from localStorage ──────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cases-filter-v1");
      if (saved) {
        const s = JSON.parse(saved) as {
          filter?: FilterKey; sortKey?: SortKey; doctorFilter?: string;
        };
        if (s.filter)       setFilter(s.filter);
        if (s.sortKey)      setSortKey(s.sortKey);
        if (s.doctorFilter) setDoctorFilter(s.doctorFilter);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Persist filter state ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem("cases-filter-v1", JSON.stringify({ filter, sortKey, doctorFilter }));
    } catch { /* ignore */ }
  }, [filter, sortKey, doctorFilter]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isEditable && e.key !== "Escape") return;
      if (e.key === "/" && !isEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n" && !isEditable) {
        e.preventDefault();
        router.push("/cases/new");
      } else if (e.key === "Escape") {
        if (searchQuery) setSearchQuery("");
        searchRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [searchQuery, router]);

  // ── Close sort dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortOpen]);

  // ── Fetch live cases ───────────────────────────────────────────────────────
  useEffect(() => {
    if (previewMode) return;
    setApiSource("loading");
    fetchCases()
      .then(({ cases, source }) => { setApiCases(cases); setApiSource(source); })
      .catch(() => setApiSource("demo"));
  }, [previewMode]);

  // ── Bulk helpers ───────────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearBulk = useCallback(() => {
    setSelectedIds(new Set());
    setBulkMode(false);
  }, []);

  const handleBulkArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/cases/${id}/status`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "archived" }),
          }),
        ),
      );
      setApiCases((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      clearBulk();
    } catch (e) {
      console.error("[CasesPage] bulk archive failed:", e);
    }
  }, [selectedIds, clearBulk]);

  const handleArchiveCase = useCallback(async (id: string) => {
    if (previewMode) {
      setHiddenDemoCaseIds((prev) => { const next = new Set(prev); next.add(id); return next; });
      return;
    }
    try {
      await fetch(`/api/cases/${id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      setApiCases((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error("[CasesPage] archive failed:", e);
    }
  }, [previewMode]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const visibleDemoCases = useMemo(
    () => DEMO_CASES.filter((c) => !hiddenDemoCaseIds.has(c.id)),
    [hiddenDemoCaseIds],
  );

  const filteredBySearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleDemoCases;
    return visibleDemoCases.filter((c) =>
      c.patient.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      c.doctor.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q),
    );
  }, [searchQuery, visibleDemoCases]);

  const filteredByDoctor = useMemo(
    () => doctorFilter === "all" ? filteredBySearch : filteredBySearch.filter((c) => c.doctor === doctorFilter),
    [filteredBySearch, doctorFilter],
  );

  const visible = useMemo(
    () => sortCases(filterCases(filteredByDoctor, filter), sortKey),
    [filteredByDoctor, filter, sortKey],
  );

  const filteredApiCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return apiCases;
    return apiCases.filter((c) =>
      `${c.patient.firstName} ${c.patient.lastName}`.toLowerCase().includes(q) ||
      (c.chiefComplaint ?? "").toLowerCase().includes(q) ||
      (c.malocclusionClass ?? "").toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q),
    );
  }, [apiCases, searchQuery]);

  const slaCount   = DEMO_CASES.filter((c) => c.slaRisk).length;
  const reviewCount = DEMO_CASES.filter((c) => c.status === "clinical_review" || c.status === "scan_review").length;
  const activeSortLabel = SORT_SPECS.find((s) => s.key === sortKey)?.label ?? "Sort";

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Case Management
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Cases
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Approvals, SLA alerts, and active workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          {previewMode && (
            <button
              type="button"
              onClick={() => { if (bulkMode) clearBulk(); else setBulkMode(true); }}
              className={[
                "hidden h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition sm:flex",
                bulkMode
                  ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]"
                  : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              <Check size={12} />
              {bulkMode ? "Cancel" : "Select"}
            </button>
          )}
          <Link href="/cases/new">
            <Button variant="primary" size="sm">
              <Plus size={15} /> New Case
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Preview toggle ── */}
      <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[color:var(--foreground)]">Preview mode</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {previewMode
              ? "Representative cases shown · not live data"
              : "Connect backend to see live cases"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewMode((v) => !v)}
          role="switch"
          aria-checked={previewMode}
          className={[
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            previewMode ? "bg-[color:var(--primary)]" : "bg-[color:var(--border)]",
          ].join(" ")}
        >
          <span className={[
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            previewMode ? "translate-x-5" : "translate-x-0",
          ].join(" ")} />
        </button>
      </div>

      {/* ── Data source banners ── */}
      {previewMode && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={12} className="shrink-0" />
          Representative preview data · Not connected to live data
        </div>
      )}
      {!previewMode && apiSource === "demo" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={12} className="shrink-0" />
          API fallback — backend unreachable · Showing demo cases
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex flex-col items-center gap-2 p-3">
          <span className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">
            {previewMode
              ? DEMO_CASES.filter((c) => c.status !== "completed").length
              : apiSource === "loading" ? "…"
              : apiCases.filter((c) => c.status !== "completed").length}
          </span>
          <StatusBadge tone="primary">Active</StatusBadge>
        </Card>
        <Card className="flex flex-col items-center gap-2 p-3">
          <span className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">
            {previewMode
              ? reviewCount
              : apiSource === "loading" ? "…"
              : apiCases.filter((c) => c.status === "clinical_review").length}
          </span>
          <StatusBadge tone="warning">Needs review</StatusBadge>
        </Card>
        <Card className="flex flex-col items-center gap-2 p-3">
          <span className="flex items-center gap-1 text-2xl font-bold tabular-nums text-[color:var(--foreground)]">
            {previewMode ? slaCount : "0"}
            {previewMode && slaCount > 0 && <AlertCircle size={16} className="text-rose-500" />}
          </span>
          <StatusBadge tone="danger">SLA risk</StatusBadge>
        </Card>
      </div>

      {/* ── Search + sort row ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cases, patients, doctors… ( / )"
            aria-label="Search cases"
            className="h-10 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] pl-9 pr-9 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort dropdown (preview mode only) */}
        {previewMode && (
          <div className="relative shrink-0" ref={sortRef}>
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
            >
              <ArrowDownUp size={13} />
              <span className="hidden sm:inline">{activeSortLabel}</span>
              <ChevronDown
                size={11}
                className={["transition-transform", sortOpen ? "rotate-180" : ""].join(" ")}
              />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-1 shadow-[var(--shadow-lg)]">
                {SORT_SPECS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => { setSortKey(s.key); setSortOpen(false); }}
                    className={[
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                      sortKey === s.key
                        ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                        : "text-[color:var(--foreground)] hover:bg-[color:var(--border)]/40",
                    ].join(" ")}
                  >
                    {s.label}
                    {sortKey === s.key && <Check size={10} className="ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      {previewMode ? (
        <Card className="overflow-hidden p-0">
          {/* Status filter chips */}
          <div className="border-b border-[color:var(--border)] px-4 py-3">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {FILTER_SPECS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={[
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                    filter === f.key
                      ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                      : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                  ].join(" ")}
                >
                  {f.label}
                  <span className="ml-1 tabular-nums opacity-60">
                    ({filterCases(DEMO_CASES, f.key).length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Doctor filter chips */}
          <div className="border-b border-[color:var(--border)] bg-[color:var(--card)]/50 px-4 py-2">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setDoctorFilter("all")}
                className={[
                  "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all",
                  doctorFilter === "all"
                    ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                ].join(" ")}
              >
                All doctors
              </button>
              {ALL_DOCTORS.map((doc) => (
                <button
                  key={doc}
                  type="button"
                  onClick={() => setDoctorFilter(doc)}
                  className={[
                    "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all",
                    doctorFilter === doc
                      ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                      : "border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                  ].join(" ")}
                >
                  {doc}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk select-all bar */}
          {bulkMode && visible.length > 0 && (
            <div className="flex items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--primary-glow)]/30 px-4 py-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.size === visible.length) setSelectedIds(new Set());
                  else setSelectedIds(new Set(visible.map((c) => c.id)));
                }}
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all",
                  selectedIds.size === visible.length
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]"
                    : "border-[color:var(--primary)]",
                ].join(" ")}
                aria-label="Toggle select all"
              >
                {selectedIds.size === visible.length && (
                  <Check size={10} className="text-[color:var(--primary-foreground)]" />
                )}
              </button>
              <span className="text-xs text-[color:var(--muted-foreground)]">
                {selectedIds.size === 0
                  ? "Select cases to bulk-act"
                  : `${selectedIds.size} of ${visible.length} selected`}
              </span>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto text-xs font-medium text-[color:var(--primary)]"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Case rows */}
          <div className="divide-y divide-[color:var(--border)]">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CheckCircle2 size={24} className="text-emerald-500" />
                <p className="text-sm text-[color:var(--muted-foreground)]">No cases in this filter</p>
              </div>
            ) : (
              visible.map((c) => (
                <CaseRow
                  key={c.id}
                  c={c}
                  bulkMode={bulkMode}
                  selected={selectedIds.has(c.id)}
                  onToggleSelect={toggleSelect}
                  onArchive={handleArchiveCase}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[color:var(--border)] px-4 py-3">
            <Link
              href="/cases/new"
              className="text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2"
            >
              Start New Case →
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <FolderKanban size={15} className="text-[color:var(--primary)]" />
              <h2 className="text-sm font-semibold text-[color:var(--foreground)]">
                {apiSource === "api" ? "Live Cases"
                  : apiSource === "demo" ? "Demo Cases (Fallback)"
                  : "Loading…"}
              </h2>
            </div>
            {apiSource === "api" && <StatusBadge tone="success">Live</StatusBadge>}
          </div>

          {apiSource === "loading" ? (
            <div className="flex items-center justify-center py-10">
              <Clock size={20} className="animate-spin text-[color:var(--muted-foreground)]" />
            </div>
          ) : apiCases.length === 0 ? (
            <div className="flex flex-col items-center gap-4 p-10 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
                <FolderKanban size={28} />
              </span>
              <div>
                <p className="text-base font-semibold text-[color:var(--foreground)]">No active cases</p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  New cases will appear here after a patient record or scan upload is created.
                </p>
              </div>
              <Link
                href="/studio"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-5 text-sm font-semibold text-[color:var(--foreground)] transition-transform active:scale-95"
              >
                <UploadCloud size={15} className="text-[color:var(--primary)]" />
                Upload STL / PLY / OBJ
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--border)]">
              {filteredApiCases.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Search size={20} className="text-[color:var(--muted-foreground)]" />
                  <p className="text-sm text-[color:var(--muted-foreground)]">
                    No cases match &ldquo;{searchQuery}&rdquo;
                  </p>
                </div>
              ) : (
                filteredApiCases.map((c) => <LiveCaseRow key={c.id} c={c} />)
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── Workflow shortcuts ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { href: "/studio",         label: "CAD Studio",      icon: Clock,        tone: "bg-[color:var(--primary-glow)] text-[color:var(--primary)]" },
          { href: "/cases/new",      label: "New Case Wizard", icon: Plus,         tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
          { href: "/treatment-plan", label: "Treatment Plan",  icon: AlertCircle,  tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-xs font-semibold text-[color:var(--foreground)] transition-transform active:scale-95 hover:bg-[color:var(--border)]/40"
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${item.tone}`}>
                <Icon size={13} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* ── Bulk action bar (sticky) ── */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+var(--sa-bottom)+0.75rem)] z-30 mx-auto max-w-sm px-4">
          <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-4 py-2.5 shadow-[var(--shadow-lg)] backdrop-blur-xl">
            <span className="flex-1 text-sm font-semibold text-[color:var(--foreground)]">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={() => void handleBulkArchive()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--border)]/50 hover:text-[color:var(--foreground)]"
            >
              <Archive size={12} /> Archive
            </button>
            <Link
              href="/export"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--border)]/50 hover:text-[color:var(--foreground)]"
            >
              <Download size={12} /> Export
            </Link>
            <button
              type="button"
              onClick={clearBulk}
              className="grid h-7 w-7 place-items-center rounded-lg text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--border)]/50"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
