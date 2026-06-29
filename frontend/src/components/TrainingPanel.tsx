'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface CpdActivity {
  id: string; title: string; provider: string | null; activityType: string;
  cpdHours: number; completionDate: string; certificateUrl: string | null; verified: boolean;
}
interface CpdSummary {
  totalHours: number; verifiedHours: number;
  activitiesByType: Record<string, number>;
  requirement: { periodStart: string; periodEnd: string; requiredHours: number } | null;
}

const API = (path: string) => `/api/${path}`;
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const ACTIVITY_TYPES = ['course','webinar','conference','self_study','simulation','other'];

export default function TrainingPanel() {
  const [activities, setActivities] = useState<CpdActivity[]>([]);
  const [summary, setSummary]       = useState<CpdSummary | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [showLog, setShowLog]       = useState(false);

  // Form
  const [title, setTitle]           = useState('');
  const [provider, setProvider]     = useState('');
  const [actType, setActType]       = useState('course');
  const [hours, setHours]           = useState('');
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [certUrl, setCertUrl]       = useState('');
  const [notes, setNotes]           = useState('');

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(() => run(async () => {
    const [a, s] = await Promise.all([
      apiFetch<CpdActivity[]>('training/activities/my'),
      apiFetch<CpdSummary>('training/activities/my/summary'),
    ]);
    setActivities(a); setSummary(s);
  }), [run]);

  useEffect(() => { load(); }, [load]);

  const logActivity = async () => {
    if (!title.trim() || !hours) return;
    await run(async () => {
      await apiFetch('training/activities', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), provider: provider || null, activityType: actType, cpdHours: Number(hours), completionDate: date, certificateUrl: certUrl || null, notes: notes || null }),
      });
      setShowLog(false); setTitle(''); setProvider(''); setHours(''); setCertUrl(''); setNotes('');
      await load();
    });
  };

  const requirementProgress = summary?.requirement
    ? Math.min(100, (summary.totalHours / summary.requirement.requiredHours) * 100)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">CPD / Training</h3>
        <button onClick={() => setShowLog(v => !v)} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">+ Log Activity</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {summary && (
        <div className="rounded border border-gray-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{summary.totalHours}</p>
              <p className="text-[10px] text-gray-500">Total CPD Hours</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-700">{summary.verifiedHours}</p>
              <p className="text-[10px] text-gray-500">Verified Hours</p>
            </div>
          </div>
          {summary.requirement && requirementProgress != null && (
            <div>
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Progress to {summary.requirement.requiredHours}h requirement</span>
                <span>{summary.totalHours}h / {summary.requirement.requiredHours}h</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className={`h-2 rounded-full transition-all ${requirementProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${requirementProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Period: {new Date(summary.requirement.periodStart).toLocaleDateString()} – {new Date(summary.requirement.periodEnd).toLocaleDateString()}
              </p>
            </div>
          )}
          {Object.keys(summary.activitiesByType).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {Object.entries(summary.activitiesByType).map(([type, hrs]) => (
                <span key={type} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700">
                  {type.replace('_', ' ')}: {Number(hrs).toFixed(1)}h
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {showLog && (
        <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
          <input type="text" placeholder="Activity title *" value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Provider / organizer" value={provider} onChange={e => setProvider(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <select value={actType} onChange={e => setActType(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs">
              {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="CPD hours *" step="0.5" min="0.5" value={hours} onChange={e => setHours(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
          </div>
          <input type="url" placeholder="Certificate URL (optional)" value={certUrl} onChange={e => setCertUrl(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
          <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
          <div className="flex gap-2">
            <button onClick={logActivity} disabled={loading || !title.trim() || !hours} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Log</button>
            <button onClick={() => setShowLog(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {activities.length === 0 && !loading && <p className="py-8 text-center text-xs text-gray-400">No CPD activities logged yet.</p>}
        {activities.map(a => (
          <div key={a.id} className="rounded border border-gray-200 bg-white p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{a.title}</p>
              {a.provider && <p className="text-xs text-gray-500 mt-0.5">{a.provider}</p>}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{a.activityType.replace('_', ' ')}</span>
                <span className="text-xs font-semibold text-blue-700">{a.cpdHours}h</span>
                <span className="text-[10px] text-gray-400">{new Date(a.completionDate).toLocaleDateString()}</span>
              </div>
              {a.certificateUrl && <a href={a.certificateUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 underline mt-0.5 block">Certificate</a>}
            </div>
            {a.verified && <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Verified</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
