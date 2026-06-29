'use client';
import { useState, useEffect, useCallback } from 'react';
import { Printer, Plus, ChevronRight, AlertTriangle } from 'lucide-react';

interface PrintJob {
  id: string; jobName: string; material: string; layerHeightUm: number;
  status: string; printDurationMinutes: number | null; notes: string | null;
  createdAt: string; startedAt: string | null; completedAt: string | null;
}

interface Props { token: string; caseId?: string }

const STATUS_COLOR: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700',
  printing: 'bg-blue-100 text-blue-700',
  post_processing: 'bg-yellow-100 text-yellow-700',
  qc: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const NEXT_LABEL: Record<string, string> = {
  queued: 'Start Printing',
  printing: 'Post-Process',
  post_processing: 'Send to QC',
  qc: 'Mark Complete',
};

export default function PrintFarmPanel({ token, caseId }: Props) {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ jobName: '', material: 'ortho_resin', layerHeightUm: 50, notes: '' });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const r = await fetch(`/api/print-jobs?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setJobs(await r.json());
    } finally { setLoading(false); }
  }, [token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.jobName.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, caseId: caseId ?? null }),
      });
      setForm({ jobName: '', material: 'ortho_resin', layerHeightUm: 50, notes: '' });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const advance = async (id: string) => {
    await fetch(`/api/print-jobs/${id}/advance`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    await load();
  };

  const fail = async (id: string) => {
    await fetch(`/api/print-jobs/${id}/fail`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Printer size={16} />
          Print Farm
        </h3>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          <Plus size={13} />
          New Job
        </button>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        {['', 'queued', 'printing', 'post_processing', 'qc', 'completed', 'failed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2 py-1 rounded-full border capitalize ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Job name *" value={form.jobName} onChange={e => setForm(f => ({ ...f, jobName: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Material</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))}>
                <option value="ortho_resin">Ortho Resin</option>
                <option value="model_resin">Model Resin</option>
                <option value="flexible_resin">Flexible Resin</option>
                <option value="castable_resin">Castable Resin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Layer Height (µm)</label>
              <input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.layerHeightUm} onChange={e => setForm(f => ({ ...f, layerHeightUm: Number(e.target.value) }))} />
            </div>
          </div>
          <textarea className="w-full border rounded px-3 py-2 text-sm" placeholder="Notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button onClick={create} disabled={saving || !form.jobName.trim()} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Job'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No print jobs</p>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => (
            <div key={job.id} className="p-3 border rounded-lg bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{job.jobName}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${STATUS_COLOR[job.status] ?? 'bg-gray-100'}`}>
                      {job.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{job.material} · {job.layerHeightUm}µm</p>
                  {job.printDurationMinutes && <p className="text-xs text-gray-400 mt-0.5">{Math.round(job.printDurationMinutes / 60)}h {job.printDurationMinutes % 60}m</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {NEXT_LABEL[job.status] && (
                    <button onClick={() => advance(job.id)} className="flex items-center gap-1 text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                      <ChevronRight size={11} />
                      {NEXT_LABEL[job.status]}
                    </button>
                  )}
                  {['queued', 'printing', 'post_processing', 'qc'].includes(job.status) && (
                    <button onClick={() => fail(job.id)} className="flex items-center gap-1 text-xs px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50">
                      <AlertTriangle size={11} />
                      Fail
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
