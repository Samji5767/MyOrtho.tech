"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Box,
  Download,
  FolderKanban,
  Home,
  Layers3,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

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
  { href: '/',         label: 'Overview', icon: Home         },
  { href: '/cases',    label: 'Cases',    icon: FolderKanban },
  { href: '/patients', label: 'Patients', icon: Users        },
  { href: '/studio',   label: 'Studio',   icon: Box          },
  { href: '/settings', label: 'Settings', icon: Settings     },
];

function isActive(pathname: string, tab: TabItem): boolean {
  if (tab.href === '/') return pathname === '/';
  return pathname.startsWith(tab.href);
}

// ─── Mobile bottom tab bar (5 tabs, liquid glass) ────────────────────────────

export function TabBar() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Primary navigation"
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
};

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Overview', icon: Home },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { href: '/cases',          label: 'Cases',          icon: FolderKanban },
      { href: '/patients',       label: 'Patients',       icon: Users        },
      { href: '/treatment-plan', label: 'Treatment Plan', icon: Layers3      },
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
      { href: '/cases', label: 'Export & Downloads', icon: Download },
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
];

export function SidebarNav() {
  const pathname = usePathname() ?? '/';

  return (
    <aside className="lgt-sidebar" aria-label="Primary navigation">
      <div className="lgt-sidebar-glass" aria-hidden />

      <div
        className="flex h-full flex-col overflow-y-auto px-3"
        style={{ paddingTop: 'calc(var(--sa-top, 0px) + 1rem)', paddingBottom: '1rem' }}
      >
        {/* Logo mark */}
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <Image
            src="/app-icon.png"
            alt="MyOrtho"
            width={32}
            height={32}
            style={{ borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="flex flex-col leading-none">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">My Ortho</span>
            <span className="mt-0.5 text-sm font-semibold text-[color:var(--foreground)]">Dashboard</span>
          </span>
        </div>

        {/* Navigation groups */}
        <div className="flex flex-col gap-4">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
      </div>
    </aside>
  );
}
