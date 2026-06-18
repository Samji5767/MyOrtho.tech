"use client";

import React, { useMemo, useState } from "react";
import { Activity, Boxes, CheckCircle2, Clock, Download, FileText, Layers, Printer, Rotate3D, ShieldCheck, Wand2 } from "lucide-react";
import { usePrintJobs, usePrinters } from "@/hooks/useApi";
import { Button, Card, DataRow, MetricCard, ProgressBar, SectionHeader, StatusBadge } from "@/components/DesignSystem";

const layerHeights = [50, 75, 100, 150];

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
