/**
 * Route-level loading skeleton — shown during client-side navigation transitions.
 * CSS-only skeleton rows with no JS required; appears instantly.
 */
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header skeleton — mirrors InboxList header structure */}
      <div className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur-xl">
        <div style={{ height: "env(safe-area-inset-top, 0px)" }} />

        {/* Title row */}
        <div className="flex h-[52px] items-center gap-3 px-4">
          <span className="h-9 w-9 shrink-0 animate-skeleton rounded-2xl" />
          <span className="h-7 w-40 animate-skeleton rounded-xl" />
          <span className="ml-auto h-9 w-9 animate-skeleton rounded-full" />
        </div>

        {/* Search bar */}
        <div className="px-4 pb-2">
          <div className="h-11 animate-skeleton rounded-full" />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 px-4 pb-3">
          {[52, 64, 72, 110, 52].map((w, i) => (
            <span
              key={i}
              className="h-8 shrink-0 animate-skeleton rounded-full"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>

      {/* Thread row skeletons */}
      <div className="flex-1 divide-y divide-[color:var(--border)]">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            {/* Avatar */}
            <span className="h-12 w-12 shrink-0 animate-skeleton rounded-full" />
            {/* Text */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <span className="h-4 animate-skeleton rounded" style={{ width: `${100 + (i % 3) * 28}px` }} />
                <span className="h-3 w-10 shrink-0 animate-skeleton rounded" />
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-16 animate-skeleton rounded" />
                <span className="h-3 animate-skeleton rounded" style={{ width: `${120 + (i % 4) * 20}px` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
