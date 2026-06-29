'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface AppointmentType { id: string; name: string; durationMinutes: number; color: string }
interface Appointment { id: string; appointmentTypeId: string; typeName: string; scheduledAt: string; durationMinutes: number; status: string; notes: string | null; providerId: string | null }
interface Milestone { id: string; title: string; targetDate: string | null; completedAt: string | null; notes: string | null }

const API = (path: string) => `/api/${path}`;
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled:  'bg-blue-100 text-blue-800',
  confirmed:  'bg-green-100 text-green-800',
  completed:  'bg-gray-100 text-gray-600',
  cancelled:  'bg-red-100 text-red-800',
  no_show:    'bg-amber-100 text-amber-800',
};

const NEXT_STATUS: Record<string, string> = {
  scheduled: 'confirmed',
  confirmed: 'completed',
};

export default function AppointmentsPanel({ caseId }: { caseId: string }) {
  const [types, setTypes]               = useState<AppointmentType[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [milestones, setMilestones]     = useState<Milestone[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [tab, setTab]                   = useState<'appointments' | 'milestones'>('appointments');

  // New appointment form
  const [showAppt, setShowAppt]       = useState(false);
  const [selType, setSelType]         = useState('');
  const [schedDate, setSchedDate]     = useState('');
  const [apptNotes, setApptNotes]     = useState('');

  // New milestone form
  const [showMile, setShowMile]       = useState(false);
  const [mileTitle, setMileTitle]     = useState('');
  const [mileDate, setMileDate]       = useState('');
  const [mileNotes, setMileNotes]     = useState('');

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(() => run(async () => {
    const [t, a, m] = await Promise.all([
      apiFetch<AppointmentType[]>('appointment-types'),
      apiFetch<Appointment[]>(`cases/${caseId}/appointments`),
      apiFetch<Milestone[]>(`cases/${caseId}/milestones`),
    ]);
    setTypes(t); setAppointments(a); setMilestones(m);
  }), [caseId, run]);

  useEffect(() => { load(); }, [load]);

  const createAppt = async () => {
    if (!selType || !schedDate) return;
    await run(async () => {
      await apiFetch(`cases/${caseId}/appointments`, {
        method: 'POST',
        body: JSON.stringify({ appointmentTypeId: selType, scheduledAt: new Date(schedDate).toISOString(), notes: apptNotes || null }),
      });
      setShowAppt(false); setSelType(''); setSchedDate(''); setApptNotes('');
      await load();
    });
  };

  const updateApptStatus = async (apptId: string, status: string) => {
    await run(async () => {
      await apiFetch(`appointments/${apptId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    });
  };

  const cancelAppt = (apptId: string) => updateApptStatus(apptId, 'cancelled');

  const createMilestone = async () => {
    if (!mileTitle.trim()) return;
    await run(async () => {
      await apiFetch(`cases/${caseId}/milestones`, {
        method: 'POST',
        body: JSON.stringify({ title: mileTitle.trim(), targetDate: mileDate || null, notes: mileNotes || null }),
      });
      setShowMile(false); setMileTitle(''); setMileDate(''); setMileNotes('');
      await load();
    });
  };

  const completeMilestone = async (milestoneId: string) => {
    await run(async () => {
      await apiFetch(`milestones/${milestoneId}/complete`, { method: 'PATCH', body: '{}' });
      await load();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200">
        {(['appointments', 'milestones'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold capitalize ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {tab === 'appointments' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Appointments</p>
            <button onClick={() => setShowAppt(v => !v)} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">+ Schedule</button>
          </div>

          {showAppt && (
            <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
              <select value={selType} onChange={e => setSelType(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs">
                <option value="">Select appointment type…</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name} ({t.durationMinutes} min)</option>)}
              </select>
              <input type="datetime-local" value={schedDate} onChange={e => setSchedDate(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
              <textarea placeholder="Notes (optional)" value={apptNotes} onChange={e => setApptNotes(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
              <div className="flex gap-2">
                <button onClick={createAppt} disabled={loading} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Schedule</button>
                <button onClick={() => setShowAppt(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
              </div>
            </div>
          )}

          {appointments.length === 0 && !loading && (
            <p className="py-8 text-center text-xs text-gray-400">No appointments scheduled.</p>
          )}
          {appointments.map(a => (
            <div key={a.id} className="rounded border border-gray-200 bg-white p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{a.typeName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(a.scheduledAt).toLocaleString()} · {a.durationMinutes} min</p>
                {a.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{a.notes}</p>}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[a.status] ?? 'bg-gray-100 text-gray-600'}`}>{a.status.replace('_', ' ')}</span>
                {NEXT_STATUS[a.status] && (
                  <div className="flex gap-1">
                    <button onClick={() => updateApptStatus(a.id, NEXT_STATUS[a.status]!)} className="rounded bg-green-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-green-700">
                      Mark {NEXT_STATUS[a.status]}
                    </button>
                    <button onClick={() => cancelAppt(a.id)} className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">Cancel</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'milestones' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Treatment Milestones</p>
            <button onClick={() => setShowMile(v => !v)} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">+ Add Milestone</button>
          </div>

          {showMile && (
            <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
              <input type="text" placeholder="Milestone title" value={mileTitle} onChange={e => setMileTitle(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
              <input type="date" value={mileDate} onChange={e => setMileDate(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" placeholder="Target date (optional)" />
              <textarea placeholder="Notes (optional)" value={mileNotes} onChange={e => setMileNotes(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
              <div className="flex gap-2">
                <button onClick={createMilestone} disabled={loading} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Add</button>
                <button onClick={() => setShowMile(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
              </div>
            </div>
          )}

          {milestones.length === 0 && !loading && (
            <p className="py-8 text-center text-xs text-gray-400">No milestones defined.</p>
          )}
          {milestones.map(m => (
            <div key={m.id} className={`rounded border p-4 flex items-start justify-between gap-4 ${m.completedAt ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
              <div>
                <p className={`text-sm font-semibold ${m.completedAt ? 'line-through text-gray-400' : 'text-gray-900'}`}>{m.title}</p>
                {m.targetDate && <p className="text-xs text-gray-500 mt-0.5">Target: {new Date(m.targetDate).toLocaleDateString()}</p>}
                {m.completedAt && <p className="text-xs text-green-700 mt-0.5">Completed {new Date(m.completedAt).toLocaleDateString()}</p>}
                {m.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{m.notes}</p>}
              </div>
              {!m.completedAt && (
                <button onClick={() => completeMilestone(m.id)} className="shrink-0 rounded bg-green-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-green-700">
                  Complete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
