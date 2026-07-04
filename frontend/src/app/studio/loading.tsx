export default function StudioLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-10 w-10 animate-skeleton rounded-xl" />
        <div className="h-7 w-40 animate-skeleton rounded-xl" />
      </div>
      <div className="mb-4 flex gap-2 overflow-hidden">
        {[80, 100, 88, 96, 80, 72, 88].map((w, i) => (
          <span key={i} className="h-9 shrink-0 animate-skeleton rounded-lg" style={{ width: w }} />
        ))}
      </div>
      <div className="h-[480px] animate-skeleton rounded-2xl" />
    </div>
  );
}
