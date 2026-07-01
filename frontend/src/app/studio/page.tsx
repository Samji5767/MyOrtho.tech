"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  Layers3,
  Loader2,
  ScanLine,
  Sparkles,
  UploadCloud,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";
import CADCapabilityMatrix from "@/components/CADCapabilityMatrix";
import { fetchCase, type CaseDetail } from "@/lib/api/cases";
import OrthoWorkflowRail from "@/components/OrthoWorkflowRail";
import OrthoAnalysisTabs from "@/components/OrthoAnalysisTabs";

// ─── Heavy 3D components — SSR off, load only when tab is active ──────────────

const Viewer3D = dynamic(() => import("@/components/Viewer3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-xl animate-skeleton">
      <span className="text-sm text-[color:var(--muted-foreground)]">Initialising 3D renderer…</span>
    </div>
  ),
});

const CADEngine = dynamic(() => import("@/components/CADEngine"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-xl animate-skeleton">
      <span className="text-sm text-[color:var(--muted-foreground)]">Loading CAD engine…</span>
    </div>
  ),
});

// ─── Workbench tab types ──────────────────────────────────────────────────────

type StudioTab = "import" | "viewer" | "cad" | "plan" | "preview";

const TABS: { key: StudioTab; label: string; icon: LucideIcon }[] = [
  { key: "import",  label: "Scan & Import",  icon: ScanLine       },
  { key: "viewer",  label: "3D Viewer",      icon: Layers3        },
  { key: "cad",     label: "CAD Studio",     icon: Box            },
  { key: "plan",    label: "Plan & Analyse", icon: ClipboardList  },
  { key: "preview", label: "Preview",        icon: Wand2          },
];

// ─── No-case-loaded banner ────────────────────────────────────────────────────

function NoCaseBanner() {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
        <FolderKanban size={22} />
      </span>
      <div>
        <p className="text-sm font-semibold text-[color:var(--foreground)]">No case loaded</p>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          Create or select a case to load scans, run AI segmentation, and start planning.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href="/cases/new"
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
        >
          New Case
        </Link>
        <Link
          href="/cases"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[color:var(--border)] px-4 text-sm font-semibold text-[color:var(--foreground)] transition-transform active:scale-95"
        >
          Select Case
          <ArrowRight size={14} />
        </Link>
      </div>
    </Card>
  );
}

// ─── Case context banner ──────────────────────────────────────────────────────

function CaseBanner({ caseData }: { caseData: CaseDetail }) {
  const patientName = `${caseData.patient.firstName} ${caseData.patient.lastName}`;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-sm font-bold text-[color:var(--primary)]">
        {caseData.patient.firstName[0]}{caseData.patient.lastName[0]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{patientName}</p>
        <p className="truncate text-xs text-[color:var(--muted-foreground)]">
          {caseData.chiefComplaint ?? "No chief complaint"} · {caseData.status}
        </p>
      </div>
      <Link href={`/cases/${caseData.id}`}>
        <StatusBadge tone="primary">View Case</StatusBadge>
      </Link>
    </div>
  );
}

// ─── AI disclaimer ────────────────────────────────────────────────────────────

function AIDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span>
        <strong>Clinical decision support only.</strong> All AI outputs are automated suggestions and require clinician review and approval before export or manufacturing.
      </span>
    </div>
  );
}

// ─── Import tab ───────────────────────────────────────────────────────────────

