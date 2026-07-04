"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Apple,
  Monitor,
  Globe,
  Shield,
  CheckCircle2,
  Copy,
  Check,
  ChevronRight,
  Download,
  Cpu,
  HardDrive,
  Wifi,
  Activity,
  Layers,
  Stethoscope,
  Scan,
  ClipboardList,
  BarChart3,
  FileText,
  Users,
  Sparkles,
  Lock,
} from "lucide-react";

// ─── Release data ─────────────────────────────────────────────────────────────

const RELEASE = {
  version: "2.0.0",
  build: "2026.07.04.001",
  date: "July 4, 2026",
  channel: "Stable",
  macos: {
    arm: {
      size: "Coming Soon",
      arch: "Apple Silicon",
      minOs: "macOS 13 Ventura",
      sha256: null as string | null,
      url: null as string | null,
    },
    intel: {
      size: "Coming Soon",
      arch: "Intel x64",
      minOs: "macOS 12 Monterey",
      sha256: null as string | null,
      url: null as string | null,
    },
  },
  windows: {
    exe: {
      size: "Coming Soon",
      arch: "Windows x64",
      minOs: "Windows 10 22H2",
      sha256: null as string | null,
      url: null as string | null,
    },
    msi: {
      size: "Coming Soon",
      arch: "Windows x64 (MSI)",
      minOs: "Windows 10 22H2",
      sha256: null as string | null,
      url: null as string | null,
    },
  },
};

const FEATURES = [
  { icon: <ClipboardList size={16} />, label: "Patient Management" },
  { icon: <Scan size={16} />, label: "3D STL Viewer" },
  { icon: <Sparkles size={16} />, label: "AI Segmentation" },
  { icon: <Activity size={16} />, label: "Treatment Planning" },
  { icon: <Layers size={16} />, label: "Movement Simulation" },
  { icon: <Stethoscope size={16} />, label: "Attachments & IPR" },
  { icon: <BarChart3 size={16} />, label: "Clinical Measurements" },
  { icon: <FileText size={16} />, label: "Clinical Notes" },
  { icon: <Users size={16} />, label: "Case Collaboration" },
  { icon: <Download size={16} />, label: "Export Center" },
  { icon: <Lock size={16} />, label: "HIPAA Compliant" },
  { icon: <Wifi size={16} />, label: "Offline Support" },
];

// ─── ChecksumCopy ─────────────────────────────────────────────────────────────

function ChecksumCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1.5 font-mono text-[10px] text-dl-muted hover:text-dl-text transition-colors group"
    >
      <span className="truncate max-w-[200px]">{value.slice(0, 16)}…</span>
      {copied
        ? <Check size={10} className="text-emerald-500 shrink-0" />
        : <Copy size={10} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      }
    </button>
  );
}

// ─── InstallStep ──────────────────────────────────────────────────────────────

function InstallStep({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dl-accent/10 text-dl-accent text-xs font-bold border border-dl-accent/20">
        {n}
      </span>
      <p className="text-sm text-dl-muted pt-0.5">{text}</p>
    </div>
  );
}

// ─── DownloadCard ─────────────────────────────────────────────────────────────

interface DownloadVariant {
  arch: string;
  size: string;
  minOs: string;
  url: string | null;
  sha256: string | null;
  label: string;
  type: "dmg" | "exe" | "msi";
}

