"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import NotificationBell from "@/components/NotificationBell";
import { APP_VERSION } from "@/lib/version";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/auth";
import {
  BarChart3,
  Box,
  ClipboardCheck,
  Download,
  FolderKanban,
  Home,
  Layers3,
  LogOut,
  MapPin,
  Plug,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Primary navigation — 5 WhatsApp-style sections ─────────────────────────
// Inbox (/) is the landing. Studio (/studio) groups all 3D tooling.
// All previous 9-tab destinations are reachable within each section.

type TabItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

const TABS: TabItem[] = [
  { href: '/dashboard', label: 'Overview', icon: Home         },
  { href: '/cases',     label: 'Cases',    icon: FolderKanban },
  { href: '/patients',  label: 'Patients', icon: Users        },
  { href: '/studio',    label: 'Studio',   icon: Box          },
  { href: '/settings',  label: 'Settings', icon: Settings     },
];

// A route is "active" when it is an exact match (for single-word routes that
// could be a prefix of something else) or a prefix match for sub-routes.
function isActive(pathname: string, tab: TabItem): boolean {
  return pathname === tab.href || pathname.startsWith(tab.href + '/');
}

// ─── Mobile bottom tab bar (5 tabs, liquid glass) ────────────────────────────

export function TabBar() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Main navigation"
      className="lgt-bar fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{ paddingBottom: 'var(--sa-bottom)' }}
    >
      <div className="lgt-glass" aria-hidden />

      <ul
        className="mx-auto flex h-[var(--tab-bar-height)] max-w-screen-sm items-stretch justify-around px-1"
        role="list"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(pathname, tab);

          return (
            <li key={tab.href} className="flex flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'lgt-tab-item w-full',
                  'focus-ring',
                  active ? 'lgt-tab-active' : 'lgt-tab-idle',
                ].join(' ')}
              >
                <span className="lgt-tab-pill" aria-hidden />
                <span
                  className="lgt-tab-indicator"
                  style={{ width: active ? 22 : 0, opacity: active ? 1 : 0 }}
                  aria-hidden
                />
                <span className="relative">
                  <Icon size={23} strokeWidth={active ? 2.3 : 1.7} aria-hidden />
                  {!!tab.badge && tab.badge > 0 && !active && (
                    <span
                      aria-hidden
                      className="animate-badge-pop absolute -right-2 -top-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[color:var(--danger)] px-0.5 text-[8px] font-black leading-none text-white"
                    >
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </span>
                <span className={['lgt-tab-label', active ? 'font-semibold' : 'font-medium'].join(' ')}>
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── iPad / desktop sidebar — 5 grouped sections ─────────────────────────────

type SidebarGroup = {
  label: string;
  items: TabItem[];
  adminOnly?: boolean;
};

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Overview', icon: Home },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { href: '/cases',           label: 'Cases',          icon: FolderKanban   },
      { href: '/cases/approvals', label: 'Approval Queue', icon: ClipboardCheck },
      { href: '/patients',        label: 'Patients',       icon: Users          },
      { href: '/treatment-plan',  label: 'Treatment Plan', icon: Layers3        },
    ],
  },
  {
    label: 'Studio',
    items: [
      { href: '/studio', label: 'CAD Design Studio', icon: Box },
    ],
  },
  {
    label: 'Export',
    items: [
      { href: '/export', label: 'Export & Downloads', icon: Download },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/admin',              label: 'Admin Panel',  icon: ShieldCheck },
      { href: '/admin/locations',    label: 'Locations',    icon: MapPin      },
      { href: '/admin/integrations', label: 'Integrations', icon: Plug        },
    ],
    adminOnly: true,
  },
];

export function SidebarNav() {
  const pathname = usePathname() ?? '/';
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const initials = user ? userInitials(user.name) : '—';

  return (
    <aside className="lgt-sidebar" aria-label="Main navigation">
      <div className="lgt-sidebar-glass" aria-hidden />

      <div
        className="flex h-full flex-col overflow-y-auto px-3"
        style={{ paddingTop: 'calc(var(--sa-top, 0px) + 1rem)', paddingBottom: '1rem' }}
      >
        {/* Logo mark */}
        <div className="mb-6 px-2">
          <BrandMark variant="compact" size="sm" />
        </div>

        {/* Navigation groups */}
        <div className="flex flex-col gap-4">
          {SIDEBAR_GROUPS.filter((g) =>
            !g.adminOnly || user?.role === "admin" || user?.role === "super_admin"
          ).map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'lgt-sidebar-item focus-ring',
                        active ? 'lgt-sidebar-active' : 'lgt-sidebar-idle',
                      ].join(' ')}
                    >
                      <span className="relative shrink-0">
                        <Icon size={17} strokeWidth={active ? 2.2 : 1.75} aria-hidden />
                        {!!item.badge && item.badge > 0 && !active && (
                          <span
                            aria-hidden
                            className="absolute -right-1.5 -top-1.5 flex h-[13px] min-w-[13px] items-center justify-center rounded-full bg-[color:var(--danger)] px-0.5 text-[8px] font-black leading-none text-white"
                          >
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── User section + logout ─────────────────────────────────────────── */}
        <div className="mt-auto pt-4 border-t border-[color:var(--border)]">
          <div className="flex items-center gap-2.5 px-2 py-2">
            {/* Avatar → settings */}
            <Link
              href="/settings"
              aria-label={user ? `${user.name} — settings` : 'Profile and settings'}
              title={user ? `${user.name} · ${roleLabel(user.role)}` : 'Profile'}
              className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--clinical-highlight)] text-[10px] font-bold tracking-tight text-[color:var(--primary-foreground)] transition-transform active:scale-95"
            >
              {initials}
            </Link>

            {/* Name + role */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold leading-tight text-[color:var(--foreground)]">
                {user?.name ?? 'Loading…'}
              </p>
              <p className="truncate text-[10px] leading-tight text-[color:var(--muted-foreground)]">
                {user ? roleLabel(user.role) : ''}
              </p>
            </div>

            {/* Notifications */}
            <NotificationBell />

            {/* Sign out */}
            <button
              type="button"
              aria-label="Sign out"
              onClick={() => void handleLogout()}
              className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[color:var(--muted-foreground)] transition-colors hover:bg-rose-500/10 hover:text-rose-500"
            >
              <LogOut size={13} strokeWidth={2} />
            </button>
          </div>

          {/* Version badge */}
          <p className="px-2 pt-1 text-[9px] text-[color:var(--muted-foreground)] select-none">
            v{APP_VERSION}
          </p>
        </div>
      </div>
    </aside>
  );
}
