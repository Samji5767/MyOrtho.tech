export default function CasesLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
      {/* Header skeleton */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-8 w-36 animate-skeleton rounded-xl" />
        <div className="h-9 w-28 animate-skeleton rounded-xl" />
      </div>
      {/* Filter chips */}
      <div className="mb-4 flex gap-2">
        {[64, 96, 80, 72, 88].map((w, i) => (
          <span key={i} className="h-8 animate-skeleton rounded-full" style={{ width: w }} />
        ))}
      </div>
      {/* Case card skeletons */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-skeleton rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
