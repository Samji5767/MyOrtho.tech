"use client";

import React from "react";

interface LoadingSkeletonProps {
  className?: string;
  rows?: number;
  type?: "text" | "card" | "table";
}

function SkeletonBar({ width = "100%", height = "0.75rem" }: { width?: string; height?: string }) {
  return (
    <div
      className="animate-skeleton rounded-md"
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

function TextSkeleton({ rows }: { rows: number }) {
  const widths = ["100%", "88%", "94%", "72%", "82%", "90%", "66%", "78%"];
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBar
          key={i}
          width={widths[i % widths.length]}
          height="0.75rem"
        />
      ))}
    </div>
  );
}

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
        >
          <div className="flex items-center gap-3">
            <SkeletonBar width="2.5rem" height="2.5rem" />
            <div className="flex-1 space-y-2">
              <SkeletonBar width="55%" height="0.75rem" />
              <SkeletonBar width="80%" height="0.625rem" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <SkeletonBar width="100%" height="0.625rem" />
            <SkeletonBar width="76%" height="0.625rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-[var(--shadow-sm)]">
      {/* header */}
      <div className="flex gap-4 border-b border-border px-4 py-3">
        {[45, 25, 20].map((w, i) => (
          <SkeletonBar key={i} width={`${w}%`} height="0.625rem" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 border-b border-border px-4 py-3 last:border-0"
        >
          {[45, 25, 20].map((w, j) => (
            <SkeletonBar key={j} width={`${w}%`} height="0.625rem" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LoadingSkeleton({ className = "", rows = 3, type = "text" }: LoadingSkeletonProps) {
  return (
    <div className={`w-full ${className}`} role="status" aria-label="Loading">
      {type === "text" && <TextSkeleton rows={rows} />}
      {type === "card" && <CardSkeleton rows={rows} />}
      {type === "table" && <TableSkeleton rows={rows} />}
    </div>
  );
}

export default LoadingSkeleton;
