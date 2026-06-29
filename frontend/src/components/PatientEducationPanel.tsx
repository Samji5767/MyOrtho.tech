'use client';
import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, CheckCircle, Eye } from 'lucide-react';

interface EducationContent {
  id: string; title: string; category: string; contentType: string;
  contentUrl: string | null; bodyText: string | null; isGlobal: boolean;
}
interface EducationAssignment {
  id: string; contentId: string; viewedAt: string | null; completedAt: string | null;
  title?: string; category?: string;
}

interface Props { caseId: string; token: string }

export default function PatientEducationPanel({ caseId, token }: Props) {
  const [content, setContent] = useState<EducationContent[]>([]);
  const [assignments, setAssignments] = useState<EducationAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'assigned' | 'library'>('assigned');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, aRes] = await Promise.all([
        fetch('/api/education/content', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/education/cases/${caseId}/assignments`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cRes.ok) setContent(await cRes.json());
      if (aRes.ok) setAssignments(await aRes.json());
    } finally { setLoading(false); }
  }, [caseId, token]);

  useEffect(() => { load(); }, [load]);

  const assign = async (contentId: string) => {
    setAssigning(contentId);
    try {
      await fetch(`/api/education/cases/${caseId}/assignments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId }),
      });
      await load();
    } finally { setAssigning(null); }
  };

  const markViewed = async (id: string) => {
    await fetch(`/api/education/assignments/${id}/viewed`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  const markCompleted = async (id: string) => {
    await fetch(`/api/education/assignments/${id}/completed`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  const assignedIds = new Set(assignments.map(a => a.contentId));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <BookOpen size={16} />
          Patient Education
        </h3>
        <div className="flex rounded-md border overflow-hidden text-sm">
          {(['assigned', 'library'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {t === 'assigned' ? `Assigned (${assignments.length})` : 'Library'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : tab === 'assigned' ? (
        assignments.length === 0 ? (
          <div className="text-center py-6">
            <BookOpen size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No education content assigned yet.</p>
            <button onClick={() => setTab('library')} className="mt-2 text-sm text-indigo-600 hover:underline">Browse Library</button>
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map(a => (
              <div key={a.id} className="p-3 border rounded-lg bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{a.title ?? 'Untitled'}</p>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">{a.category ?? ''}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {a.viewedAt && <span className="flex items-center gap-1"><Eye size={11} /> Viewed</span>}
                      {a.completedAt && <span className="flex items-center gap-1 text-green-600"><CheckCircle size={11} /> Completed</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!a.viewedAt && (
                      <button onClick={() => markViewed(a.id)} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-600">
                        Mark Viewed
                      </button>
                    )}
                    {a.viewedAt && !a.completedAt && (
                      <button onClick={() => markCompleted(a.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {content.map(c => (
            <div key={c.id} className="p-3 border rounded-lg bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{c.title}</p>
                    {c.isGlobal && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Library</span>}
                    {assignedIds.has(c.id) && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Assigned</span>}
                  </div>
                  <p className="text-xs text-gray-500 capitalize mt-0.5">{c.category} · {c.contentType}</p>
                  {expanded === c.id && c.bodyText && (
                    <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{c.bodyText}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {c.bodyText && (
                    <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-600">
                      {expanded === c.id ? 'Hide' : 'Preview'}
                    </button>
                  )}
                  {!assignedIds.has(c.id) && (
                    <button
                      onClick={() => assign(c.id)}
                      disabled={assigning === c.id}
                      className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {assigning === c.id ? '…' : 'Assign'}
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
