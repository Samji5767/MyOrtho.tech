"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
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
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Sun,
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

type Workspace = "landing" | "dashboard" | "patients" | "cases" | "uploads" | "viewer" | "planning" | "printing" | "reports" | "settings";

const navigation: { id: Workspace; label: string; icon: LucideIcon; shortcut: string }[] = [
  { id: "landing", label: "Overview", icon: Home, shortcut: "O" },
  { id: "dashboard", label: "Dashboard", icon: Activity, shortcut: "D" },
  { id: "patients", label: "Patients", icon: Users, shortcut: "P" },
  { id: "cases", label: "Cases", icon: FolderKanban, shortcut: "C" },
  { id: "uploads", label: "STL imports", icon: UploadCloud, shortcut: "U" },
  { id: "viewer", label: "STL viewer", icon: Layers3, shortcut: "V" },
  { id: "planning", label: "Treatment plan", icon: Wand2, shortcut: "T" },
  { id: "printing", label: "Printing center", icon: Printer, shortcut: "M" },
  { id: "reports", label: "Reports", icon: FileBarChart, shortcut: "R" },
  { id: "settings", label: "Settings", icon: Settings, shortcut: "S" }
];

const patients = [
  { name: "Eleanor Vance", age: 29, caseId: "MYO-2408", status: "planning", risk: "Moderate", progress: 62, next: "Doctor approval", revenue: "$4.8k" },
  { name: "Julian Kerr", age: 17, caseId: "MYO-2412", status: "manufacturing", risk: "Low", progress: 84, next: "Print batch 22", revenue: "$3.9k" },
  { name: "Amara Singh", age: 34, caseId: "MYO-2419", status: "scan_uploaded", risk: "High", progress: 28, next: "Segment roots", revenue: "$5.6k" },
  { name: "Mateo Alvarez", age: 22, caseId: "MYO-2425", status: "staging", risk: "Low", progress: 73, next: "Stage comparison", revenue: "$4.2k" }
];

const planStages = Array.from({ length: 18 }, (_, index) => ({
  stage: index + 1,
  movement: Math.max(0.1, 1.8 - index * 0.07),
  ipr: index % 4 === 0 ? 0.2 : 0,
  status: index < 9 ? "complete" : index === 9 ? "active" : "queued",
  tracking: Math.min(98, 78 + index),
  heat: Math.max(12, 88 - index * 3)
}));

