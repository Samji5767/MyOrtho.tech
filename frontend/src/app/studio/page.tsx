"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  Layers3,
  ScanLine,
  Sparkles,
  UploadCloud,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";

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

type StudioTab = 'import' | 'viewer' | 'cad' | 'preview';

const TABS: { key: StudioTab; label: string; icon: LucideIcon }[] = [
  { key: 'import',  label: 'Scan & Import', icon: ScanLine },
  { key: 'viewer',  label: '3D Viewer',     icon: Layers3 },
  { key: 'cad',     label: 'CAD Studio',    icon: Box },
  { key: 'preview', label: 'Preview',       icon: Wand2 },
];

// ─── Import tab ───────────────────────────────────────────────────────────────

function ImportTab() {
  const PIPELINE_STEPS = [
    { n: 1,  label: 'Upload STL / OBJ',           done: false },
    { n: 2,  label: 'File validation',             done: false },
    { n: 3,  label: 'Mesh repair',                 done: false },
    { n: 4,  label: 'Orientation correction',      done: false },
    { n: 5,  label: 'Tooth detection',             done: false },
    { n: 6,  label: 'AI segmentation',             done: false },
    { n: 7,  label: 'FDI labelling',               done: false },
    { n: 8,  label: 'Root apex estimation',        done: false },
    { n: 9,  label: 'Per-tooth mesh extraction',   done: false },
    { n: 10, label: 'Occlusal registration',       done: false },
    { n: 11, label: 'Quality confidence score',    done: false },
  ];

  return (
    <div className="space-y-4">
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
            <p className="text-sm font-semibold text-[color:var(--foreground)]">Drop STL, OBJ, or CBCT</p>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">Max 50 MB · Full arch or individual teeth</p>
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
            <div key={step.n} className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
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

function ViewerTab() {
  return (
    <div className="space-y-4">
      {/* Performance note: single backdrop-filter (tab bar) is below this canvas, not stacked on it */}
      <Viewer3D />
    </div>
  );
}

// ─── CAD tab ──────────────────────────────────────────────────────────────────

function CadTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
        <div className="flex items-center gap-2">
          <StatusBadge tone="info">Offline lighting</StatusBadge>
          <StatusBadge tone="neutral">No CDN fetch</StatusBadge>
        </div>
      </div>
      <CADEngine />
    </div>
  );
}

// ─── Preview tab ──────────────────────────────────────────────────────────────

function PreviewTab() {
  const FEATURES = [
    { icon: Layers3,  label: 'Stage-by-stage aligner preview',       href: '/desktop' },
    { icon: Wand2,    label: 'Treatment movement timeline',           href: '/treatment-plan' },
    { icon: Box,      label: 'CAD workspace (full)',                  href: '/desktop' },
    { icon: Sparkles, label: 'AI biomechanics validation',            href: '/desktop' },
  ];

  return (
    <div className="space-y-4">
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
                <span className="min-w-0 flex-1 text-sm font-semibold text-[color:var(--foreground)]">{f.label}</span>
                <ArrowRight size={15} className="shrink-0 text-[color:var(--muted-foreground)]" />
              </Link>
            );
          })}
        </div>
      </Card>

      <Link
        href="/desktop"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] transition-transform active:scale-95"
      >
        Open full CAD workspace
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

// ─── Studio page ──────────────────────────────────────────────────────────────

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('import');

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
          Clinical Workbench
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
          Studio
        </h1>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          STL import · AI segmentation · 3D viewer · CAD engine
        </p>
      </div>

      {/* Workbench tab bar */}
      <div className="no-scrollbar flex items-stretch gap-1 overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-1 shadow-[var(--shadow-sm)]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex flex-1 shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
              activeTab === key
                ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)]'
                : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
            }`}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{key === 'import' ? 'Scan' : key === 'viewer' ? 'View' : key === 'cad' ? 'CAD' : 'Preview'}</span>
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div className="animate-page-enter">
        {activeTab === 'import'  && <ImportTab />}
        {activeTab === 'viewer'  && <ViewerTab />}
        {activeTab === 'cad'     && <CadTab />}
        {activeTab === 'preview' && <PreviewTab />}
      </div>
    </section>
  );
}
