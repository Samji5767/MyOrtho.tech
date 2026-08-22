"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Eye, EyeOff, Lock } from "lucide-react";
import { resetPassword } from "@/lib/auth";
import BrandMark from "@/components/BrandMark";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? null;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Redirect away if no token in URL
  useEffect(() => {
    if (token === null) {
      router.replace("/forgot-password");
    }
  }, [token, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const result = await resetPassword(token!, password);
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
         style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <BrandMark />
        </div>

        <div className="rounded-2xl border p-8 shadow-sm"
             style={{ background: "var(--card)", borderColor: "var(--border)" }}>

          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle className="h-12 w-12" style={{ color: "var(--primary)" }} />
              <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                Password updated
              </h1>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <Link href="/login"
                    className="mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-center transition-opacity hover:opacity-90"
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                Sign in
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                  Set a new password
                </h1>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Choose a strong password of at least 8 characters.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="password" className="text-sm font-medium"
                         style={{ color: "var(--foreground)" }}>
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                          style={{ color: "var(--muted-foreground)" }} />
                    <input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-lg border pl-9 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                      style={{
                        background: "var(--input)",
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      aria-label={showPwd ? "Hide password" : "Show password"}
                    >
                      {showPwd
                        ? <EyeOff className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
                        : <Eye    className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
                      }
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirm" className="text-sm font-medium"
                         style={{ color: "var(--foreground)" }}>
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                          style={{ color: "var(--muted-foreground)" }} />
                    <input
                      id="confirm"
                      type={showPwd ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                      style={{
                        background: "var(--input)",
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm" style={{ color: "var(--destructive, #ef4444)" }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {loading ? "Updating…" : "Set new password"}
                </button>
              </form>

              <p className="text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
                Remembered it?{" "}
                <Link href="/login" className="underline" style={{ color: "var(--primary)" }}>
                  Sign in instead
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
