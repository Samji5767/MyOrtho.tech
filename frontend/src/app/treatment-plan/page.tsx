"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Wand2,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";

const WORKFLOW_STEPS = [
  { n: 1, label: "Upload scan", detail: "Import STL, PLY, or OBJ for the patient's dentition." },
  { n: 2, label: "Run segmentation", detail: "AI pipeline detects and labels each tooth with FDI notation." },
  { n: 3, label: "Review CAD setup", detail: "Validate mesh quality, attachments, and IPR positions." },
  { n: 4, label: "Generate treatment plan", detail: "AI proposes stage movements; clinician adjusts as needed." },
  { n: 5, label: "Doctor approval", detail: "Licensed orthodontist reviews and digitally approves the plan." },
];

export default function TreatmentPlanPage() {
  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Treatment Planning
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Treatment Plan
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Stage generation, movement adjustment, and plan approval
          </p>
        </div>
        <Button variant="primary" size="sm">
          <Wand2 size={15} /> Generate plan
        </Button>
      </div>

      {/* Empty state */}
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
          <Layers3 size={28} />
        </span>
        <div>
          <p className="text-base font-semibold text-[color:var(--foreground)]">No treatment plan yet</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Treatment plans are generated after scan validation, segmentation, and CAD setup.
          </p>
        </div>
        <Link
          href="/studio"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[color:var(--primary)] px-5 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
        >
          <ArrowRight size={15} />
          Start with a scan
        </Link>
      </Card>

      {/* Workflow steps */}
      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList size={17} className="text-[color:var(--primary)]" />
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">Treatment plan workflow</h2>
          <span className="ml-auto">
            <StatusBadge tone="neutral">5 steps</StatusBadge>
          </span>
        </div>

        <div className="space-y-2">
          {WORKFLOW_STEPS.map((step) => (
            <div
              key={step.n}
              className="ios-chip flex items-start gap-3 px-4 py-3"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--card)] text-xs font-bold text-[color:var(--muted-foreground)] border border-[color:var(--border)]">
                {step.n}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{step.label}</p>
                <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{step.detail}</p>
              </div>
              <StatusBadge tone="neutral">Pending</StatusBadge>
            </div>
          ))}
        </div>
      </Card>

      {/* Disclaimer */}
      <Card className="border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-xs leading-5 text-[color:var(--foreground)]">
            AI-generated treatment recommendations, staging plans, and movement predictions are advisory only.
            Final treatment planning and clinical decisions remain the sole responsibility of the licensed orthodontist.
          </p>
        </div>
      </Card>

      <Link
        href="/desktop"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] transition-transform active:scale-95"
      >
        Open full CAD planning workspace
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}
