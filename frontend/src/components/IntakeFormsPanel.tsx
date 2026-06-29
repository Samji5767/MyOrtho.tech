'use client';
import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Send, CheckCircle } from 'lucide-react';

interface IntakeTemplate {
  id: string; templateName: string; formType: string;
  fields: Array<{ id: string; label: string; type: string; required?: boolean; options?: string[] }>;
  isActive: boolean;
}
interface IntakeSubmission {
  id: string; submittedAt: string; reviewedAt: string | null;
  submittedData: Record<string, unknown>;
}

interface Props { token: string; patientId?: string; caseId?: string }

const FORM_TYPES = ['medical_history', 'consent', 'questionnaire', 'registration', 'insurance'];

export default function IntakeFormsPanel({ token, patientId, caseId }: Props) {
  const [templates, setTemplates] = useState<IntakeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IntakeTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissions, setSubmissions] = useState<IntakeSubmission[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({ templateName: '', formType: 'medical_history' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/intake-forms/templates', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setTemplates(await r.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const loadSubmissions = async (templateId: string) => {
    const r = await fetch(`/api/intake-forms/templates/${templateId}/submissions`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setSubmissions(await r.json());
  };

  const selectTemplate = (t: IntakeTemplate) => {
    setSelected(t);
    setFormData({});
    setSubmitted(false);
    loadSubmissions(t.id);
  };

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await fetch('/api/intake-forms/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selected.id,
          patientId: patientId ?? null,
          caseId: caseId ?? null,
          submittedData: formData,
        }),
      });
      setSubmitted(true);
      loadSubmissions(selected.id);
    } finally { setSubmitting(false); }
  };

  const createTemplate = async () => {
    if (!newForm.templateName.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/intake-forms/templates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newForm, fields: [] }),
      });
      setNewForm({ templateName: '', formType: 'medical_history' });
      setShowCreate(false);
      await load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList size={16} />
          Intake Forms
        </h3>
        <button onClick={() => setShowCreate(v => !v)} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          <Plus size={13} />
          New Template
        </button>
      </div>

      {showCreate && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Template name *"
            value={newForm.templateName}
            onChange={e => setNewForm(f => ({ ...f, templateName: e.target.value }))}
          />
          <select
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={newForm.formType}
            onChange={e => setNewForm(f => ({ ...f, formType: e.target.value }))}
          >
            {FORM_TYPES.map(t => (
              <option key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button onClick={createTemplate} disabled={saving || !newForm.templateName.trim()} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Template'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No intake form templates configured</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map(t => (
            <div
              key={t.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${selected?.id === t.id ? 'border-indigo-500 bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}
              onClick={() => selectTemplate(t)}
            >
              <p className="text-sm font-medium text-gray-900">{t.templateName}</p>
              <p className="text-xs text-gray-500 mt-0.5 capitalize">{t.formType.replace(/_/g, ' ')} · {t.fields.length} fields</p>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <p className="text-sm font-medium text-gray-900">{selected.templateName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
          </div>
          {selected.fields.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">This template has no fields configured yet.</p>
              <p className="text-xs text-gray-400 mt-1">Fields can be added via the API or admin tools.</p>
            </div>
          ) : submitted ? (
            <div className="p-4 flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle size={16} />
              Form submitted successfully
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {selected.fields.map(field => (
                <div key={field.id}>
                  <label className="block text-xs text-gray-600 mb-1">
                    {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {field.type === 'select' && field.options ? (
                    <select className="w-full border rounded px-2 py-1.5 text-sm" value={formData[field.id] ?? ''} onChange={e => setFormData(d => ({ ...d, [field.id]: e.target.value }))}>
                      <option value="">Select…</option>
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={3} value={formData[field.id] ?? ''} onChange={e => setFormData(d => ({ ...d, [field.id]: e.target.value }))} />
                  ) : (
                    <input className="w-full border rounded px-2 py-1.5 text-sm" type={field.type === 'date' ? 'date' : 'text'} value={formData[field.id] ?? ''} onChange={e => setFormData(d => ({ ...d, [field.id]: e.target.value }))} />
                  )}
                </div>
              ))}
              <button onClick={submit} disabled={submitting} className="flex items-center gap-2 w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 justify-center disabled:opacity-50">
                <Send size={13} />
                {submitting ? 'Submitting…' : 'Submit Form'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
