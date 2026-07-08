"use client";

import type { ReactNode } from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TopBar } from "./TopBar";
import { TabBar, SidebarNav } from "./TabBar";
import { AuthGate } from "@/components/AuthGate";
import { CommandPalette } from "@/components/CommandPalette";
import { isIOS, isNative } from "@/lib/capacitor/platform";
import { hapticLight } from "@/lib/capacitor/haptics";

// ─── Keyboard navigation shortcuts (H/P/W/S/C) ───────────────────────────────
// Only fire when no input, textarea, or select element has focus.

const NAV_SHORTCUTS: Record<string, string> = {
  h: "/dashboard",
  p: "/patients",
  w: "/studio",
  s: "/settings",
  c: "/cases",
};

function useGlobalNavShortcuts() {
  const router = useRouter();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (["input", "textarea", "select", "[contenteditable]"].includes(tag)) return;
      if (document.activeElement?.hasAttribute("contenteditable")) return;
      const target = NAV_SHORTCUTS[e.key.toLowerCase()];
      if (target) router.push(target);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);
}

// Public routes that bypass auth gate and suppress chrome (nav/top bar)
const PUBLIC_PATHS = ["/login", "/onboarding", "/", "/signup", "/trust", "/download"];
function isPublicPath(p: string) {
  return PUBLIC_PATHS.some(pub => p === pub || p === pub + "/" || p.startsWith(pub + "/"));
}

// ─── Pull-to-refresh ──────────────────────────────────────────────────────────

const PULL_THRESHOLD = 72;
const MAX_PULL_DISTANCE = 100;

function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Defer native check to after mount so server/client initial render both return null.
  const [isNativeIOS, setIsNativeIOS] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    setIsNativeIOS(isNative() && isIOS());
  }, []);

  useEffect(() => {
    if (!isNativeIOS) return;

    const getScrollTop = () => window.scrollY ?? document.documentElement.scrollTop ?? 0;

    const onTouchStart = (e: TouchEvent) => {
      if (getScrollTop() > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || getScrollTop() > 0) return;
      const dist = e.touches[0].clientY - startY.current;
      if (dist <= 0) return;
      e.preventDefault();
      setPullDistance(Math.min(dist * 0.55, MAX_PULL_DISTANCE));
    };

    const onTouchEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pullDistance >= PULL_THRESHOLD) {
        setRefreshing(true);
        setPullDistance(0);
        void hapticLight();
        await onRefresh();
        setRefreshing(false);
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isNativeIOS, pullDistance, onRefresh]);

  if (!isNativeIOS) return null;
  const opacity = Math.min(pullDistance / PULL_THRESHOLD, 1);
  if (pullDistance <= 4 && !refreshing) return null;

  return (
    <div
      className="fixed left-0 right-0 z-50 flex justify-center"
      style={{
        top: `calc(env(safe-area-inset-top, 0px) + 56px)`,
        transform: `translateY(${refreshing ? 16 : pullDistance * 0.5}px)`,
        opacity,
      }}
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur">
        <span
          className={refreshing ? "animate-spin" : ""}
          style={{ display: "inline-block", transform: refreshing ? undefined : `rotate(${pullDistance * 3}deg)` }}
        >
          ↻
        </span>
        {refreshing ? "Refreshing…" : pullDistance >= PULL_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
      </div>
    </div>
  );
}

// ─── Dynamic Island spacer ────────────────────────────────────────────────────
// HYDRATION SAFETY: isNative()/isIOS() access the Capacitor global which is
// absent during static HTML generation but present in the iOS WebView. Calling
// them during render causes server→null / client→div mismatch (#418/#423).
// Defer the check to after mount so the initial render always returns null.

function DynamicIslandSpacer() {
  const [isNativeIOS, setIsNativeIOS] = useState(false);
  useEffect(() => {
    setIsNativeIOS(isNative() && isIOS());
  }, []);
  if (!isNativeIOS) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100]"
      style={{ height: "env(safe-area-inset-top, 0px)" }}
    />
  );
}

// ─── iPad detection ───────────────────────────────────────────────────────────

function useIsIPad(): boolean {
  const [isIPad, setIsIPad] = useState(false);
  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent;
      setIsIPad(/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 0));
    };
    check();
  }, []);
  return isIPad;
}

// ─── App shell ────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const isIPad = useIsIPad();
  const pathname = usePathname() ?? '/';
  useGlobalNavShortcuts();

  const openSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }, []);

  const handleRefresh = useCallback(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    window.dispatchEvent(new CustomEvent("app-refresh"));
  }, []);

  useEffect(() => {
    const onTabChange = () => void hapticLight();
    window.addEventListener("tab-changed", onTabChange);
    return () => window.removeEventListener("tab-changed", onTabChange);
  }, []);

  const isPublic = isPublicPath(pathname);

  // ── Public routes (login / onboarding): render bare, no nav, no auth gate ──
  if (isPublic) {
    return (
      <>
        <DynamicIslandSpacer />
        <main id="main-content">{children}</main>
      </>
    );
  }

  // ── iPad layout: sidebar + content ──────────────────────────────────────────
  if (isIPad) {
    return (
      <div className="ipad-shell-root">
        <DynamicIslandSpacer />
        <SidebarNav />
        <div className="ipad-shell-content">
          <AuthGate>
            <main id="main-content">{children}</main>
          </AuthGate>
        </div>
        <CommandPalette />
      </div>
    );
  }

  // ── Mobile layout: top bar + scrollable content + bottom tab bar ─────────────
  // Inbox (/) owns its full-bleed header — TopBar is hidden there.
  const showTopBar = pathname !== '/';

  return (
    <div className="app-shell-root">
      <DynamicIslandSpacer />
      <PullToRefresh onRefresh={handleRefresh} />
      {showTopBar && <TopBar onOpenSearch={openSearch} />}
      <AuthGate>
        <main id="main-content" className="app-shell-content">{children}</main>
      </AuthGate>
      <TabBar />
      <CommandPalette />
    </div>
  );
}
