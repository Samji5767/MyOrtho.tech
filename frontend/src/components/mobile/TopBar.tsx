"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Search, Stethoscope } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/auth";
import NotificationBell from "@/components/NotificationBell";

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface TopBarProps {
  onOpenSearch: () => void;
}

export function TopBar({ onOpenSearch }: TopBarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const initials = user ? userInitials(user.name) : "—";

  return (
    <header
      className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color-mix(in_srgb,var(--background)_84%,transparent)] backdrop-blur-xl lg:hidden"
      style={{ paddingTop: "var(--sa-top)" }}
    >
      <div className="mx-auto flex h-[var(--top-bar-height)] max-w-screen-sm items-center gap-3 px-4">
        <Link href="/" aria-label="MyOrtho Home" className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-2xl bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--clinical-highlight)] text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)]"
          >
            <Stethoscope size={15} strokeWidth={2.4} />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
              MY ORTHO
            </span>
            <span className="mt-0.5 truncate text-sm font-semibold tracking-tight text-[color:var(--foreground)]">
              {user ? roleLabel(user.role) : "Clinical OS"}
            </span>
          </span>
        </Link>

        <div className="flex-1" />

        <button
          type="button"
          aria-label="Search and quick commands"
          onClick={onOpenSearch}
          className="focus-ring touch-target flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] shadow-[var(--shadow-sm)] transition-transform duration-200 active:scale-95"
        >
          <Search size={16} strokeWidth={2} />
        </button>

        <NotificationBell />

        {/* User avatar → settings */}
        <Link
          href="/settings"
          aria-label={user ? `${user.name} — settings` : "Profile and settings"}
          title={user ? `${user.name} · ${roleLabel(user.role)}` : "Profile"}
          className="focus-ring touch-target grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--clinical-highlight)] text-[11px] font-semibold tracking-tight text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] transition-transform duration-200 active:scale-95"
        >
          {initials}
        </Link>

        {/* Sign out */}
        <button
          type="button"
          aria-label="Sign out"
          onClick={handleLogout}
          className="focus-ring touch-target flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] shadow-[var(--shadow-sm)] transition-all duration-200 hover:border-rose-300 hover:text-rose-500 active:scale-95 dark:hover:border-rose-700"
        >
          <LogOut size={15} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
