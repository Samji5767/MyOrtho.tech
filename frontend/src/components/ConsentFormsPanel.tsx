'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ConsentTemplate { id: string; title: string; contentMarkdown: string; version: string; requiresWitness: boolean }
interface PatientConsent { id: string; templateId: string; templateTitle: string; patientName: string; status: string; signedAt: string | null; expiresAt: string; createdAt: string }

const API = (path: string) => `/api/${path}`;

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const STATUS_COLOR: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-800',
  signed:   'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  expired:  'bg-gray-100 text-gray-600',
};

export default function ConsentFormsPanel({ caseId }: { caseId: string }) {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [consents, setConsents] = useState<PatientConsent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create consent form state
  const [showCreate, setShowCreate] = useState(false);
  const [selTemplate, setSelTemplate] = useState('');
  const [patientName, setPatientName] = useState('');

  // Sign form state
  const [signingId, setSigningId] = useState<string | null>(null);
  const [typedSig, setTypedSig] = useState('');

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(() => run(async () => {
    const [tmpl, c] = await Promise.all([
      apiFetch<ConsentTemplate[]>('consent-templates'),
      apiFetch<PatientConsent[]>(`cases/${caseId}/consents`),
    ]);
    setTemplates(tmpl);
    setConsents(c);
  }), [caseId, run]);

  useEffect(() => { load(); }, [load]);

  const createConsent = async () => {
    if (!selTemplate || !patientName.trim()) return;
    await run(async () => {
      await apiFetch(`cases/${caseId}/consents`, {
        method: 'POST',
        body: JSON.stringify({ templateId: selTemplate, patientName: patientName.trim() }),
      });
      setShowCreate(false); setSelTemplate(''); setPatientName('');
      await load();
    });
  };

  const signConsent = async () => {
    if (!signingId || !typedSig.trim()) return;
    await run(async () => {
      await apiFetch(`consents/${signingId}/sign`, {
        method: 'PATCH',
        body: JSON.stringify({ signatureData: `typed:${typedSig.trim()}` }),
      });
      setSigningId(null); setTypedSig('');
      await load();
    });
  };

  const declineConsent = async (consentId: string) => {
    await run(async () => {
      await apiFetch(`consents/${consentId}/decline`, { method: 'PATCH', body: '{}' });
      await load();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Consent Forms</h3>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          + New Consent
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {showCreate && (
        <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Create Consent Request</p>
          <select
            value={selTemplate}
            onChange={e => setSelTemplate(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-xs"
          >
            <option value="">Select template…</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.title} (v{t.version})</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Patient full name"
            value={patientName}
            onChange={e => setPatientName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-xs"
          />
          <div className="flex gap-2">
            <button onClick={createConsent} disabled={loading} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Create</button>
            <button onClick={() => setShowCreate(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {signingId && (
        <div className="rounded border border-green-200 bg-green-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Patient E-Signature</p>
          <p className="text-xs text-gray-500">Type full name to confirm consent</p>
          <input
            type="text"
            placeholder="Type full name as signature"
            value={typedSig}
            onChange={e => setTypedSig(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-xs font-medium italic"
          />
          <div className="flex gap-2">
            <button onClick={signConsent} disabled={loading || !typedSig.trim()} className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Confirm Signature</button>
            <button onClick={() => { setSigningId(null); setTypedSig(''); }} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {consents.length === 0 && !loading && (
          <p className="py-8 text-center text-xs text-gray-400">No consent forms for this case. Create one above.</p>
        )}
        {consents.map(c => (
          <div key={c.id} className="rounded border border-gray-200 bg-white p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{c.templateTitle}</p>
              <p className="text-xs text-gray-500 mt-0.5">Patient: {c.patientName}</p>
              {c.signedAt && (
                <p className="text-xs text-green-700 mt-0.5">Signed {new Date(c.signedAt).toLocaleDateString()}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-0.5">Expires {new Date(c.expiresAt).toLocaleDateString()}</p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {c.status}
              </span>
              {c.status === 'pending' && (
                <div className="flex gap-1">
                  <button
                    onClick={() => setSigningId(c.id)}
                    className="rounded bg-green-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-green-700"
                  >
                    Sign
                  </button>
                  <button
                    onClick={() => declineConsent(c.id)}
                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
