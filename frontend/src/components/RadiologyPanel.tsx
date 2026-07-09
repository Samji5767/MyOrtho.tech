'use client';
import { useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, Plus, Trash2, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api/client';

interface RadiologyImage {
  id: string; imageType: string; fileUrl: string;
  captureDate: string | null; notes: string | null; createdAt: string;
}

interface Props { patientId: string; caseId?: string }

const IMAGE_TYPES = ['panoramic', 'periapical', 'bitewing', 'lateral_ceph', 'cbct', 'intraoral', 'photo'];

export default function RadiologyPanel({ patientId, caseId }: Props) {
  const [images, setImages] = useState<RadiologyImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ imageType: 'panoramic', fileUrl: '', captureDate: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ patientId });
      if (caseId) params.set('caseId', caseId);
      if (filter) params.set('imageType', filter);
      const data = await api.get<RadiologyImage[]>(`/api/radiology?${params}`);
      setImages(data);
    } catch { /* silent on load failure */ } finally { setLoading(false); }
  }, [patientId, caseId, filter]);

  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    if (!form.fileUrl.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/radiology', { ...form, patientId, caseId: caseId ?? null, captureDate: form.captureDate || null, notes: form.notes || null });
      setForm({ imageType: 'panoramic', fileUrl: '', captureDate: '', notes: '' });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    await api.delete(`/api/radiology/${id}`);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ImageIcon size={16} />
          Radiology / Imaging
        </h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <Plus size={13} />
          Add Image
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('')}
          className={`text-xs px-2 py-1 rounded-full border ${!filter ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          All
        </button>
        {IMAGE_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setFilter(filter === t ? '' : t)}
            className={`text-xs px-2 py-1 rounded-full border capitalize ${filter === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Image Type</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.imageType} onChange={e => setForm(f => ({ ...f, imageType: e.target.value }))}>
                {IMAGE_TYPES.map(t => (
                  <option key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Capture Date</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.captureDate} onChange={e => setForm(f => ({ ...f, captureDate: e.target.value }))} />
            </div>
          </div>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="File URL (storage path) *"
            value={form.fileUrl}
            onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))}
          />
          <textarea
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Notes (optional)"
            rows={2}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
          <button onClick={upload} disabled={saving || !form.fileUrl.trim()} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Image Record'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No radiology images recorded</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {images.map(img => (
            <div key={img.id} className="p-3 border rounded-lg bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 capitalize">{img.imageType.replace(/_/g, ' ')}</p>
                  {img.captureDate && <p className="text-xs text-gray-500 mt-0.5">{new Date(img.captureDate).toLocaleDateString()}</p>}
                  {img.notes && <p className="text-xs text-gray-400 mt-1 truncate">{img.notes}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <a href={img.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:text-indigo-600 rounded">
                    <ExternalLink size={13} />
                  </a>
                  <button onClick={() => remove(img.id)} className="p-1.5 text-gray-500 hover:text-red-600 rounded">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
