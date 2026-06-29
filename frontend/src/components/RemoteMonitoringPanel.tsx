'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface CheckIn {
  id: string; checkInDate: string; wearHours: number | null; painScore: number | null;
  issuesReported: string[]; alignerStage: number | null;
  clinicianNotes: string | null; reviewedAt: string | null;
}
interface ComplianceSummary {
  totalCheckIns: number; reviewedCount: number; averageWearHours: number | null;
  averagePainScore: number | null; lastCheckIn: string | null;
}

const API = (path: string) => `/api/${path}`;
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const TARGET_WEAR_HOURS = 22;

function PainDot({ score }: { score: number }) {
  const color = score <= 3 ? 'bg-green-500' : score <= 6 ? 'bg-amber-500' : 'bg-red-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export default function RemoteMonitoringPanel({ caseId }: { caseId: string }) {
  const [checkIns, setCheckIns]   = useState<CheckIn[]>([]);
  const [summary, setSummary]     = useState<ComplianceSummary | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // New check-in form
  const [showAdd, setShowAdd]     = useState(false);
  const [ciDate, setCiDate]       = useState(new Date().toISOString().slice(0, 10));
  const [wearHours, setWearHours] = useState('');
  const [painScore, setPainScore] = useState('');
  const [alignerStage, setAlignerStage] = useState('');
  const [issues, setIssues]       = useState('');

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(() => run(async () => {
    const [ci, s] = await Promise.all([
      apiFetch<CheckIn[]>(`cases/${caseId}/check-ins`),
      apiFetch<ComplianceSummary>(`cases/${caseId}/compliance-summary`),
    ]);
    setCheckIns(ci); setSummary(s);
  }), [caseId, run]);

  useEffect(() => { load(); }, [load]);

  const createCheckIn = async () => {
    await run(async () => {
      const issuesList = issues.split(',').map(s => s.trim()).filter(Boolean);
      await apiFetch(`cases/${caseId}/check-ins`, {
        method: 'POST',
        body: JSON.stringify({
          checkInDate: ciDate,
          wearHours: wearHours ? Number(wearHours) : null,
          painScore: painScore ? Number(painScore) : null,
          alignerStage: alignerStage ? Number(alignerStage) : null,
          issuesReported: issuesList,
        }),
      });
      setShowAdd(false); setWearHours(''); setPainScore(''); setAlignerStage(''); setIssues('');
      await load();
    });
  };

  const review = async () => {
    if (!reviewingId) return;
    await run(async () => {
      await apiFetch(`cases/${caseId}/check-ins/${reviewingId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ clinicianNotes: reviewNotes }),
      });
      setReviewingId(null); setReviewNotes('');
      await load();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Remote Patient Monitoring</h3>
        <button onClick={() => setShowAdd(v => !v)} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">+ Check-In</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {summary && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Check-Ins', value: summary.totalCheckIns },
            { label: 'Avg Wear', value: summary.averageWearHours != null ? `${summary.averageWearHours}h` : '—' },
            { label: 'Avg Pain', value: summary.averagePainScore != null ? summary.averagePainScore.toFixed(1) : '—' },
          ].map(s => (
            <div key={s.label} className="rounded border border-gray-200 bg-white p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={ciDate} onChange={e => setCiDate(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <input type="number" placeholder={`Wear hrs (target ${TARGET_WEAR_HOURS}h)`} min="0" max="24" step="0.5" value={wearHours} onChange={e => setWearHours(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Pain score 0-10" min="0" max="10" value={painScore} onChange={e => setPainScore(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <input type="number" placeholder="Aligner stage" min="1" value={alignerStage} onChange={e => setAlignerStage(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
          </div>
          <input type="text" placeholder="Issues (comma-separated)" value={issues} onChange={e => setIssues(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
          <div className="flex gap-2">
            <button onClick={createCheckIn} disabled={loading} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Submit</button>
            <button onClick={() => setShowAdd(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {reviewingId && (
        <div className="rounded border border-green-200 bg-green-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Clinician Review</p>
          <textarea placeholder="Clinician notes" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
          <div className="flex gap-2">
            <button onClick={review} disabled={loading} className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Save Review</button>
            <button onClick={() => { setReviewingId(null); setReviewNotes(''); }} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {checkIns.length === 0 && !loading && <p className="py-8 text-center text-xs text-gray-400">No check-in data recorded.</p>}
        {checkIns.map(ci => (
          <div key={ci.id} className="rounded border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-gray-900">{new Date(ci.checkInDate).toLocaleDateString()}</p>
                  {ci.alignerStage && <span className="text-xs text-gray-500">Stage {ci.alignerStage}</span>}
                  {ci.painScore != null && <PainDot score={ci.painScore} />}
                </div>
                <div className="flex gap-4 mt-0.5">
                  {ci.wearHours != null && (
                    <p className={`text-xs ${ci.wearHours >= TARGET_WEAR_HOURS - 2 ? 'text-green-700' : 'text-amber-600'}`}>
                      {ci.wearHours}h wear
                    </p>
                  )}
                  {ci.painScore != null && <p className="text-xs text-gray-500">Pain {ci.painScore}/10</p>}
                </div>
                {ci.issuesReported.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {ci.issuesReported.map(i => <span key={i} className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">{i}</span>)}
                  </div>
                )}
                {ci.clinicianNotes && <p className="text-xs text-gray-600 mt-1 italic">{ci.clinicianNotes}</p>}
              </div>
              {!ci.reviewedAt && (
                <button onClick={() => setReviewingId(ci.id)} className="shrink-0 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">Review</button>
              )}
              {ci.reviewedAt && <span className="shrink-0 text-[10px] text-green-600">Reviewed</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
