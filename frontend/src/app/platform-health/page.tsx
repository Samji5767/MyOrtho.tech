"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const ADMIN_ROLES = ["admin", "super_admin"];

const PlatformHealthPanel = dynamic(
  () => import("@/components/PlatformHealthPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 rounded bg-[color:var(--border)] opacity-50" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-[color:var(--border)] opacity-60" />
          ))}
        </div>
        <div className="h-32 rounded-xl border border-[color:var(--border)] opacity-50" />
      </div>
    ),
  },
);

function PageSkeleton() {
  return (
    <section className="mx-auto max-w-4xl pb-20 px-4 sm:px-5 pt-4 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-full bg-[color:var(--border)] opacity-50 animate-pulse" />
        <div className="space-y-1.5 animate-pulse">
          <div className="h-5 w-36 rounded bg-[color:var(--border)] opacity-50" />
          <div className="h-3 w-52 rounded bg-[color:var(--border)] opacity-40" />
        </div>
      </div>
      <div className="border border-[color:var(--border)] rounded-xl bg-[color:var(--card)] p-5 sm:p-6 space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-[color:var(--border)] opacity-50" />
          ))}
        </div>
        <div className="h-28 rounded-xl bg-[color:var(--border)] opacity-40" />
        <div className="h-40 rounded-xl bg-[color:var(--border)] opacity-30" />
      </div>
    </section>
  );
}

export default function PlatformHealthPage() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !user || !ADMIN_ROLES.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [status, user, router]);

  if (status === "loading") return <PageSkeleton />;
  if (!user || !ADMIN_ROLES.includes(user.role)) return null;

  return (
    <section className="mx-auto max-w-4xl pb-20 px-4 sm:px-5 pt-4 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/admin"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:opacity-80 transition-opacity"
          aria-label="Back to admin"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">Platform Health</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            System status and infrastructure metrics
          </p>
        </div>
      </div>

      <div className="border border-[color:var(--border)] rounded-xl bg-[color:var(--card)] p-5 sm:p-6">
        <PlatformHealthPanel />
      </div>
    </section>
  );
}
