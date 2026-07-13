"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, CreditCard, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Card } from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subscription {
  planName: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  seats: number | null;
  storageGb: number | null;
}

interface BillingInfo {
  subscription: Subscription | null;
  creditBalance: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const searchParams = useSearchParams();
  const success  = searchParams.get("success") === "1";
  const canceled = searchParams.get("canceled") === "1";

  const [info, setInfo]       = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/billing/subscription", { credentials: "include" })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: BillingInfo) => setInfo(data))
      .catch(() => setError("Failed to load billing information."))
      .finally(() => setLoading(false));
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Portal request failed");
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    } catch {
      setError("Could not open billing portal. Please try again.");
      setPortalLoading(false);
    }
  }

  const sub = info?.subscription;

  const statusTone: Record<string, string> = {
    active:     "text-emerald-600 dark:text-emerald-400",
    trialing:   "text-sky-600 dark:text-sky-400",
    past_due:   "text-amber-600 dark:text-amber-400",
    canceled:   "text-[color:var(--muted-foreground)]",
    incomplete: "text-rose-600 dark:text-rose-400",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[color:var(--foreground)]">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          Manage your plan, seats, and payment method.
        </p>
      </div>

      {/* Checkout result banners */}
      {success && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-600/30 dark:bg-emerald-900/10 dark:text-emerald-400">
          <CheckCircle2 size={16} className="shrink-0" />
          Subscription activated — welcome! Your plan is now live.
        </div>
      )}
      {canceled && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-sm text-amber-700 dark:border-amber-600/30 dark:bg-amber-900/10 dark:text-amber-400">
          <XCircle size={16} className="shrink-0" />
          Checkout canceled — no charge was made. Your existing plan is unchanged.
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <Card className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[color:var(--muted-foreground)]" />
        </Card>
      ) : !sub ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <CreditCard size={32} className="text-[color:var(--muted-foreground)]" />
          <div>
            <p className="text-base font-semibold text-[color:var(--foreground)]">No active subscription</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              Start a plan to unlock all features.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[color:var(--primary)] px-6 text-sm font-semibold text-[color:var(--primary-foreground)] transition-opacity hover:opacity-90"
          >
            View plans
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Current plan</h2>
              <span className={["text-xs font-semibold capitalize", statusTone[sub.status] ?? ""].join(" ")}>
                {sub.status.replace("_", " ")}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Plan</p>
                <p className="mt-0.5 text-sm font-medium text-[color:var(--foreground)]">{sub.planName}</p>
              </div>
              {sub.currentPeriodEnd && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                    {sub.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[color:var(--foreground)]">
                    {new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, { dateStyle: "long" })}
                  </p>
                </div>
              )}
              {sub.seats !== null && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Seats</p>
                  <p className="mt-0.5 text-sm font-medium text-[color:var(--foreground)]">{sub.seats}</p>
                </div>
              )}
              {sub.storageGb !== null && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Storage</p>
                  <p className="mt-0.5 text-sm font-medium text-[color:var(--foreground)]">{sub.storageGb} GB</p>
                </div>
              )}
              {info && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Credits</p>
                  <p className="mt-0.5 text-sm font-medium text-[color:var(--foreground)]">{info.creditBalance}</p>
                </div>
              )}
            </div>

            {sub.cancelAtPeriodEnd && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-600/30 dark:bg-amber-900/10 dark:text-amber-400">
                <AlertCircle size={13} className="shrink-0" />
                Your subscription is set to cancel at the end of the billing period.
              </div>
            )}
          </Card>

          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={portalLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--border)]/40 disabled:opacity-50"
          >
            {portalLoading
              ? <><Loader2 size={15} className="animate-spin" /> Opening portal…</>
              : <><CreditCard size={15} /> Manage payment &amp; invoices <ExternalLink size={12} className="text-[color:var(--muted-foreground)]" /></>}
          </button>
        </div>
      )}
    </div>
  );
}
