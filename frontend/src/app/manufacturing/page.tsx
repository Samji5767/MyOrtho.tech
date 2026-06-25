"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Factory,
  Loader2,
  Printer,
  RefreshCw,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";
import {
  listManufacturingJobs,
  listPrinters,
  retryJob,
  cancelJob,
  type ApiPrintJob,
  type ApiPrinter,
} from "@/lib/api/manufacturing";

const WORKFLOW_STEPS = [
  { n: 1, label: "Treatment plan approved", detail: "Doctor signs off on all stage movements and attachments." },
  { n: 2, label: "STL models generated", detail: "Per-stage aligner models are exported from the CAD engine." },
  { n: 3, label: "Print queue created", detail: "Batch jobs are created for each stage and assigned to printers." },
  { n: 4, label: "QC completed", detail: "Printed models pass quality inspection before packaging." },
  { n: 5, label: "Shipment prepared", detail: "Aligners are packaged and dispatched to the clinic or patient." },
];

function jobStatusTone(status: string): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "qc_pending") return "warning";
  if (["printing", "nesting", "cleaning", "curing"].includes(status)) return "info";
  return "neutral";
}

function connectorTone(status: string): "neutral" | "warning" | "success" | "danger" | "info" {
  if (status === "online" || status === "configured") return "success";
  if (status === "error") return "danger";
  if (status === "offline") return "warning";
  return "neutral";
}

export default function ManufacturingPage() {
  const [jobs, setJobs] = useState<ApiPrintJob[]>([]);
  const [printers, setPrinters] = useState<ApiPrinter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([listManufacturingJobs(), listPrinters()])
      .then(([jobsArr, printersArr]) => {
        setJobs(Array.isArray(jobsArr) ? jobsArr : []);
        setPrinters(Array.isArray(printersArr) ? printersArr : []);
      })
      .catch(() => setLoadError("Backend unavailable — manufacturing data not loaded"))
      .finally(() => setLoading(false));
  }, []);

  const inQueue   = jobs.filter(j => j.status === "queued" || j.status === "nesting").length;
  const printing  = jobs.filter(j => j.status === "printing").length;
  const qcPending = jobs.filter(j => j.status === "qc_pending").length;

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Lab Operations
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Manufacturing
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Print queue, QC workflow, and shipment tracking
          </p>
        </div>
        <Printer size={20} className="text-[color:var(--primary)]" />
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={12} className="shrink-0" /> {loadError}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "In queue",      value: loading ? "…" : String(inQueue),   tone: "primary"  as const },
          { label: "Printing now",  value: loading ? "…" : String(printing),  tone: "info"     as const },
          { label: "Awaiting QC",   value: loading ? "…" : String(qcPending), tone: "warning"  as const },
          { label: "SLA at risk",   value: "0",                                tone: "danger"   as const },
        ].map((s) => (
          <Card key={s.label} className="flex flex-col items-center gap-2 p-3">
            <span className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">{s.value}</span>
            <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
          </Card>
        ))}
      </div>

      {/* Jobs list */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-4 py-3">
          <Factory size={15} className="text-[color:var(--primary)]" />
          <h2 className="text-sm font-semibold text-[color:var(--foreground)]">
            Print Jobs
            {!loading && <span className="ml-1.5 font-normal text-[color:var(--muted-foreground)]">({jobs.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-[color:var(--muted-foreground)]" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Factory size={24} className="text-[color:var(--muted-foreground)]" />
            <p className="text-sm text-[color:var(--muted-foreground)]">
              No manufacturing jobs yet. Approved treatment plans will create print jobs.
            </p>
            <Link
              href="/treatment-plan"
              className="text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2"
            >
              View treatment plans →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                      {job.id.slice(0, 8)}…
                    </span>
                    <StatusBadge tone={jobStatusTone(job.status)}>
                      {job.status.replace(/_/g, " ")}
                    </StatusBadge>
                    {job.retryCount != null && job.retryCount > 0 && (
                      <span className="text-[10px] text-[color:var(--muted-foreground)]">
                        retry #{job.retryCount}
                      </span>
                    )}
                  </div>
                  {job.printer && (
                    <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                      Printer: {job.printer.name} ({job.printer.brand})
                    </p>
                  )}
                  {job.failureReason && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <XCircle size={10} className="shrink-0" /> {job.failureReason}
                    </p>
                  )}
                  {actionErrors[job.id] && (
                    <p className="mt-1 text-xs text-red-500">{actionErrors[job.id]}</p>
                  )}
                  <div className="mt-1.5 flex gap-2">
                    {job.status === "failed" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          try {
                            const updated = await retryJob(job.id);
                            setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, ...updated } : j));
                            setActionErrors((p) => { const n = { ...p }; delete n[job.id]; return n; });
                          } catch (e) {
                            setActionErrors((p) => ({ ...p, [job.id]: e instanceof Error ? e.message : "Retry failed" }));
                          }
                        }}
                      >
                        <RefreshCw size={11} /> Retry
                      </Button>
                    )}
                    {!["completed", "failed"].includes(job.status) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          try {
                            const updated = await cancelJob(job.id, "Cancelled by operator");
                            setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, ...updated } : j));
                            setActionErrors((p) => { const n = { ...p }; delete n[job.id]; return n; });
                          } catch (e) {
                            setActionErrors((p) => ({ ...p, [job.id]: e instanceof Error ? e.message : "Cancel failed" }));
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
                  {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Printers */}
      {!loading && printers.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-4 py-3">
            <Printer size={15} className="text-[color:var(--primary)]" />
            <h2 className="text-sm font-semibold text-[color:var(--foreground)]">
              Printer Registry
              <span className="ml-1.5 font-normal text-[color:var(--muted-foreground)]">({printers.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-[color:var(--border)]">
            {printers.map((p) => (
              <div key={p.id} className="flex items-start gap-3 px-4 py-3">
                <Printer size={15} className="mt-0.5 shrink-0 text-[color:var(--muted-foreground)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{p.name}</p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {p.brand} {p.model}
                    {p.materialType ? ` · ${p.materialType}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone="neutral">{p.status}</StatusBadge>
                    {p.connectorStatus === "not_configured" || p.connectorStatus === "connector_required" ? (
                      <span className="flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50/60 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                        <WifiOff size={9} /> {p.connectorStatus === "not_configured" ? "Not configured" : "Connector required"}
                      </span>
                    ) : (
                      <StatusBadge tone={connectorTone(p.connectorStatus)}>
                        {p.connectorStatus}
                      </StatusBadge>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-[color:var(--muted-foreground)]">{p.connectorNote}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Workflow steps */}
      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <Factory size={17} className="text-[color:var(--primary)]" />
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">Manufacturing workflow</h2>
        </div>
        <div className="space-y-2">
          {WORKFLOW_STEPS.map((step) => (
            <div key={step.n} className="ios-chip flex items-start gap-3 px-4 py-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[10px] font-bold text-[color:var(--muted-foreground)]">
                {step.n}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{step.label}</p>
                <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Disclaimer */}
      <Card className="border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-xs leading-5 text-[color:var(--foreground)]">
            Manufacturing approvals and shipment decisions remain the responsibility of the licensed orthodontist and lab operator.
            MyOrtho provides software tooling only. Printer connector status shows{" "}
            <strong>connector required</strong> until vendor credentials are configured.
          </p>
        </div>
      </Card>
    </section>
  );
}
