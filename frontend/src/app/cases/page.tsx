"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderKanban,
  Plus,
  UploadCloud,
} from "lucide-react";
import { Button, Card, ProgressBar, StatusBadge } from "@/components/DesignSystem";

// ─── Representative demo data ─────────────────────────────────────────────────
// Shown only in preview mode. Never presented as live backend data.

type CaseUrgency = "routine" | "urgent" | "critical";
type CaseStageStatus = "draft" | "submitted" | "clinical-review" | "approved" | "manufacturing" | "completed";

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
  progress: number;
  slaRisk: boolean;
}

const DEMO_CASES: DemoCase[] = [
  {
    id: "C-2883", patient: "Oliver T.", initials: "OT",
    accentClass: "bg-rose-500",
    status: "clinical-review", urgency: "critical",
    doctor: "Dr. Park", type: "Class II Div1 — Canine reposition",
    age: "4 h", progress: 45, slaRisk: true,
  },
  {
    id: "C-2847", patient: "Sarah M.", initials: "SM",
    accentClass: "bg-amber-500",
    status: "approved", urgency: "urgent",
    doctor: "Dr. Chen", type: "Aligner Stage 14 approval",
    age: "2 d", progress: 72, slaRisk: false,
  },
  {
    id: "C-2876", patient: "Emma K.", initials: "EK",
    accentClass: "bg-violet-500",
    status: "manufacturing", urgency: "urgent",
    doctor: "Dr. Chen", type: "Refinement — 8 upper aligners",
    age: "3 d", progress: 85, slaRisk: false,
  },
  {
    id: "C-2901", patient: "James R.", initials: "JR",
    accentClass: "bg-teal-500",
    status: "clinical-review", urgency: "routine",
    doctor: "Dr. Lee", type: "Class I — Upper arch IPR 0.3 mm",
    age: "1 d", progress: 35, slaRisk: false,
  },
  {
    id: "C-2859", patient: "Marcus D.", initials: "MD",
    accentClass: "bg-blue-500",
    status: "submitted", urgency: "urgent",
    doctor: "Dr. Torres", type: "Full-arch correction — 7 attachments",
    age: "3 d", progress: 60, slaRisk: true,
  },
  {
    id: "C-2912", patient: "Ava N.", initials: "AN",
    accentClass: "bg-emerald-500",
    status: "completed", urgency: "routine",
    doctor: "Dr. Lee", type: "Retention Phase — Hawley + Vivera",
    age: "5 d", progress: 100, slaRisk: false,
  },
  {
    id: "C-2900", patient: "Lily S.", initials: "LS",
    accentClass: "bg-indigo-500",
    status: "draft", urgency: "routine",
    doctor: "Dr. Nguyen", type: "Initial consultation — Class I moderate crowding",
    age: "12 h", progress: 15, slaRisk: false,
  },
];

const STATUS_META: Record<CaseStageStatus, { label: string; tone: "neutral" | "info" | "primary" | "warning" | "success" | "danger" }> = {
  draft:           { label: "Draft",            tone: "neutral"  },
  submitted:       { label: "Submitted",        tone: "info"     },
  "clinical-review": { label: "Clinical Review", tone: "primary" },
  approved:        { label: "Approved",         tone: "success"  },
  manufacturing:   { label: "Manufacturing",    tone: "info"     },
  completed:       { label: "Completed",        tone: "success"  },
};

const URGENCY_TONE: Record<CaseUrgency, "neutral" | "warning" | "danger"> = {
  routine: "neutral",
  urgent: "warning",
  critical: "danger",
};

type FilterKey = "all" | "review" | "approved" | "manufacturing" | "completed" | "sla";

const FILTER_SPECS: { key: FilterKey; label: string }[] = [
  { key: "all",           label: "All" },
  { key: "review",        label: "Needs Review" },
  { key: "approved",      label: "Approved" },
  { key: "manufacturing", label: "Manufacturing" },
  { key: "completed",     label: "Completed" },
  { key: "sla",           label: "SLA Risk" },
];

function filterCases(cases: DemoCase[], key: FilterKey): DemoCase[] {
  if (key === "review")        return cases.filter(c => c.status === "clinical-review" || c.status === "submitted");
  if (key === "approved")      return cases.filter(c => c.status === "approved");
  if (key === "manufacturing") return cases.filter(c => c.status === "manufacturing");
  if (key === "completed")     return cases.filter(c => c.status === "completed");
  if (key === "sla")           return cases.filter(c => c.slaRisk);
  return cases;
}

