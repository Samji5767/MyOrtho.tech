"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { register } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import BrandMark from "@/components/BrandMark";

export default function SignupPage() {
  const router = useRouter();
  const { refresh, status } = useAuth();

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [fullName, setFullName]     = useState("");
  const [clinicName, setClinicName] = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Redirect away if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const result = await register(
      email.trim(),
      password,
      fullName.trim(),
      clinicName.trim(),
    );

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    await refresh();
    router.replace("/onboarding");
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] pl-10 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition-colors focus:border-[color:var(--primary)] focus:outline-none disabled:opacity-50";

  // While checking auth status or redirecting, show a spinner to avoid flash
  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[color:var(--background)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[color:var(--background)] px-4 pb-8 pt-[env(safe-area-inset-top,0px)]">
      {/* Logo + tagline */}
      <div className="mb-10 flex flex-col items-center">
        <BrandMark size="lg" variant="full" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-8 shadow-[var(--shadow-md)]">
        <h1 className="mb-1 text-base font-semibold text-[color:var(--foreground)]">
          Create your clinic account
        </h1>
        <p className="mb-6 text-sm text-[color:var(--muted-foreground)]">
          14-day free trial · No credit card required
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
          {/* Full name */}
          <div className="space-y-1.5">
            <label
              htmlFor="fullName"
              className="text-xs font-semibold text-[color:var(--foreground)]"
            >
                Your full name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
              />
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                disabled={loading}
                placeholder="Dr. Jane Smith"
                className={inputClass}
              />
            </div>
          </div>

          {/* Clinic name */}
          <div className="space-y-1.5">
            <label
              htmlFor="clinicName"
              className="text-xs font-semibold text-[color:var(--foreground)]"
            >
              Clinic / practice name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building2
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
              />
              <input
                id="clinicName"
                type="text"
                autoComplete="organization"
                value={clinicName}
                onChange={e => setClinicName(e.target.value)}
                required
                disabled={loading}
                placeholder="Alameda Orthodontics"
                className={inputClass}
              />
            </div>
          </div>

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
                className={inputClass}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-[color:var(--foreground)]"
            >
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
              />
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
                placeholder="Min. 8 characters"
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
            <p className="text-[10px] text-[color:var(--muted-foreground)]">
              Minimum 8 characters required
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password || !fullName || !clinicName}
            className="relative h-11 w-full overflow-hidden rounded-xl bg-[color:var(--primary)] text-sm font-semibold text-[color:var(--primary-foreground)] transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating account…
              </span>
            ) : (
              "Start free trial"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[color:var(--muted-foreground)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[color:var(--primary)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>

      {/* Pricing note */}
      <div className="mt-6 w-full max-w-sm rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 px-5 py-4">
        <p className="text-center text-xs font-semibold text-[color:var(--foreground)]">
          Simple, transparent pricing
        </p>
        <div className="mt-3 flex gap-3">
          <div className="flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
              Monthly
            </p>
            <p className="mt-1 text-xl font-bold text-[color:var(--foreground)]">$54</p>
            <p className="text-[10px] text-[color:var(--muted-foreground)]">per month</p>
          </div>
          <div className="flex-1 rounded-xl border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/5 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--primary)]">
              Annual · Best value
            </p>
            <p className="mt-1 text-xl font-bold text-[color:var(--foreground)]">$499</p>
            <p className="text-[10px] text-[color:var(--muted-foreground)]">per year</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-[10px] text-[color:var(--muted-foreground)]">
        Powered by MyOrtho.tech · By signing up you agree to our Terms of Service
      </p>
    </div>
  );
}
