'use client';
import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, BarChart2, Send } from 'lucide-react';

interface Survey {
  id: string; title: string; description: string | null; isActive: boolean;
  questions: Array<{ id: string; text: string; type: string; options?: string[] }>;
  createdAt: string;
}
interface SurveyStats {
  totalResponses: number; averages: Record<string, number>;
}

interface Props { token: string; caseId?: string }

export default function SurveysPanel({ token, caseId }: Props) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Survey | null>(null);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [responses, setResponses] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState<'surveys' | 'respond'>('surveys');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/surveys', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setSurveys(await r.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const loadStats = async (survey: Survey) => {
    const r = await fetch(`/api/surveys/${survey.id}/stats`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setStats(await r.json());
    setSelected(survey);
    setTab('surveys');
  };

  const submit = async () => {
    if (!selected || !caseId) return;
    setSubmitting(true);
    try {
      await fetch(`/api/surveys/${selected.id}/respond`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, answers: responses }),
      });
      setSubmitted(true);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList size={16} />
          Patient Surveys
        </h3>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : surveys.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No surveys available</p>
      ) : (
        <div className="space-y-3">
          {surveys.map(survey => (
            <div key={survey.id} className="border rounded-lg bg-white overflow-hidden">
              <div className="p-3 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{survey.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${survey.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {survey.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {survey.description && <p className="text-xs text-gray-500 mt-0.5">{survey.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{survey.questions.length} question{survey.questions.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => loadStats(survey)}
                    className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-600"
                  >
                    <BarChart2 size={11} />
                    Stats
                  </button>
                  {caseId && survey.isActive && (
                    <button
                      onClick={() => { setSelected(survey); setTab('respond'); setSubmitted(false); setResponses({}); }}
                      className="flex items-center gap-1 text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      <Send size={11} />
                      Respond
                    </button>
                  )}
                </div>
              </div>

              {selected?.id === survey.id && tab === 'surveys' && stats && (
                <div className="border-t bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Stats ({stats.totalResponses} responses)</p>
                  {Object.keys(stats.averages).length === 0 ? (
                    <p className="text-xs text-gray-400">No numeric answers yet</p>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(stats.averages).map(([q, avg]) => (
                        <div key={q} className="flex justify-between text-xs text-gray-600">
                          <span className="truncate">{q}</span>
                          <span className="font-medium">{avg.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selected?.id === survey.id && tab === 'respond' && !submitted && (
                <div className="border-t bg-gray-50 p-3 space-y-3">
                  <p className="text-xs font-medium text-gray-700">Patient Response Form</p>
                  {survey.questions.map(q => (
                    <div key={q.id}>
                      <label className="block text-xs text-gray-600 mb-1">{q.text}</label>
                      {q.type === 'rating' ? (
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              onClick={() => setResponses(r => ({ ...r, [q.id]: n }))}
                              className={`w-8 h-8 rounded-full text-sm border ${responses[q.id] === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-gray-100'}`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      ) : q.type === 'boolean' ? (
                        <div className="flex gap-2">
                          {['Yes', 'No'].map(opt => (
                            <button
                              key={opt}
                              onClick={() => setResponses(r => ({ ...r, [q.id]: opt }))}
                              className={`px-3 py-1 text-sm border rounded ${responses[q.id] === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-gray-100'}`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          className="w-full border rounded px-2 py-1.5 text-sm"
                          rows={2}
                          value={(responses[q.id] as string) ?? ''}
                          onChange={e => setResponses(r => ({ ...r, [q.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                  <button onClick={submit} disabled={submitting} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
                    {submitting ? 'Submitting…' : 'Submit Response'}
                  </button>
                </div>
              )}
              {selected?.id === survey.id && tab === 'respond' && submitted && (
                <div className="border-t bg-green-50 p-3 text-sm text-green-700 text-center">
                  Response submitted successfully
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
