"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Building2,
  FileBarChart,
  MapPin,
  Plug,
  Settings2,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge } from "@/components/DesignSystem";

const ADMIN_ROLES = ["admin", "super_admin"];

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
  {
    icon: <MapPin size={18} />,
    title: "Clinic Locations",
    description: "Manage practice locations, working hours, and chair allocation.",
    href: "/admin/locations",
  },
  {
    icon: <Plug size={18} />,
    title: "Integration Hub",
    description: "Connect scanners, printers, and practice management systems.",
    href: "/admin/integrations",
  },
  {
    icon: <FileBarChart size={18} />,
    title: "Reports",
    description: "Practice reports, financial summaries, and audit exports.",
    href: "/admin/reports",
  },
  {
    icon: <Shield size={18} />,
    title: "Audit Log",
    description: "View audit trail and PHI access logs.",
    href: "/admin/audit",
  },
];

interface PlatformStats {
  users: { total: number; active: number };
  orgs: { total: number };
  cases: { total: number };
  credits: { total: number };
}

function AdminSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 animate-pulse">
      <div className="mb-6 h-12 rounded-xl bg-[color:var(--border)] opacity-50" />
      <div className="mb-6 h-7 w-40 rounded-lg bg-[color:var(--border)] opacity-50" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] opacity-60" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] opacity-60" />
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { status, user } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error(`Stats unavailable (${res.status})`);
      setStats(await res.json() as PlatformStats);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "Could not load stats");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !user || !ADMIN_ROLES.includes(user.role)) {
      router.replace("/dashboard");
      return;
    }
    // Only super_admin can see global stats
    if (user.role === "super_admin") {
      void fetchStats();
    }
  }, [status, user, router, fetchStats]);

  if (status === "loading") return <AdminSkeleton />;
  if (!user || !ADMIN_ROLES.includes(user.role)) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Back navigation */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:opacity-80 transition-opacity"
          aria-label="Back to settings"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">Administration</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Manage users, organizations, and platform settings
          </p>
        </div>
      </div>

      {/* Access notice */}
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
        <ShieldAlert size={15} className="shrink-0" />
        <span>
          <strong>Admin only.</strong> This panel is restricted to{" "}
          <code className="rounded bg-rose-100/80 px-1 py-0.5 text-xs dark:bg-rose-900/30">admin</code>{" "}
          and{" "}
          <code className="rounded bg-rose-100/80 px-1 py-0.5 text-xs dark:bg-rose-900/30">super_admin</code>{" "}
          accounts. Unauthorized access attempts are logged.
        </span>
      </div>

      {/* Platform stats — super_admin only */}
      {user.role === "super_admin" && (
        <div className="mb-6">
          {statsError ? (
            <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-700 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-400">
              {statsError}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total users", value: stats?.users?.total, sub: `${stats?.users?.active ?? "—"} active` },
                { label: "Organizations", value: stats?.orgs?.total, sub: null },
                { label: "Cases", value: stats?.cases?.total, sub: null },
                { label: "Credits", value: stats?.credits?.total?.toLocaleString(), sub: "across all orgs" },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
                >
                  {loadingStats ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-6 w-12 rounded bg-[color:var(--border)] opacity-50" />
                      <div className="h-3 w-20 rounded bg-[color:var(--border)] opacity-40" />
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-[color:var(--foreground)]">
                        {tile.value ?? "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{tile.label}</p>
                      {tile.sub && (
                        <p className="mt-0.5 text-[11px] text-[color:var(--muted-foreground)]">{tile.sub}</p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session user info */}
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--foreground)] truncate">{user.name}</p>
          <p className="text-xs text-[color:var(--muted-foreground)] truncate">{user.email}</p>
        </div>
        <StatusBadge tone="danger">{user.role.replace("_", " ")}</StatusBadge>
      </div>

      {/* Navigation sections */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_SECTIONS.map((section) => (
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
