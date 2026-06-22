"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Factory,
  Printer,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/DesignSystem";

const WORKFLOW_STEPS = [
  { n: 1, label: "Treatment plan approved", detail: "Doctor signs off on all stage movements and attachments." },
  { n: 2, label: "STL models generated", detail: "Per-stage aligner models are exported from the CAD engine." },
  { n: 3, label: "Print queue created", detail: "Batch jobs are created for each stage and assigned to printers." },
  { n: 4, label: "QC completed", detail: "Printed models pass quality inspection before packaging." },
  { n: 5, label: "Shipment prepared", detail: "Aligners are packaged and dispatched to the clinic or patient." },
];

export default function ManufacturingPage() {
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

      {/* Stats grid — zeros until backend connected */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "In queue", value: "0", tone: "primary" as const },
          { label: "Printing now", value: "0", tone: "info" as const },
          { label: "Awaiting ship", value: "0", tone: "warning" as const },
          { label: "SLA at risk", value: "0", tone: "danger" as const },
        ].map((s) => (
          <Card key={s.label} className="flex flex-col items-center gap-2 p-3">
            <span className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">{s.value}</span>
            <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
          <Factory size={28} />
        </span>
        <div>
          <p className="text-base font-semibold text-[color:var(--foreground)]">No manufacturing jobs</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Approved treatment plans will create printable model and aligner production jobs.
          </p>
        </div>
        <Link
          href="/treatment-plan"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-5 text-sm font-semibold text-[color:var(--foreground)] transition-transform active:scale-95"
        >
          <ArrowRight size={15} className="text-[color:var(--primary)]" />
          View treatment plans
        </Link>
      </Card>

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
            MyOrtho provides software tooling only.
          </p>
        </div>
      </Card>

      <Link
        href="/desktop"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] transition-transform active:scale-95"
      >
        Open full manufacturing workspace
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}
