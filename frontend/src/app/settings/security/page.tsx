"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, Info, Lock, Shield, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/auth";

// ─── Static security feature list ─────────────────────────────────────────────

const SECURITY_FEATURES = [
  {
    title: "HIPAA audit logging",
    desc: "All clinical actions — logins, data access, exports, and role changes — are written to an immutable audit trail.",
    status: "Active",
    tone: "success",
  },
  {
    title: "PHI export controls",
    desc: "Exporting patient records requires doctor-level approval. Bulk exports are restricted to super_admin.",
    status: "Enforced",
    tone: "success",
  },
  {
    title: "TLS 1.3 in transit",
    desc: "All API traffic is encrypted end-to-end. Cookies are Secure + HttpOnly; no bearer tokens are stored in localStorage.",
    status: "Active",
    tone: "success",
  },
  {
    title: "Role-based access control",
    desc: "Every API endpoint checks the authenticated user's role and organization context before responding.",
    status: "Active",
    tone: "success",
  },
  {
    title: "Multi-factor authentication (MFA)",
    desc: "MFA enrollment is managed by your organization administrator via the Admin Portal. Contact your admin to enable TOTP or hardware key MFA.",
    status: "Org-managed",
    tone: "info",
  },
  {
    title: "Single sign-on (SSO)",
    desc: "SAML 2.0 and OIDC SSO are configured at the organization level. Your admin can link your IdP in the Enterprise settings.",
    status: "Org-managed",
    tone: "info",
  },
] as const;

const toneCls = {
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  info:    "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
} as const;

export default function SecurityPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] transition-opacity hover:opacity-80"
          aria-label="Back to settings"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">Security</h1>
          <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
            Authentication, access control, and compliance.
          </p>
        </div>
      </div>

      {/* Session summary */}
      {user && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3.5">
          <Shield size={16} className="shrink-0 text-[color:var(--primary)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">Active session</p>
            <p className="text-xs text-[color:var(--muted-foreground)] truncate">
              {user.email} · {roleLabel(user.role)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Authenticated
          </span>
        </div>
      )}

      {/* Security features */}
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden mb-5">
        <div className="border-b border-[color:var(--border)] px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
            Platform security
          </p>
        </div>
        <div className="divide-y divide-[color:var(--border)]">
          {SECURITY_FEATURES.map(f => (
            <div key={f.title} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="flex items-start gap-3 min-w-0">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[color:var(--primary)]" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{f.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--muted-foreground)]">{f.desc}</p>
                </div>
              </div>
              <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${toneCls[f.tone]}`}>
                {f.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Admin note */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3.5 text-sm text-amber-700 dark:border-amber-600/30 dark:bg-amber-900/10 dark:text-amber-400">
        <Info size={15} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">MFA and SSO require admin configuration</p>
          <p className="mt-0.5 text-xs leading-relaxed">
            Multi-factor authentication and single sign-on are provisioned per organization.
            Ask your organization administrator to configure these in the Admin Portal.
          </p>
        </div>
      </div>

      {/* Links */}
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
        <div className="border-b border-[color:var(--border)] px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
            Resources
          </p>
        </div>
        <div className="divide-y divide-[color:var(--border)]">
          <Link
            href="/trust"
            className="flex items-center gap-3 px-5 py-4 text-sm text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--border)]/20"
          >
            <Lock size={15} className="shrink-0 text-[color:var(--primary)]" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Trust Center</p>
              <p className="text-xs text-[color:var(--muted-foreground)]">PHI policy, compliance, and security documentation</p>
            </div>
            <ExternalLink size={13} className="shrink-0 text-[color:var(--muted-foreground)]" />
          </Link>
          <Link
            href="/admin/audit"
            className="flex items-center gap-3 px-5 py-4 text-sm text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--border)]/20"
          >
            <CheckCircle2 size={15} className="shrink-0 text-[color:var(--primary)]" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Audit trail</p>
              <p className="text-xs text-[color:var(--muted-foreground)]">Review all security events and access logs</p>
            </div>
            <ExternalLink size={13} className="shrink-0 text-[color:var(--muted-foreground)]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
