'use client';

import React, { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  slug: string;
  name: string;
  priceUsdCents: number;
  isUnlimited: boolean;
  maxCasesPerMonth: number | null;
}

interface UsageSummary {
  planSlug: string;
  planName: string;
  priceUsdCents: number;
  isUnlimited: boolean;
  status: string;
  casesThisPeriod: number;
  maxCasesPerMonth: number;
  creditBalance: number;
  currentPeriodEnd: string | null;
  paygExportCostCents: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDollars(cents: number): string {
  if (cents === 0) return '$0';
  const dollars = cents / 100;
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isCurrentPlan,
  onSubscribe,
  loading,
}: {
  plan: Plan;
  isCurrentPlan: boolean;
  onSubscribe: (slug: string) => void;
  loading: boolean;
}) {
  const isPayg = plan.slug === 'payg';
  const isUnlimited = plan.slug === 'unlimited_professional';

  return (
    <div className={`rounded-lg border-2 p-5 flex flex-col gap-3 ${
      isCurrentPlan ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
    }`}>
      {isCurrentPlan && (
        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Current Plan</div>
      )}
      <div>
        <h3 className="text-sm font-bold text-gray-900">{plan.name}</h3>
        {isPayg && (
          <div className="mt-1">
            <span className="text-2xl font-bold text-gray-900">$0</span>
            <span className="text-sm text-gray-500">/month</span>
            <p className="text-xs text-gray-500 mt-0.5">+ $1.99 per export package</p>
          </div>
        )}
        {!isPayg && (
          <div className="mt-1">
            <span className="text-2xl font-bold text-gray-900">
              {formatDollars(plan.priceUsdCents)}
            </span>
            <span className="text-sm text-gray-500">/month</span>
          </div>
        )}
      </div>

      <ul className="space-y-1.5 text-xs text-gray-600 flex-1">
        {isUnlimited && (
          <>
            <li className="flex gap-2"><span className="text-green-600">✓</span> Unlimited cases per month</li>
            <li className="flex gap-2"><span className="text-green-600">✓</span> Unlimited export packages</li>
            <li className="flex gap-2"><span className="text-green-600">✓</span> Full AI Copilot access</li>
            <li className="flex gap-2"><span className="text-green-600">✓</span> CBCT fusion & bone analysis</li>
            <li className="flex gap-2"><span className="text-green-600">✓</span> Multi-arch coordination</li>
            <li className="flex gap-2"><span className="text-green-600">✓</span> Treatment quality scoring</li>
            <li className="flex gap-2"><span className="text-green-600">✓</span> Priority support</li>
          </>
        )}
        {isPayg && (
          <>
            <li className="flex gap-2"><span className="text-green-600">✓</span> All clinical modules</li>
            <li className="flex gap-2"><span className="text-green-600">✓</span> $1.99 per export package</li>
            <li className="flex gap-2"><span className="text-green-600">✓</span> Pay only when you export</li>
            <li className="flex gap-2"><span className="text-gray-400">—</span> No monthly commitment</li>
          </>
        )}
      </ul>

      <button
        onClick={() => onSubscribe(plan.slug)}
        disabled={loading || isCurrentPlan}
        className={`w-full py-2 text-xs font-semibold rounded transition-colors ${
          isCurrentPlan
            ? 'bg-blue-100 text-blue-700 cursor-default'
            : isUnlimited
            ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
            : 'bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50'
        }`}
      >
        {isCurrentPlan ? 'Active' : loading ? 'Subscribing…' : `Subscribe to ${plan.name}`}
      </button>
    </div>
  );
}

// ─── Usage Summary ────────────────────────────────────────────────────────────

function UsageCard({ summary }: { summary: UsageSummary }) {
  const progressPct = summary.isUnlimited || summary.maxCasesPerMonth === 0
    ? 0
    : Math.min(100, (summary.casesThisPeriod / summary.maxCasesPerMonth) * 100);

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-700">Current Usage</p>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>{summary.planName}</span>
            <span className={`font-semibold ${summary.status === 'active' ? 'text-green-700' : 'text-red-700'}`}>
              {summary.status}
            </span>
          </div>
          {!summary.isUnlimited && summary.maxCasesPerMonth > 0 && (
            <>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${progressPct >= 90 ? 'bg-red-500' : progressPct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {summary.casesThisPeriod} / {summary.maxCasesPerMonth} cases this period
              </p>
            </>
          )}
          {summary.isUnlimited && (
            <p className="text-xs text-green-700 font-semibold">Unlimited cases & exports</p>
          )}
          {summary.planSlug === 'payg' && (
            <p className="text-xs text-gray-600">
              Credit balance: <span className="font-semibold">{formatDollars(summary.creditBalance)}</span>
              <span className="text-gray-400 ml-2">($1.99 per export)</span>
            </p>
          )}
        </div>
      </div>
      {summary.currentPeriodEnd && (
        <p className="text-[10px] text-gray-400">
          Period ends {new Date(summary.currentPeriodEnd).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function PricingPlansPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/plans').then(r => r.json()),
      fetch('/api/billing/summary').then(r => r.json()),
    ]).then(([p, u]) => {
      setPlans(p as Plan[]);
      setUsage(u as UsageSummary);
    }).catch(e => setError((e as Error).message));
  }, []);

  const handleSubscribe = async (slug: string) => {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier: slug }),
      });
      if (!res.ok) throw new Error(await res.text());
      const summary = await fetch('/api/billing/summary').then(r => r.json());
      setUsage(summary as UsageSummary);
      setSuccess(`Subscribed to ${plans.find(p => p.slug === slug)?.name ?? slug}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Subscription Plans</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Unlimited Professional at $499/mo or Pay-As-You-Go at $1.99 per export
        </p>
      </div>

      <div className="p-4 space-y-5">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
        )}
        {success && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-3">{success}</div>
        )}

        {usage && <UsageCard summary={usage} />}

        <div className="grid grid-cols-2 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan.slug}
              plan={plan}
              isCurrentPlan={usage?.planSlug === plan.slug}
              onSubscribe={handleSubscribe}
              loading={loading}
            />
          ))}
        </div>

        <div className="rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-gray-700">Billing notes</p>
          <p>• Unlimited Professional includes all modules, unlimited cases, and no per-export charge.</p>
          <p>• Pay-As-You-Go charges $1.99 per approved export package from your credit balance.</p>
          <p>• All export packages require clinician approval before export regardless of plan.</p>
          <p>• Contact support to add credits to your PAYG balance.</p>
        </div>
      </div>
    </div>
  );
}