function CommandPalette({ open, onClose, setActive }: { open: boolean; onClose: () => void; setActive: (workspace: Workspace) => void }) {
  const [query, setQuery] = useState("");
  const filtered = navigation.filter(item => item.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/45 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="mx-auto mt-16 w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-lg" onMouseDown={event => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Command size={18} className="text-primary" />
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search workspaces, demo flows, reports..."
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-secondary"
          />
          <kbd className="rounded-md border border-border px-2 py-1 text-xs text-secondary">Esc</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {filtered.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-slate-100 focus-ring dark:hover:bg-slate-900"
                onClick={() => {
                  setActive(item.id);
                  onClose();
                }}
              >
                <span className="flex min-w-0 items-center gap-3"><Icon size={18} className="text-primary" /><span className="truncate text-sm font-semibold text-foreground">{item.label}</span></span>
                <span className="flex items-center gap-2 text-xs text-secondary"><kbd className="rounded border border-border px-1.5 py-0.5">{item.shortcut}</kbd><CornerDownLeft size={14} /></span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Shell({ active, setActive, children }: { active: Workspace; setActive: (workspace: Workspace) => void; children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(value => !value);
        return;
      }
      if (event.key === "Escape") setCommandOpen(false);
      if (!isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const match = navigation.find(item => item.shortcut.toLowerCase() === event.key.toLowerCase());
        if (match) setActive(match.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setActive]);

  const Nav = ({ compact = false }: { compact?: boolean }) => (
    <nav className="space-y-1" aria-label="Workspace navigation">
      {navigation.map(item => {
        const Icon = item.icon;
        const selected = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              setActive(item.id);
              setMobileOpen(false);
            }}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition focus-ring ${selected ? "bg-primary text-primary-foreground shadow-sm" : "text-secondary hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-900"}`}
          >
            <Icon size={18} className="transition group-hover:scale-105" />
            {!compact && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
            {!compact && <kbd className="hidden rounded border border-current/20 px-1.5 py-0.5 text-[10px] opacity-60 xl:inline">{item.shortcut}</kbd>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} setActive={setActive} />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-border bg-card/88 p-4 backdrop-blur-xl lg:block">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Stethoscope size={21} /></div>
          <div>
            <p className="text-sm font-bold tracking-tight text-foreground">MyOrtho.tech</p>
            <p className="text-xs text-secondary">Clinical command center</p>
          </div>
        </div>
        <Nav />
        <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-border bg-slate-50 p-3 dark:bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><ShieldCheck size={15} className="text-emerald-500" /> HIPAA-ready audit mode</div>
          <p className="mt-2 text-xs leading-5 text-secondary">Approvals, uploads, printing exports, and demo events are prepared for immutable logging.</p>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-3 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Stethoscope size={21} /></div><span className="font-bold">MyOrtho.tech</span></div>
              <Button size="icon" variant="ghost" onClick={() => setMobileOpen(false)}><X size={18} /></Button>
            </div>
            <Nav />
          </div>
        </div>
      )}

      <main className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border bg-background/78 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={19} /></Button>
              <button onClick={() => setCommandOpen(true)} className="hidden h-10 min-w-[300px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-secondary transition hover:bg-slate-100 focus-ring md:flex dark:hover:bg-slate-900">
                <Search size={16} /> Search patients, cases, stages, reports <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[11px]">Cmd K</kbd>
              </button>
              <div className="min-w-0 md:hidden">
                <p className="truncate text-sm font-bold text-foreground">MyOrtho.tech</p>
                <p className="text-xs text-secondary">{navigation.find(item => item.id === active)?.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" aria-label="Open command palette" className="md:hidden" onClick={() => setCommandOpen(true)}><Command size={18} /></Button>
              <Button size="icon" variant="ghost" aria-label="Notifications"><Bell size={18} /></Button>
              <Button size="icon" variant="ghost" aria-label="Toggle theme" onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</Button>
              <Button variant="primary" className="hidden sm:inline-flex" onClick={() => setActive("uploads")}><Plus size={16} /> New case</Button>
            </div>
          </div>
        </header>
        <div key={active} className="mx-auto max-w-[1600px] animate-page-enter px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

function Landing({ setActive }: { setActive: (workspace: Workspace) => void }) {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-xl border border-border bg-slate-950 text-white shadow-lg">
        <div className="absolute inset-0 clinical-grid opacity-30" />
        <div className="relative grid min-h-[520px] gap-8 p-6 md:p-10 xl:grid-cols-[1fr_520px] xl:items-center">
          <div className="max-w-3xl">
            <StatusBadge tone="primary">Enterprise orthodontic platform</StatusBadge>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">MyOrtho.tech</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">A premium clinical workspace for scan acquisition, STL visualization, treatment staging, aligner manufacturing, and production reporting.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => setActive("dashboard")}>Open dashboard <ChevronRight size={16} /></Button>
              <Button variant="secondary" className="border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setActive("viewer")}>Launch STL viewer</Button>
              <Button variant="secondary" className="border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setActive("planning")}><PlayCircle size={16} /> Guided demo</Button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
            <div className="rounded-lg bg-slate-900 p-4">
              <div className="mb-4 flex items-center justify-between"><span className="text-sm font-semibold">Eleanor Vance treatment</span><StatusBadge tone="success">On track</StatusBadge></div>
              <div className="relative h-64 overflow-hidden rounded-lg bg-slate-950 clinical-grid">
                <div className="absolute left-8 top-10 h-28 w-72 rounded-full border border-teal-300/40" />
                <div className="absolute bottom-10 right-8 h-28 w-72 rounded-full border border-blue-300/35" />
                <div className="absolute inset-x-8 top-1/2 h-1 rounded-full bg-gradient-to-r from-teal-400 via-blue-400 to-emerald-400" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-white/5 p-3"><p className="text-slate-400">Stages</p><p className="mt-1 text-xl font-semibold">18</p></div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-slate-400">IPR</p><p className="mt-1 text-xl font-semibold">1.2mm</p></div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-slate-400">QC</p><p className="mt-1 text-xl font-semibold">98%</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {["Clinical-grade STL controls", "Case lifecycle intelligence", "Manufacturing handoff reports"].map((title, index) => (
          <Card key={title} className="interactive-card p-5">
            <Sparkles className={index === 0 ? "text-primary" : index === 1 ? "text-blue-500" : "text-emerald-500"} size={22} />
            <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-secondary">{index === 0 ? "Orbit, pan, zoom, presets, screenshots, sections, measurements, annotations, landmarks, and dental material rendering." : index === 1 ? "Patient records, cases, notes, staging, progress tracking, risk flags, activity, and approval workflows." : "Print preparation, resin and cost estimation, fleet telemetry, support recommendations, and exportable reports."}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Enterprise dashboard" title="Clinical operations at a glance" description="Monitor case throughput, treatment planning quality, manufacturing health, patient workflow risk, and commercial performance from one command center." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active cases" value="128" helper="24 need doctor review" icon={FolderKanban} tone="primary" />
        <MetricCard label="Plans approved" value="91%" helper="+7.8% over last month" icon={CheckCircle2} tone="success" />
        <MetricCard label="Monthly ARR placeholder" value="$642k" helper="Investor demo metric" icon={TrendingUp} tone="info" />
        <MetricCard label="Print utilization" value="76%" helper="2 jobs at risk" icon={Printer} tone="warning" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-foreground">Case pipeline</h3>
          <div className="mt-5 space-y-4">
            {["Scan uploaded", "Segmentation", "Treatment planning", "Doctor approval", "Manufacturing"].map((label, index) => <div key={label}><div className="mb-2 flex justify-between text-sm"><span className="font-medium text-foreground">{label}</span><span className="text-secondary">{[18, 11, 26, 14, 33][index]} cases</span></div><ProgressBar value={[42, 30, 68, 36, 78][index]} tone={index === 3 ? "warning" : "primary"} /></div>)}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-foreground">User activity timeline</h3>
          <div className="mt-4 space-y-3">
            {["Dr. Patel approved MYO-2408", "Lab A exported batch 22", "Amara Singh scan flagged scale warning", "Finance forecast refreshed"].map((event, index) => <div key={event} className="flex gap-3 rounded-lg border border-border p-3"><span className="mt-1 h-2 w-2 rounded-full bg-primary" /><div><p className="text-sm font-semibold text-foreground">{event}</p><p className="mt-1 text-xs text-secondary">{["4 min", "19 min", "32 min", "1 hr"][index]} ago</p></div></div>)}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PatientManagement() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Patient management" title="Patient profiles and treatment tracking" description="Create patient records, review active cases, track next actions, and keep clinical notes visible at the point of care." action={<Button variant="primary"><Plus size={16} /> Add patient</Button>} />
      <div className="grid gap-4">
        {patients.map(patient => <Card key={patient.caseId} className="interactive-card p-4"><div className="grid gap-4 md:grid-cols-[1fr_140px_180px_160px_120px]"><div><h3 className="font-semibold text-foreground">{patient.name}</h3><p className="mt-1 text-sm text-secondary">Age {patient.age} - Case {patient.caseId}</p></div><StatusBadge tone={patient.status === "manufacturing" ? "primary" : patient.status === "scan_uploaded" ? "info" : "success"}>{patient.status}</StatusBadge><div><p className="mb-2 text-xs text-secondary">Treatment progress</p><ProgressBar value={patient.progress} /></div><div className="text-sm text-secondary"><span className="font-medium text-foreground">Next:</span> {patient.next}</div><div className="text-sm font-semibold text-foreground">{patient.revenue}</div></div></Card>)}
      </div>
    </div>
  );
}

function CaseManagement() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Case management" title="Orthodontic case board" description="Clinical, lab, and manufacturing teams share the same case status, treatment notes, approvals, STL assets, and production readiness." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {patients.map(patient => <Card key={patient.caseId} className="interactive-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">{patient.caseId}</p><h3 className="mt-2 font-semibold text-foreground">{patient.name}</h3></div><StatusBadge tone={patient.risk === "High" ? "danger" : patient.risk === "Moderate" ? "warning" : "success"}>{patient.risk}</StatusBadge></div><p className="mt-4 text-sm leading-6 text-secondary">{patient.next}. Notes, scan status, treatment stage, manufacturing readiness, and approval history are grouped per case.</p><div className="mt-5"><ProgressBar value={patient.progress} /></div></Card>)}
      </div>
    </div>
  );
}

function TreatmentPlanning() {
  const [stage, setStage] = useState(10);
  const current = planStages[stage - 1];
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Treatment planning" title="Premium stage simulation" description="Review before/after movement, stage deltas, IPR, treatment tracking, heatmaps, and side-by-side comparison across the aligner timeline." action={<Button variant="primary"><Wand2 size={16} /> Generate stages</Button>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-lg font-semibold text-foreground">Timeline stage {stage}</h3><StatusBadge tone={current.status === "active" ? "primary" : current.status === "complete" ? "success" : "neutral"}>{current.status}</StatusBadge></div>
          <input type="range" min={1} max={18} value={stage} onChange={event => setStage(Number(event.target.value))} className="w-full accent-teal-500" />
          <div className="mt-4 grid grid-cols-6 gap-1 md:grid-cols-18">
            {planStages.map(item => <button key={item.stage} onClick={() => setStage(item.stage)} className={`h-10 rounded-md border text-xs font-semibold transition ${item.stage === stage ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-secondary hover:border-primary/50"}`}>{item.stage}</button>)}
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="relative h-80 rounded-lg border border-border bg-slate-950 clinical-grid"><span className="absolute left-3 top-3"><StatusBadge tone="info">Before</StatusBadge></span><div className="absolute inset-x-10 top-1/2 h-24 rounded-full border border-blue-300/30" /></div>
            <div className="relative h-80 rounded-lg border border-border bg-slate-950 clinical-grid"><span className="absolute left-3 top-3"><StatusBadge tone="success">After stage {stage}</StatusBadge></span><div className="absolute inset-x-10 top-[45%] h-24 rounded-full border border-teal-300/50 shadow-[0_0_30px_rgba(45,212,191,0.18)]" /></div>
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="p-5"><h3 className="text-lg font-semibold text-foreground">Movement analytics</h3><div className="mt-4"><DataRow label="Max movement" value={`${current.movement.toFixed(2)} mm`} /><DataRow label="IPR planned" value={`${current.ipr.toFixed(1)} mm`} /><DataRow label="Tracking confidence" value={`${current.tracking}%`} /><DataRow label="Attachments" value="6 active" /><DataRow label="Refinement risk" value={<StatusBadge tone="warning">Moderate</StatusBadge>} /></div></Card>
          <Card className="p-5"><h3 className="text-lg font-semibold text-foreground">Movement heatmap</h3><div className="mt-4 grid grid-cols-7 gap-2">{Array.from({ length: 28 }, (_, index) => <div key={index} className="h-8 rounded-md" style={{ background: `rgba(${index % 3 === 0 ? 45 : 96}, ${index % 3 === 0 ? 212 : 165}, ${index % 3 === 0 ? 191 : 250}, ${0.18 + ((current.heat + index) % 70) / 120})` }} />)}</div></Card>
        </div>
      </div>
    </div>
  );
}

function Reports() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Reports" title="Clinical and manufacturing reports" description="Generate case reports, production summaries, progress analytics, PDF-ready snapshots, and investor demo evidence." />
      <div className="grid gap-4 md:grid-cols-3">{["Case report", "Manufacturing report", "Progress analytics"].map((title, index) => <Card key={title} className="interactive-card p-5"><FileBarChart className="text-primary" size={24} /><h3 className="mt-4 font-semibold text-foreground">{title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{index === 0 ? "Patient summary, diagnosis, scan metrics, staging, approvals, and notes." : index === 1 ? "Printer, material, resin estimate, batch status, QC, and export trace." : "Movement tracking, case statistics, treatment velocity, and refinement risk."}</p><Button className="mt-5" variant="secondary">Generate</Button></Card>)}</div>
      <Card className="p-5"><BarChart3 className="text-primary" size={22} /><h3 className="mt-3 text-lg font-semibold text-foreground">Clinic performance</h3><div className="mt-5 grid gap-4 md:grid-cols-4"><MetricCard label="Cases completed" value="342" icon={CheckCircle2} tone="success" /><MetricCard label="Refinement rate" value="8.4%" icon={Activity} tone="warning" /><MetricCard label="Avg aligners" value="21" icon={Layers3} tone="info" /><MetricCard label="Print yield" value="97.3%" icon={Printer} tone="primary" /></div></Card>
      <Card className="p-5"><h3 className="text-lg font-semibold text-foreground">Investor demo guide</h3><div className="mt-4 grid gap-3 md:grid-cols-4"><DataRow label="Flow" value="Upload to plan" /><DataRow label="Persona" value="Enterprise clinic" /><DataRow label="Proof" value="Reports + STL" /><DataRow label="Readiness" value={<StatusBadge tone="success">Demo ready</StatusBadge>} /></div></Card>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Settings" title="Workspace, security, and design system" description="Configure clinic identity, clinical defaults, manufacturing presets, security policy, notification routing, and mobile behavior." />
      <div className="grid gap-6 xl:grid-cols-2"><Card className="p-5"><h3 className="text-lg font-semibold text-foreground">Clinical defaults</h3><div className="mt-4"><DataRow label="Default layer height" value="100 microns" /><DataRow label="Treatment protocol" value="Clear aligner comprehensive" /><DataRow label="STL parser" value="Client + worker ready" /><DataRow label="Theme" value="Light and dark" /></div></Card><Card className="p-5"><h3 className="text-lg font-semibold text-foreground">Security</h3><div className="mt-4"><DataRow label="SSO" value={<StatusBadge tone="success">Enabled</StatusBadge>} /><DataRow label="MFA" value={<StatusBadge tone="success">Enforced</StatusBadge>} /><DataRow label="Audit logs" value="90 day hot storage" /><DataRow label="PHI export" value="Approval required" /></div></Card></div>
      <div className="grid gap-4 md:grid-cols-3"><MetricCard label="Keyboard shortcuts" value="10" helper="Direct workspace jumps" icon={Keyboard} tone="primary" /><MetricCard label="Mobile targets" value="44px" helper="Touch-safe controls" icon={Smartphone} tone="info" /><MetricCard label="Interaction budget" value="60fps" helper="Reduced motion respected" icon={Zap} tone="success" /></div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState<Workspace>("landing");
  const [lastMetrics, setLastMetrics] = useState<object | null>(null);

  const content = useMemo(() => {
    switch (active) {
      case "landing": return <Landing setActive={setActive} />;
      case "dashboard": return <Dashboard />;
      case "patients": return <PatientManagement />;
      case "cases": return <CaseManagement />;
      case "uploads": return <ScanImportSystem caseId="MYO-2408" patientName="Eleanor Vance" onUploadSuccess={setLastMetrics} />;
      case "viewer": return <Viewer3D />;
      case "planning": return <TreatmentPlanning />;
      case "printing": return <ManufacturingCenter />;
      case "reports": return <Reports />;
      case "settings": return <SettingsPage />;
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
