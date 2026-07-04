"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const PlatformHealthPanel = dynamic(
  () => import("@/components/PlatformHealthPanel"),
  { ssr: false, loading: () => <p className="text-sm text-[color:var(--muted-foreground)]">Loading platform health…</p> },
);

export default function PlatformHealthPage() {
  return (
    <section className="mx-auto max-w-4xl pb-20 px-4 sm:px-5 pt-4 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:opacity-80"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">Platform Health</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">System status and infrastructure metrics</p>
        </div>
      </div>

      <div className="border border-[color:var(--border)] rounded-xl bg-[color:var(--card)] p-5 sm:p-6">
        <PlatformHealthPanel token="" />
      </div>
    </section>
  );
}
