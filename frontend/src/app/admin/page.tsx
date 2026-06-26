"use client";

import dynamic from "next/dynamic";
import { Loader2, ShieldAlert } from "lucide-react";

const EnterpriseAdmin = dynamic(
  () => import("@/components/EnterpriseAdmin").then(m => m.EnterpriseAdmin),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-[color:var(--muted-foreground)]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading admin panel…</span>
      </div>
    ),
  },
);

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
        <ShieldAlert size={15} className="shrink-0" />
        <span>
          <strong>Super Admin only.</strong> This panel is restricted to <code className="rounded bg-rose-100/80 px-1 py-0.5 text-xs dark:bg-rose-900/30">super_admin</code> accounts.
          Unauthorized access attempts are logged.
        </span>
      </div>
      <EnterpriseAdmin />
    </div>
  );
}