function CaseRow({ c }: { c: DemoCase }) {
  const statusMeta = STATUS_META[c.status];
  const pctProgress = c.progress;

  return (
    <Link
      href={`/cases/${c.id}`}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--border)]/40 active:scale-[0.995]"
    >
      {/* Initials avatar */}
      <div className="relative shrink-0">
        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${c.accentClass}`}>
          {c.initials}
        </span>
        {c.slaRisk && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--background)] bg-rose-500" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-[color:var(--foreground)]">{c.patient}</span>
          <span className="font-mono text-[10px] text-[color:var(--muted-foreground)]">{c.id}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-[color:var(--muted-foreground)]">{c.type} · {c.doctor}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar
              value={pctProgress}
              tone={pctProgress >= 80 ? "success" : pctProgress >= 50 ? "primary" : "warning"}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
            {pctProgress}%
          </span>
        </div>
      </div>

      {/* Right meta */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
        <div className="flex items-center gap-1.5">
          {c.slaRisk && <AlertTriangle size={11} className="text-rose-500" />}
          <StatusBadge tone={URGENCY_TONE[c.urgency]}>{c.urgency}</StatusBadge>
          <span className="text-[10px] tabular-nums text-[color:var(--muted-foreground)]">{c.age}</span>
        </div>
      </div>

      <ChevronRight size={14} className="shrink-0 text-[color:var(--muted-foreground)] transition-colors group-hover:text-[color:var(--foreground)]" />
    </Link>
  );
}

// ─── Live case row ─────────────────────────────────────────────────────────────

function LiveCaseRow({ c }: { c: CaseListItem }) {
  const patientName = `${c.patient.firstName} ${c.patient.lastName}`;
  const initials = `${c.patient.firstName[0] ?? "?"}${c.patient.lastName[0] ?? "?"}`.toUpperCase();
  const statusTone: "neutral" | "info" | "warning" | "success" =
    c.status === "completed" ? "success"
    : c.status === "scan_uploaded" || c.status === "segmenting" ? "info"
    : c.status === "pending_approval" || c.status === "planning" ? "warning"
    : "neutral";
  const label = c.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <Link
      href={`/cases/${c.id}`}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--border)]/40 active:scale-[0.995]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-xs font-bold text-[color:var(--primary-foreground)]">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-[color:var(--foreground)]">{patientName}</span>
          <span className="font-mono text-[10px] text-[color:var(--muted-foreground)] truncate">{c.id.slice(0, 8)}…</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-[color:var(--muted-foreground)]">
          {c.chiefComplaint ?? c.malocclusionClass ?? "—"}
          {c.assignedTo ? ` · ${c.assignedTo.name}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge tone={statusTone}>{label}</StatusBadge>
        <span className="text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
          {new Date(c.updatedAt).toLocaleDateString()}
        </span>
      </div>
      <ChevronRight size={14} className="shrink-0 text-[color:var(--muted-foreground)] transition-colors group-hover:text-[color:var(--foreground)]" />
    </Link>
  );
}

export default function CasesPage() {
  const [previewMode, setPreviewMode] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  // Live data (fetched when preview mode is off)
  const [apiCases, setApiCases] = useState<CaseListItem[]>([]);
  const [apiSource, setApiSource] = useState<"loading" | "api" | "demo">("loading");

  useEffect(() => {
    if (previewMode) return;
    setApiSource("loading");
    fetchCases()
      .then(({ cases, source }) => { setApiCases(cases); setApiSource(source); })
      .catch(() => setApiSource("demo"));
  }, [previewMode]);

  const cases = previewMode ? DEMO_CASES : [];
  const visible = filterCases(cases, filter);

  const slaCount   = cases.filter(c => c.slaRisk).length;
  const reviewCount = cases.filter(c => c.status === "clinical-review" || c.status === "submitted").length;

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">
      {/* Header */}
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
        <Link href="/cases/new">
          <Button variant="primary" size="sm">
            <Plus size={15} /> New Case
          </Button>
        </Link>
      </div>

      {/* Preview toggle */}
      <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[color:var(--foreground)]">Preview mode</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {previewMode ? "Representative cases shown · not live data" : "Connect backend to see live cases"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewMode(v => !v)}
          role="switch"
          aria-checked={previewMode}
          className={["relative h-6 w-11 shrink-0 rounded-full transition-colors", previewMode ? "bg-[color:var(--primary)]" : "bg-[color:var(--border)]"].join(" ")}
        >
          <span className={["absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200", previewMode ? "translate-x-5" : "translate-x-0"].join(" ")} />
        </button>
      </div>

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

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex flex-col items-center gap-2 p-3">
          <span className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">
            {previewMode
              ? cases.filter(c => c.status !== "completed").length
              : apiSource === "loading" ? "…" : apiCases.filter(c => c.status !== "completed").length}
          </span>
          <StatusBadge tone="primary">Active</StatusBadge>
        </Card>
        <Card className="flex flex-col items-center gap-2 p-3">
          <span className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">
            {previewMode ? reviewCount : apiSource === "loading" ? "…" : apiCases.filter(c => c.status === "pending_approval").length}
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

      {/* Content */}
      {previewMode ? (
        <Card className="overflow-hidden p-0">
          {/* Filter chips */}
          <div className="border-b border-[color:var(--border)] px-4 py-3">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {FILTER_SPECS.map(f => (
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
                    ({filterCases(cases, f.key).length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Case list */}
          <div className="divide-y divide-[color:var(--border)]">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CheckCircle2 size={24} className="text-emerald-500" />
                <p className="text-sm text-[color:var(--muted-foreground)]">No cases in this filter</p>
              </div>
            ) : (
              visible.map(c => <CaseRow key={c.id} c={c} />)
            )}
          </div>

          {/* Footer link */}
          <div className="border-t border-[color:var(--border)] px-4 py-3">
            <Link href="/workflow" className="text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2">
              Open Clinical Workflow →
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <FolderKanban size={15} className="text-[color:var(--primary)]" />
              <h2 className="text-sm font-semibold text-[color:var(--foreground)]">
                {apiSource === "api" ? "Live Cases" : apiSource === "demo" ? "Demo Cases (Fallback)" : "Loading…"}
              </h2>
            </div>
            {apiSource === "api" && (
              <StatusBadge tone="success">Live</StatusBadge>
            )}
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
              {apiCases.map(c => <LiveCaseRow key={c.id} c={c} />)}
            </div>
          )}
        </Card>
      )}

      {/* Workflow shortcuts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { href: "/workflow",       label: "Clinical Workflow",  icon: Clock, tone: "bg-[color:var(--primary-glow)] text-[color:var(--primary)]" },
          { href: "/cases/new",      label: "New Case Wizard",    icon: Plus,  tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
          { href: "/manufacturing",  label: "Manufacturing",      icon: AlertCircle, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
        ].map(item => {
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
    </section>
  );
}
