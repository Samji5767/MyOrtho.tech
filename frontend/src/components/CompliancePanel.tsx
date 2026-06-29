'use client';
import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Plus, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface ComplianceRequirement {
  id: string; requirementName: string; category: string;
  description: string | null; dueDate: string | null; status: string;
  evidenceUrl: string | null;
}
interface ComplianceScore {
  total: number; compliant: number; score: number;
  byCategory: Record<string, { compliant: number; total: number }>;
}

interface Props { token: string }

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  compliant: { icon: CheckCircle, color: 'text-green-600', label: 'Compliant' },
  non_compliant: { icon: AlertCircle, color: 'text-red-600', label: 'Non-Compliant' },
  in_progress: { icon: Clock, color: 'text-yellow-600', label: 'In Progress' },
  not_started: { icon: Clock, color: 'text-gray-400', label: 'Not Started' },
};

export default function CompliancePanel({ token }: Props) {
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [score, setScore] = useState<ComplianceScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ requirementName: '', category: 'hipaa', description: '', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [updateForm, setUpdateForm] = useState({ status: 'compliant', evidenceUrl: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, sRes] = await Promise.all([
        fetch('/api/compliance', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/compliance/score', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (rRes.ok) setRequirements(await rRes.json());
      if (sRes.ok) setScore(await sRes.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const seed = async () => {
    await fetch('/api/compliance/seed', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const create = async () => {
    if (!form.requirementName.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/compliance', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, dueDate: form.dueDate || null }),
      });
      setForm({ requirementName: '', category: 'hipaa', description: '', dueDate: '' });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const updateStatus = async (id: string) => {
    await fetch(`/api/compliance/${id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: updateForm.status, evidenceUrl: updateForm.evidenceUrl || null }),
    });
    setSelected(null);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ShieldCheck size={16} />
          Regulatory Compliance
        </h3>
        <div className="flex gap-2">
          <button onClick={seed} className="text-sm px-3 py-1.5 border rounded-md hover:bg-gray-50 text-gray-700">
            Seed Defaults
          </button>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            <Plus size={13} />
            Add
          </button>
        </div>
      </div>

      {score && (
        <div className="p-4 border rounded-lg bg-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">Overall Compliance Score</p>
            <p className={`text-lg font-bold ${score.score >= 80 ? 'text-green-600' : score.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {score.score}%
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full ${score.score >= 80 ? 'bg-green-500' : score.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${score.score}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(score.byCategory).map(([cat, data]) => (
              <div key={cat} className="flex justify-between text-xs text-gray-600">
                <span className="capitalize font-medium">{cat}</span>
                <span>{data.compliant}/{data.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Requirement name *"
            value={form.requirementName}
            onChange={e => setForm(f => ({ ...f, requirementName: e.target.value }))}
          />
          <textarea
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Description"
            rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <select className="border rounded px-2 py-1.5 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="hipaa">HIPAA</option>
              <option value="iso">ISO</option>
              <option value="osha">OSHA</option>
              <option value="state">State</option>
              <option value="other">Other</option>
            </select>
            <input type="date" className="border rounded px-2 py-1.5 text-sm" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <button onClick={create} disabled={saving || !form.requirementName.trim()} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : requirements.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No compliance requirements. Click "Seed Defaults" to get started.</p>
      ) : (
        <div className="space-y-2">
          {requirements.map(req => {
            const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG['not_started'];
            const Icon = cfg.icon;
            return (
              <div key={req.id} className="p-3 border rounded-lg bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Icon size={15} className={`mt-0.5 flex-shrink-0 ${cfg.color}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{req.requirementName}</p>
                      {req.description && <p className="text-xs text-gray-500 mt-0.5">{req.description}</p>}
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        <span className="capitalize">{req.category}</span>
                        {req.dueDate && <span>Due: {new Date(req.dueDate).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(selected === req.id ? null : req.id)}
                    className={`text-xs px-2 py-1 border rounded flex-shrink-0 ${cfg.color} border-current bg-white hover:bg-gray-50`}
                  >
                    {cfg.label}
                  </button>
                </div>
                {selected === req.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <select
                      className="w-full border rounded px-2 py-1.5 text-sm"
                      value={updateForm.status}
                      onChange={e => setUpdateForm(f => ({ ...f, status: e.target.value }))}
                    >
                      <option value="compliant">Compliant</option>
                      <option value="non_compliant">Non-Compliant</option>
                      <option value="in_progress">In Progress</option>
                      <option value="not_started">Not Started</option>
                    </select>
                    <input
                      className="w-full border rounded px-2 py-1.5 text-sm"
                      placeholder="Evidence URL (optional)"
                      value={updateForm.evidenceUrl}
                      onChange={e => setUpdateForm(f => ({ ...f, evidenceUrl: e.target.value }))}
                    />
                    <button onClick={() => updateStatus(req.id)} className="w-full py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
                      Update Status
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
