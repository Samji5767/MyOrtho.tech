"use client";

import { ShieldCheck, Lock, FileCheck, Server, Eye, AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  icon: React.ReactNode;
  title: string;
  items: { heading: string; body: string }[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    icon: <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />,
    title: "HIPAA Compliance",
    items: [
      {
        heading: "Business Associate Agreement",
        body: "MyOrtho Technologies signs a BAA with every covered entity before PHI is processed. Contact support to obtain or review your executed BAA.",
      },
      {
        heading: "Minimum Necessary Standard",
        body: "AI inference pipelines operate exclusively on de-identified geometric mesh data. Patient names, dates of birth, and other direct identifiers never enter the ML pipeline.",
      },
      {
        heading: "Access Controls",
        body: "Role-based access (super_admin → admin → orthodontist → assistant → viewer) is enforced at the API layer. Every permission check is server-side — client role claims are never trusted.",
      },
      {
        heading: "Workforce Training",
        body: "All employees with access to PHI complete annual HIPAA Privacy and Security Rule training. Completion is tracked in the internal compliance system.",
      },
    ],
  },
  {
    icon: <Lock size={16} className="text-blue-600 dark:text-blue-400" />,
    title: "Data Security",
    items: [
      {
        heading: "Encryption at Rest",
        body: "All patient data is encrypted at rest using AES-256. Encryption keys are managed via a dedicated key management service and rotated annually.",
      },
      {
        heading: "Encryption in Transit",
        body: "All connections use TLS 1.2 or higher. HSTS with a one-year max-age and preload is enforced on all endpoints. HTTP connections are automatically upgraded.",
      },
      {
        heading: "Authentication",
        body: "Sessions are maintained via HttpOnly, Secure, SameSite=Strict cookies. JWT tokens never appear in response bodies or URLs. Bcrypt with a work factor of 12 is used for password hashing.",
      },
      {
        heading: "Content Security Policy",
        body: "A strict CSP restricts script execution to same-origin sources only. Inline scripts and eval() are blocked. Object embedding is disabled.",
      },
    ],
  },
  {
    icon: <FileCheck size={16} className="text-violet-600 dark:text-violet-400" />,
    title: "Audit & Accountability",
    items: [
      {
        heading: "Immutable Audit Log",
        body: "Every user action that touches PHI — create, read, update, delete — is recorded with actor ID, timestamp, IP address, and affected resource. Logs are append-only and cannot be modified by application-layer users.",
      },
      {
        heading: "AI Recommendation Logging",
        body: "Every AI-generated suggestion (segmentation boundary, IPR depth, staging sequence) is logged with the model version, input hash, and output. This supports clinical accountability and reproducibility.",
      },
      {
        heading: "Login and Auth Events",
        body: "Login attempts (success and failure), logouts, and rate-limiting events are all captured. Failed login patterns trigger automatic rate limiting at the IP level.",
      },
      {
        heading: "Retention Policy",
        body: "Audit records are retained for a minimum of six years in compliance with 45 CFR §164.530(j). Records can be provided to covered entities on request.",
      },
    ],
  },
  {
    icon: <Server size={16} className="text-amber-600 dark:text-amber-400" />,
    title: "Infrastructure",
    items: [
      {
        heading: "On-Device AI Inference",
        body: "The tooth segmentation model runs locally on the practitioner's workstation (CoreML on Apple Silicon; ONNX Runtime on Windows). 3D scan geometry is never uploaded to a remote inference server.",
      },
      {
        heading: "Data Residency",
        body: "Patient records are stored in US-East region by default. EU data residency is available for practices under GDPR. Contact support to configure your region.",
      },
      {
        heading: "Backups",
        body: "Automated encrypted backups run every 24 hours with a 30-day retention window. Point-in-time recovery is available for the last 7 days.",
      },
      {
        heading: "Vulnerability Management",
        body: "Dependencies are scanned on every CI build. Critical CVEs must be patched within 72 hours; high severity within 14 days. Penetration tests are conducted annually.",
      },
    ],
  },
  {
    icon: <Eye size={16} className="text-rose-600 dark:text-rose-400" />,
    title: "Privacy",
    items: [
      {
        heading: "Data Minimization",
        body: "MyOrtho only collects data necessary to deliver the service. Scan geometry, treatment records, and clinical notes are never sold or used for advertising.",
      },
      {
        heading: "Patient Rights",
        body: "Covered entities retain full ownership of patient data. Export and deletion requests can be fulfilled within 30 days via the admin panel or by contacting support.",
      },
      {
        heading: "Sub-processors",
        body: "A current list of sub-processors (cloud infrastructure, payment processor, transactional email) is maintained and updated whenever a new sub-processor is added.",
      },
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrustPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
        <h1 className="text-xl font-bold text-[color:var(--foreground)]">Trust Center</h1>
      </div>
      <p className="mb-8 text-sm text-[color:var(--muted-foreground)] max-w-prose">
        How MyOrtho protects patient data, maintains HIPAA compliance, and supports clinical accountability.
      </p>

      {/* Notice banner */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-300">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <span>
          This page describes MyOrtho&apos;s security posture and compliance practices. It is informational
          and does not constitute legal advice. For a copy of our BAA, DPA, or full privacy policy,
          contact <strong>privacy@myortho.tech</strong>.
        </span>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {SECTIONS.map(section => (
          <div
            key={section.title}
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--background)] px-5 py-3">
              {section.icon}
              <h2 className="text-sm font-bold text-[color:var(--foreground)]">{section.title}</h2>
            </div>
            <dl className="divide-y divide-[color:var(--border)]">
              {section.items.map(item => (
                <div key={item.heading} className="px-5 py-4">
                  <dt className="mb-1 text-sm font-semibold text-[color:var(--foreground)]">{item.heading}</dt>
                  <dd className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-[color:var(--muted-foreground)]">
        Last updated July 2026 · MyOrtho Technologies, Inc. · For security disclosures, email{" "}
        <span className="font-medium">security@myortho.tech</span>.
      </p>
    </div>
  );
}
