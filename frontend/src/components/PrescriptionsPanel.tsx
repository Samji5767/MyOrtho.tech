'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Prescription {
  id: string; medicationName: string; strength: string | null; dosageForm: string | null;
  sig: string; quantity: string; refills: number; indication: string | null;
  status: string; filledAt: string | null; expiresAt: string | null; createdAt: string;
}

const API = (path: string) => `/api/${path}`;
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-100 text-green-800',
  filled:    'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  expired:   'bg-gray-100 text-gray-600',
};

const DOSAGE_FORMS = ['tablet','capsule','liquid','topical','spray','other'];

export default function PrescriptionsPanel({ caseId }: { caseId: string }) {
  const [rxList, setRxList]       = useState<Prescription[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Form
  const [medName, setMedName]     = useState('');
  const [strength, setStrength]   = useState('');
  const [dosForm, setDosForm]     = useState('tablet');
  const [sig, setSig]             = useState('');
  const [qty, setQty]             = useState('');
  const [refills, setRefills]     = useState('0');
  const [indication, setIndication] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(() => run(async () => {
    const data = await apiFetch<Prescription[]>(`cases/${caseId}/prescriptions`);
    setRxList(data);
  }), [caseId, run]);

  useEffect(() => { load(); }, [load]);

  const createRx = async () => {
    if (!medName.trim() || !sig.trim() || !qty.trim()) return;
    await run(async () => {
      await apiFetch(`cases/${caseId}/prescriptions`, {
        method: 'POST',
        body: JSON.stringify({
          medicationName: medName.trim(), strength: strength || null, dosageForm: dosForm,
          sig: sig.trim(), quantity: qty.trim(), refills: Number(refills),
          indication: indication || null, expiresAt: expiresAt || null,
        }),
      });
      setShowCreate(false); setMedName(''); setStrength(''); setSig(''); setQty(''); setRefills('0'); setIndication(''); setExpiresAt('');
      await load();
    });
  };

  const fillRx = async (rxId: string) => {
    await run(async () => {
      await apiFetch(`prescriptions/${rxId}/fill`, { method: 'PATCH', body: '{}' });
      await load();
    });
  };

  const cancelRx = async (rxId: string) => {
    await run(async () => {
      await apiFetch(`prescriptions/${rxId}/cancel`, { method: 'PATCH', body: '{}' });
      await load();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Prescriptions</h3>
        <button onClick={() => setShowCreate(v => !v)} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">+ New Rx</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {showCreate && (
        <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Medication name *" value={medName} onChange={e => setMedName(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <input type="text" placeholder="Strength (e.g. 500mg)" value={strength} onChange={e => setStrength(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={dosForm} onChange={e => setDosForm(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs">
              {DOSAGE_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="text" placeholder="Quantity (e.g. 30 tablets)" value={qty} onChange={e => setQty(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
          </div>
          <input type="text" placeholder="Sig / directions *" value={sig} onChange={e => setSig(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Refills" min="0" max="12" value={refills} onChange={e => setRefills(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <input type="date" placeholder="Expires" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
          </div>
          <input type="text" placeholder="Indication (optional)" value={indication} onChange={e => setIndication(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
          <div className="flex gap-2">
            <button onClick={createRx} disabled={loading || !medName.trim() || !sig.trim() || !qty.trim()} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Prescribe</button>
            <button onClick={() => setShowCreate(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rxList.length === 0 && !loading && <p className="py-8 text-center text-xs text-gray-400">No prescriptions for this case.</p>}
        {rxList.map(rx => (
          <div key={rx.id} className="rounded border border-gray-200 bg-white p-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{rx.medicationName}</p>
                {rx.strength && <span className="text-xs text-gray-500">{rx.strength}</span>}
                {rx.dosageForm && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{rx.dosageForm}</span>}
              </div>
              <p className="text-xs text-gray-600 mt-0.5">{rx.sig}</p>
              <p className="text-xs text-gray-500 mt-0.5">{rx.quantity} · {rx.refills} refill{rx.refills !== 1 ? 's' : ''}</p>
              {rx.indication && <p className="text-[10px] text-gray-400 mt-0.5">For: {rx.indication}</p>}
              {rx.expiresAt && <p className="text-[10px] text-gray-400 mt-0.5">Expires {new Date(rx.expiresAt).toLocaleDateString()}</p>}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[rx.status] ?? 'bg-gray-100 text-gray-600'}`}>{rx.status}</span>
              {rx.status === 'active' && (
                <div className="flex gap-1">
                  <button onClick={() => fillRx(rx.id)} disabled={loading} className="rounded bg-green-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50">Fill</button>
                  <button onClick={() => cancelRx(rx.id)} disabled={loading} className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 disabled:opacity-50">Cancel</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
