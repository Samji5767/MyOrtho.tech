import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Users,
  Key,
  Building2,
  BarChart3,
  Lock,
  CheckCircle2,
  ArrowRight,
  Globe,
  FileText,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Enterprise",
  description: "Enterprise deployment, SSO, HIPAA compliance, and volume licensing for MyOrtho.",
};

const FEATURES = [
  {
    icon: <Key size={18} />,
    title: "Single Sign-On (SSO)",
    description:
      "SAML 2.0 and OIDC support for any identity provider — Okta, Azure AD, Google Workspace, or your own IdP. Role mapping, group sync, and Just-in-Time provisioning included.",
  },
  {
    icon: <Shield size={18} />,
    title: "HIPAA Business Associate Agreement",
    description:
      "We sign BAAs for all Enterprise accounts. All PHI is encrypted at rest (AES-256) and in transit (TLS 1.3). Complete audit trail for every clinical action.",
  },
  {
    icon: <Building2 size={18} />,
    title: "Multi-Location Management",
    description:
      "Manage an unlimited number of clinic locations from a single admin dashboard. Per-location branding, user management, and data isolation.",
  },
  {
    icon: <Users size={18} />,
    title: "Centralized User Provisioning",
    description:
      "SCIM 2.0 for automated user lifecycle management. Onboard and offboard staff with zero manual steps. Custom roles with granular permission sets.",
  },
  {
    icon: <Lock size={18} />,
    title: "Advanced Security Controls",
    description:
      "IP allowlisting, session timeout policies, MFA enforcement, device trust policies, and data export restrictions — all configurable per organization.",
  },
  {
    icon: <BarChart3 size={18} />,
    title: "Analytics & Reporting",
    description:
      "Organization-wide case metrics, clinical throughput dashboards, and compliance reporting. Export to CSV or connect directly via our analytics API.",
  },
  {
    icon: <Globe size={18} />,
    title: "Data Residency",
    description:
      "Choose where your patient data is stored — US, EU, or AU regions. Dedicated Supabase project with isolated database and object storage.",
  },
  {
    icon: <FileText size={18} />,
    title: "Custom Contracts & SLA",
    description:
      "Negotiate volume pricing, custom payment terms, and a guaranteed 99.9% uptime SLA with dedicated support escalation paths.",
  },
];

const COMPLIANCE = [
  "HIPAA (US)",
  "GDPR (EU)",
  "PIPEDA (CA)",
  "SOC 2 Type II (in progress)",
  "ISO 27001 (in progress)",
  "TGA Class IIa (AU, in progress)",
];

export default function EnterprisePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      {/* Hero */}
      <div className="mb-16 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-dl-border bg-dl-surface px-3 py-1 text-[11px] font-medium text-dl-muted mb-5">
          <Building2 size={11} />
          Enterprise
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-dl-text mb-4 text-balance">
          Built for enterprise orthodontics practices
        </h1>
        <p className="text-dl-muted text-lg leading-relaxed mb-8">
          SSO, HIPAA BAA, multi-location management, advanced security controls, and dedicated
          support — everything a growing practice or DSO needs to deploy MyOrtho at scale.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/download/support"
            className="inline-flex items-center gap-2 rounded-lg bg-dl-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-dl-accent-hover transition-colors"
          >
            Contact Sales
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/download/docs"
            className="inline-flex items-center gap-2 rounded-lg border border-dl-border bg-dl-surface px-5 py-2.5 text-sm font-medium text-dl-text hover:bg-dl-border/40 transition-colors"
          >
            Enterprise Docs
          </Link>
        </div>
      </div>

      {/* Features grid */}
      <div className="mb-16">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-dl-muted mb-6">
          Enterprise Features
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-dl-border bg-dl-surface p-5"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-dl-accent">{f.icon}</span>
                <h3 className="text-sm font-semibold text-dl-text">{f.title}</h3>
              </div>
              <p className="text-xs text-dl-muted leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance */}
      <div className="mb-16">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-dl-muted mb-6">
          Compliance & Certifications
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {COMPLIANCE.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full border border-dl-border bg-dl-surface px-3 py-1.5 text-xs font-medium text-dl-text"
            >
              <CheckCircle2 size={12} className="text-emerald-500" />
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl border border-dl-border bg-dl-surface overflow-hidden">
        <div className="p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h3 className="text-xl font-semibold text-dl-text mb-2">
                Talk to our enterprise team
              </h3>
              <p className="text-sm text-dl-muted max-w-lg">
                Get a custom demo, discuss your deployment requirements, and receive a
                tailored quote. Our clinical IT team has helped practices of all sizes
                deploy MyOrtho securely.
              </p>
            </div>
            <Link
              href="/download/support"
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-dl-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-dl-accent-hover transition-colors"
            >
              Book a Demo
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <div className="border-t border-dl-border bg-dl-bg px-8 sm:px-10 py-4">
          <p className="text-xs text-dl-muted">
            Already an enterprise customer?{" "}
            <Link href="/download/support" className="text-dl-accent hover:underline">
              Contact your account manager
            </Link>{" "}
            or visit the{" "}
            <Link href="/download/docs" className="text-dl-accent hover:underline">
              enterprise documentation
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
