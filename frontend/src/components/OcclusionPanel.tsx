'use client';
import { useState, useEffect, useCallback } from 'react';
import { Target, Plus } from 'lucide-react';

interface OcclusionAnalysis {
  id: string; analysisDate: string; angleClass: string | null;
  overjetMm: number | null; overbitemm: number | null; midlineShiftMm: number | null;
  crowdingUpperMm: number | null; crowdingLowerMm: number | null;
  tmjFindings: string | null; notes: string | null; createdAt: string;
}

interface Props { caseId: string; token: string }

export default function OcclusionPanel({ caseId, token }: Props) {
  const [analyses, setAnalyses] = useState<OcclusionAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    analysisDate: new Date().toISOString().slice(0, 10),
    angleClass: '', overjetMm: '', overbitemm: '', midlineShiftMm: '',
    crowdingUpperMm: '', crowdingLowerMm: '', tmjFindings: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/cases/${caseId}/occlusion`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setAnalyses(await r.json());
    } finally { setLoading(false); }
  }, [caseId, token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    try {
      await fetch(`/api/cases/${caseId}/occlusion`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisDate: form.analysisDate,
          angleClass: form.angleClass || null,
          overjetMm: form.overjetMm ? parseFloat(form.overjetMm) : null,
          overbitemm: form.overbitemm ? parseFloat(form.overbitemm) : null,
          midlineShiftMm: form.midlineShiftMm ? parseFloat(form.midlineShiftMm) : null,
          crowdingUpperMm: form.crowdingUpperMm ? parseFloat(form.crowdingUpperMm) : null,
          crowdingLowerMm: form.crowdingLowerMm ? parseFloat(form.crowdingLowerMm) : null,
          tmjFindings: form.tmjFindings || null,
          notes: form.notes || null,
        }),
      });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Target size={16} />
          Occlusion Analysis
        </h3>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          <Plus size={13} />
          New Analysis
        </button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Analysis Date</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.analysisDate} onChange={e => setForm(f => ({ ...f, analysisDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Angle Class</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.angleClass} onChange={e => setForm(f => ({ ...f, angleClass: e.target.value }))}>
                <option value="">—</option>
                <option value="I">Class I</option>
                <option value="II_div1">Class II Div 1</option>
                <option value="II_div2">Class II Div 2</option>
                <option value="III">Class III</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(['overjetMm', 'overbitemm', 'midlineShiftMm'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs text-gray-600 mb-1">
                  {field === 'overjetMm' ? 'Overjet (mm)' : field === 'overbitemm' ? 'Overbite (mm)' : 'Midline Shift (mm)'}
                </label>
                <input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm" value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Upper Crowding (mm)</label>
              <input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm" value={form.crowdingUpperMm} onChange={e => setForm(f => ({ ...f, crowdingUpperMm: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Lower Crowding (mm)</label>
              <input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm" value={form.crowdingLowerMm} onChange={e => setForm(f => ({ ...f, crowdingLowerMm: e.target.value }))} />
            </div>
          </div>
          <input className="w-full border rounded px-3 py-2 text-sm" placeholder="TMJ findings" value={form.tmjFindings} onChange={e => setForm(f => ({ ...f, tmjFindings: e.target.value }))} />
          <textarea className="w-full border rounded px-3 py-2 text-sm" placeholder="Notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button onClick={create} disabled={saving} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Analysis'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : analyses.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No occlusion analyses recorded</p>
      ) : (
        <div className="space-y-3">
          {analyses.map(a => (
            <div key={a.id} className="p-4 border rounded-lg bg-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-900">{new Date(a.analysisDate).toLocaleDateString()}</p>
                {a.angleClass && (
                  <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">
                    Class {a.angleClass.replace('_', ' ')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {a.overjetMm !== null && (
                  <div><p className="text-xs text-gray-500">Overjet</p><p className="font-medium">{a.overjetMm} mm</p></div>
                )}
                {a.overbitemm !== null && (
                  <div><p className="text-xs text-gray-500">Overbite</p><p className="font-medium">{a.overbitemm} mm</p></div>
                )}
                {a.midlineShiftMm !== null && (
                  <div><p className="text-xs text-gray-500">Midline</p><p className="font-medium">{a.midlineShiftMm} mm</p></div>
                )}
                {a.crowdingUpperMm !== null && (
                  <div><p className="text-xs text-gray-500">Upper Crowding</p><p className="font-medium">{a.crowdingUpperMm} mm</p></div>
                )}
                {a.crowdingLowerMm !== null && (
                  <div><p className="text-xs text-gray-500">Lower Crowding</p><p className="font-medium">{a.crowdingLowerMm} mm</p></div>
                )}
              </div>
              {a.tmjFindings && <p className="text-xs text-gray-600 mt-2"><span className="font-medium">TMJ:</span> {a.tmjFindings}</p>}
              {a.notes && <p className="text-xs text-gray-500 mt-1">{a.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
