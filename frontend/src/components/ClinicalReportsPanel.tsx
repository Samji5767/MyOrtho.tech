'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ClinicalReport {
  id: string;
  reportType: string;
  title: string;
  status: string;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
}

const API = (path: string) => `/api/${path}`;
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const REPORT_TYPES = [
  { key: 'treatment_summary',  label: 'Treatment Summary' },
  { key: 'aligner_progress',   label: 'Aligner Progress' },
  { key: 'insurance_preauth',  label: 'Insurance Pre-Auth' },
] as const;

const STATUS_COLOR: Record<string, string> = {
  draft:    'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
};

type ReportTypeKey = (typeof REPORT_TYPES)[number]['key'];

const ENDPOINT_MAP: Record<ReportTypeKey, string> = {
  treatment_summary: 'treatment-summary',
  aligner_progress:  'aligner-progress',
  insurance_preauth: 'insurance-preauth',
};

export default function ClinicalReportsPanel({ caseId, planId }: { caseId: string; planId?: string }) {
  const [reports, setReports]           = useState<ClinicalReport[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [generating, setGenerating]     = useState<string | null>(null);
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [content, setContent]           = useState<Record<string, string>>({});

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(() => run(async () => {
    const data = await apiFetch<ClinicalReport[]>(`cases/${caseId}/reports`);
    setReports(data);
  }), [caseId, run]);

  useEffect(() => { load(); }, [load]);

  const generate = async (type: ReportTypeKey) => {
    setGenerating(type);
    try {
      const endpoint = ENDPOINT_MAP[type];
      const report = await apiFetch<ClinicalReport & { contentMarkdown: string }>(
        `cases/${caseId}/reports/${endpoint}`,
        { method: 'POST', body: JSON.stringify({ planId: planId ?? null }) },
      );
      setContent(prev => ({ ...prev, [report.id]: report.contentMarkdown ?? '' }));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(null);
    }
  };

  const approve = async (reportId: string) => {
    await run(async () => {
      await apiFetch(`cases/${caseId}/reports/${reportId}/approve`, { method: 'PATCH', body: '{}' });
      await load();
    });
  };

  const toggleExpand = async (reportId: string) => {
    if (expanded === reportId) { setExpanded(null); return; }
    setExpanded(reportId);
    if (!content[reportId]) {
      try {
        const r = await apiFetch<{ contentMarkdown: string }>(`cases/${caseId}/reports/${reportId}`);
        setContent(prev => ({ ...prev, [reportId]: r.contentMarkdown ?? '' }));
      } catch { /* ignore */ }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Clinical Reports</h3>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <div className="grid grid-cols-3 gap-2">
        {REPORT_TYPES.map(rt => (
          <button
            key={rt.key}
            onClick={() => generate(rt.key)}
            disabled={!!generating || loading}
            className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {generating === rt.key ? 'Generating…' : `Generate ${rt.label}`}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {reports.length === 0 && !loading && (
          <p className="py-8 text-center text-xs text-gray-400">No reports generated yet. Use the buttons above to generate reports.</p>
        )}
        {reports.map(r => (
          <div key={r.id} className="rounded border border-gray-200 bg-white overflow-hidden">
            <div className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleDateString()}</p>
                {r.approvedAt && r.approvedBy && (
                  <p className="text-xs text-green-700 mt-0.5">Approved {new Date(r.approvedAt).toLocaleDateString()}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                <button onClick={() => toggleExpand(r.id)} className="text-[10px] text-blue-600 underline">
                  {expanded === r.id ? 'Hide' : 'Preview'}
                </button>
                {r.status === 'draft' && (
                  <button onClick={() => approve(r.id)} disabled={loading} className="rounded bg-green-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                    Approve
                  </button>
                )}
              </div>
            </div>
            {expanded === r.id && (
              <div className="border-t border-gray-100 bg-gray-50 p-4">
                <pre className="text-[10px] text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                  {content[r.id] ?? 'Loading preview…'}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
