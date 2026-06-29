'use client';
import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Trash2, ExternalLink } from 'lucide-react';

interface OrgDocument {
  id: string; documentType: string; fileName: string; fileUrl: string;
  fileSizeBytes: number | null; mimeType: string | null; tags: string[];
  uploadedBy: string; createdAt: string;
}

interface Props { caseId?: string; patientId?: string; token: string }

const DOC_TYPES = ['clinical', 'consent', 'insurance', 'referral', 'lab', 'imaging', 'prescription', 'correspondence', 'other'];

export default function DocumentsPanel({ caseId, patientId, token }: Props) {
  const [docs, setDocs] = useState<OrgDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ documentType: 'clinical', fileName: '', fileUrl: '', mimeType: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (caseId) params.set('caseId', caseId);
      if (patientId) params.set('patientId', patientId);
      const r = await fetch(`/api/documents?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setDocs(await r.json());
    } finally { setLoading(false); }
  }, [caseId, patientId, token]);

  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    if (!form.fileName.trim() || !form.fileUrl.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, caseId: caseId ?? null, patientId: patientId ?? null }),
      });
      setForm({ documentType: 'clinical', fileName: '', fileUrl: '', mimeType: '' });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  const fmtSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <FileText size={16} />
          Documents
        </h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <Plus size={13} />
          Add Document
        </button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={form.documentType}
                onChange={e => setForm(f => ({ ...f, documentType: e.target.value }))}
              >
                {DOC_TYPES.map(t => (
                  <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">MIME Type</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="application/pdf"
                value={form.mimeType}
                onChange={e => setForm(f => ({ ...f, mimeType: e.target.value }))}
              />
            </div>
          </div>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="File name *"
            value={form.fileName}
            onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))}
          />
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="File URL (storage path) *"
            value={form.fileUrl}
            onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))}
          />
          <button
            onClick={upload}
            disabled={saving || !form.fileName.trim() || !form.fileUrl.trim()}
            className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Document'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No documents uploaded</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="p-3 border rounded-lg bg-white flex items-center gap-3">
              <FileText size={18} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                <div className="flex gap-2 mt-0.5 text-xs text-gray-400">
                  <span className="capitalize">{doc.documentType}</span>
                  {doc.fileSizeBytes && <span>{fmtSize(doc.fileSizeBytes)}</span>}
                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-gray-500 hover:text-indigo-600 rounded"
                >
                  <ExternalLink size={14} />
                </a>
                <button onClick={() => remove(doc.id)} className="p-1.5 text-gray-500 hover:text-red-600 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
