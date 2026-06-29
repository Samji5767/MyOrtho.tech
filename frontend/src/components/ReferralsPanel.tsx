'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Referral {
  id: string;
  referralType: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  urgency: string;
  reason: string;
  clinicalNotes: string | null;
  status: string;
  sentAt: string | null;
  respondedAt: string | null;
  responseNotes: string | null;
  createdAt: string;
}

const API = (path: string) => `/api/${path}`;
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800',
  sent:      'bg-blue-100 text-blue-800',
  accepted:  'bg-green-100 text-green-800',
  declined:  'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-600',
};

const URGENCY_COLOR: Record<string, string> = {
  routine:  'text-gray-500',
  urgent:   'text-amber-600',
  emergent: 'text-red-600 font-bold',
};

const REFERRAL_TYPES = ['orthodontist','periodontist','oral_surgeon','endodontist','prosthodontist','general_dentist','other'];

export default function ReferralsPanel({ caseId }: { caseId: string }) {
  const [referrals, setReferrals]       = useState<Referral[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [expanded, setExpanded]         = useState<string | null>(null);

  // New referral form
  const [showCreate, setShowCreate]     = useState(false);
  const [refType, setRefType]           = useState('orthodontist');
  const [recipient, setRecipient]       = useState('');
  const [recipEmail, setRecipEmail]     = useState('');
  const [recipPhone, setRecipPhone]     = useState('');
  const [urgency, setUrgency]           = useState('routine');
  const [reason, setReason]             = useState('');
  const [clinNotes, setClinNotes]       = useState('');

  // Response update
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respStatus, setRespStatus]     = useState('accepted');
  const [respNotes, setRespNotes]       = useState('');

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(() => run(async () => {
    const data = await apiFetch<Referral[]>(`cases/${caseId}/referrals`);
    setReferrals(data);
  }), [caseId, run]);

  useEffect(() => { load(); }, [load]);

  const createReferral = async () => {
    if (!recipient.trim() || !reason.trim()) return;
    await run(async () => {
      await apiFetch(`cases/${caseId}/referrals`, {
        method: 'POST',
        body: JSON.stringify({
          referralType: refType,
          recipientName: recipient.trim(),
          recipientEmail: recipEmail || null,
          recipientPhone: recipPhone || null,
          urgency,
          reason: reason.trim(),
          clinicalNotes: clinNotes || null,
        }),
      });
      setShowCreate(false);
      setRecipient(''); setRecipEmail(''); setRecipPhone(''); setReason(''); setClinNotes('');
      await load();
    });
  };

  const sendReferral = async (referralId: string) => {
    await run(async () => {
      await apiFetch(`referrals/${referralId}/send`, { method: 'POST', body: '{}' });
      await load();
    });
  };

  const submitResponse = async () => {
    if (!respondingId) return;
    await run(async () => {
      await apiFetch(`referrals/${respondingId}/response`, {
        method: 'PATCH',
        body: JSON.stringify({ status: respStatus, responseNotes: respNotes || null }),
      });
      setRespondingId(null); setRespNotes('');
      await load();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Referrals</h3>
        <button onClick={() => setShowCreate(v => !v)} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">+ New Referral</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {showCreate && (
        <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select value={refType} onChange={e => setRefType(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs">
              {REFERRAL_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={urgency} onChange={e => setUrgency(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs">
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergent">Emergent</option>
            </select>
          </div>
          <input type="text" placeholder="Recipient name / practice" value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <input type="email" placeholder="Email (optional)" value={recipEmail} onChange={e => setRecipEmail(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <input type="tel" placeholder="Phone (optional)" value={recipPhone} onChange={e => setRecipPhone(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
          </div>
          <textarea placeholder="Reason for referral *" value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
          <textarea placeholder="Clinical notes (optional)" value={clinNotes} onChange={e => setClinNotes(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
          <div className="flex gap-2">
            <button onClick={createReferral} disabled={loading || !recipient.trim() || !reason.trim()} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Create</button>
            <button onClick={() => setShowCreate(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {respondingId && (
        <div className="rounded border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Record Referral Response</p>
          <select value={respStatus} onChange={e => setRespStatus(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs">
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="completed">Completed</option>
          </select>
          <textarea placeholder="Response notes (optional)" value={respNotes} onChange={e => setRespNotes(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
          <div className="flex gap-2">
            <button onClick={submitResponse} disabled={loading} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Submit</button>
            <button onClick={() => { setRespondingId(null); setRespNotes(''); }} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {referrals.length === 0 && !loading && (
          <p className="py-8 text-center text-xs text-gray-400">No referrals for this case.</p>
        )}
        {referrals.map(r => (
          <div key={r.id} className="rounded border border-gray-200 bg-white overflow-hidden">
            <div className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{r.recipientName}</p>
                  <span className={`text-[10px] uppercase ${URGENCY_COLOR[r.urgency] ?? ''}`}>{r.urgency}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{r.referralType.replace(/_/g, ' ')} · {r.reason}</p>
                {r.sentAt && <p className="text-[10px] text-gray-400 mt-0.5">Sent {new Date(r.sentAt).toLocaleDateString()}</p>}
                {r.respondedAt && <p className="text-[10px] text-gray-400 mt-0.5">Response {new Date(r.respondedAt).toLocaleDateString()}</p>}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                <div className="flex gap-1">
                  <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-[10px] text-blue-600 underline">
                    {expanded === r.id ? 'Collapse' : 'Details'}
                  </button>
                  {r.status === 'pending' && (
                    <button onClick={() => sendReferral(r.id)} disabled={loading} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50">Send</button>
                  )}
                  {r.status === 'sent' && (
                    <button onClick={() => setRespondingId(r.id)} className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">Record Response</button>
                  )}
                </div>
              </div>
            </div>
            {expanded === r.id && (
              <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-2">
                {r.clinicalNotes && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Clinical Notes</p>
                    <p className="text-xs text-gray-600">{r.clinicalNotes}</p>
                  </div>
                )}
                {r.responseNotes && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Response Notes</p>
                    <p className="text-xs text-gray-600">{r.responseNotes}</p>
                  </div>
                )}
                {r.recipientEmail && <p className="text-xs text-gray-500">Email: {r.recipientEmail}</p>}
                {r.recipientPhone && <p className="text-xs text-gray-500">Phone: {r.recipientPhone}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
