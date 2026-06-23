"use client";

import {
  AlertTriangle,
  Archive,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  Eye,
  FileText,
  Key,
  Lock,
  Map,
  Server,
  Shield,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/DesignSystem";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrustSection {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  items: TrustItem[];
}

interface TrustItem {
  label: string;
  detail: string;
  status: "ready" | "designed-for" | "roadmap";
}

// ─── Status metadata ──────────────────────────────────────────────────────────

const STATUS_META: Record<TrustItem["status"], { label: string; tone: "success" | "info" | "neutral" }> = {
  "ready":          { label: "Ready",           tone: "success" },
  "designed-for":   { label: "Designed for",    tone: "info"    },
  "roadmap":        { label: "Roadmap",          tone: "neutral" },
};

// ─── Trust data ───────────────────────────────────────────────────────────────

const TRUST_SECTIONS: TrustSection[] = [
  {
    id: "phi",
    icon: Database,
    title: "PHI Handling Principles",
    description: "How MyOrtho is designed to handle Protected Health Information.",
    items: [
      {
        label: "Data stays on your VPS",
        detail: "All patient data is stored in your organization's own PostgreSQL instance running on your Hostinger VPS. No patient data is sent to third-party cloud analytics services.",
        status: "ready",
      },
      {
        label: "Postgres encrypted volumes",
        detail: "Docker volume encryption is supported at the OS level on the VPS. Data-at-rest encryption depends on the underlying storage configuration managed by your infrastructure team.",
        status: "designed-for",
      },
      {
        label: "No PHI in AI engine training",
        detail: "The AI engine processes data transiently for analysis. Patient identifiers are not used in any model training pipeline. The platform is designed so that de-identified data can be used for future model improvement, subject to your organization's IRB and consent procedures.",
        status: "designed-for",
      },
      {
        label: "PHI access logging",
        detail: "All access to case records is logged in the audit trail with user ID, role, timestamp, and action. Log export is available in CSV format.",
        status: "ready",
      },
      {
        label: "Minimum necessary principle",
        detail: "Role-based access controls are designed so that each role sees only the data required for their function. Full implementation of RBAC enforcement is on the roadmap.",
        status: "roadmap",
      },
    ],
  },
  {
    id: "audit",
    icon: Archive,
    title: "Audit Logging Principles",
    description: "How MyOrtho captures, stores, and exposes the audit trail for clinical and compliance review.",
    items: [
      {
        label: "Tamper-evident audit log",
        detail: "Audit events are append-only with timestamptz precision. Events cannot be deleted through the application layer. Database-level immutability requires additional PostgreSQL configuration on your infrastructure.",
        status: "designed-for",
      },
      {
        label: "11 event types captured",
        detail: "case_created, file_uploaded, measurement_created, treatment_modified, approved, approval_revoked, revision_requested, manufacturing_started, manufacturing_completed, status_changed, note_added.",
        status: "ready",
      },
      {
        label: "Actor, role, and timestamp on every event",
        detail: "Every audit event records the user ID, display name, role, action description, and ISO-8601 timestamp. JSON metadata is preserved per event.",
        status: "ready",
      },
      {
        label: "CSV export",
        detail: "Audit trails can be exported as CSV for compliance reporting, external audit, or archival. Export includes all fields.",
        status: "ready",
      },
      {
        label: "Long-term retention policy",
        detail: "Retention schedule (e.g., 7-year medical record requirement) is the responsibility of your organization. The schema supports indefinite retention. Automated purge or archival policies are on the roadmap.",
        status: "roadmap",
      },
    ],
  },
  {
    id: "ai-policy",
    icon: Brain,
    title: "Human-in-the-Loop AI Policy",
    description: "Governing principles for all AI-assisted features in the platform.",
    items: [
      {
        label: "Decision support, not replacement",
        detail: "Every AI feature in MyOrtho provides information to support clinical decision-making. No AI feature makes autonomous clinical decisions or takes autonomous actions.",
        status: "ready",
      },
      {
        label: "Explicit approval required for AI outputs",
        detail: "AI-generated suggestions (IPR amounts, attachment positions, treatment setups) are not applied until explicitly reviewed and approved by the treating orthodontist.",
        status: "designed-for",
      },
      {
        label: "Maturity labels on every AI capability",
        detail: "Every AI capability is labelled as Implemented, Simulated, or Planned. Simulated capabilities use representative data and are not validated clinical engines. See the AI Readiness Center for the full capability matrix.",
        status: "ready",
      },
      {
        label: "No autonomous diagnosis",
        detail: "MyOrtho does not and will not make autonomous diagnostic conclusions. Clinical diagnosis is always the responsibility of the licensed treating professional.",
        status: "ready",
      },
      {
        label: "AI audit trail",
        detail: "AI-generated suggestions and the clinician's acceptance, modification, or rejection of those suggestions are recorded in the audit trail. Full AI decision logging is on the roadmap.",
        status: "roadmap",
      },
    ],
  },
  {
    id: "data-export",
    icon: Archive,
    title: "Data Export Policy",
    description: "Your rights and mechanisms for exporting your data.",
    items: [
      {
        label: "Case data export",
        detail: "Individual cases and their associated measurements, treatment plans, and audit logs can be exported in standard formats (CSV, JSON).",
        status: "ready",
      },
      {
        label: "CAD package export",
        detail: "Treatment plans are exportable as structured JSON CAD packages compatible with downstream lab and manufacturing workflows.",
        status: "ready",
      },
      {
        label: "Full database export",
        detail: "As you host your own PostgreSQL instance, you have full access to pg_dump for complete database export at any time. No data is locked in a proprietary cloud.",
        status: "ready",
      },
      {
        label: "FHIR / HL7 export",
        detail: "Structured export in FHIR R4 or HL7 format for interoperability with EHR / practice management systems is on the roadmap.",
        status: "roadmap",
      },
    ],
  },
  {
    id: "rbac",
    icon: Users,
    title: "Role-Based Access Roadmap",
    description: "Current and planned access control capabilities.",
    items: [
      {
        label: "Role assignment at account creation",
        detail: "Every user is assigned a role at creation: super_admin, admin, orthodontist, dentist, resident, lab_technician, lab_manager, clinical_director, vp_clinical, vp_manufacturing, executive.",
        status: "ready",
      },
      {
        label: "Role-based UI personalization",
        detail: "Navigation, default workspace, and recommended actions are personalized to the user's role. Role badges appear in the top bar and settings.",
        status: "ready",
      },
      {
        label: "API-level permission enforcement",
        detail: "Backend API endpoints are being hardened with role-based guards. JWT-authenticated sessions attach role claims to all API requests. Full enforcement is under active development.",
        status: "roadmap",
      },
      {
        label: "Multi-organization tenant isolation",
        detail: "The database schema supports multi-organization isolation via organization_id on all clinical tables. Full tenant enforcement at the API layer is on the roadmap.",
        status: "designed-for",
      },
      {
        label: "Attribute-based access control (ABAC)",
        detail: "Fine-grained per-resource access rules (e.g., a doctor can only see their own patients) require ABAC policies. Planned for a future phase.",
        status: "roadmap",
      },
    ],
  },
  {
    id: "security",
    icon: Lock,
    title: "Security Checklist",
    description: "Security practices implemented or designed for in this platform.",
    items: [
      {
        label: "Passwords stored with bcrypt (12 rounds)",
        detail: "Admin and user passwords are hashed with bcrypt at cost factor 12. Plaintext passwords are never stored or logged.",
        status: "ready",
      },
      {
        label: "HttpOnly JWT session cookies",
        detail: "Sessions use HttpOnly, SameSite=Lax, Secure=true cookies. The mo_session JWT is signed with a secret that is never exposed to the frontend.",
        status: "ready",
      },
      {
        label: "Login rate limiting",
        detail: "Login attempts are rate-limited to 10 per IP per minute. Brute-force protection via in-memory rate limiter; Redis-backed rate limiting is on the roadmap for multi-instance deployments.",
        status: "ready",
      },
      {
        label: "CORS restricted to known origins",
        detail: "CORS is configured to allow only the production frontend domain and localhost for development. Wildcard origins are not permitted.",
        status: "ready",
      },
      {
        label: "Postgres not exposed to the internet",
        detail: "The database runs on an internal Docker Compose network. Port 5432 is not published to the host or internet.",
        status: "ready",
      },
      {
        label: "HTTPS with Let's Encrypt",
        detail: "Production traffic is served over TLS terminated at the Nginx reverse proxy. Certificates are managed by Certbot.",
        status: "ready",
      },
      {
        label: "Input validation on all API endpoints",
        detail: "NestJS ValidationPipe with class-validator strips unknown fields and validates types on all incoming requests.",
        status: "ready",
      },
      {
        label: "Dependency audit",
        detail: "npm audit is run as part of the build process. Automated vulnerability scanning (Snyk or Dependabot) is on the roadmap.",
        status: "roadmap",
      },
      {
        label: "Penetration testing",
        detail: "Independent third-party penetration testing is recommended before accepting real patient data in production. Not yet completed.",
        status: "roadmap",
      },
    ],
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function TrustItemRow({ item }: { item: TrustItem }) {
  const meta = STATUS_META[item.status];
  return (
    <div className="flex items-start gap-3 border-t border-[color:var(--border)] pt-3 first:border-t-0 first:pt-0">
      <div className="mt-0.5 shrink-0">
        {item.status === "ready"
          ? <CheckCircle2 size={15} className="text-emerald-500" />
          : item.status === "designed-for"
          ? <Eye size={15} className="text-blue-500" />
          : <Clock size={15} className="text-[color:var(--muted-foreground)]" />
        }
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[color:var(--foreground)]">{item.label}</span>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        </div>
        <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">{item.detail}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrustPage() {
  return (
    <section className="animate-page-enter mx-auto w-full max-w-3xl px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+2rem)] pt-4 sm:px-5">

      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">Compliance & Privacy</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">Trust Center</h1>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          Transparency into how MyOrtho handles clinical data, AI decisions, security, and compliance. We use honest language:
          what&apos;s <strong className="text-[color:var(--foreground)]">ready today</strong>, what the platform is
          <strong className="text-[color:var(--foreground)]"> designed for</strong>, and what&apos;s on the
          <strong className="text-[color:var(--foreground)]"> roadmap</strong>.
        </p>
      </div>

      {/* Disclaimer banner */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Regulatory disclaimer</p>
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            MyOrtho is <strong>not FDA-cleared, CE-marked, or MDR-certified</strong> as a medical device.
            The platform is designed to support clinical workflows and is prepared for compliance frameworks, but has not completed regulatory certification.
            Organizations using this platform for clinical purposes are responsible for their own regulatory assessment, compliance obligations, and patient data governance.
          </p>
        </div>
      </div>

      {/* Status legend */}
      <div className="mb-6 flex flex-wrap gap-3">
        {Object.entries(STATUS_META).map(([key, meta]) => {
          const Icon = key === "ready" ? CheckCircle2 : key === "designed-for" ? Eye : Clock;
          return (
            <div key={key} className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
              <Icon size={13} className={key === "ready" ? "text-emerald-500" : key === "designed-for" ? "text-blue-500" : ""} />
              <span><strong className="text-[color:var(--foreground)]">{meta.label}</strong> — {
                key === "ready" ? "Working today" :
                key === "designed-for" ? "Architecture supports it; configuration may be required" :
                "Planned for a future release"
              }</span>
            </div>
          );
        })}
      </div>

      {/* Trust sections */}
      <div className="space-y-4">
        {TRUST_SECTIONS.map(section => {
          const Icon = section.icon;
          const readyCount = section.items.filter(i => i.status === "ready").length;
          const totalCount = section.items.length;

          return (
            <Card key={section.id} className="overflow-hidden p-0">
              <div className="border-b border-[color:var(--border)] px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--primary-glow)]">
                    <Icon size={16} className="text-[color:var(--primary)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-[color:var(--foreground)]">{section.title}</h2>
                      <span className="text-xs text-[color:var(--muted-foreground)]">
                        {readyCount}/{totalCount} ready
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{section.description}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 px-5 py-4">
                {section.items.map(item => <TrustItemRow key={item.label} item={item} />)}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Clinical disclaimer */}
      <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-[color:var(--primary)]" />
          <h2 className="text-sm font-bold text-[color:var(--foreground)]">Clinical disclaimer</h2>
        </div>
        <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          MyOrtho is a clinical workflow platform designed to assist licensed orthodontic and dental professionals.
          Information provided by the platform — including measurements, AI suggestions, treatment plans, and analytics —
          is intended as decision support only. The final clinical decision, treatment prescription, and patient care
          responsibility rests entirely with the licensed treating professional.
        </p>
        <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          MyOrtho is <strong className="text-[color:var(--foreground)]">prepared for</strong> HIPAA-compliant deployment
          (data stays on your infrastructure; access is logged; PHI is not shared with third parties),
          but HIPAA compliance is a shared responsibility between the platform and your organization&apos;s policies,
          training, and Business Associate Agreements.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            "Designed for clinical use",
            "Prepared for HIPAA deployment",
            "Supports audit requirements",
            "Roadmap includes MDR / FDA 510(k) pathway",
          ].map(tag => (
            <StatusBadge key={tag} tone="neutral">{tag}</StatusBadge>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          href="/ai-readiness"
          className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--muted)]"
        >
          <span className="flex items-center gap-2">
            <Brain size={15} className="text-[color:var(--primary)]" />
            AI Readiness Center
          </span>
          <ChevronRight size={14} className="text-[color:var(--muted-foreground)]" />
        </Link>
        <Link
          href="/settings"
          className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--muted)]"
        >
          <span className="flex items-center gap-2">
            <Key size={15} className="text-[color:var(--primary)]" />
            Account & Security Settings
          </span>
          <ChevronRight size={14} className="text-[color:var(--muted-foreground)]" />
        </Link>
      </div>
    </section>
  );
}
