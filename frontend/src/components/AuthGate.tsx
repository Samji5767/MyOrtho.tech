"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// These paths are accessible without authentication
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/trust",
  "/download",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];
// Authenticated paths reachable before email verification is confirmed.
// Deliberately excludes /onboarding — email must be verified before onboarding.
const UNVERIFIED_ALLOWED = ["/verify-email"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname === p + "/"
  );
}

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    if (status === "loading") return;
    if (isPublicPath(pathname)) return;

    if (status === "unauthenticated") {
      // Save the intended destination so login can redirect back
      try {
        sessionStorage.setItem("mo_redirect", pathname);
      } catch {}
      router.replace("/login");
      return;
    }

    if (status === "authenticated" && user) {
      // Email not verified — send to verify-email page (except onboarding)
      if (!user.isEmailVerified && !UNVERIFIED_ALLOWED.some((p) => pathname.startsWith(p))) {
        router.replace("/verify-email");
        return;
      }
      // Onboarding not complete — send to onboarding (email must be verified first)
      if (user.isEmailVerified && !user.isOnboarded && pathname !== "/onboarding") {
        router.replace("/onboarding");
        return;
      }
    }
  }, [status, user, pathname, router]);

  // On public paths: always render
  if (isPublicPath(pathname)) return <>{children}</>;

  // Loading: show nothing (launch shell is already visible from layout)
  if (status === "loading") return <AuthLoadingScreen />;

  // Unauthenticated: render nothing (redirect is in-flight)
  if (status === "unauthenticated") return <AuthLoadingScreen />;

  return <>{children}</>;
}

function AuthLoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center gap-4"
      style={{ background: "var(--background)" }}
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--primary)]" />
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        Verifying credentials…
      </p>
    </div>
  );
}
