"use client";

import { ShieldAlert, Users, Building2, Settings2, Activity } from "lucide-react";
import Link from "next/link";

const ADMIN_SECTIONS = [
  {
    icon: <Users size={18} />,
    title: "Users & Roles",
    description: "Manage organization members, roles, and permissions.",
    href: "/admin/users",
  },
  {
    icon: <Building2 size={18} />,
    title: "Organization",
    description: "Organization profile, branding, and clinic locations.",
    href: "/admin/org",
  },
  {
    icon: <Settings2 size={18} />,
    title: "Feature Flags",
    description: "Enable or disable features for this organization.",
    href: "/settings",
  },
  {
    icon: <Activity size={18} />,
    title: "Platform Health",
    description: "System status, uptime, and infrastructure metrics.",
    href: "/platform-health",
  },
];

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
        <ShieldAlert size={15} className="shrink-0" />
        <span>
          <strong>Admin only.</strong> This panel is restricted to <code className="rounded bg-rose-100/80 px-1 py-0.5 text-xs dark:bg-rose-900/30">admin</code> and <code className="rounded bg-rose-100/80 px-1 py-0.5 text-xs dark:bg-rose-900/30">super_admin</code> accounts.
          Unauthorized access attempts are logged.
        </span>
      </div>

      <h1 className="mb-6 text-xl font-bold text-[color:var(--foreground)]">Administration</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {ADMIN_SECTIONS.map(section => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-start gap-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 transition-all hover:border-[color:var(--primary)]/40 hover:shadow-sm active:scale-[0.99]"
          >
            <span className="mt-0.5 shrink-0 text-[color:var(--primary)]">{section.icon}</span>
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{section.title}</p>
              <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{section.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
