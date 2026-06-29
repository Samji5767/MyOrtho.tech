'use client';
import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, AlertTriangle, Shield } from 'lucide-react';

interface DeviceBatch {
  id: string; batchCode: string; deviceType: string; materialLot: string | null;
  manufactureDate: string | null; expiryDate: string | null;
  caseIds: string[]; status: string; recallReason: string | null; createdAt: string;
}

interface Props { token: string }

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  recalled: 'bg-red-100 text-red-700',
  quarantined: 'bg-orange-100 text-orange-700',
  expired: 'bg-gray-100 text-gray-600',
};

export default function DeviceTrackingPanel({ token }: Props) {
  const [batches, setBatches] = useState<DeviceBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ batchCode: '', deviceType: 'aligner', materialLot: '', manufactureDate: '', expiryDate: '' });
  const [saving, setSaving] = useState(false);
  const [recalling, setRecalling] = useState<string | null>(null);
  const [recallReason, setRecallReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/device-batches', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setBatches(await r.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.batchCode.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/device-batches', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, materialLot: form.materialLot || null, manufactureDate: form.manufactureDate || null, expiryDate: form.expiryDate || null }),
      });
      setForm({ batchCode: '', deviceType: 'aligner', materialLot: '', manufactureDate: '', expiryDate: '' });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const recall = async (id: string) => {
    if (!recallReason.trim()) return;
    await fetch(`/api/device-batches/${id}/recall`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: recallReason }),
    });
    setRecalling(null);
    setRecallReason('');
    await load();
  };

  const quarantine = async (id: string) => {
    await fetch(`/api/device-batches/${id}/quarantine`, {
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
          <Package size={16} />
          Device Tracking &amp; Recall
        </h3>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          <Plus size={13} />
          New Batch
        </button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Batch Code *</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm font-mono" value={form.batchCode} onChange={e => setForm(f => ({ ...f, batchCode: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Device Type</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.deviceType} onChange={e => setForm(f => ({ ...f, deviceType: e.target.value }))}>
                <option value="aligner">Aligner</option>
                <option value="retainer">Retainer</option>
                <option value="model">Model</option>
                <option value="attachment_jig">Attachment Jig</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Material Lot</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.materialLot} onChange={e => setForm(f => ({ ...f, materialLot: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Manufacture Date</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.manufactureDate} onChange={e => setForm(f => ({ ...f, manufactureDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Expiry Date</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
            </div>
          </div>
          <button onClick={create} disabled={saving || !form.batchCode.trim()} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Batch'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : batches.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No device batches registered</p>
      ) : (
        <div className="space-y-2">
          {batches.map(batch => (
            <div key={batch.id} className="p-3 border rounded-lg bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-mono font-medium text-gray-900">{batch.batchCode}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${STATUS_COLOR[batch.status] ?? 'bg-gray-100'}`}>
                      {batch.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">{batch.deviceType} · {batch.caseIds.length} case{batch.caseIds.length !== 1 ? 's' : ''}</p>
                  {batch.materialLot && <p className="text-xs text-gray-400">Lot: {batch.materialLot}</p>}
                  {batch.recallReason && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={11} /> {batch.recallReason}
                    </p>
                  )}
                </div>
                {batch.status === 'active' && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => quarantine(batch.id)} className="text-xs px-2 py-1 border border-orange-300 text-orange-700 rounded hover:bg-orange-50">
                      Quarantine
                    </button>
                    <button onClick={() => setRecalling(recalling === batch.id ? null : batch.id)} className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50">
                      Recall
                    </button>
                  </div>
                )}
              </div>
              {recalling === batch.id && (
                <div className="mt-3 pt-3 border-t flex gap-2">
                  <input
                    className="flex-1 border rounded px-2 py-1.5 text-sm"
                    placeholder="Recall reason *"
                    value={recallReason}
                    onChange={e => setRecallReason(e.target.value)}
                  />
                  <button onClick={() => recall(batch.id)} disabled={!recallReason.trim()} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
                    Confirm
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
