"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-4 px-8 py-12 text-center ${className}`}
      role="alert"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-[color:var(--danger)]">
        <AlertCircle size={22} strokeWidth={1.8} />
      </span>
      <div className="max-w-[280px] space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-[var(--shadow-sm)] transition-transform active:scale-95 hover:border-[color:var(--primary)] hover:text-primary"
        >
          <RefreshCw size={13} />
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorState;
