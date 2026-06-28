"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Box,
  Brain,
  ChevronRight,
  Clock,
  Factory,
  FolderKanban,
  Package,
  Plus,
  ScanLine,
  Settings,
  Target,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/DesignSystem";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";
import NewCaseModal from "@/components/NewCaseModal";

// ─── Workflow pipeline ────────────────────────────────────────────────────────

type PipelineStep = {
  n: number;
  label: string;
  sub: string;
  icon: LucideIcon;
  href: string;
  color: string;
};

const PIPELINE: PipelineStep[] = [
  { n: 1, label: "Scan",           sub: "STL / OBJ / PLY import",     icon: ScanLine, href: "/studio",         color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  { n: 2, label: "AI Segment",     sub: "Tooth detection & labelling", icon: Target,   href: "/studio",         color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { n: 3, label: "CAD Design",     sub: "Aligner & attachment design", icon: Box,      href: "/studio",         color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  { n: 4, label: "Treatment Plan", sub: "Movement sequencing & IPR",   icon: Wand2,    href: "/treatment-plan", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  { n: 5, label: "Manufacturing",  sub: "3D print & QC",               icon: Factory,  href: "/manufacturing",  color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { n: 6, label: "Delivery",       sub: "Ship to clinic",              icon: Package,  href: "/cases",          color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
];

// ─── Quick-access shortcuts ───────────────────────────────────────────────────

type Shortcut = { label: string; sub: string; icon: LucideIcon; href: string };

const SHORTCUTS: Shortcut[] = [
  { label: "Cases",              sub: "All patient cases",            icon: FolderKanban, href: "/cases" },
  { label: "Patients",           sub: "Patient records",              icon: Users,        href: "/patients" },
  { label: "CAD Design Studio",  sub: "3D aligner & CAD workspace",   icon: Box,          href: "/studio" },
  { label: "AI Copilot",         sub: "Treatment proposal & review",  icon: Brain,        href: "/studio" },
  { label: "Manufacturing",      sub: "Print queue & QC",             icon: Factory,      href: "/manufacturing" },
  { label: "Settings",           sub: "Preferences & admin",          icon: Settings,     href: "/settings" },
];

// ─── Case status helpers ──────────────────────────────────────────────────────

function caseStatusBadge(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    active_treatment: { label: "Active",          cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    pending_records:  { label: "Pending",         cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    scan_review:      { label: "Scan Review",     cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
    clinical_review:  { label: "Clinical Review", cls: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
    manufacturing:    { label: "Manufacturing",   cls: "bg-[color:var(--primary-glow)] text-[color:var(--primary)]" },
    completed:        { label: "Completed",       cls: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
    on_hold:          { label: "On Hold",         cls: "bg-slate-500/10 text-slate-500" },
  };
  return map[status] ?? { label: status, cls: "bg-slate-500/10 text-slate-500" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipelineCard({ step }: { step: PipelineStep }) {
  const Icon = step.icon;
  return (
    <Link
      href={step.href}
      className="ios-card group flex min-w-[148px] flex-col gap-3 p-4 transition-transform active:scale-[0.97]"
    >
      <div className="flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-2xl ${step.color}`}>
          <Icon size={17} />
        </span>
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--border)] text-[9px] font-bold text-[color:var(--muted-foreground)]">
          {step.n}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{step.label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[color:var(--muted-foreground)]">{step.sub}</p>
      </div>
    </Link>
  );
}

function ShortcutCard({ s }: { s: Shortcut }) {
  const Icon = s.icon;
  return (
    <Link
      href={s.href}
      className="ios-card flex items-center gap-3 p-4 transition-transform active:scale-[0.97]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{s.label}</p>
        <p className="mt-0.5 truncate text-[11px] text-[color:var(--muted-foreground)]">{s.sub}</p>
      </div>
    </Link>
  );
}

function CaseRow({ c }: { c: CaseListItem }) {
  const { label, cls } = caseStatusBadge(c.status);
  const patientName = `${c.patient.firstName} ${c.patient.lastName}`;
  const initials = [c.patient.firstName[0], c.patient.lastName[0]].join("").toUpperCase();
  const date = new Date(c.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Link
      href={`/cases/${c.id}`}
      className="ios-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-sm font-bold text-[color:var(--primary)]">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{patientName}</p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--muted-foreground)]">
          {c.chiefComplaint ?? "No chief complaint"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
        <div className="flex items-center gap-0.5 text-[11px] text-[color:var(--muted-foreground)]">
          <Clock size={10} />
          {date}
        </div>
        <ChevronRight size={14} className="text-[color:var(--muted-foreground)]" />
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);

  const loadCases = useCallback(() => {
    fetchCases()
      .then(({ cases }) => { setCases(cases.slice(0, 6)); setCasesLoading(false); })
      .catch(() => setCasesLoading(false));
  }, []);

  useEffect(() => { loadCases(); }, [loadCases]);

  return (
    <>
      <section className="animate-page-enter mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+2rem)] pt-5 sm:px-5">

        {/* ── Hero ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/app-icon.png"
              alt="MyOrtho"
              style={{ width: 40, height: 40, borderRadius: 14, objectFit: "cover", flexShrink: 0 }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                MyOrtho.tech
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">
                Overview
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] transition-transform active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} />
            New Case
          </button>
        </div>

        {/* ── Clinical Workflow Pipeline ── */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            Clinical Workflow
          </p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {PIPELINE.map((step) => (
              <PipelineCard key={step.n} step={step} />
            ))}
          </div>
        </div>

        {/* ── Quick Access ── */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            Quick Access
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SHORTCUTS.map((s) => (
              <ShortcutCard key={s.label} s={s} />
            ))}
          </div>
        </div>

        {/* ── Recent Cases ── */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
              Recent Cases
            </p>
            <Link
              href="/cases"
              className="text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2"
            >
              View all →
            </Link>
          </div>

          {casesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="ios-card h-[70px] animate-pulse" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
                <FolderKanban size={22} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[color:var(--foreground)]">No cases yet</p>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  Create your first patient case to get started with the clinical workflow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
              >
                <Plus size={14} strokeWidth={2.5} />
                Create First Case
              </button>
            </Card>
          ) : (
            <div className="space-y-2">
              {cases.map((c) => (
                <CaseRow key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* New Case modal */}
      {modalOpen && (
        <NewCaseModal
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            loadCases();
          }}
        />
      )}
    </>
  );
}
