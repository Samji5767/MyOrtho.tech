"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Droplet,
  Factory,
  Flame,
  Layers,
  Loader2,
  Package,
  Printer,
  RotateCcw,
  Settings,
  Truck,
  TrendingUp,
  TrendingDown,
  Waves,
  X,
  Zap,
} from "lucide-react";
import type { ProductionJob, ProductionStatus, Printer as PrinterType, MaterialInventory } from "@/types/orthodontic";
import { PRODUCTION_PIPELINE_STEPS, productionStatusLabel, productionStatusStep } from "@/types/orthodontic";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PRINTERS: PrinterType[] = [];

const MOCK_JOBS: ProductionJob[] = [];

const MOCK_MATERIALS: MaterialInventory[] = [];

// ─── Production pipeline visualization ───────────────────────────────────────

const STEP_ICONS: Record<ProductionStatus, React.ElementType> = {
  queued: CircleDot,
  printing: Printer,
  washing: Waves,
  curing: Flame,
  qc_inspection: CheckCircle2,
  packaging: Package,
  shipping: Truck,
  completed: CheckCircle2,
  failed: X,
};

function ProductionPipelineBar({ job }: { job: ProductionJob }) {
  const currentStep = productionStatusStep(job.status);
  const steps = PRODUCTION_PIPELINE_STEPS.filter(s => s !== "failed");

  return (
    <div className="mt-3 flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const Icon = STEP_ICONS[step];
        return (
          <div key={step} className="flex flex-1 items-center">
            <div className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs ${done ? "border-emerald-500 bg-emerald-500 text-white" : active ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]" : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}>
              <Icon size={12} />
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${done ? "bg-emerald-500" : "bg-[color:var(--border)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Job card ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ProductionStatus, string> = {
  queued:       "bg-slate-500/10 text-slate-500",
  printing:     "bg-[color:var(--primary-glow)] text-[color:var(--primary)]",
  washing:      "bg-sky-500/10 text-sky-600",
  curing:       "bg-orange-500/10 text-orange-600",
  qc_inspection:"bg-amber-500/10 text-amber-600",
  packaging:    "bg-teal-500/10 text-teal-600",
  shipping:     "bg-emerald-500/10 text-emerald-600",
  completed:    "bg-emerald-500/10 text-emerald-600",
  failed:       "bg-rose-500/10 text-rose-500",
};

function JobCard({ job }: { job: ProductionJob }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border overflow-hidden ${job.slaRisk ? "border-rose-300/50 bg-rose-50/30 dark:border-rose-700/40 dark:bg-rose-900/5" : "border-[color:var(--border)] bg-[color:var(--card)]"}`}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
          <Printer size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-bold text-[color:var(--primary)]">{job.batchLabel}</span>
            <span className="truncate text-sm font-semibold text-[color:var(--foreground)]">{job.patientName}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-[color:var(--muted-foreground)]">Stages {job.stageRange} · {job.alignerCount} aligners</span>
            <span className="text-[10px] text-[color:var(--muted-foreground)]">·</span>
            <span className="text-xs text-[color:var(--muted-foreground)]">{job.printerName}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {job.slaRisk && <AlertTriangle size={14} className="text-rose-500" />}
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_COLORS[job.status]}`}>
            {productionStatusLabel(job.status)}
          </span>
          {expanded ? <ChevronUp size={15} className="text-[color:var(--muted-foreground)]" /> : <ChevronDown size={15} className="text-[color:var(--muted-foreground)]" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[color:var(--border)] px-4 py-4">
          <ProductionPipelineBar job={job} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Started",    value: job.startedAt ?? "—" },
              { label: "ETA",        value: job.estimatedCompleteAt ?? "—" },
              { label: "Resin",      value: `${job.resinVolumeMl} mL` },
              { label: "Material",   value: job.resinType.split(" ").slice(-2).join(" ") },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-2.5">
                <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">{label}</p>
                <p className="mt-0.5 text-xs font-bold text-[color:var(--foreground)]">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {job.status === "qc_inspection" && (
              <button type="button" className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white">
                <CheckCircle2 size={13} /> Approve QC
              </button>
            )}
            {job.status === "queued" && (
              <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-3 py-2 text-xs font-bold text-white">
                <Zap size={13} /> Start Printing
              </button>
            )}
            {job.status === "shipping" && (
              <button type="button" className="flex items-center gap-1.5 rounded-xl bg-teal-500 px-3 py-2 text-xs font-bold text-white">
                <Truck size={13} /> Mark Delivered
              </button>
            )}
            {job.status === "failed" && (
              <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-xs font-bold text-[color:var(--foreground)]">
                <RotateCcw size={13} /> Retry Batch
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Printer status cards ─────────────────────────────────────────────────────

function PrinterCard({ printer }: { printer: PrinterType }) {
  const STATUS_COLORS_MAP: Record<PrinterType["status"], string> = {
    printing:    "bg-[color:var(--primary-glow)] text-[color:var(--primary)]",
    idle:        "bg-emerald-500/10 text-emerald-600",
    offline:     "bg-slate-500/10 text-slate-500",
    error:       "bg-rose-500/10 text-rose-500",
    maintenance: "bg-amber-500/10 text-amber-600",
  };

  const matLevel = printer.materialLevel;
  const matColor = matLevel < 20 ? "bg-rose-500" : matLevel < 40 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${printer.status === "printing" ? "bg-[color:var(--primary-glow)]" : "bg-slate-500/10"}`}>
            <Printer size={16} className={printer.status === "printing" ? "text-[color:var(--primary)]" : "text-slate-500"} />
          </span>
          <div>
            <p className="text-sm font-bold text-[color:var(--foreground)]">{printer.name}</p>
            <p className="text-[10px] text-[color:var(--muted-foreground)]">{printer.model}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_COLORS_MAP[printer.status]}`}>
          {printer.status}
        </span>
      </div>

      {printer.status === "printing" && printer.currentJobProgress !== undefined && (
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-[color:var(--muted-foreground)]">{printer.currentJobId}</span>
            <span className="text-xs font-bold text-[color:var(--primary)]">{printer.currentJobProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[color:var(--border)]">
            <div className="h-full rounded-full bg-[color:var(--primary)] transition-all" style={{ width: `${printer.currentJobProgress}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">Resin Level</span>
            <span className={`text-[10px] font-bold ${matLevel < 20 ? "text-rose-500" : matLevel < 40 ? "text-amber-600" : "text-emerald-600"}`}>{matLevel}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[color:var(--border)]">
            <div className={`h-full rounded-full ${matColor}`} style={{ width: `${matLevel}%` }} />
          </div>
          {matLevel < 40 && <p className="mt-0.5 text-[10px] text-amber-600 font-semibold">⚠ Reorder recommended</p>}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="text-center">
            <p className="text-sm font-black tabular-nums text-[color:var(--foreground)]">{printer.utilizationPct}%</p>
            <p className="text-[9px] text-[color:var(--muted-foreground)]">Utilization</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-black tabular-nums text-[color:var(--foreground)]">{printer.totalPrintsToday}</p>
            <p className="text-[9px] text-[color:var(--muted-foreground)]">Today</p>
          </div>
          <div className="text-center">
            <p className={`text-sm font-black tabular-nums ${printer.successRateToday < 90 ? "text-amber-600" : "text-emerald-600"}`}>{printer.successRateToday}%</p>
            <p className="text-[9px] text-[color:var(--muted-foreground)]">Yield</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Materials inventory ──────────────────────────────────────────────────────

function MaterialsPanel() {
  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Droplet size={15} className="text-sky-500" />
        <h3 className="font-bold text-[color:var(--foreground)]">Resin Inventory</h3>
        {MOCK_MATERIALS.some(m => m.isLowStock) && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600">
            <AlertTriangle size={10} /> Low stock
          </span>
        )}
      </div>
      <div className="space-y-3">
        {MOCK_MATERIALS.map(mat => (
          <div key={mat.id} className={`rounded-xl border p-4 ${mat.isLowStock ? "border-amber-300/50 bg-amber-50/40 dark:border-amber-700/40 dark:bg-amber-900/10" : "border-[color:var(--border)] bg-[color:var(--card)]"}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-sm font-bold text-[color:var(--foreground)]">{mat.resinType}</p>
                <p className="text-xs text-[color:var(--muted-foreground)]">{mat.manufacturer} · Lot {mat.lotNumber}</p>
              </div>
              <span className={`text-sm font-black tabular-nums ${mat.remainingMl < 400 ? "text-rose-500" : mat.remainingMl < 800 ? "text-amber-600" : "text-emerald-600"}`}>
                {mat.remainingMl} mL
              </span>
            </div>
            <div className="h-2 rounded-full bg-[color:var(--border)] mb-1.5">
              <div className={`h-full rounded-full transition-all ${mat.usagePercentage > 80 ? "bg-rose-500" : mat.usagePercentage > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${100 - mat.usagePercentage}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-[color:var(--muted-foreground)]">
              <span>{mat.remainingMl} of {mat.totalMl} mL remaining</span>
              <span>Exp {mat.expiryDate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Production metrics ───────────────────────────────────────────────────────

function ProductionMetrics() {
  const metrics = [
    { label: "Jobs Today",       value: "12",    trend: "+3",   up: true,  color: "text-[color:var(--primary)]" },
    { label: "Success Rate",     value: "91.7%", trend: "+1.2%",up: true,  color: "text-emerald-600" },
    { label: "Failure Rate",     value: "8.3%",  trend: "-2%",  up: false, color: "text-rose-500" },
    { label: "Avg Turnaround",   value: "3.8 h", trend: "-0.5h",up: false, color: "text-[color:var(--foreground)]" },
    { label: "Printer Util.",    value: "72%",   trend: "+5%",  up: true,  color: "text-teal-600" },
    { label: "Resin Consumed",   value: "312 mL",trend: "",     up: true,  color: "text-[color:var(--muted-foreground)]" },
  ];

  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={15} className="text-[color:var(--primary)]" />
        <h3 className="font-bold text-[color:var(--foreground)]">Production Metrics</h3>
        <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">Today</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map(m => (
          <div key={m.label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
            <p className={`text-xl font-black tabular-nums ${m.color}`}>{m.value}</p>
            <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">{m.label}</p>
            {m.trend && (
              <p className={`mt-0.5 flex items-center gap-0.5 text-[10px] font-bold ${m.up ? "text-emerald-600" : "text-rose-500"}`}>
                {m.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {m.trend}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ManufacturingOpsCenter() {
  const [activeTab, setActiveTab] = useState<"queue" | "printers" | "materials" | "metrics">("queue");
  const [statusFilter, setStatusFilter] = useState<ProductionStatus | "all">("all");

  const filteredJobs = statusFilter === "all" ? MOCK_JOBS : MOCK_JOBS.filter(j => j.status === statusFilter);

  const queueStats = {
    total: MOCK_JOBS.length,
    active: MOCK_JOBS.filter(j => j.status === "printing" || j.status === "washing" || j.status === "curing").length,
    qc: MOCK_JOBS.filter(j => j.status === "qc_inspection").length,
    slaRisk: MOCK_JOBS.filter(j => j.slaRisk).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Manufacturing Operating Center</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Production Pipeline</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{queueStats.active} active jobs · {queueStats.qc} in QC · {queueStats.slaRisk} SLA risk</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm font-bold text-[color:var(--foreground)]">
            <Settings size={14} /> Configure
          </button>
          <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-bold text-white">
            <Printer size={14} /> New Print Job
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Print Queue",    value: queueStats.total,    color: "text-[color:var(--primary)]" },
          { label: "Active Jobs",    value: queueStats.active,   color: "text-[color:var(--primary)]" },
          { label: "In QC",          value: queueStats.qc,       color: "text-amber-600" },
          { label: "SLA at Risk",    value: queueStats.slaRisk,  color: queueStats.slaRisk > 0 ? "text-rose-500" : "text-emerald-600" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
            <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-[color:var(--muted-foreground)]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(["queue", "printers", "materials", "metrics"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all capitalize ${activeTab === tab ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
          >
            {tab === "queue" ? "Print Queue" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Print Queue */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {(["all", "queued", "printing", "washing", "curing", "qc_inspection", "shipping", "completed"] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all capitalize ${statusFilter === f ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
              >
                {f === "all" ? "All" : productionStatusLabel(f)}
              </button>
            ))}
          </div>
          {filteredJobs.map(job => <JobCard key={job.id} job={job} />)}
        </div>
      )}

      {/* Printers */}
      {activeTab === "printers" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {MOCK_PRINTERS.map(p => <PrinterCard key={p.id} printer={p} />)}
        </div>
      )}

      {/* Materials */}
      {activeTab === "materials" && <MaterialsPanel />}

      {/* Metrics */}
      {activeTab === "metrics" && <ProductionMetrics />}
    </div>
  );
}

export default ManufacturingOpsCenter;
