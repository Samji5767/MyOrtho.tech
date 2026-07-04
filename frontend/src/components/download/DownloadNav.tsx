"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/download", label: "Download" },
  { href: "/download/release-notes", label: "Release Notes" },
  { href: "/download/system-requirements", label: "System Requirements" },
  { href: "/download/enterprise", label: "Enterprise" },
  { href: "/download/docs", label: "Documentation" },
  { href: "/download/support", label: "Support" },
];

export function DownloadNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-dl-border bg-dl-bg/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex h-14 items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/download" className="flex items-center gap-2.5 shrink-0">
            <div className="h-7 w-7 rounded-lg bg-dl-accent flex items-center justify-center shadow-[0_0_12px_rgba(37,99,235,0.35)]">
              <span className="text-white text-xs font-black">M</span>
            </div>
            <span className="font-semibold text-sm text-dl-text">MyOrtho</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={[
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  pathname === l.href
                    ? "text-dl-text bg-dl-surface"
                    : "text-dl-muted hover:text-dl-text hover:bg-dl-surface/60",
                ].join(" ")}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/download"
              className="hidden sm:flex items-center gap-1.5 rounded-lg bg-dl-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-dl-accent-hover transition-colors"
            >
              <Download size={14} />
              Download
            </Link>
            <button
              type="button"
              className="lg:hidden p-1.5 rounded-lg text-dl-muted hover:text-dl-text hover:bg-dl-surface transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-dl-border bg-dl-bg py-3 px-6">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={[
                  "px-3 py-2 rounded-lg text-sm transition-colors",
                  pathname === l.href
                    ? "text-dl-text bg-dl-surface"
                    : "text-dl-muted hover:text-dl-text",
                ].join(" ")}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
