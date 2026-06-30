'use client';
import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Plus, X } from 'lucide-react';

interface ClinicalTask {
  id: string; title: string; description: string | null; priority: string;
  status: string; dueDate: string | null; assignedTo: string | null;
  caseId: string | null; createdAt: string; completedAt: string | null;
}

interface Props { caseId?: string; token: string }

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
};

export default function TasksPanel({ caseId, token }: Props) {
  const [tasks, setTasks] = useState<ClinicalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', dueDate: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (caseId) params.set('caseId', caseId);
      const r = await fetch(`/api/tasks?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setTasks(await r.json());
    } finally { setLoading(false); }
  }, [caseId, token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/tasks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, caseId: caseId ?? null, dueDate: form.dueDate || null }),
      });
      if (!r.ok) return;
      setForm({ title: '', description: '', priority: 'normal', dueDate: '' });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const pending = tasks.filter(t => t.status !== 'completed');
  const completed = tasks.filter(t => t.status === 'completed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <CheckSquare size={16} />
          Clinical Tasks
          {pending.length > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
          )}
        </h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? 'Cancel' : 'Add Task'}
        </button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Task title *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Description (optional)"
            rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Priority</label>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Due Date</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <button
            onClick={create}
            disabled={saving || !form.title.trim()}
            className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No open tasks</p>
      ) : (
        <div className="space-y-2">
          {pending.map(task => (
            <div key={task.id} className="p-3 border rounded-lg bg-white flex items-start gap-3">
              <button
                onClick={() => updateStatus(task.id, task.status === 'pending' ? 'in_progress' : 'completed')}
                className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 border-gray-300 hover:border-indigo-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLOR[task.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                    {task.priority}
                  </span>
                  {task.status === 'in_progress' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">In Progress</span>
                  )}
                </div>
                {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
                {task.dueDate && (
                  <p className="text-xs text-gray-400 mt-1">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <p className="text-xs text-gray-400">{completed.length} completed task{completed.length !== 1 ? 's' : ''} hidden</p>
      )}
    </div>
  );
}
