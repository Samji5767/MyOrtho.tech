'use client';
import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Plus, TrendingUp, RefreshCw } from 'lucide-react';

interface RevenueTransaction {
  id: string; transactionType: string; amountCents: number; currency: string;
  description: string | null; cdtCode: string | null; status: string;
  postedAt: string | null; createdAt: string;
}
interface RevenueSummary {
  totalChargesCents: number; totalPaymentsCents: number;
  totalAdjustmentsCents: number; netRevenueCents: number; outstandingCents: number;
}

interface Props { token: string; caseId?: string; patientId?: string }

const TX_COLORS: Record<string, string> = {
  charge: 'text-blue-600', payment: 'text-green-600',
  adjustment: 'text-yellow-600', refund: 'text-orange-600', writeoff: 'text-gray-600',
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function RevenueCyclePanel({ token, caseId, patientId }: Props) {
  const [transactions, setTransactions] = useState<RevenueTransaction[]>([]);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ transactionType: 'charge', amountDollars: '', description: '', cdtCode: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (caseId) params.set('caseId', caseId);
      if (patientId) params.set('patientId', patientId);
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/revenue?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/revenue/summary', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (tRes.ok) setTransactions(await tRes.json());
      if (sRes.ok) setSummary(await sRes.json());
    } finally { setLoading(false); }
  }, [token, caseId, patientId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const amountCents = Math.round(parseFloat(form.amountDollars) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;
    setSaving(true);
    try {
      await fetch('/api/revenue', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: form.transactionType,
          amountCents,
          description: form.description || null,
          cdtCode: form.cdtCode || null,
          caseId: caseId ?? null,
          patientId: patientId ?? null,
        }),
      });
      setForm({ transactionType: 'charge', amountDollars: '', description: '', cdtCode: '' });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const post = async (id: string) => {
    await fetch(`/api/revenue/${id}/post`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <DollarSign size={16} />
          Revenue Cycle
        </h3>
        <div className="flex gap-2">
          <button onClick={load} className="p-1.5 text-gray-500 hover:text-gray-700 rounded border">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            <Plus size={13} />
            Add
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Charges', value: fmt(summary.totalChargesCents), color: 'text-blue-600' },
            { label: 'Total Payments', value: fmt(summary.totalPaymentsCents), color: 'text-green-600' },
            { label: 'Outstanding', value: fmt(summary.outstandingCents), color: 'text-red-600' },
            { label: 'Net Revenue', value: fmt(summary.netRevenueCents), color: 'text-indigo-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3 border rounded-lg bg-white text-center">
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.transactionType} onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))}>
                <option value="charge">Charge</option>
                <option value="payment">Payment</option>
                <option value="adjustment">Adjustment</option>
                <option value="refund">Refund</option>
                <option value="writeoff">Write-Off</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm" value={form.amountDollars} onChange={e => setForm(f => ({ ...f, amountDollars: e.target.value }))} />
            </div>
          </div>
          <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <input className="w-full border rounded px-3 py-2 text-sm font-mono" placeholder="CDT Code (e.g. D8080)" value={form.cdtCode} onChange={e => setForm(f => ({ ...f, cdtCode: e.target.value }))} />
          <button onClick={create} disabled={saving || !form.amountDollars} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Transaction'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No transactions recorded</p>
      ) : (
        <div className="space-y-1">
          {transactions.map(tx => (
            <div key={tx.id} className="p-3 border rounded-lg bg-white flex items-center gap-3">
              <DollarSign size={14} className={TX_COLORS[tx.transactionType] ?? 'text-gray-500'} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 capitalize">{tx.transactionType}</p>
                  {tx.cdtCode && <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{tx.cdtCode}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${tx.status === 'posted' || tx.status === 'cleared' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {tx.status}
                  </span>
                </div>
                {tx.description && <p className="text-xs text-gray-500 mt-0.5">{tx.description}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${TX_COLORS[tx.transactionType] ?? 'text-gray-700'}`}>{fmt(tx.amountCents)}</p>
                {tx.status === 'pending' && (
                  <button onClick={() => post(tx.id)} className="text-xs text-indigo-600 hover:underline mt-0.5">Post</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
