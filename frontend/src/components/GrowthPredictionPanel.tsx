'use client';
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Plus } from 'lucide-react';

interface GrowthPrediction {
  id: string; predictionDate: string; skeletalAgeYears: number | null;
  cervicalMaturationStage: string | null; growthPotential: string | null;
  mandibularGrowthRemainingMm: number | null; predictedAdultClass: string | null;
  recommendations: string | null; createdAt: string;
}

interface Props { patientId: string; token: string }

const GROWTH_LABELS: Record<string, string> = {
  pre_peak: 'Pre-Peak Growth',
  peak: 'Peak Growth',
  post_peak: 'Post-Peak Growth',
  complete: 'Growth Complete',
};

const GROWTH_COLORS: Record<string, string> = {
  pre_peak: 'bg-yellow-100 text-yellow-800',
  peak: 'bg-green-100 text-green-800',
  post_peak: 'bg-blue-100 text-blue-800',
  complete: 'bg-gray-100 text-gray-700',
};

export default function GrowthPredictionPanel({ patientId, token }: Props) {
  const [predictions, setPredictions] = useState<GrowthPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    predictionDate: new Date().toISOString().slice(0, 10),
    skeletalAgeYears: '', cervicalMaturationStage: '', growthPotential: '',
    mandibularGrowthRemainingMm: '', predictedAdultClass: '', recommendations: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/patients/${patientId}/growth-predictions`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setPredictions(await r.json());
    } finally { setLoading(false); }
  }, [patientId, token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    try {
      await fetch(`/api/patients/${patientId}/growth-predictions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predictionDate: form.predictionDate,
          skeletalAgeYears: form.skeletalAgeYears ? parseFloat(form.skeletalAgeYears) : null,
          cervicalMaturationStage: form.cervicalMaturationStage || null,
          growthPotential: form.growthPotential || null,
          mandibularGrowthRemainingMm: form.mandibularGrowthRemainingMm ? parseFloat(form.mandibularGrowthRemainingMm) : null,
          predictedAdultClass: form.predictedAdultClass || null,
          recommendations: form.recommendations || null,
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
          <TrendingUp size={16} />
          Growth Prediction
        </h3>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          <Plus size={13} />
          New Prediction
        </button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Assessment Date</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.predictionDate} onChange={e => setForm(f => ({ ...f, predictionDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Skeletal Age (years)</label>
              <input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm" value={form.skeletalAgeYears} onChange={e => setForm(f => ({ ...f, skeletalAgeYears: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">CVM Stage</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.cervicalMaturationStage} onChange={e => setForm(f => ({ ...f, cervicalMaturationStage: e.target.value }))}>
                <option value="">—</option>
                {['CS1','CS2','CS3','CS4','CS5','CS6'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Growth Potential</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.growthPotential} onChange={e => setForm(f => ({ ...f, growthPotential: e.target.value }))}>
                <option value="">—</option>
                <option value="pre_peak">Pre-Peak</option>
                <option value="peak">Peak</option>
                <option value="post_peak">Post-Peak</option>
                <option value="complete">Complete</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Remaining Growth (mm)</label>
              <input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm" value={form.mandibularGrowthRemainingMm} onChange={e => setForm(f => ({ ...f, mandibularGrowthRemainingMm: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Predicted Adult Class</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="e.g. Class I" value={form.predictedAdultClass} onChange={e => setForm(f => ({ ...f, predictedAdultClass: e.target.value }))} />
            </div>
          </div>
          <textarea className="w-full border rounded px-3 py-2 text-sm" placeholder="Clinical recommendations" rows={3} value={form.recommendations} onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))} />
          <button onClick={create} disabled={saving} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Prediction'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : predictions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No growth predictions recorded</p>
      ) : (
        <div className="space-y-3">
          {predictions.map(p => (
            <div key={p.id} className="p-4 border rounded-lg bg-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-900">{new Date(p.predictionDate).toLocaleDateString()}</p>
                {p.growthPotential && (
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${GROWTH_COLORS[p.growthPotential] ?? 'bg-gray-100'}`}>
                    {GROWTH_LABELS[p.growthPotential] ?? p.growthPotential}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {p.skeletalAgeYears !== null && <div><p className="text-xs text-gray-500">Skeletal Age</p><p className="font-medium">{p.skeletalAgeYears} yrs</p></div>}
                {p.cervicalMaturationStage && <div><p className="text-xs text-gray-500">CVM Stage</p><p className="font-medium">{p.cervicalMaturationStage}</p></div>}
                {p.mandibularGrowthRemainingMm !== null && <div><p className="text-xs text-gray-500">Remaining Growth</p><p className="font-medium">{p.mandibularGrowthRemainingMm} mm</p></div>}
                {p.predictedAdultClass && <div><p className="text-xs text-gray-500">Adult Class</p><p className="font-medium">{p.predictedAdultClass}</p></div>}
              </div>
              {p.recommendations && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-gray-700 mb-1">Recommendations</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{p.recommendations}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
