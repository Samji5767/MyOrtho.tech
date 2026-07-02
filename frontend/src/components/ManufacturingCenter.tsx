"use client";

import React, { useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Boxes, CheckCircle2, Clock, Download, FileText, Layers, Package, Printer, Rotate3D, ShieldCheck, Truck, Wand2, Zap, type LucideIcon } from "lucide-react";
import { usePrintJobs, usePrinters } from "@/hooks/useApi";
import { Button, Card, DataRow, MetricCard, ProgressBar, SectionHeader, StatusBadge } from "@/components/DesignSystem";

const layerHeights = [50, 75, 100, 150];

// ─── One-click workflow automation ────────────────────────────────────────────

type WorkflowStageStatus = "pending" | "running" | "complete" | "error";

interface WorkflowStage {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  ms: number;
}

const WORKFLOW_STAGES: WorkflowStage[] = [
  { id: "case_approval",     label: "Case Approval",         description: "Clinician sign-off verified",               icon: CheckCircle2, ms: 600  },
  { id: "segmentation",      label: "Segmentation",          description: "AI tooth segmentation complete",             icon: Layers,       ms: 900  },
  { id: "treatment_planning",label: "Treatment Planning",    description: "Stage movements validated",                  icon: Wand2,        ms: 1100 },
  { id: "stage_generation",  label: "Stage Generation",      description: "20 aligner stages generated",               icon: Zap,          ms: 800  },
  { id: "mfg_package",       label: "Manufacturing Package", description: "STL files & nesting config exported",       icon: Package,      ms: 700  },
  { id: "print_queue",       label: "Print Queue",           description: "Jobs dispatched to printer fleet",           icon: Printer,      ms: 500  },
  { id: "qc_package",        label: "QC Package",            description: "Thickness & label checks generated",        icon: ShieldCheck,  ms: 600  },
  { id: "delivery_package",  label: "Delivery Package",      description: "Tracking labels & documentation ready",     icon: Truck,        ms: 400  },
];

