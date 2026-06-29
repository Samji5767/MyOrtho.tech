'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface TreatmentOutcome {
  id: string; outcomeDate: string; finalOverjetMm: number | null; finalOverbiteJm: number | null;
  finalMidlineDeviationMm: number | null; archCoordinationAchieved: boolean | null;
  totalAlignersUsed: number | null; refinementsCount: number;
  treatmentDurationDays: number | null; patientSatisfaction: number | null;
  clinicianSatisfaction: number | null; notes: string | null;
}

const API = (path: string) => `/api/${path}`;
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

function StarRating({ value }: { value: number | null }) {
  if (!value) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className="text-xs">
      {'★'.repeat(value)}{'☆'.repeat(5 - value)}
    </span>
  );
}

export default function OutcomesPanel({ caseId }: { caseId: string }) {
  const [outcome, setOutcome]     = useState<TreatmentOutcome | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showRecord, setShowRecord] = useState(false);

  // Form fields
  const [outcomeDate, setOutcomeDate]   = useState(new Date().toISOString().slice(0, 10));
  const [overjet, setOverjet]           = useState('');
  const [overbite, setOverbite]         = useState('');
  const [midline, setMidline]           = useState('');
  const [archCoord, setArchCoord]       = useState<string>('');
  const [totalAligners, setTotalAligners] = useState('');
  const [refinements, setRefinements]   = useState('0');
  const [duration, setDuration]         = useState('');
  const [patientSat, setPatientSat]     = useState('');
  const [clinicianSat, setClinicianSat] = useState('');
  const [notes, setNotes]               = useState('');

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(() => run(async () => {
    const data = await apiFetch<TreatmentOutcome | null>(`cases/${caseId}/outcome`);
    setOutcome(data);
  }), [caseId, run]);

  useEffect(() => { load(); }, [load]);

  const record = async () => {
    await run(async () => {
      await apiFetch(`cases/${caseId}/outcome`, {
        method: 'POST',
        body: JSON.stringify({
          outcomeDate,
          finalOverjetMm: overjet ? Number(overjet) : undefined,
          finalOverbiteJm: overbite ? Number(overbite) : undefined,
          finalMidlineDeviationMm: midline ? Number(midline) : undefined,
          archCoordinationAchieved: archCoord !== '' ? archCoord === 'true' : undefined,
          totalAlignersUsed: totalAligners ? Number(totalAligners) : undefined,
          refinementsCount: Number(refinements),
          treatmentDurationDays: duration ? Number(duration) : undefined,
          patientSatisfaction: patientSat ? Number(patientSat) : undefined,
          clinicianSatisfaction: clinicianSat ? Number(clinicianSat) : undefined,
          notes: notes || null,
        }),
      });
      setShowRecord(false);
      await load();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Treatment Outcomes</h3>
        {!outcome && (
          <button onClick={() => setShowRecord(v => !v)} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Record Outcome</button>
        )}
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {showRecord && !outcome && (
        <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Record Treatment Outcome</p>
          <input type="date" value={outcomeDate} onChange={e => setOutcomeDate(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Final overjet (mm)" step="0.1" value={overjet} onChange={e => setOverjet(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <input type="number" placeholder="Final overbite (mm)" step="0.1" value={overbite} onChange={e => setOverbite(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Midline deviation (mm)" step="0.1" value={midline} onChange={e => setMidline(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <select value={archCoord} onChange={e => setArchCoord(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs">
              <option value="">Arch coordination?</option>
              <option value="true">Achieved</option>
              <option value="false">Not achieved</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder="Total aligners" value={totalAligners} onChange={e => setTotalAligners(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <input type="number" placeholder="Refinements" min="0" value={refinements} onChange={e => setRefinements(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
            <input type="number" placeholder="Duration (days)" value={duration} onChange={e => setDuration(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={patientSat} onChange={e => setPatientSat(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs">
              <option value="">Patient satisfaction</option>
              {[1,2,3,4,5].map(v => <option key={v} value={v}>{v} star{v>1?'s':''}</option>)}
            </select>
            <select value={clinicianSat} onChange={e => setClinicianSat(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs">
              <option value="">Clinician satisfaction</option>
              {[1,2,3,4,5].map(v => <option key={v} value={v}>{v} star{v>1?'s':''}</option>)}
            </select>
          </div>
          <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
          <div className="flex gap-2">
            <button onClick={record} disabled={loading} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Record</button>
            <button onClick={() => setShowRecord(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {!outcome && !loading && !showRecord && (
        <p className="py-8 text-center text-xs text-gray-400">No outcome recorded for this case.</p>
      )}

      {outcome && (
        <div className="rounded border border-green-200 bg-green-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Outcome Recorded</p>
            <p className="text-[10px] text-gray-500">{new Date(outcome.outcomeDate).toLocaleDateString()}</p>
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Final Overjet</span><span className="font-semibold">{outcome.finalOverjetMm != null ? `${outcome.finalOverjetMm} mm` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Final Overbite</span><span className="font-semibold">{outcome.finalOverbiteJm != null ? `${outcome.finalOverbiteJm} mm` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Midline Dev.</span><span className="font-semibold">{outcome.finalMidlineDeviationMm != null ? `${outcome.finalMidlineDeviationMm} mm` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Arch Coord.</span><span className="font-semibold">{outcome.archCoordinationAchieved == null ? '—' : outcome.archCoordinationAchieved ? 'Achieved' : 'Not achieved'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total Aligners</span><span className="font-semibold">{outcome.totalAlignersUsed ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Refinements</span><span className="font-semibold">{outcome.refinementsCount}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-semibold">{outcome.treatmentDurationDays != null ? `${outcome.treatmentDurationDays} days` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Patient Sat.</span><span className="font-semibold"><StarRating value={outcome.patientSatisfaction} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Clinician Sat.</span><span className="font-semibold"><StarRating value={outcome.clinicianSatisfaction} /></span></div>
          </div>
          {outcome.notes && <p className="text-xs text-gray-600 italic border-t border-green-200 pt-3">{outcome.notes}</p>}
        </div>
      )}
    </div>
  );
}
