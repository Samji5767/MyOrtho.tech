"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Box,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Command,
  CornerDownLeft,
  FileBarChart,
  FolderKanban,
  Gauge,
  Home,
  Keyboard,
  Layers3,
  Menu,
  Moon,
  PlayCircle,
  Plus,
  Printer,
  Scan,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Sun,
  Target,
  Timer,
  TrendingUp,
  UploadCloud,
  Users,
  Wand2,
  X,
  Zap
} from "lucide-react";
import { useTheme } from "@/components/ThemeContext";
import { Button, Card, DataRow, EmptyState, MetricCard, ProgressBar, SectionHeader, StatusBadge } from "@/components/DesignSystem";

// ─── Dynamic imports — all 11 phases ─────────────────────────────────────────

const Viewer3D = dynamic(() => import("@/components/Viewer3D"), {
  ssr: false,
  loading: () => <div className="h-[620px] rounded-lg animate-skeleton" />
});
const ScanImportSystem = dynamic(() => import("@/components/ScanImportSystem"), {
  loading: () => <div className="h-[520px] rounded-lg animate-skeleton" />
});
const ManufacturingCenter = dynamic(() => import("@/components/ManufacturingCenter"), {
  loading: () => <div className="h-[560px] rounded-lg animate-skeleton" />
});

// Phase 1
const ClinicalCommandCenter = dynamic(() => import("@/components/ClinicalCommandCenter").then(m => ({ default: m.ClinicalCommandCenter })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});
// Phase 2
const EnterprisePatientProfile = dynamic(() => import("@/components/EnterprisePatientProfile").then(m => ({ default: m.EnterprisePatientProfile })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});
// Phase 3
const ScanProcessingCenter = dynamic(() => import("@/components/ScanProcessingCenter").then(m => ({ default: m.ScanProcessingCenter })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});
// Phase 4
const AISegmentationCenter = dynamic(() => import("@/components/AISegmentationCenter").then(m => ({ default: m.AISegmentationCenter })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});
// Phase 5
const CADDesignStudio = dynamic(() => import("@/components/CADDesignStudio").then(m => ({ default: m.CADDesignStudio })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});
// Phase 6
const TreatmentPlanningEngine = dynamic(() => import("@/components/TreatmentPlanningEngine").then(m => ({ default: m.TreatmentPlanningEngine })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});
// Phase 7
const AIOrthodonticCopilot = dynamic(() => import("@/components/AIOrthodonticCopilot").then(m => ({ default: m.AIOrthodonticCopilot })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});
// Phase 8
const ManufacturingOpsCenter = dynamic(() => import("@/components/ManufacturingOpsCenter").then(m => ({ default: m.ManufacturingOpsCenter })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});
// Phase 9
const QualityControlCenter = dynamic(() => import("@/components/QualityControlCenter").then(m => ({ default: m.QualityControlCenter })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});
// Phase 10
const EnterpriseAdmin = dynamic(() => import("@/components/EnterpriseAdmin").then(m => ({ default: m.EnterpriseAdmin })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});
// Phase 11
const BusinessIntelligence = dynamic(() => import("@/components/BusinessIntelligence").then(m => ({ default: m.BusinessIntelligence })), {
  loading: () => <div className="h-[600px] rounded-lg animate-skeleton" />
});

// ─── Workspace type ───────────────────────────────────────────────────────────

type Workspace =
  // Original
  | "landing" | "dashboard" | "patients" | "cases" | "uploads" | "viewer"
  | "planning" | "printing" | "reports" | "settings"
  // Phase 1–11
  | "command" | "patient-profile" | "scan-center" | "segmentation"
  | "cad-studio" | "treatment-engine" | "ai-copilot"
  | "mfg-ops" | "quality-control" | "enterprise" | "intelligence";

// ─── Navigation config with sections ─────────────────────────────────────────

type NavItem = { id: Workspace; label: string; icon: LucideIcon; shortcut: string; isNew?: boolean };
type NavSection = { label: string; items: NavItem[] };