function ImportTab({ caseData }: { caseData: CaseDetail | null }) {
  const PIPELINE_STEPS = [
    { n: 1,  label: "Upload STL / OBJ / PLY",       done: false },
    { n: 2,  label: "File validation",               done: false },
    { n: 3,  label: "Mesh repair",                   done: false },
    { n: 4,  label: "Orientation correction",        done: false },
    { n: 5,  label: "Tooth detection",               done: false },
    { n: 6,  label: "AI segmentation",               done: false },
    { n: 7,  label: "FDI labelling",                 done: false },
    { n: 8,  label: "Root apex estimation",          done: false },
    { n: 9,  label: "Per-tooth mesh extraction",     done: false },
    { n: 10, label: "Occlusal registration",         done: false },
    { n: 11, label: "Quality confidence score",      done: false },
  ];

  return (
    <div className="space-y-4">
      {!caseData ? (
        <NoCaseBanner />
      ) : (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <UploadCloud size={17} className="text-[color:var(--primary)]" />
            <h2 className="text-base font-semibold text-[color:var(--foreground)]">Upload a scan</h2>
          </div>
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-[color:var(--border)] p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
              <UploadCloud size={24} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">Drop STL, OBJ, or PLY</p>
              <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                Max 50 MB · Full arch or individual teeth
              </p>
            </div>
            <Link
              href="/ai-analysis"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-5 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] transition-transform active:scale-95"
            >
              <ScanLine size={15} />
              Open full scan workspace
            </Link>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={17} className="text-[color:var(--primary)]" />
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">AI pipeline</h2>
          <span className="ml-auto">
            <StatusBadge tone="info">11-stage</StatusBadge>
          </span>
        </div>
        <div className="space-y-2">
          {PIPELINE_STEPS.map((step) => (
            <div
              key={step.n}
              className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--border)_70%,transparent)] text-[10px] font-bold text-[color:var(--muted-foreground)]">
                {step.done ? <CheckCircle2 size={13} className="text-emerald-500" /> : step.n}
              </span>
              <span className="text-xs text-[color:var(--foreground)]">{step.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Viewer tab ───────────────────────────────────────────────────────────────

function ViewerTab({ caseData }: { caseData: CaseDetail | null }) {
  if (!caseData) return <NoCaseBanner />;
  return (
    <div className="space-y-4">
      <AIDisclaimer />
      <Viewer3D />
    </div>
  );
}

// ─── CAD tab ──────────────────────────────────────────────────────────────────

function CadTab({ caseData }: { caseData: CaseDetail | null }) {
  if (!caseData) return <NoCaseBanner />;

  function saveSnapshot() {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas) return;
    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      const patientName = `${caseData!.patient.firstName}-${caseData!.patient.lastName}`.replace(/\s+/g, "-");
      a.download = `myortho-snapshot-${patientName}.png`;
      a.href = url;
      a.click();
    } catch {}
  }

  return (
    <div className="space-y-4">
      <AIDisclaimer />
      {/* Back to case + snapshot row */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/cases/${caseData.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[color:var(--border)] px-3 text-xs font-semibold text-[color:var(--foreground)] transition-colors hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
        >
          ← Back to Case
        </Link>
        <button
          type="button"
          onClick={saveSnapshot}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[color:var(--border)] px-3 text-xs font-semibold text-[color:var(--foreground)] transition-colors hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
        >
          <CheckCircle2 size={12} /> Save Snapshot
        </button>
      </div>
      <CADCapabilityMatrix />
      <CADEngine />
    </div>
  );
}

// ─── Plan tab ─────────────────────────────────────────────────────────────────

function PlanTab({ caseData }: { caseData: CaseDetail | null }) {
  const caseId      = caseData?.id      ?? null;
  const patientName = caseData
    ? `${caseData.patient.firstName} ${caseData.patient.lastName}`
    : "";

  return (
    <div className="space-y-4">
      <AIDisclaimer />
      {!caseData && (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
          No case loaded — planning tools show demo data. Select a case to persist progress.
        </div>
      )}
      {/* Pronto-style workflow rail */}
      <OrthoWorkflowRail caseId={caseId} />
      {/* Analysis / planning tabs */}
      <OrthoAnalysisTabs caseId={caseId} patientName={patientName} />
    </div>
  );
}

// ─── Preview tab ──────────────────────────────────────────────────────────────

function PreviewTab({ caseData }: { caseData: CaseDetail | null }) {
  if (!caseData) return <NoCaseBanner />;

  const FEATURES = [
    { icon: Layers3,  label: "Stage-by-stage aligner preview",  href: `/cases/${caseData.id}` },
    { icon: Wand2,    label: "Treatment movement timeline",      href: "/treatment-plan"       },
    { icon: Box,      label: "Full CAD workspace",               href: "/studio"               },
    { icon: Sparkles, label: "AI biomechanics validation",       href: "/studio"               },
  ];

  return (
    <div className="space-y-4">
      <AIDisclaimer />
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Wand2 size={17} className="text-[color:var(--primary)]" />
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">Treatment preview</h2>
        </div>
        <div className="space-y-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Link
                key={f.label}
                href={f.href}
                className="ios-chip flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-[color:var(--foreground)]">
                  {f.label}
                </span>
                <ArrowRight size={15} className="shrink-0 text-[color:var(--muted-foreground)]" />
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Studio page ──────────────────────────────────────────────────────────────

export default function StudioPage() {
  const searchParams = useSearchParams();
  const caseId = searchParams?.get("caseId") ?? null;

  const [activeTab, setActiveTab] = useState<StudioTab>("import");
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);

  useEffect(() => {
    if (!caseId) { setCaseData(null); return; }
    setCaseLoading(true);
    fetchCase(caseId)
      .then(({ data }) => { setCaseData(data); setCaseLoading(false); })
      .catch(() => setCaseLoading(false));
  }, [caseId]);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
          Clinical Workbench
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
          CAD Design Studio
        </h1>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          STL import · AI segmentation · 3D viewer · CAD engine
        </p>
      </div>

      {/* Case context */}
      {caseLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
          <Loader2 size={16} className="animate-spin text-[color:var(--muted-foreground)]" />
          <span className="text-sm text-[color:var(--muted-foreground)]">Loading case…</span>
        </div>
      ) : caseData ? (
        <CaseBanner caseData={caseData} />
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-3">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            No case loaded — select a case to load scans and segmentation data.
          </p>
          <Link href="/cases" className="ml-3 shrink-0 text-xs font-semibold text-[color:var(--primary)] hover:underline">
            Select Case →
          </Link>
        </div>
      )}

      {/* Workbench tab bar */}
      <div className="no-scrollbar flex items-stretch gap-1 overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-1 shadow-[var(--shadow-sm)]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={[
              "flex flex-1 shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-95",
              activeTab === key
                ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)]"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">
              {key === "import" ? "Scan" : key === "viewer" ? "View" : key === "cad" ? "CAD" : key === "plan" ? "Plan" : "Preview"}
            </span>
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div className="animate-page-enter">
        {activeTab === "import"  && <ImportTab  caseData={caseData} />}
        {activeTab === "viewer"  && <ViewerTab  caseData={caseData} />}
        {activeTab === "cad"     && <CadTab     caseData={caseData} />}
        {activeTab === "plan"    && <PlanTab    caseData={caseData} />}
        {activeTab === "preview" && <PreviewTab caseData={caseData} />}
      </div>
    </section>
  );
}
