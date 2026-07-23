"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { login } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import BrandMark from "@/components/BrandMark";

export default function LoginPage() {
  const router = useRouter();
  const { refresh, status } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Redirect away if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email.trim(), password);

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      passwordRef.current?.focus();
      return;
    }

    // Refresh auth context so all downstream components see the new user
    await refresh();

    // Redirect to the originally requested route, or the dashboard
    let destination = "/dashboard";
    try {
      const saved = sessionStorage.getItem("mo_redirect");
      if (saved && saved !== "/login" && saved !== "/") {
        destination = saved;
        sessionStorage.removeItem("mo_redirect");
      }
    } catch {}

    // If email is not yet verified, require verification before anything else
    if (!result.user.isEmailVerified) {
      destination = "/verify-email";
    } else if (!result.user.isOnboarded) {
      // If the user hasn't completed onboarding, send them there
      destination = "/onboarding";
    }

    router.replace(destination);
  }

  // While checking auth status or redirecting, show a spinner to avoid flash
  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[color:var(--background)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="animate-page-enter flex min-h-dvh flex-col items-center justify-center bg-[color:var(--background)] px-4 pb-8 pt-[env(safe-area-inset-top,0px)]">
      {/* Logo + tagline */}
      <div className="mb-10 flex flex-col items-center">
        <BrandMark size="lg" variant="full" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-8 shadow-[var(--shadow-md)]">
        <h1 className="mb-1 text-base font-semibold text-[color:var(--foreground)]">
          Sign in to your account
        </h1>
        <p className="mb-6 text-sm text-[color:var(--muted-foreground)]">
          Enter your credentials to access the platform.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200/60 bg-rose-50/60 px-3.5 py-2.5 dark:border-rose-500/20 dark:bg-rose-500/10"
          >
            <Lock size={13} className="mt-0.5 shrink-0 text-rose-500" />
            <p className="text-xs font-medium text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-[color:var(--foreground)]"
            >
              Email address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
              />
              <input
                id="email"
                type="email"
                autoComplete="username email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="you@clinic.com"
                className="h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] pl-10 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition-colors focus:border-[color:var(--primary)] focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-[color:var(--foreground)]"
              >
                Password <span className="text-rose-500">*</span>
              </label>
              <Link href="/forgot-password"
                    className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
              />
              <input
                id="password"
                ref={passwordRef}
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] pl-10 pr-11 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition-colors focus:border-[color:var(--primary)] focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="relative h-11 w-full overflow-hidden rounded-xl bg-[color:var(--primary)] text-sm font-semibold text-[color:var(--primary-foreground)] transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[color:var(--muted-foreground)]">
          New to MyOrtho?{" "}
          <Link
            href="/signup"
            className="font-medium text-[color:var(--primary)] hover:underline"
          >
            Start your free trial
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-[10px] text-[color:var(--muted-foreground)]">
        MyOrtho Clinical OS · Protected workspace
        <br />
        Unauthorized access is prohibited.
      </p>
    </div>
  );
}