const navigationSections: NavSection[] = [
  {
    label: "Clinical Operations",
    items: [
      { id: "landing",       label: "Overview",              icon: Home,        shortcut: "O" },
      { id: "command",       label: "Command Center",        icon: Gauge,       shortcut: "1", isNew: true },
      { id: "patient-profile",label:"Patients",             icon: Users,       shortcut: "P", isNew: true },
      { id: "cases",         label: "Cases",                 icon: FolderKanban,shortcut: "C" },
    ],
  },
  {
    label: "Clinical Workflow",
    items: [
      { id: "scan-center",   label: "Scan Processing",       icon: Scan,        shortcut: "2", isNew: true },
      { id: "segmentation",  label: "AI Segmentation",       icon: Target,      shortcut: "3", isNew: true },
      { id: "cad-studio",    label: "CAD Design Studio",     icon: Box,         shortcut: "4", isNew: true },
      { id: "viewer",        label: "STL Viewer",            icon: Layers3,     shortcut: "V" },
      { id: "treatment-engine",label:"Treatment Planning",   icon: Wand2,       shortcut: "5", isNew: true },
      { id: "ai-copilot",    label: "AI Copilot",            icon: Bot,         shortcut: "6", isNew: true },
    ],
  },
  {
    label: "Production",
    items: [
      { id: "printing",      label: "Printing Center",       icon: Printer,     shortcut: "M" },
      { id: "mfg-ops",       label: "Manufacturing Ops",     icon: Zap,         shortcut: "7", isNew: true },
      { id: "quality-control",label:"Quality Control",      icon: ShieldCheck, shortcut: "8", isNew: true },
    ],
  },
  {
    label: "Analytics & Admin",
    items: [
      { id: "intelligence",  label: "Business Intelligence", icon: BarChart3,   shortcut: "9", isNew: true },
      { id: "reports",       label: "Reports",               icon: FileBarChart,shortcut: "R" },
      { id: "enterprise",    label: "Enterprise Admin",      icon: Building2,   shortcut: "0", isNew: true },
      { id: "settings",      label: "Settings",              icon: Settings,    shortcut: "S" },
    ],
  },
];

// Flat list for command palette and keyboard shortcuts
const allNavItems: NavItem[] = navigationSections.flatMap(s => s.items);

// ─── Workspace data — empty in production, sample in demo mode only ───────────

const patients: { name: string; age: number; caseId: string; status: string; risk: string; progress: number; next: string; revenue: string }[] = [];

const planStages = Array.from({ length: 18 }, (_, index) => ({
  stage: index + 1,
  movement: Math.max(0.1, 1.8 - index * 0.07),
  ipr: index % 4 === 0 ? 0.2 : 0,
  status: index < 9 ? "complete" : index === 9 ? "active" : "queued",
  tracking: Math.min(98, 78 + index),
  heat: Math.max(12, 88 - index * 3)
}));

// ─── Command Palette ──────────────────────────────────────────────────────────

