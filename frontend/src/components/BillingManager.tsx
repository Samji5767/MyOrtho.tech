"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle,
  CreditCard,
  FileText,
  Loader2,
  Sliders,
  Zap,
} from "lucide-react";
import {
  activateSubscription,
  getActiveSubscription,
  getBalance,
  listPlans,
  listTransactions,
  type ActiveSubscription,
  type CreditTransaction,
  type SubscriptionPlan,
} from "@/lib/api/credits";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function pct(used: number, max: number) {
  return Math.min(100, Math.round((used / Math.max(max, 1)) * 100));
}

export default function BillingManager() {
  const [tab, setTab] = useState<"credits" | "plans">("credits");
  const [balance, setBalance] = useState<number | null>(null);
  const [sub, setSub] = useState<ActiveSubscription | null | undefined>(undefined);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [txns, setTxns] = useState<CreditTransaction[]>([]);
  const [activating, setActivating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getBalance(),
      getActiveSubscription(),
      listPlans(),
      listTransactions(),
    ])
      .then(([bal, activeSub, planList, txnList]) => {
        setBalance(bal.balance);
        setSub(activeSub);
        setPlans(planList);
        setTxns(txnList);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleActivate(slug: string) {
    setActivating(slug);
    try {
      const newSub = await activateSubscription(slug);
      setSub(newSub);
      // Refresh balance after plan grant
      const bal = await getBalance();
      setBalance(bal.balance);
      const txnList = await listTransactions();
      setTxns(txnList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setActivating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-[color:var(--muted-foreground)]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading billing…</span>
      </div>
    );
  }

  const casePct = sub ? pct(sub.casesThisPeriod, sub.maxCasesPerMonth) : 0;

  return (
    <div className="grid grid-cols-1 gap-6 text-xs lg:grid-cols-3">

      {/* ── Left: credit wallet + subscriptions ── */}
      <div className="space-y-4 lg:col-span-2">

        {/* Credit wallet hero */}
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <div className="mb-4 flex items-center justify-between border-b border-[color:var(--border)] pb-4">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" />
              <h3 className="text-sm font-extrabold text-[color:var(--foreground)]">Import Credits</h3>
            </div>
            <div className="flex gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]/30 p-0.5">
              {(["credits", "plans"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={[
                    "rounded-md px-3 py-1 text-[10px] font-bold capitalize transition-all",
                    tab === t ? "bg-[color:var(--primary)] text-white" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                  ].join(" ")}
                >
                  {t === "credits" ? "Wallet" : "Plans"}
                </button>
              ))}
            </div>
          </div>

          {tab === "credits" ? (
            <div className="space-y-4">
              {/* Balance */}
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Credit Balance</p>
                  <p className="text-4xl font-black tabular-nums text-[color:var(--foreground)]">
                    {balance ?? "—"}
                  </p>
                  <p className="text-[10px] text-[color:var(--muted-foreground)]">credits remaining · 1 credit = 1 STL import</p>
                </div>
                {sub && (
                  <div className="ml-auto text-right">
                    <p className="text-[10px] text-[color:var(--muted-foreground)]">Active plan</p>
                    <p className="font-bold text-[color:var(--primary)]">{sub.planName}</p>
                    <p className="text-[10px] text-[color:var(--muted-foreground)]">{sub.creditsIncluded} credits/cycle</p>
                  </div>
                )}
              </div>

              {/* Case usage bar */}
              {sub && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">Cases this period</span>
                    <span className="tabular-nums text-[color:var(--foreground)]">
                      {sub.casesThisPeriod} / {sub.maxCasesPerMonth}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--muted)]/40">
                    <div
                      className={["h-full rounded-full transition-all", casePct >= 90 ? "bg-red-500" : casePct >= 70 ? "bg-yellow-400" : "bg-emerald-500"].join(" ")}
                      style={{ width: `${casePct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-[color:var(--muted-foreground)]">
                    Period ends {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Transaction history */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">Recent transactions</p>
                {txns.length === 0 ? (
                  <p className="text-[color:var(--muted-foreground)]">No transactions yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {txns.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border border-[color:var(--border)] px-3 py-2">
                        <div>
                          <p className="font-semibold text-[color:var(--foreground)] capitalize">{t.type.replace(/_/g, " ")}</p>
                          {t.notes && <p className="text-[10px] text-[color:var(--muted-foreground)]">{t.notes}</p>}
                        </div>
                        <span className={["tabular-nums font-bold", t.amount > 0 ? "text-emerald-500" : "text-red-400"].join(" ")}>
                          {t.amount > 0 ? "+" : ""}{t.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Plans tab
            <div className="space-y-4">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
                <Sliders size={11} /> Choose a subscription plan
              </p>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {plans.map((plan) => {
                  const isActive = sub?.planSlug === plan.slug;
                  return (
                    <div
                      key={plan.id}
                      className={[
                        "flex flex-col rounded-2xl border p-4 transition-all",
                        isActive
                          ? "border-[color:var(--primary)] bg-[color:var(--primary)]/5"
                          : "border-[color:var(--border)] hover:border-[color:var(--primary)]/40",
                      ].join(" ")}
                    >
                      <div className="mb-3 flex-1">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[color:var(--primary)]">{plan.name}</p>
                        <p className="mt-1 text-2xl font-black text-[color:var(--foreground)]">
                          {fmt(plan.priceUsdCents)}<span className="text-xs font-normal text-[color:var(--muted-foreground)]">/mo</span>
                        </p>
                        <p className="mt-0.5 text-[10px] text-[color:var(--muted-foreground)]">
                          Up to {plan.maxCasesPerMonth} cases · {plan.creditsIncluded} credits
                        </p>
                        <ul className="mt-3 space-y-1.5">
                          {(plan.features as string[]).map((f) => (
                            <li key={f} className="flex items-center gap-1.5 text-[10px] text-[color:var(--foreground)]">
                              <CheckCircle size={9} className="shrink-0 text-emerald-500" /> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        disabled={isActive || activating === plan.slug}
                        onClick={() => handleActivate(plan.slug)}
                        className={[
                          "mt-3 w-full rounded-xl py-2 text-[11px] font-bold transition-all",
                          isActive
                            ? "cursor-default bg-[color:var(--primary)]/10 text-[color:var(--primary)]"
                            : "bg-[color:var(--primary)] text-white hover:opacity-90 disabled:opacity-50",
                        ].join(" ")}
                      >
                        {activating === plan.slug ? (
                          <Loader2 size={12} className="mx-auto animate-spin" />
                        ) : isActive ? (
                          "Current plan"
                        ) : (
                          "Activate"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: usage summary ── */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <h4 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-[color:var(--foreground)]">
            <Activity size={14} className="text-teal-400" /> Subscription Summary
          </h4>
          {sub ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[color:var(--muted-foreground)]">Plan</span>
                <span className="font-bold text-[color:var(--foreground)]">{sub.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[color:var(--muted-foreground)]">Status</span>
                <span className="font-bold capitalize text-emerald-500">{sub.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[color:var(--muted-foreground)]">Monthly</span>
                <span className="font-bold text-[color:var(--foreground)]">{fmt(sub.priceUsdCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[color:var(--muted-foreground)]">Credits/cycle</span>
                <span className="font-bold text-[color:var(--foreground)]">{sub.creditsIncluded}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[color:var(--muted-foreground)]">Cases limit</span>
                <span className="font-bold text-[color:var(--foreground)]">{sub.maxCasesPerMonth}/mo</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-[color:var(--muted-foreground)]">
              <p>No active subscription.</p>
              <button
                onClick={() => setTab("plans")}
                className="w-full rounded-xl bg-[color:var(--primary)] py-2 text-[11px] font-bold text-white"
              >
                Choose a plan
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[color:var(--foreground)]">
            <FileText size={14} /> Credit Pricing
          </h4>
          <div className="space-y-2 text-[color:var(--muted-foreground)]">
            <div className="flex justify-between">
              <span>STL import</span><span className="font-semibold text-[color:var(--foreground)]">1 credit</span>
            </div>
            <div className="flex justify-between">
              <span>AI segmentation</span><span className="font-semibold text-[color:var(--foreground)]">2 credits</span>
            </div>
            <div className="flex justify-between">
              <span>OBJ / PLY import</span><span className="font-semibold text-[color:var(--foreground)]">1 credit</span>
            </div>
            <div className="mt-3 rounded-lg bg-[color:var(--muted)]/20 p-2.5 text-[10px]">
              <p className="font-semibold text-[color:var(--primary)]">Starter — $299/mo</p>
              <p>50 credits · up to 25 cases</p>
              <p className="mt-1 font-semibold text-[color:var(--primary)]">Professional — $499/mo</p>
              <p>150 credits · up to 100 cases</p>
              <p className="mt-1 font-semibold text-[color:var(--primary)]">Enterprise — $699/mo</p>
              <p>500 credits · up to 260 cases</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
