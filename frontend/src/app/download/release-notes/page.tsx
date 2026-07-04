import type { Metadata } from "next";
import { CheckCircle2, AlertCircle, Wrench, Sparkles, ChevronRight } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Release Notes",
  description: "Changelogs and release notes for every version of MyOrtho.",
};

interface Change {
  type: "new" | "improved" | "fixed";
  text: string;
}

interface Release {
  version: string;
  date: string;
  channel: "Stable" | "Beta";
  summary: string;
  changes: Change[];
}

const RELEASES: Release[] = [
  {
    version: "2.0.0",
    date: "July 4, 2026",
    channel: "Stable",
    summary: "Major release introducing AI-assisted segmentation, full biomechanics engine, and redesigned clinical workflow.",
    changes: [
      { type: "new", text: "AI-powered tooth segmentation with sub-0.1 mm accuracy" },
      { type: "new", text: "Biomechanics simulation engine with force vector analysis" },
      { type: "new", text: "3D movement simulation with per-stage frame rendering" },
      { type: "new", text: "CBCT integration and cephalometric analysis module" },
      { type: "new", text: "Arch coordination panel for multi-arch synchronization" },
      { type: "new", text: "Treatment refinement workflow with full audit trail" },
      { type: "new", text: "Enterprise SSO (SAML 2.0 / OIDC) support" },
      { type: "new", text: "HIPAA-compliant audit logging across all clinical actions" },
      { type: "improved", text: "Redesigned case detail UI with tabbed clinical panels" },
      { type: "improved", text: "Treatment plan editor with inline notes and AI recommendations" },
      { type: "improved", text: "STL export with configurable quality presets" },
      { type: "improved", text: "Dark mode with system theme auto-detection" },
      { type: "improved", text: "Keyboard navigation throughout the clinical workspace" },
      { type: "fixed", text: "Cookie-based session auth applied consistently across all panels" },
      { type: "fixed", text: "Corrected aligner stage sorting in treatment simulation player" },
      { type: "fixed", text: "Fixed stale theme state when switching OS dark mode preference" },
    ],
  },
  {
    version: "1.5.2",
    date: "May 12, 2026",
    channel: "Stable",
    summary: "Patch release addressing attachment library filtering and print job stability.",
    changes: [
      { type: "fixed", text: "Attachment library search now respects tooth number filter" },
      { type: "fixed", text: "Print farm queue no longer hangs on multi-arch exports" },
      { type: "fixed", text: "Case status badge renders correctly after status transitions" },
      { type: "improved", text: "Export package generation is 40% faster for large setups" },
    ],
  },
  {
    version: "1.5.1",
    date: "April 28, 2026",
    channel: "Stable",
    summary: "Stability improvements and minor UI fixes.",
    changes: [
      { type: "fixed", text: "QA report PDF export handles cases with zero flags correctly" },
      { type: "fixed", text: "Radiology viewer no longer clips wide images on small screens" },
      { type: "improved", text: "Notifications panel updates in real time without refresh" },
    ],
  },
  {
    version: "1.5.0",
    date: "March 31, 2026",
    channel: "Stable",
    summary: "Introduces the Collaboration module, patient portal, and overhauled notifications.",
    changes: [
      { type: "new", text: "Real-time case collaboration with presence indicators" },
      { type: "new", text: "Patient communication portal with secure messaging" },
      { type: "new", text: "Per-case AI clinical alerts with severity levels" },
      { type: "improved", text: "Notification bell with mark-all-read and dismiss actions" },
      { type: "improved", text: "Settings page consolidated into a single unified view" },
    ],
  },
];

const TYPE_META: Record<
  Change["type"],
  { label: string; icon: React.ReactNode; color: string }
> = {
  new: {
    label: "New",
    icon: <Sparkles size={12} />,
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  improved: {
    label: "Improved",
    icon: <Wrench size={12} />,
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  fixed: {
    label: "Fixed",
    icon: <CheckCircle2 size={12} />,
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
};

export default function ReleaseNotesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {/* Header */}
      <div className="mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-dl-border bg-dl-surface px-3 py-1 text-[11px] font-medium text-dl-muted mb-5">
          <AlertCircle size={11} />
          Changelog
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-dl-text mb-3">
          Release Notes
        </h1>
        <p className="text-dl-muted leading-relaxed max-w-xl">
          Every change, fix, and new feature shipped to MyOrtho — in full detail.
          Subscribe to the{" "}
          <Link
            href="/download/support"
            className="text-dl-accent hover:underline"
          >
            release feed
          </Link>{" "}
          to get notified.
        </p>
      </div>

      {/* Releases */}
      <div className="flex flex-col gap-12">
        {RELEASES.map((release, i) => (
          <article
            key={release.version}
            className="relative pl-6 border-l border-dl-border"
          >
            {/* Timeline dot */}
            <div
              className={[
                "absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2",
                i === 0
                  ? "bg-dl-accent border-dl-accent"
                  : "bg-dl-bg border-dl-border",
              ].join(" ")}
            />

            {/* Version header */}
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <span className="text-lg font-semibold text-dl-text font-mono">
                v{release.version}
              </span>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  release.channel === "Stable"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                ].join(" ")}
              >
                {release.channel}
              </span>
              <span className="text-xs text-dl-muted">{release.date}</span>
            </div>

            <p className="text-sm text-dl-muted mb-5 leading-relaxed">
              {release.summary}
            </p>

            {/* Change list */}
            <ul className="flex flex-col gap-2.5">
              {release.changes.map((change, j) => {
                const meta = TYPE_META[change.type];
                return (
                  <li key={j} className="flex items-start gap-3 text-sm">
                    <span
                      className={[
                        "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
                        meta.color,
                      ].join(" ")}
                    >
                      {meta.icon}
                      {meta.label}
                    </span>
                    <span className="text-dl-text leading-snug">{change.text}</span>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-16 rounded-xl border border-dl-border bg-dl-surface p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-dl-text">Ready to upgrade?</p>
          <p className="text-xs text-dl-muted mt-0.5">
            v2.0.0 is the latest stable release.
          </p>
        </div>
        <Link
          href="/download"
          className="inline-flex items-center gap-1.5 rounded-lg bg-dl-accent px-4 py-2 text-sm font-medium text-white hover:bg-dl-accent-hover transition-colors"
        >
          Download v2.0.0
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
