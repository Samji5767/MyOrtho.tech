"use client";

import Link from "next/link";
import { BellRing, Search, Stethoscope } from "lucide-react";

const DOCTOR_INITIALS = "DF";

interface TopBarProps {
  onOpenSearch: () => void;
}

export function TopBar({ onOpenSearch }: TopBarProps) {
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
              Clinic dashboard
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

        <button
          type="button"
          aria-label="Notifications"
          className="focus-ring touch-target relative flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] shadow-[var(--shadow-sm)] transition-transform duration-200 active:scale-95"
        >
          <BellRing size={16} strokeWidth={2} />
        </button>

        <Link
          href="/settings"
          aria-label="Profile and settings"
          className="focus-ring touch-target grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--clinical-highlight)] text-[11px] font-semibold tracking-tight text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] transition-transform duration-200 active:scale-95"
        >
          {DOCTOR_INITIALS}
        </Link>
      </div>
    </header>
  );
}