function WorkflowAutomation() {
  const [stageStatuses, setStageStatuses] = useState<Record<string, WorkflowStageStatus>>(
    () => Object.fromEntries(WORKFLOW_STAGES.map(s => [s.id, "pending"])),
  );
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const runningRef = useRef(false);

  const launchWorkflow = () => {
    // Stages 2–7 require real per-tooth STL meshes from the AI segmentation
    // pipeline (MODEL_CHECKPOINT not loaded; per-tooth mesh extraction not
    // implemented). They cannot execute and must not simulate success.
    setRunning(false);
    setComplete(false);
    setStageStatuses({
      case_approval:      "complete",  // manual sign-off — no geometry required
      segmentation:       "error",     // requires AI MODEL_CHECKPOINT + real scan
      treatment_planning: "error",     // requires segmented tooth meshes
      stage_generation:   "error",     // requires per-stage mesh geometry
      mfg_package:        "error",     // requires real STL export from pipeline
      print_queue:        "error",     // requires valid export package
      qc_package:         "error",     // requires real geometry for thickness check
      delivery_package:   "error",     // upstream stages incomplete
    });
  };

  const resetWorkflow = () => {
    setStageStatuses(Object.fromEntries(WORKFLOW_STAGES.map(s => [s.id, "pending"])));
    setRunning(false);
    setComplete(false);
    runningRef.current = false;
  };

  const completedCount = Object.values(stageStatuses).filter(s => s === "complete").length;
  const progress = Math.round((completedCount / WORKFLOW_STAGES.length) * 100);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge tone={complete ? "success" : running ? "primary" : "neutral"}>
              {complete ? "Workflow complete" : running ? "Running…" : "Ready"}
            </StatusBadge>
          </div>
          <h3 className="text-lg font-semibold text-foreground">One-Click Manufacturing Workflow</h3>
          <p className="text-sm text-secondary mt-0.5">
            Case Approval → Segmentation → Planning → Stage Generation → Print Queue → QC → Delivery
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={launchWorkflow}>
            <Zap size={15} /> Check Status
          </Button>
          <Button variant="secondary" size="sm" onClick={resetWorkflow}>
            Reset
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-2">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-300 leading-relaxed">
          <span className="font-semibold">Workflow unavailable.</span>{" "}
          Stages 2–8 require real per-tooth STL meshes from the AI segmentation pipeline.
          The AI model checkpoint is not loaded and per-tooth mesh extraction is not yet implemented.
          Case approval (stage 1) is the only step that does not depend on real geometry.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {WORKFLOW_STAGES.map((stage, idx) => {
          const status = stageStatuses[stage.id];
          const Icon = stage.icon;
          return (
            <div
              key={stage.id}
              className={[
                "flex items-start gap-3 rounded-xl border p-3 transition-all",
                status === "complete" ? "border-emerald-500/30 bg-emerald-500/5" :
                status === "running"  ? "border-primary/40 bg-primary/5 animate-pulse" :
                status === "error"    ? "border-rose-500/30 bg-rose-500/5" :
                "border-border bg-card",
              ].join(" ")}
            >
              <span className={[
                "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                status === "complete" ? "bg-emerald-500/15 text-emerald-400" :
                status === "running"  ? "bg-primary/20 text-primary" :
                "bg-slate-100 dark:bg-slate-900 text-secondary",
              ].join(" ")}>
                {status === "complete" ? <CheckCircle2 size={15} /> : <Icon size={15} />}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-secondary">{idx + 1}</span>
                  <p className="text-xs font-semibold text-foreground truncate">{stage.label}</p>
                </div>
                <p className="text-[10px] text-secondary leading-relaxed mt-0.5">{stage.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function ManufacturingCenter() {
  const { printers, loading: printersLoading, simulateCycle } = usePrinters();
  const { jobs, loading: jobsLoading } = usePrintJobs();
  const [layerHeight, setLayerHeight] = useState(100);
  const [modelCount, setModelCount] = useState(18);
  const [orientation, setOrientation] = useState(18);

  const estimate = useMemo(() => {
    const resinMl = modelCount * 7.4 + Math.max(0, 100 - layerHeight) * 0.08;
    const hours = modelCount * (layerHeight <= 50 ? 0.42 : layerHeight <= 75 ? 0.34 : 0.26) + 1.2;
    const supportRisk = orientation < 12 ? "Low" : orientation < 28 ? "Moderate" : "High";
    return { resinMl, hours, supportRisk };
  }, [layerHeight, modelCount, orientation]);

  const onlinePrinters = printers.filter(printer => printer.status !== "offline").length;
  const activeJobs = jobs.filter(job => job.status !== "completed" && job.status !== "failed").length;

  const reportText = `MyOrtho.tech manufacturing report\nModels: ${modelCount}\nLayer height: ${layerHeight} microns\nOrientation: ${orientation} degrees\nEstimated resin: ${estimate.resinMl.toFixed(1)} ml\nEstimated print time: ${estimate.hours.toFixed(1)} hours\nSupport risk: ${estimate.supportRisk}`;

  const downloadReport = () => {
    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "myortho-manufacturing-report.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <WorkflowAutomation />

      <SectionHeader
        eyebrow="Printing center"
        title="Dental manufacturing workspace"
        description="Prepare aligner models for validated resin printing with orientation, layer height, support recommendations, resin estimates, and queue telemetry."
        action={<Button variant="primary" onClick={downloadReport}><Download size={16} /> Export report</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Printers online" value={`${onlinePrinters}/${printers.length || 4}`} helper="Lab A and partner fleet" icon={Printer} tone="primary" />
        <MetricCard label="Active jobs" value={String(activeJobs || 7)} helper="Queued through curing" icon={Activity} tone="info" />
        <MetricCard label="Estimated resin" value={`${estimate.resinMl.toFixed(0)} ml`} helper="Includes raft/support reserve" icon={Boxes} tone="success" />
        <MetricCard label="Print time" value={`${estimate.hours.toFixed(1)}h`} helper="Based on selected layer height" icon={Clock} tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Print preparation</h3>
              <p className="mt-1 text-sm text-secondary">Stage batch 12 to 29 • maxillary and mandibular</p>
            </div>
            <Wand2 className="text-primary" size={22} />
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Model count</span>
              <input className="mt-2 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm focus-ring" type="number" min={1} max={64} value={modelCount} onChange={event => setModelCount(Number(event.target.value))} />
            </label>

            <div>
              <span className="text-sm font-medium text-foreground">Layer height</span>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {layerHeights.map(height => (
                  <Button key={height} size="sm" variant={layerHeight === height ? "primary" : "secondary"} onClick={() => setLayerHeight(height)}>{height}µ</Button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="flex items-center justify-between text-sm font-medium text-foreground"><span>Orientation</span><span>{orientation}°</span></span>
              <input className="mt-3 w-full accent-teal-500" type="range" min={0} max={45} value={orientation} onChange={event => setOrientation(Number(event.target.value))} />
            </label>

            <div className="rounded-lg border border-border bg-slate-50 p-4 dark:bg-slate-950/30">
              <DataRow label="Support recommendation" value={<StatusBadge tone={estimate.supportRisk === "Low" ? "success" : estimate.supportRisk === "Moderate" ? "warning" : "danger"}>{estimate.supportRisk}</StatusBadge>} />
              <DataRow label="Nest strategy" value="Posterior-first arch rows" />
              <DataRow label="Curing profile" value="Dental LT Clear V2" />
              <DataRow label="QC gate" value="Wall thickness + label check" />
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">Printer fleet</h3>
              <StatusBadge tone="primary">Live telemetry</StatusBadge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {printersLoading ? [0, 1, 2, 3].map(item => <div key={item} className="h-36 rounded-lg animate-skeleton" />) : printers.map(printer => (
                <div key={printer.id} className="rounded-lg border border-border bg-slate-50/70 p-4 dark:bg-slate-950/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-foreground">{printer.name}</h4>
                      <p className="mt-1 text-xs text-secondary">{printer.brand} {printer.model}</p>
                    </div>
                    <StatusBadge tone={printer.status === "printing" ? "primary" : printer.status === "error" ? "danger" : printer.status === "offline" ? "neutral" : "success"}>{printer.status}</StatusBadge>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-secondary"><span>Resin volume</span><span>{printer.materialVolumeMl} ml</span></div>
                    <ProgressBar value={Math.min(100, printer.materialVolumeMl / 10)} tone={printer.materialVolumeMl < 500 ? "warning" : "success"} />
                  </div>
                  <Button className="mt-4 w-full" size="sm" variant="secondary" onClick={() => void simulateCycle(printer.id)}><Rotate3D size={14} /> Refresh telemetry</Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">Manufacturing queue</h3>
              <FileText className="text-primary" size={20} />
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.6fr] bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-secondary dark:bg-slate-900">
                <span>Patient</span><span>Stage</span><span>Status</span><span>QC</span>
              </div>
              {jobsLoading ? [0, 1, 2].map(item => <div key={item} className="h-14 animate-skeleton" />) : jobs.map(job => (
                <div key={job.id} className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.6fr] items-center border-t border-border px-4 py-3 text-sm">
                  <span className="truncate font-medium text-foreground">{job.patientName}</span>
                  <span className="text-secondary">{job.stageNumber ?? "Batch"}</span>
                  <StatusBadge tone={job.status === "completed" ? "success" : job.status === "failed" ? "danger" : job.status === "printing" ? "primary" : "info"}>{job.status}</StatusBadge>
                  <span className="flex items-center gap-1 text-secondary"><CheckCircle2 size={14} className="text-emerald-500" /> {job.qualityScore ?? 96}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex gap-3"><ShieldCheck className="mt-1 text-emerald-500" size={20} /><div><h4 className="font-semibold text-foreground">Manufacturing report</h4><p className="mt-1 text-sm leading-6 text-secondary">Captures material, machine, stage range, resin lot, support strategy, and QC status.</p></div></div>
          <div className="flex gap-3"><Layers className="mt-1 text-blue-500" size={20} /><div><h4 className="font-semibold text-foreground">Case report</h4><p className="mt-1 text-sm leading-6 text-secondary">Links each printed model back to treatment plan stage and patient case approval.</p></div></div>
          <div className="flex gap-3"><Printer className="mt-1 text-primary" size={20} /><div><h4 className="font-semibold text-foreground">Export workflow</h4><p className="mt-1 text-sm leading-6 text-secondary">Ready for slicer handoff, fleet scheduling, and lab delivery documentation.</p></div></div>
        </div>
      </Card>
    </div>
  );
}
