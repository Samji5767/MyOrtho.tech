import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card text-4xl">
        🔍
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="max-w-sm text-sm text-secondary">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Go to Home
      </Link>
    </main>
  );
}
