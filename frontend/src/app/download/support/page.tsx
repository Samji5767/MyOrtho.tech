import type { Metadata } from "next";
import Link from "next/link";
import {
  MessageCircle,
  Mail,
  BookOpen,
  AlertCircle,
  Clock,
  ChevronRight,
  Building2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with MyOrtho — documentation, community, and direct support channels.",
};

const CHANNELS = [
  {
    icon: <BookOpen size={20} />,
    title: "Documentation",
    description: "Detailed guides for installation, clinical workflows, API reference, and enterprise setup.",
    cta: "Browse docs",
    href: "/download/docs",
    badge: null,
  },
  {
    icon: <MessageCircle size={20} />,
    title: "Community",
    description: "Join other clinicians and developers in the MyOrtho community forum. Ask questions, share tips.",
    cta: "Open community",
    href: "/download/support",
    badge: "Coming Soon",
  },
  {
    icon: <Mail size={20} />,
    title: "Email Support",
    description: "Direct email support for all plan types. Priority queue for Enterprise accounts.",
    cta: "support@myortho.tech",
    href: "mailto:support@myortho.tech",
    badge: null,
  },
  {
    icon: <Building2 size={20} />,
    title: "Enterprise Sales",
    description: "Talk to our enterprise team about volume licensing, SSO setup, and custom deployments.",
    cta: "Contact sales",
    href: "mailto:enterprise@myortho.tech",
    badge: null,
  },
];

const SLA = [
  { tier: "Free", p1: "5 business days", p2: "—", p3: "—" },
  { tier: "Clinic", p1: "2 business days", p2: "1 business day", p3: "—" },
  { tier: "Enterprise", p1: "4 hours", p2: "1 business day", p3: "2 business days" },
];

const FAQ = [
  {
    q: "How do I install MyOrtho on macOS?",
    a: "Download the .dmg from the Download Center. Open it, drag MyOrtho.app to your Applications folder, and launch it. macOS will prompt you to approve the app on first launch — this is expected.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You have 30 days after cancellation to export all your patient data in FHIR R4 JSON or STL format. After 30 days, data is deleted from our servers in accordance with our data retention policy.",
  },
  {
    q: "Is MyOrtho HIPAA compliant?",
    a: "Yes. MyOrtho is designed for HIPAA-covered entities. We sign BAAs for all paid plans. All PHI is encrypted at rest (AES-256) and in transit (TLS 1.3).",
  },
  {
    q: "Can I use MyOrtho offline?",
    a: "The desktop app (macOS/Windows) supports offline mode for viewing and annotating existing cases. Creating new scans or running AI segmentation requires an internet connection.",
  },
  {
    q: "How does auto-update work?",
    a: "The desktop app checks for updates on launch and every 4 hours. Enterprise admins can configure a managed update channel and defer updates by up to 30 days.",
  },
  {
    q: "Do you offer volume discounts?",
    a: "Yes. Contact our enterprise team at enterprise@myortho.tech for pricing for groups of 5 or more clinical users.",
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {/* Header */}
      <div className="mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-dl-border bg-dl-surface px-3 py-1 text-[11px] font-medium text-dl-muted mb-5">
          Support
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-dl-text mb-3">
          How can we help?
        </h1>
        <p className="text-dl-muted leading-relaxed max-w-xl">
          Browse documentation, search the community, or reach our team directly.
        </p>
      </div>

      {/* Channels */}
      <div className="grid sm:grid-cols-2 gap-4 mb-16">
        {CHANNELS.map((channel) => (
          <div
            key={channel.title}
            className="rounded-xl border border-dl-border bg-dl-surface p-5 flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-dl-accent">{channel.icon}</span>
              {channel.badge && (
                <span className="rounded-full bg-dl-border/60 px-2 py-0.5 text-[10px] font-medium text-dl-muted">
                  {channel.badge}
                </span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-dl-text mb-1">{channel.title}</h2>
            <p className="text-xs text-dl-muted leading-relaxed flex-1 mb-4">
              {channel.description}
            </p>
            <Link
              href={channel.href}
              className="inline-flex items-center gap-1 text-xs font-medium text-dl-accent hover:underline"
            >
              {channel.cta}
              <ChevronRight size={12} />
            </Link>
          </div>
        ))}
      </div>

      {/* SLA table */}
      <div className="mb-16">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-dl-muted mb-5 flex items-center gap-1.5">
          <Clock size={12} />
          Response Time SLA
        </h2>
        <div className="rounded-xl border border-dl-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dl-border bg-dl-surface">
                  <th className="px-4 py-3 text-left font-medium text-dl-muted">Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-dl-muted">P1 — Critical</th>
                  <th className="px-4 py-3 text-left font-medium text-dl-muted">P2 — High</th>
                  <th className="px-4 py-3 text-left font-medium text-dl-muted">P3 — Normal</th>
                </tr>
              </thead>
              <tbody>
                {SLA.map((row, i) => (
                  <tr
                    key={row.tier}
                    className={[
                      "border-b border-dl-border last:border-0",
                      i % 2 === 1 ? "bg-dl-surface/40" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3 font-medium text-dl-text">{row.tier}</td>
                    <td className="px-4 py-3 text-dl-muted">{row.p1}</td>
                    <td className="px-4 py-3 text-dl-muted">{row.p2}</td>
                    <td className="px-4 py-3 text-dl-muted">{row.p3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-2 text-xs text-dl-muted">
          SLA targets apply to email support during business hours (Mon–Fri, 9am–6pm ET).
          Enterprise SLAs are contractual.
        </p>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-dl-muted mb-5 flex items-center gap-1.5">
          <AlertCircle size={12} />
          Frequently Asked Questions
        </h2>
        <div className="flex flex-col gap-px rounded-xl border border-dl-border overflow-hidden">
          {FAQ.map((item) => (
            <div
              key={item.q}
              className="bg-dl-surface px-5 py-4 border-b border-dl-border last:border-0"
            >
              <p className="text-sm font-medium text-dl-text mb-1.5">{item.q}</p>
              <p className="text-xs text-dl-muted leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