function DownloadCard({
  platform,
  icon,
  variants,
  installSteps,
}: {
  platform: string;
  icon: React.ReactNode;
  variants: DownloadVariant[];
  installSteps: string[];
}) {
  const [activeVariant, setActiveVariant] = useState(0);
  const v = variants[activeVariant];

  return (
    <div className="rounded-2xl border border-dl-border bg-dl-surface overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.25)]">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-dl-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-dl-surface border border-dl-border flex items-center justify-center text-dl-text shadow-sm">
            {icon}
          </div>
          <div>
            <p className="font-semibold text-dl-text">{platform}</p>
            <p className="text-xs text-dl-muted">Version {RELEASE.version} · {RELEASE.channel}</p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold px-2.5 py-0.5 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {RELEASE.channel}
            </span>
          </div>
        </div>

        {/* Variant tabs */}
        {variants.length > 1 && (
          <div className="flex gap-1 mb-5">
            {variants.map((vr, i) => (
              <button
                key={vr.arch}
                type="button"
                onClick={() => setActiveVariant(i)}
                className={[
                  "flex-1 rounded-lg py-2 text-xs font-medium transition-all",
                  i === activeVariant
                    ? "bg-dl-accent text-white shadow-sm"
                    : "bg-dl-border/40 text-dl-muted hover:bg-dl-border/70 hover:text-dl-text",
                ].join(" ")}
              >
                {vr.arch}
              </button>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-lg bg-dl-bg px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-dl-muted mb-0.5">Architecture</p>
            <p className="text-xs font-medium text-dl-text">{v.arch}</p>
          </div>
          <div className="rounded-lg bg-dl-bg px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-dl-muted mb-0.5">Minimum OS</p>
            <p className="text-xs font-medium text-dl-text">{v.minOs}</p>
          </div>
          <div className="rounded-lg bg-dl-bg px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-dl-muted mb-0.5">File Size</p>
            <p className="text-xs font-medium text-dl-text">{v.size}</p>
          </div>
          <div className="rounded-lg bg-dl-bg px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-dl-muted mb-0.5">Type</p>
            <p className="text-xs font-medium text-dl-text uppercase">.{v.type}</p>
          </div>
        </div>

        {/* Download button */}
        {v.url ? (
          <a
            href={v.url}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-dl-accent py-3 text-sm font-semibold text-white hover:bg-dl-accent-hover transition-colors shadow-[0_2px_8px_var(--dl-accent-glow)]"
          >
            <Download size={16} />
            Download {v.type.toUpperCase()}
          </a>
        ) : (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-dl-surface border-2 border-dashed border-dl-border py-3 text-sm font-medium text-dl-muted cursor-not-allowed">
            <HardDrive size={16} />
            Coming Soon
          </div>
        )}

        {/* Checksum */}
        {v.sha256 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-dl-bg px-3 py-2">
            <Shield size={11} className="text-dl-muted shrink-0" />
            <span className="text-[10px] text-dl-muted">SHA-256:</span>
            <ChecksumCopy value={v.sha256} />
          </div>
        )}
      </div>

      {/* Installation guide */}
      <div className="px-6 py-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-dl-muted mb-4">Installation</p>
        <div className="space-y-3">
          {installSteps.map((step, i) => (
            <InstallStep key={i} n={i + 1} text={step} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DownloadPage() {
  const [buildDate] = useState(RELEASE.date);

  const macVariants: DownloadVariant[] = [
    {
      arch: "Apple Silicon",
      size: RELEASE.macos.arm.size,
      minOs: RELEASE.macos.arm.minOs,
      url: RELEASE.macos.arm.url,
      sha256: RELEASE.macos.arm.sha256,
      label: "Apple Silicon",
      type: "dmg",
    },
    {
      arch: "Intel",
      size: RELEASE.macos.intel.size,
      minOs: RELEASE.macos.intel.minOs,
      url: RELEASE.macos.intel.url,
      sha256: RELEASE.macos.intel.sha256,
      label: "Intel",
      type: "dmg",
    },
  ];

  const winVariants: DownloadVariant[] = [
    {
      arch: "EXE Installer",
      size: RELEASE.windows.exe.size,
      minOs: RELEASE.windows.exe.minOs,
      url: RELEASE.windows.exe.url,
      sha256: RELEASE.windows.exe.sha256,
      label: "Installer",
      type: "exe",
    },
    {
      arch: "MSI Package",
      size: RELEASE.windows.msi.size,
      minOs: RELEASE.windows.msi.minOs,
      url: RELEASE.windows.msi.url,
      sha256: RELEASE.windows.msi.sha256,
      label: "MSI",
      type: "msi",
    },
  ];

  return (
    <div className="font-dl">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-20 pb-16 px-6">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-dl-accent/5 blur-[80px]" />
        </div>

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-dl-border bg-dl-surface px-4 py-1.5 text-xs text-dl-muted mb-8 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Version {RELEASE.version} · Build {RELEASE.build} · {buildDate}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-dl-text leading-[1.08] mb-6">
            The Clinical Operating<br />System for Orthodontics
          </h1>

          <p className="text-lg text-dl-muted max-w-xl mx-auto mb-10 leading-relaxed">
            Plan cases. Design treatment. Export production-ready aligners.
            Built for orthodontists, clinics, and dental laboratories.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <a
              href="#download-cards"
              className="inline-flex items-center gap-2 rounded-xl bg-dl-accent px-6 py-3 text-sm font-semibold text-white hover:bg-dl-accent-hover transition-colors shadow-[0_4px_16px_var(--dl-accent-glow)]"
            >
              <Download size={16} />
              Download Free
            </a>
            <Link
              href="/download/enterprise"
              className="inline-flex items-center gap-2 rounded-xl border border-dl-border bg-dl-surface px-6 py-3 text-sm font-medium text-dl-text hover:border-dl-accent/40 transition-colors"
            >
              Enterprise Licensing
              <ChevronRight size={14} className="text-dl-muted" />
            </Link>
          </div>

          <p className="text-xs text-dl-muted">
            Free for individual orthodontists · No credit card required
          </p>
        </div>
      </section>

      {/* ── Download cards ── */}
      <section id="download-cards" className="px-6 pb-20 scroll-mt-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-dl-muted mb-2">Downloads</p>
            <h2 className="text-2xl font-bold text-dl-text">Choose your platform</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* macOS */}
            <DownloadCard
              platform="macOS"
              icon={<Apple size={22} />}
              variants={macVariants}
              installSteps={[
                "Download the .dmg file for your Mac",
                "Open the DMG and drag MyOrtho to Applications",
                "Launch MyOrtho from your Applications folder",
                "Grant permissions when prompted (camera, network)",
                "Sign in or create your free account",
              ]}
            />

            {/* Windows */}
            <DownloadCard
              platform="Windows"
              icon={<Monitor size={22} />}
              variants={winVariants}
              installSteps={[
                "Download the EXE or MSI installer",
                "Run the installer as Administrator",
                "Follow the setup wizard to completion",
                "Launch MyOrtho from the Start Menu",
                "Sign in or create your free account",
              ]}
            />

            {/* Web Platform */}
            <div className="rounded-2xl border border-dl-border bg-dl-surface overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.25)]">
              <div className="px-6 pt-6 pb-5 border-b border-dl-border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-dl-surface border border-dl-border flex items-center justify-center text-dl-text shadow-sm">
                    <Globe size={22} />
                  </div>
                  <div>
                    <p className="font-semibold text-dl-text">Web Platform</p>
                    <p className="text-xs text-dl-muted">No installation required</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {[
                    "Works in any modern browser",
                    "Full clinical workflow support",
                    "Real-time cloud sync",
                    "Collaborate with your team",
                    "Automatic updates",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2.5 text-sm text-dl-muted">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                <Link
                  href="/"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-dl-surface border border-dl-accent/40 py-3 text-sm font-semibold text-dl-accent hover:bg-dl-accent/5 transition-colors"
                >
                  <Globe size={16} />
                  Open Web App
                </Link>
              </div>

              <div className="px-6 py-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-dl-muted mb-4">Requirements</p>
                <div className="space-y-2.5">
                  {[
                    { icon: <Globe size={13} />, text: "Chrome 110+, Firefox 115+, Safari 16+" },
                    { icon: <Cpu size={13} />, text: "WebGL 2.0 for 3D features" },
                    { icon: <Wifi size={13} />, text: "Internet connection required" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-start gap-2.5 text-xs text-dl-muted">
                      <span className="mt-0.5 shrink-0 text-dl-muted">{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section className="border-t border-dl-border bg-dl-surface py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-widest text-dl-muted mb-2">What&rsquo;s included</p>
            <h2 className="text-2xl font-bold text-dl-text">Complete clinical toolkit</h2>
            <p className="mt-2 text-dl-muted text-sm max-w-md mx-auto">Everything from scan ingestion to production-ready aligner export, in one application.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 rounded-xl border border-dl-border bg-dl-bg px-4 py-3"
              >
                <span className="text-dl-accent shrink-0">{f.icon}</span>
                <span className="text-sm text-dl-text font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security & compliance ── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-dl-border bg-dl-surface overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-dl-border">
              <div className="px-8 py-8">
                <Shield size={20} className="text-dl-accent mb-4" />
                <h3 className="text-lg font-semibold text-dl-text mb-2">Enterprise Security</h3>
                <p className="text-sm text-dl-muted leading-relaxed mb-4">
                  HIPAA-compliant architecture with AES-256 encryption at rest, TLS 1.3 in transit,
                  and role-based access control built for clinical environments.
                </p>
                <Link href="/download/enterprise" className="text-sm font-medium text-dl-accent hover:underline inline-flex items-center gap-1">
                  Enterprise licensing <ChevronRight size={13} />
                </Link>
              </div>
              <div className="px-8 py-8">
                <CheckCircle2 size={20} className="text-emerald-500 mb-4" />
                <h3 className="text-lg font-semibold text-dl-text mb-2">Signed & Verified</h3>
                <p className="text-sm text-dl-muted leading-relaxed mb-4">
                  All desktop installers are digitally signed. macOS builds are notarized by Apple.
                  Verify your download with the provided SHA-256 checksums.
                </p>
                <Link href="/download/system-requirements" className="text-sm font-medium text-dl-accent hover:underline inline-flex items-center gap-1">
                  System requirements <ChevronRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Release notes CTA ── */}
      <section className="border-t border-dl-border bg-dl-surface py-16 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-dl-text mb-3">What&rsquo;s new in {RELEASE.version}</h2>
          <p className="text-dl-muted text-sm mb-6">
            Full release notes including bug fixes, performance improvements, and new clinical features.
          </p>
          <Link
            href="/download/release-notes"
            className="inline-flex items-center gap-2 rounded-xl border border-dl-border bg-dl-bg px-5 py-2.5 text-sm font-medium text-dl-text hover:border-dl-accent/40 transition-colors"
          >
            <FileText size={15} />
            View Release Notes
          </Link>
        </div>
      </section>
    </div>
  );
}
