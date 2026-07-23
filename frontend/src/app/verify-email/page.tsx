"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Mail, RefreshCw } from "lucide-react";
import { verifyEmail, resendVerification } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import BrandMark from "@/components/BrandMark";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh, user, status } = useAuth();

  const token = searchParams?.get("token") ?? null;

  const [phase, setPhase] = useState<"pending" | "verifying" | "success" | "error" | "resent">("pending");
  const [message, setMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // Auto-verify if a token is in the URL
  useEffect(() => {
    if (!token) return;
    setPhase("verifying");
    verifyEmail(token).then(async (result) => {
      if ("error" in result) {
        setPhase("error");
        setMessage(result.error);
      } else {
        await refresh();
        setPhase("success");
      }
    });
  }, [token, refresh]);

  // Redirect verified + onboarded users away from this page
  useEffect(() => {
    if (status === "authenticated" && user?.isEmailVerified && user.isOnboarded) {
      router.replace("/dashboard");
    }
    if (status === "authenticated" && user?.isEmailVerified && !user.isOnboarded) {
      router.replace("/onboarding");
    }
  }, [status, user, router]);

  async function handleResend(e: FormEvent) {
    e.preventDefault();
    setResending(true);
    const result = await resendVerification();
    setResending(false);
    if ("error" in result) {
      setMessage(result.error);
    } else {
      setPhase("resent");
      setMessage(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
         style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <BrandMark />
        </div>

        <div className="rounded-2xl border p-8 shadow-sm"
             style={{ background: "var(--card)", borderColor: "var(--border)" }}>

          {/* Verifying state */}
          {phase === "verifying" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <RefreshCw className="h-10 w-10 animate-spin" style={{ color: "var(--primary)" }} />
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Verifying your email address…
              </p>
            </div>
          )}

          {/* Success state */}
          {phase === "success" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle className="h-12 w-12" style={{ color: "var(--success, #22c55e)" }} />
              <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                Email verified!
              </h1>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Your account is now active. Let's complete your setup.
              </p>
              <Link href="/onboarding"
                    className="mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-center transition-opacity hover:opacity-90"
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                Continue to onboarding
              </Link>
            </div>
          )}

          {/* Error state */}
          {phase === "error" && (
            <div className="flex flex-col gap-4">
              <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                Verification failed
              </h1>
              <p className="text-sm" style={{ color: "var(--destructive, #ef4444)" }}>
                {message ?? "The verification link is invalid or has expired."}
              </p>
              {status === "authenticated" && (
                <button onClick={handleResend} disabled={resending}
                        className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  {resending ? "Sending…" : "Send a new verification email"}
                </button>
              )}
              <Link href="/login" className="text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
                Back to login
              </Link>
            </div>
          )}

          {/* Resent state */}
          {phase === "resent" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle className="h-10 w-10" style={{ color: "var(--primary)" }} />
              <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                Verification email sent
              </h1>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Check your inbox and click the link to verify your account. The link expires in 24 hours.
              </p>
            </div>
          )}

          {/* Pending state (no token in URL) */}
          {phase === "pending" && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full"
                     style={{ background: "var(--muted)" }}>
                  <Mail className="h-6 w-6" style={{ color: "var(--muted-foreground)" }} />
                </div>
                <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                  Check your email
                </h1>
                {user && (
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    We sent a verification link to <strong>{user.email}</strong>.
                    Click it to activate your account.
                  </p>
                )}
                {!user && (
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    We sent a verification link to your email address.
                    Click it to activate your account.
                  </p>
                )}
              </div>

              {message && (
                <p className="text-sm text-center" style={{ color: "var(--destructive, #ef4444)" }}>
                  {message}
                </p>
              )}

              {status === "authenticated" && (
                <form onSubmit={handleResend}>
                  <button type="submit" disabled={resending}
                          className="w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[color:var(--muted)] disabled:opacity-50"
                          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                    {resending ? "Sending…" : "Resend verification email"}
                  </button>
                </form>
              )}

              <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
                Wrong account?{" "}
                <Link href="/login" className="underline" style={{ color: "var(--primary)" }}>
                  Sign in with a different email
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
