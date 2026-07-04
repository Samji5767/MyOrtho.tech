"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export default function CaseDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CaseDetailError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30">
        <AlertTriangle className="h-7 w-7 text-rose-500" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">Error loading case</h2>
        <p className="max-w-xs text-sm text-secondary">
          An unexpected error occurred while loading this case detail.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-secondary opacity-60">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Try again
        </button>
        <Link
          href="/cases"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-secondary hover:bg-slate-100 dark:hover:bg-slate-900"
        >
          <ArrowLeft size={14} /> All Cases
        </Link>
      </div>
    </div>
  );
}