function CommandPalette({ open, onClose, setActive }: { open: boolean; onClose: () => void; setActive: (w: Workspace) => void }) {
  const [query, setQuery] = useState("");
  const filtered = allNavItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { if (open) setQuery(""); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/45 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="mx-auto mt-16 w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-lg" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Command size={18} className="text-primary" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search workspaces, phases, modules…" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-secondary" />
          <kbd className="rounded-md border border-border px-2 py-1 text-xs text-secondary">Esc</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {filtered.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-slate-100 dark:hover:bg-slate-900" onClick={() => { setActive(item.id); onClose(); }}>
                <span className="flex min-w-0 items-center gap-3">
                  <Icon size={18} className="text-primary" />
                  <span className="truncate text-sm font-semibold text-foreground">{item.label}</span>
                  {item.isNew && <span className="rounded-full bg-[color:var(--primary-glow)] px-1.5 py-0.5 text-[9px] font-black text-[color:var(--primary)]">NEW</span>}
                </span>
                <span className="flex items-center gap-2 text-xs text-secondary">
                  <kbd className="rounded border border-border px-1.5 py-0.5">{item.shortcut}</kbd>
                  <CornerDownLeft size={14} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ active, setActive, children }: { active: Workspace; setActive: (w: Workspace) => void; children: React.ReactNode }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(v => !v); return; }
      if (e.key === "Escape") setCommandOpen(false);
      if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const match = allNavItems.find(item => item.shortcut.toLowerCase() === e.key.toLowerCase());
        if (match) setActive(match.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setActive]);

  const NavContent = ({ onSelect }: { onSelect: (w: Workspace) => void }) => (
    <nav className="space-y-4" aria-label="Workspace navigation">
      {navigationSections.map(section => (
        <div key={section.label}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-secondary">{section.label}</p>
          <div className="space-y-0.5">
            {section.items.map(item => {
              const Icon = item.icon;
              const selected = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { onSelect(item.id); }}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition focus-ring ${selected ? "bg-primary text-primary-foreground shadow-sm" : "text-secondary hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-900"}`}
                >
                  <Icon size={16} className="transition group-hover:scale-105 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.isNew && !selected && (
                    <span className="shrink-0 rounded-full bg-[color:var(--primary-glow)] px-1.5 py-0.5 text-[9px] font-black text-[color:var(--primary)]">NEW</span>
                  )}
                  <kbd className="hidden shrink-0 rounded border border-current/20 px-1.5 py-0.5 text-[10px] opacity-60 xl:inline">{item.shortcut}</kbd>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const activeLabel = allNavItems.find(i => i.id === active)?.label ?? "Workspace";

  return (
    <div className="min-h-screen">
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} setActive={setActive} />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 overflow-y-auto border-r border-border bg-card/88 p-4 pb-20 backdrop-blur-xl lg:block">
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Stethoscope size={21} /></div>
          <div>
            <p className="text-sm font-bold tracking-tight text-foreground">MyOrtho.tech</p>
            <p className="text-xs text-secondary">Orthodontic OS v2.0</p>
          </div>
        </div>
        <NavContent onSelect={(w) => { setActive(w); setMobileOpen(false); }} />
        <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-border bg-slate-50 p-3 dark:bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><ShieldCheck size={14} className="text-emerald-500" /> HIPAA-ready audit mode</div>
          <p className="mt-1.5 text-xs leading-5 text-secondary">All approvals, uploads, and exports prepared for immutable audit logging.</p>
        </div>
      </aside>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-3 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-full max-w-sm overflow-y-auto rounded-xl border border-border bg-card p-4 pb-8 shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Stethoscope size={21} /></div>
                <span className="font-bold">MyOrtho.tech</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setMobileOpen(false)}><X size={18} /></Button>
            </div>
            <NavContent onSelect={(w) => { setActive(w); setMobileOpen(false); }} />
          </div>
        </div>
      )}

      <main className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border bg-background/78 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={19} /></Button>
              <button onClick={() => setCommandOpen(true)} className="hidden h-10 min-w-[300px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-secondary transition hover:bg-slate-100 focus-ring md:flex dark:hover:bg-slate-900">
                <Search size={16} /> Search workspaces, cases, patients <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[11px]">⌘K</kbd>
              </button>
              <div className="min-w-0 md:hidden">
                <p className="truncate text-sm font-bold text-foreground">MyOrtho.tech</p>
                <p className="text-xs text-secondary">{activeLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" aria-label="Command palette" className="md:hidden" onClick={() => setCommandOpen(true)}><Command size={18} /></Button>
              <Button size="icon" variant="ghost" aria-label="Notifications"><Bell size={18} /></Button>
              <Button size="icon" variant="ghost" aria-label="Toggle theme" onClick={toggleTheme}>
                {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
              <Button variant="primary" className="hidden sm:inline-flex" onClick={() => setActive("scan-center")}>
                <Plus size={16} /> New Case
              </Button>
            </div>
          </div>
        </header>

        <div key={active} className="mx-auto max-w-[1600px] animate-page-enter px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Legacy workspace components (preserved) ─────────────────────────────────

function Landing({ setActive }: { setActive: (w: Workspace) => void }) {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-xl border border-border bg-slate-950 text-white shadow-lg">
        <div className="absolute inset-0 clinical-grid opacity-30" />
        <div className="relative grid min-h-[520px] gap-8 p-6 md:p-10 xl:grid-cols-[1fr_520px] xl:items-center">
          <div className="max-w-3xl">
            <StatusBadge tone="primary">Enterprise Orthodontic Operating System</StatusBadge>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">MyOrtho.tech</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Scan → AI Segmentation → CAD Design → Treatment Planning → Manufacturing → Delivery.
              A complete orthodontic OS for clinics, DSOs, and enterprise networks.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => setActive("command")}>Open Command Center <ChevronRight size={16} /></Button>
              <Button variant="secondary" className="border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setActive("cad-studio")}>CAD Design Studio</Button>
              <Button variant="secondary" className="border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setActive("ai-copilot")}><Sparkles size={16} /> AI Copilot</Button>
            </div>

            {/* Phase quick access */}
            <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Segmentation", id: "segmentation" as Workspace, icon: Target },
                { label: "Treatment Engine", id: "treatment-engine" as Workspace, icon: Wand2 },
                { label: "Mfg Ops", id: "mfg-ops" as Workspace, icon: Zap },
                { label: "BI Analytics", id: "intelligence" as Workspace, icon: BarChart3 },
              ].map(({ label, id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActive(id)}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
            <div className="rounded-lg bg-slate-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold">No case loaded — MYO-XXXX</span>
                <StatusBadge tone="primary">18 stages</StatusBadge>
              </div>
              <div className="relative h-52 overflow-hidden rounded-lg bg-slate-950 clinical-grid">
                <div className="absolute left-8 top-10 h-28 w-72 rounded-full border border-teal-300/40" />
                <div className="absolute bottom-10 right-8 h-28 w-72 rounded-full border border-blue-300/35" />
                <div className="absolute inset-x-8 top-1/2 h-1 rounded-full bg-gradient-to-r from-teal-400 via-blue-400 to-emerald-400" />
                <div className="absolute top-3 right-3 rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-400">97.2% Confidence</div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-sm">
                <div className="rounded-lg bg-white/5 p-2 text-center"><p className="text-slate-400 text-[10px]">Stages</p><p className="mt-0.5 text-lg font-bold">18</p></div>
                <div className="rounded-lg bg-white/5 p-2 text-center"><p className="text-slate-400 text-[10px]">IPR</p><p className="mt-0.5 text-lg font-bold">0.8mm</p></div>
                <div className="rounded-lg bg-white/5 p-2 text-center"><p className="text-slate-400 text-[10px]">QC</p><p className="mt-0.5 text-lg font-bold">98%</p></div>
                <div className="rounded-lg bg-white/5 p-2 text-center"><p className="text-slate-400 text-[10px]">SLA</p><p className="mt-0.5 text-lg font-bold text-emerald-400">OK</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { title: "Clinical Command Center",   desc: "Live case pipeline, approval queue, SLA radar, and AI recommendations.",      id: "command" as Workspace },
          { title: "AI Segmentation Center",    desc: "Tooth detection, FDI notation, landmark mapping, and quality scoring.",        id: "segmentation" as Workspace },
          { title: "CAD Design Studio",         desc: "3D viewer, treatment designer, stage simulation, and design review workflow.", id: "cad-studio" as Workspace },
          { title: "Business Intelligence",     desc: "Clinical outcomes, manufacturing metrics, revenue, and doctor productivity.", id: "intelligence" as Workspace },
        ].map(({ title, desc, id }) => (
          <Card key={title} className="interactive-card p-5 cursor-pointer" onClick={() => setActive(id)}>
            <Sparkles className="text-primary" size={20} />
            <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-secondary">{desc}</p>
            <p className="mt-3 text-xs font-bold text-primary">Open →</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LegacyDashboard() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Legacy dashboard" title="Clinical operations" description="Use the new Command Center (shortcut: 1) for the full Phase 1 experience." action={<Button variant="primary" onClick={() => {}}>Open Command Center</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active cases" value="128" helper="24 need doctor review" icon={FolderKanban} tone="primary" />
        <MetricCard label="Plans approved" value="91%" helper="+7.8% over last month" icon={CheckCircle2} tone="success" />
        <MetricCard label="Monthly revenue" value="$284k" helper="+8.8% month-over-month" icon={TrendingUp} tone="info" />
        <MetricCard label="Print utilization" value="72%" helper="3 printers active" icon={Printer} tone="warning" />
      </div>
    </div>
  );
}

function LegacyPatients() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Patient management" title="Patient profiles" description="Use the new Patient Profile workspace for the full Phase 2 enterprise experience." action={<Button variant="primary"><Plus size={16} /> Add patient</Button>} />
      <div className="grid gap-4">
        {patients.map(p => (
          <Card key={p.caseId} className="interactive-card p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_140px_180px_160px_120px]">
              <div>
                <h3 className="font-semibold text-foreground">{p.name}</h3>
                <p className="mt-1 text-sm text-secondary">Age {p.age} - Case {p.caseId}</p>
              </div>
              <StatusBadge tone={p.status === "manufacturing" ? "primary" : p.status === "scan_uploaded" ? "info" : "success"}>{p.status}</StatusBadge>
              <div><p className="mb-2 text-xs text-secondary">Progress</p><ProgressBar value={p.progress} /></div>
              <div className="text-sm text-secondary"><span className="font-medium text-foreground">Next:</span> {p.next}</div>
              <div className="text-sm font-semibold text-foreground">{p.revenue}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LegacyCases() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Case management" title="Orthodontic case board" description="Command Center (shortcut 1) provides the full case pipeline with SLA tracking." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {patients.map(p => (
          <Card key={p.caseId} className="interactive-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">{p.caseId}</p>
                <h3 className="mt-2 font-semibold text-foreground">{p.name}</h3>
              </div>
              <StatusBadge tone={p.risk === "High" ? "danger" : p.risk === "Moderate" ? "warning" : "success"}>{p.risk}</StatusBadge>
            </div>
            <div className="mt-5"><ProgressBar value={p.progress} /></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LegacyTreatmentPlanning() {
  const [stage, setStage] = useState(10);
  const current = planStages[stage - 1];
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Treatment planning" title="Stage simulation" description="Use Treatment Planning Engine (shortcut 5) for the full Phase 6 experience." action={<Button variant="primary"><Wand2 size={16} /> Generate stages</Button>} />
      <Card className="p-5">
        <input type="range" min={1} max={18} value={stage} onChange={e => setStage(Number(e.target.value))} className="w-full accent-teal-500 mb-4" />
        <div className="grid grid-cols-6 gap-1">
          {planStages.map(s => (
            <button key={s.stage} onClick={() => setStage(s.stage)} className={`h-10 rounded-md border text-xs font-semibold transition ${s.stage === stage ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-secondary"}`}>
              {s.stage}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <DataRow label="Movement delta" value={`${current.movement.toFixed(2)} mm`} />
          <DataRow label="IPR" value={`${current.ipr.toFixed(1)} mm`} />
          <DataRow label="Tracking" value={`${current.tracking}%`} />
        </div>
      </Card>
    </div>
  );
}

function Reports() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Reports" title="Clinical and manufacturing reports" description="Use Business Intelligence (shortcut 9) for full Phase 11 analytics." />
      <div className="grid gap-4 md:grid-cols-3">
        {["Case report", "Manufacturing report", "Progress analytics"].map(title => (
          <Card key={title} className="interactive-card p-5">
            <FileBarChart className="text-primary" size={24} />
            <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
            <Button className="mt-5" variant="secondary">Generate</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Settings" title="Workspace & security" description="Use Enterprise Admin (shortcut 0) for full Phase 10 RBAC and multi-clinic management." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">Security</h3>
          <DataRow label="SSO" value={<StatusBadge tone="success">Enabled</StatusBadge>} />
          <DataRow label="MFA" value={<StatusBadge tone="success">Enforced</StatusBadge>} />
          <DataRow label="Audit logs" value="90 day hot storage" />
          <DataRow label="PHI export" value="Approval required" />
        </Card>
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">Clinical defaults</h3>
          <DataRow label="Default layer height" value="100 microns" />
          <DataRow label="Treatment protocol" value="Clear aligner comprehensive" />
          <DataRow label="STL parser" value="Client + worker ready" />
          <DataRow label="AI engine" value="MyOrtho Segment v2.1" />
        </Card>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [active, setActive] = useState<Workspace>("landing");
  const [lastMetrics, setLastMetrics] = useState<object | null>(null);

  const content = useMemo(() => {
    switch (active) {
      // Phase 1
      case "command":          return <ClinicalCommandCenter />;
      // Phase 2
      case "patient-profile":  return <EnterprisePatientProfile />;
      // Phase 3
      case "scan-center":      return <ScanProcessingCenter />;
      // Phase 4
      case "segmentation":     return <AISegmentationCenter />;
      // Phase 5
      case "cad-studio":       return <CADDesignStudio />;
      // Phase 6
      case "treatment-engine": return <TreatmentPlanningEngine />;
      // Phase 7
      case "ai-copilot":       return <AIOrthodonticCopilot />;
      // Phase 8
      case "mfg-ops":          return <ManufacturingOpsCenter />;
      // Phase 9
      case "quality-control":  return <QualityControlCenter />;
      // Phase 10
      case "enterprise":       return <EnterpriseAdmin />;
      // Phase 11
      case "intelligence":     return <BusinessIntelligence />;

      // Original workspaces (preserved)
      case "landing":    return <Landing setActive={setActive} />;
      case "dashboard":  return <LegacyDashboard />;
      case "patients":   return <LegacyPatients />;
      case "cases":      return <LegacyCases />;
      case "uploads":    return <ScanImportSystem caseId="" patientName="" onUploadSuccess={setLastMetrics} />;
      case "viewer":     return <Viewer3D />;
      case "planning":   return <LegacyTreatmentPlanning />;
      case "printing":   return <ManufacturingCenter />;
      case "reports":    return <Reports />;
      case "settings":   return <SettingsPage />;

      default: return <EmptyState icon={ClipboardList} title="Workspace not found" body="Select a workspace from the navigation." />;
    }
  }, [active]);

  return (
    <Shell active={active} setActive={setActive}>
      {content}
      {lastMetrics && active !== "uploads" && <div className="sr-only">Last scan metrics loaded</div>}
    </Shell>
  );
}
