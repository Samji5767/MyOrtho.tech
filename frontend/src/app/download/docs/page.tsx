import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Terminal,
  Shield,
  Plug,
  Building2,
  ChevronRight,
  FileText,
  Layers,
  Cpu,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Technical documentation, API reference, and integration guides for MyOrtho.",
};

interface DocSection {
  icon: React.ReactNode;
  title: string;
  description: string;
  links: { label: string; href: string }[];
}

const SECTIONS: DocSection[] = [
  {
    icon: <BookOpen size={18} />,
    title: "Getting Started",
    description: "Install MyOrtho, configure your first workspace, and onboard your team.",
    links: [
      { label: "Installation guide", href: "/download" },
      { label: "System requirements", href: "/download/system-requirements" },
      { label: "First-time setup", href: "/download/docs" },
      { label: "Migrating from another system", href: "/download/docs" },
    ],
  },
  {
    icon: <Layers size={18} />,
    title: "Clinical Workflows",
    description: "End-to-end documentation for the MyOrtho clinical pipeline.",
    links: [
      { label: "Case creation & patient management", href: "/download/docs" },
      { label: "Scan upload and validation", href: "/download/docs" },
      { label: "AI segmentation overview", href: "/download/docs" },
      { label: "Treatment planning", href: "/download/docs" },
      { label: "Aligner stage simulation", href: "/download/docs" },
      { label: "Export & print queue", href: "/download/docs" },
    ],
  },
  {
    icon: <Terminal size={18} />,
    title: "API Reference",
    description: "REST API endpoints for integrating MyOrtho with your clinical systems.",
    links: [
      { label: "Authentication (cookie + Bearer)", href: "/download/docs" },
      { label: "Cases API", href: "/download/docs" },
      { label: "Patients API", href: "/download/docs" },
      { label: "Scans API", href: "/download/docs" },
      { label: "Releases & downloads API", href: "/download/docs" },
      { label: "Webhooks", href: "/download/docs" },
    ],
  },
  {
    icon: <Plug size={18} />,
    title: "Integrations",
    description: "Connect MyOrtho with scanners, practice management systems, and print farms.",
    links: [
      { label: "3Shape TRIOS integration", href: "/download/docs" },
      { label: "Align iTero integration", href: "/download/docs" },
      { label: "Formlabs printer setup", href: "/download/docs" },
      { label: "Stratasys PolyJet setup", href: "/download/docs" },
      { label: "PMS connectors (Eaglesoft, Dentrix)", href: "/download/docs" },
    ],
  },
  {
    icon: <Shield size={18} />,
    title: "Security & Compliance",
    description: "HIPAA, GDPR, and security configuration for clinical environments.",
    links: [
      { label: "HIPAA compliance guide", href: "/download/docs" },
      { label: "Data residency options", href: "/download/docs" },
      { label: "Audit log reference", href: "/download/docs" },
      { label: "Encryption and key management", href: "/download/docs" },
      { label: "Incident response procedures", href: "/download/docs" },
    ],
  },
  {
    icon: <Building2 size={18} />,
    title: "Enterprise Administration",
    description: "SSO setup, user provisioning, multi-location management, and more.",
    links: [
      { label: "SAML 2.0 / OIDC configuration", href: "/download/enterprise" },
      { label: "SCIM user provisioning", href: "/download/enterprise" },
      { label: "Role-based access control", href: "/download/docs" },
      { label: "Location and team management", href: "/download/docs" },
      { label: "Organization branding", href: "/download/docs" },
    ],
  },
  {
    icon: <Cpu size={18} />,
    title: "Desktop App",
    description: "macOS and Windows desktop app features, auto-update, and offline mode.",
    links: [
      { label: "macOS installation", href: "/download" },
      { label: "Windows installation", href: "/download" },
      { label: "Auto-update configuration", href: "/download/docs" },
      { label: "Offline mode setup", href: "/download/docs" },
      { label: "Signing & notarization (macOS)", href: "/download/docs" },
    ],
  },
  {
    icon: <Users size={18} />,
    title: "Team & Collaboration",
    description: "Real-time case collaboration, notifications, and presence indicators.",
    links: [
      { label: "Case sharing and permissions", href: "/download/docs" },
      { label: "Comments and annotations", href: "/download/docs" },
      { label: "Notification preferences", href: "/download/docs" },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      {/* Header */}
      <div className="mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-dl-border bg-dl-surface px-3 py-1 text-[11px] font-medium text-dl-muted mb-5">
          <FileText size={11} />
          Documentation
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-dl-text mb-3">
          Documentation
        </h1>
        <p className="text-dl-muted leading-relaxed max-w-xl">
          Everything you need to install, configure, and operate MyOrtho — from first
          install to enterprise-scale deployments.
        </p>
      </div>

      {/* Sections grid */}
      <div className="grid sm:grid-cols-2 gap-5">
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-dl-border bg-dl-surface p-5"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-dl-accent">{section.icon}</span>
              <h2 className="text-sm font-semibold text-dl-text">{section.title}</h2>
            </div>
            <p className="text-xs text-dl-muted mb-4 leading-relaxed">
              {section.description}
            </p>
            <ul className="flex flex-col gap-1.5">
              {section.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-dl-text hover:bg-dl-border/30 transition-colors group"
                  >
                    <span>{link.label}</span>
                    <ChevronRight
                      size={12}
                      className="text-dl-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="mt-10 rounded-xl border border-dl-border bg-dl-surface/50 p-5 text-xs text-dl-muted leading-relaxed">
        <strong className="text-dl-text">Full documentation is coming soon.</strong>{" "}
        The links above will activate with the v2.0 stable release documentation. In the
        meantime, contact{" "}
        <Link href="/download/support" className="text-dl-accent hover:underline">
          support
        </Link>{" "}
        for technical guidance.
      </div>
    </div>
  );
}
