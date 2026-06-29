'use client';
import { useState, useEffect, useCallback } from 'react';
import { Flag, Plus, ToggleLeft, ToggleRight } from 'lucide-react';

interface FeatureFlag {
  id: string; flagName: string; description: string | null;
  enabled: boolean; rolloutPercent: number; organizationId: string | null;
  createdAt: string;
}

interface Props { token: string }

export default function FeatureFlagsPanel({ token }: Props) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ flagName: '', description: '', rolloutPercent: 100 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/feature-flags', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setFlags(await r.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.flagName.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/feature-flags', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ flagName: '', description: '', rolloutPercent: 100 });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const toggle = async (flag: FeatureFlag) => {
    await fetch(`/api/feature-flags/${flag.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !flag.enabled }),
    });
    await load();
  };

  const updateRollout = async (flag: FeatureFlag, rolloutPercent: number) => {
    await fetch(`/api/feature-flags/${flag.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolloutPercent }),
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Flag size={16} />
          Feature Flags
        </h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <Plus size={13} />
          New Flag
        </button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <input
            className="w-full border rounded px-3 py-2 text-sm font-mono"
            placeholder="flag_name (snake_case) *"
            value={form.flagName}
            onChange={e => setForm(f => ({ ...f, flagName: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
          />
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Description"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <div>
            <label className="block text-xs text-gray-600 mb-1">Rollout: {form.rolloutPercent}%</label>
            <input
              type="range" min={0} max={100} value={form.rolloutPercent}
              onChange={e => setForm(f => ({ ...f, rolloutPercent: Number(e.target.value) }))}
              className="w-full"
            />
          </div>
          <button onClick={create} disabled={saving || !form.flagName.trim()} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Flag'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : flags.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No feature flags configured</p>
      ) : (
        <div className="space-y-2">
          {flags.map(flag => (
            <div key={flag.id} className="p-3 border rounded-lg bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-mono font-medium text-gray-900">{flag.flagName}</p>
                    {flag.organizationId === null && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Global</span>
                    )}
                  </div>
                  {flag.description && <p className="text-xs text-gray-500 mt-0.5">{flag.description}</p>}
                  {flag.rolloutPercent < 100 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1">
                        <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${flag.rolloutPercent}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{flag.rolloutPercent}% rollout</span>
                    </div>
                  )}
                </div>
                <button onClick={() => toggle(flag)} className={`flex-shrink-0 ${flag.enabled ? 'text-green-600' : 'text-gray-400'} hover:opacity-80`}>
                  {flag.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>
              {flag.organizationId !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="range" min={0} max={100} defaultValue={flag.rolloutPercent}
                    onMouseUp={e => updateRollout(flag, Number((e.target as HTMLInputElement).value))}
                    onTouchEnd={e => updateRollout(flag, Number((e.target as HTMLInputElement).value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-400 w-10 text-right">{flag.rolloutPercent}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
