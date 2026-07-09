"use client";

import { Brain, CheckCircle2, Clock, Circle, AlertTriangle } from "lucide-react";
import { ClinicalWarningBanner } from "@/components/ui/ClinicalWarningBanner";

// ─── Types ────────────────────────────────────────────────────────────────────

type MaturityLevel = "production" | "beta" | "research" | "planned";

interface Capability {
  name: string;
  description: string;
  level: MaturityLevel;
  detail: string;
}

interface Domain {
  name: string;
  capabilities: Capability[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const DOMAINS: Domain[] = [
  {
    name: "Segmentation",
    capabilities: [
      { name: "Tooth isolation", description: "Per-tooth mesh segmentation from intraoral scans", level: "production", detail: "Fully automated, <30 s on Apple Silicon" },
      { name: "Arch detection", description: "Maxillary/mandibular arch boundary extraction", level: "production", detail: "98.4% accuracy on internal validation set" },
      { name: "Root estimation", description: "Root morphology inference from crown geometry", level: "beta", detail: "Requires CBCT co-registration" },
      { name: "Soft-tissue landmarks", description: "Lip, nose, and chin landmark detection from photos", level: "research", detail: "2D photo input, not yet in production pipeline" },
    ],
  },
  {
    name: "Treatment Planning",
    capabilities: [
      { name: "IPR recommendations", description: "Interproximal reduction site and depth suggestions", level: "production", detail: "Bolton analysis + space calculation" },
      { name: "Staging automation", description: "Aligner stage sequencing from target occlusion", level: "beta", detail: "Manual override always available" },
      { name: "Force simulation", description: "Per-tooth biomechanical force estimation", level: "beta", detail: "FEA approximation, not validated against clinical outcomes" },
      { name: "Outcome prediction", description: "Post-treatment position prediction from initial scan", level: "research", detail: "Pilot study ongoing" },
    ],
  },
  {
    name: "Clinical Decision Support",
    capabilities: [
      { name: "Malocclusion classification", description: "Angle Class I/II/III + subtype from scan", level: "production", detail: "Mirrors clinician agreement at 94%" },
      { name: "Compliance risk scoring", description: "Patient compliance likelihood from historical patterns", level: "planned", detail: "Requires longitudinal outcome data" },
      { name: "Relapse prediction", description: "Post-retention stability risk assessment", level: "planned", detail: "Awaiting multi-site dataset" },
    ],
  },
  {
    name: "Data Handling",
    capabilities: [
      { name: "PHI isolation", description: "All AI inference runs on de-identified geometry only", level: "production", detail: "Names and DOB never enter the inference pipeline" },
      { name: "On-device inference", description: "Segmentation model runs locally, no cloud upload", level: "production", detail: "CoreML on Apple Silicon; ONNX on Windows" },
      { name: "Audit trail", description: "Every AI recommendation is logged with model version", level: "production", detail: "Immutable append-only log" },
    ],
  },
];

// ─── Maturity badge ────────────────────────────────────────────────────────────

const LEVEL_META: Record<MaturityLevel, { label: string; cls: string; icon: React.ReactNode }> = {
  production: {
    label: "Production",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    icon: <CheckCircle2 size={11} />,
  },
  beta: {
    label: "Beta",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    icon: <Clock size={11} />,
  },
  research: {
    label: "Research",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    icon: <AlertTriangle size={11} />,
  },
  planned: {
    label: "Planned",
    cls: "bg-[color:var(--border)] text-[color:var(--muted-foreground)]",
    icon: <Circle size={11} />,
  },
};

function MaturityBadge({ level }: { level: MaturityLevel }) {
  const { label, cls, icon } = LEVEL_META[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIReadinessPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Brain size={20} className="text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-bold text-[color:var(--foreground)]">AI Readiness</h1>
      </div>
      <p className="mb-2 text-sm text-[color:var(--muted-foreground)] max-w-prose">
        Capability maturity matrix for AI-assisted features in MyOrtho 2.0. Each entry reflects
        the current deployment status and data-handling approach.
      </p>

      <ClinicalWarningBanner
        message="AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist."
        className="mb-4"
      />

      {/* Legend */}
      <div className="mb-8 flex flex-wrap gap-3">
        {(["production", "beta", "research", "planned"] as MaturityLevel[]).map(l => (
          <MaturityBadge key={l} level={l} />
        ))}
      </div>

      {/* Domains */}
      <div className="space-y-6">
        {DOMAINS.map(domain => (
          <div key={domain.name} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
            <div className="border-b border-[color:var(--border)] bg-[color:var(--background)] px-5 py-3">
              <h2 className="text-sm font-bold text-[color:var(--foreground)]">{domain.name}</h2>
            </div>
            <ul className="divide-y divide-[color:var(--border)]">
              {domain.capabilities.map(cap => (
                <li key={cap.name} className="grid grid-cols-[1fr_auto] items-start gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{cap.name}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{cap.description}</p>
                    <p className="mt-1.5 text-xs text-[color:var(--muted-foreground)] italic">{cap.detail}</p>
                  </div>
                  <MaturityBadge level={cap.level} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-[color:var(--muted-foreground)]">
        Last updated July 2026 · MyOrtho Technologies, Inc. · AI features are decision-support tools and
        do not replace clinical judgment.
      </p>
    </div>
  );
}
