"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle, Mail } from "lucide-react";
import { forgotPassword } from "@/lib/auth";
import BrandMark from "@/components/BrandMark";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Email address is required");
      return;
    }
    setLoading(true);
    const result = await forgotPassword(email.trim());
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setSent(true);
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

          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle className="h-12 w-12" style={{ color: "var(--primary)" }} />
              <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                Check your inbox
              </h1>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                If <strong>{email}</strong> is associated with an account, we've sent a password reset
                link. It expires in 15 minutes.
              </p>
              <Link href="/login" className="mt-2 text-sm underline" style={{ color: "var(--primary)" }}>
                Back to login
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                  Forgot your password?
                </h1>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Enter your email address and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-sm font-medium"
                         style={{ color: "var(--foreground)" }}>
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                          style={{ color: "var(--muted-foreground)" }} />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
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
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <p className="text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
                Remember your password?{" "}
                <Link href="/login" className="underline" style={{ color: "var(--primary)" }}>
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
