'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface InsurancePlan { id: string; payerName: string; planName: string | null; memberId: string | null; groupNumber: string | null; isPrimary: boolean; effectiveDate: string | null }
interface PreAuth { id: string; caseId: string; cdtCodes: string[]; status: string; authNumber: string | null; approvedAmountCents: number | null; submittedAt: string | null; decisionAt: string | null; notes: string | null; createdAt: string }

const API = (path: string) => `/api/${path}`;
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800',
  submitted: 'bg-blue-100 text-blue-800',
  approved:  'bg-green-100 text-green-800',
  denied:    'bg-red-100 text-red-800',
  expired:   'bg-gray-100 text-gray-600',
};

export default function InsurancePanel({ caseId, patientId }: { caseId: string; patientId?: string }) {
  const [plans, setPlans]         = useState<InsurancePlan[]>([]);
  const [preauths, setPreauths]   = useState<PreAuth[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [tab, setTab]             = useState<'plans' | 'preauths'>('preauths');

  // New pre-auth form
  const [showPA, setShowPA]       = useState(false);
  const [cdtInput, setCdtInput]   = useState('');
  const [paNotes, setPaNotes]     = useState('');
  const [selPlan, setSelPlan]     = useState('');

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(() => run(async () => {
    const [pa, pl] = await Promise.all([
      apiFetch<PreAuth[]>(`cases/${caseId}/preauths`),
      patientId ? apiFetch<InsurancePlan[]>(`patients/${patientId}/insurance-plans`) : Promise.resolve([]),
    ]);
    setPreauths(pa); setPlans(pl);
  }), [caseId, patientId, run]);

  useEffect(() => { load(); }, [load]);

  const createPreAuth = async () => {
    const codes = cdtInput.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!codes.length) return;
    await run(async () => {
      await apiFetch(`cases/${caseId}/preauths`, {
        method: 'POST',
        body: JSON.stringify({ cdtCodes: codes, insurancePlanId: selPlan || null, notes: paNotes || null }),
      });
      setShowPA(false); setCdtInput(''); setPaNotes(''); setSelPlan('');
      await load();
    });
  };

  const submitPreAuth = async (id: string) => {
    await run(async () => {
      await apiFetch(`preauths/${id}/submit`, { method: 'POST', body: '{}' });
      await load();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200">
        {(['preauths', 'plans'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-semibold capitalize ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'preauths' ? 'Pre-Authorizations' : 'Insurance Plans'}
          </button>
        ))}
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {tab === 'preauths' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Pre-Authorizations</p>
            <button onClick={() => setShowPA(v => !v)} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">+ New Pre-Auth</button>
          </div>

          {showPA && (
            <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
              <input type="text" placeholder="CDT codes (e.g. D0330 D0274)" value={cdtInput} onChange={e => setCdtInput(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs font-mono" />
              {plans.length > 0 && (
                <select value={selPlan} onChange={e => setSelPlan(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs">
                  <option value="">No insurance plan linked</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.payerName}{p.isPrimary ? ' (Primary)' : ''}</option>)}
                </select>
              )}
              <textarea placeholder="Notes (optional)" value={paNotes} onChange={e => setPaNotes(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
              <div className="flex gap-2">
                <button onClick={createPreAuth} disabled={loading || !cdtInput.trim()} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Create</button>
                <button onClick={() => setShowPA(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
              </div>
            </div>
          )}

          {preauths.length === 0 && !loading && <p className="py-8 text-center text-xs text-gray-400">No pre-authorization requests.</p>}
          {preauths.map(pa => (
            <div key={pa.id} className="rounded border border-gray-200 bg-white p-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex gap-1 flex-wrap mb-1">
                  {pa.cdtCodes.map(c => <span key={c} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-700">{c}</span>)}
                </div>
                {pa.authNumber && <p className="text-xs text-green-700">Auth# {pa.authNumber}</p>}
                {pa.approvedAmountCents && <p className="text-xs text-green-700">Approved ${(pa.approvedAmountCents / 100).toFixed(2)}</p>}
                {pa.notes && <p className="text-xs text-gray-500 italic mt-0.5">{pa.notes}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(pa.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[pa.status] ?? 'bg-gray-100 text-gray-600'}`}>{pa.status}</span>
                {pa.status === 'pending' && (
                  <button onClick={() => submitPreAuth(pa.id)} disabled={loading} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50">Submit</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'plans' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">Insurance Plans</p>
          {plans.length === 0 && <p className="py-8 text-center text-xs text-gray-400">No insurance plans on file. Add from the patient record.</p>}
          {plans.map(p => (
            <div key={p.id} className="rounded border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{p.payerName}</p>
                {p.isPrimary && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Primary</span>}
              </div>
              {p.planName && <p className="text-xs text-gray-600 mt-0.5">{p.planName}</p>}
              <div className="flex gap-4 mt-1">
                {p.memberId && <p className="text-xs text-gray-500">Member: {p.memberId}</p>}
                {p.groupNumber && <p className="text-xs text-gray-500">Group: {p.groupNumber}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
