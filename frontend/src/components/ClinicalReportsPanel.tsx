'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Download, FileText, RefreshCw } from 'lucide-react';
import { ClinicalWarningBanner } from '@/components/ui/ClinicalWarningBanner';

interface ClinicalReport {
  id: string;
  reportType: string;
  title: string;
  status: string;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  contentMarkdown?: string;
}

const API = (path: string) => `/api/${path}`;
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

// ─── 4-audience report type registry ─────────────────────────────────────────
const REPORT_TYPES = [
  {
    key: 'treatment_summary',
    label: 'Orthodontist Summary',
    endpoint: 'treatment-summary',
    audience: 'Orthodontist',
    description: 'Comprehensive clinical summary with quality score, IPR, attachments, and simulation projections.',
    color: 'blue',
  },
  {
    key: 'patient_report',
    label: 'Patient Report',
    endpoint: 'patient-report',
    audience: 'Patient',
    description: 'Plain-language summary of treatment plan and patient responsibilities.',
    color: 'emerald',
  },
  {
    key: 'referring_dentist_report',
    label: 'Referring Dentist',
    endpoint: 'referring-dentist',
    audience: 'Referring Dentist',
    description: 'Clinical summary with occlusal findings and coordination notes for the referring GP.',
    color: 'violet',
  },
  {
    key: 'laboratory_report',
    label: 'Laboratory Report',
    endpoint: 'laboratory',
    audience: 'Lab / Manufacturing',
    description: 'Manufacturing specifications, IPR schedule, QC checklist, and material guidance for the lab.',
    color: 'amber',
  },
  {
    key: 'aligner_progress',
    label: 'Aligner Progress',
    endpoint: 'aligner-progress',
    audience: 'Orthodontist',
    description: 'Stage completion status, compliance percentage, and estimated completion date.',
    color: 'blue',
  },
  {
    key: 'insurance_preauth',
    label: 'Insurance Pre-Auth',
    endpoint: 'insurance-preauth',
    audience: 'Insurance',
    description: 'Pre-authorization request with CDT codes and estimated fee.',
    color: 'slate',
  },
] as const;

type ReportTypeKey = (typeof REPORT_TYPES)[number]['key'];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; btn: string }> = {
  blue:    { bg: 'bg-blue-50/60',    text: 'text-blue-700',    border: 'border-blue-200/60',    btn: 'bg-blue-600 hover:bg-blue-700' },
  emerald: { bg: 'bg-emerald-50/60', text: 'text-emerald-700', border: 'border-emerald-200/60', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  violet:  { bg: 'bg-violet-50/60',  text: 'text-violet-700',  border: 'border-violet-200/60',  btn: 'bg-violet-600 hover:bg-violet-700' },
  amber:   { bg: 'bg-amber-50/60',   text: 'text-amber-700',   border: 'border-amber-200/60',   btn: 'bg-amber-600 hover:bg-amber-700' },
  slate:   { bg: 'bg-slate-50/60',   text: 'text-slate-700',   border: 'border-slate-200/60',   btn: 'bg-slate-600 hover:bg-slate-700' },
};

export default function ClinicalReportsPanel({ caseId, planId }: { caseId: string; planId?: string }) {
  const [reports, setReports]       = useState<ClinicalReport[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [content, setContent]       = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch<ClinicalReport[]>(`cases/${caseId}/reports`);
      setReports(data);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  const generate = async (type: ReportTypeKey) => {
    const rt = REPORT_TYPES.find(r => r.key === type);
    if (!rt) return;
    setGenerating(type);
    setError(null);
    try {
      const body: Record<string, unknown> = { planId: planId ?? null };
      if (type === 'insurance_preauth') {
        body['cdtCodes'] = ['D8010'];
        body['estimatedFee'] = 0;
      }
      const report = await apiFetch<ClinicalReport>(
        `cases/${caseId}/reports/${rt.endpoint}`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      if (report.contentMarkdown) {
        setContent(prev => ({ ...prev, [report.id]: report.contentMarkdown! }));
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(null);
    }
  };

  const approve = async (reportId: string) => {
    try {
      await apiFetch(`cases/${caseId}/reports/${reportId}/approve`, { method: 'PATCH', body: '{}' });
      await load();
    } catch (e) { setError((e as Error).message); }
  };

  const toggleExpand = async (reportId: string) => {
    if (expanded === reportId) { setExpanded(null); return; }
    setExpanded(reportId);
    if (!content[reportId]) {
      try {
        const r = await apiFetch<ClinicalReport>(`cases/${caseId}/reports/${reportId}`);
        if (r.contentMarkdown) setContent(prev => ({ ...prev, [reportId]: r.contentMarkdown! }));
      } catch { /* non-critical */ }
    }
  };

  const downloadReport = (reportId: string) => {
    window.open(`/api/cases/${caseId}/reports/${reportId}/download`, '_blank');
  };

  // Group existing reports by type for display
  const reportsByType = reports.reduce<Record<string, ClinicalReport[]>>((acc, r) => {
    if (!acc[r.reportType]) acc[r.reportType] = [];
    acc[r.reportType].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <ClinicalWarningBanner message="AI-assisted reports require clinician review and approval before sharing with patients, referring providers, or laboratories." />

      {error && (
        <div className="rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-xs text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Report generation grid — 4 audiences */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Generate Reports by Audience</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REPORT_TYPES.map(rt => {
            const colors = COLOR_MAP[rt.color] ?? COLOR_MAP.slate;
            const existingReports = reportsByType[rt.key] ?? [];
            const latestApproved = existingReports.find(r => r.approvedAt);
            return (
              <div key={rt.key} className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText size={13} className={colors.text} />
                      <p className={`text-xs font-semibold ${colors.text}`}>{rt.label}</p>
                    </div>
                    <p className={`mt-0.5 text-[10px] ${colors.text} opacity-70 uppercase tracking-wide`}>
                      Audience: {rt.audience}
                    </p>
                  </div>
                  {latestApproved && (
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  )}
                </div>
                <p className={`text-[11px] ${colors.text} opacity-80 mb-3`}>{rt.description}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void generate(rt.key)}
                    disabled={!!generating || loading}
                    className={`rounded px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 ${colors.btn} transition-colors`}
                  >
                    {generating === rt.key ? 'Generating…' : existingReports.length > 0 ? 'Regenerate' : 'Generate'}
                  </button>
                  {existingReports.length > 0 && (
                    <span className={`text-[10px] ${colors.text} opacity-70`}>
                      {existingReports.length} report{existingReports.length !== 1 ? 's' : ''} on file
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Report list */}
      {reports.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Generated Reports ({reports.length})</h3>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 text-[11px] text-secondary hover:text-foreground"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <div className="space-y-2">
            {reports.map(r => (
              <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
                    <p className="text-[10px] text-secondary mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString()} · {r.reportType.replace(/_/g, ' ')}
                    </p>
                    {r.approvedAt && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        Approved {new Date(r.approvedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      r.status === 'approved' || r.approvedAt
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {r.status === 'approved' || r.approvedAt ? 'Approved' : 'Draft'}
                    </span>
                    <button
                      onClick={() => void toggleExpand(r.id)}
                      className="text-[10px] text-secondary hover:text-foreground flex items-center gap-1"
                    >
                      {expanded === r.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      {expanded === r.id ? 'Hide' : 'Preview'}
                    </button>
                    <button
                      onClick={() => downloadReport(r.id)}
                      className="text-[10px] text-secondary hover:text-foreground flex items-center gap-1"
                      title="Download HTML report"
                    >
                      <Download size={11} />
                      Download
                    </button>
                    {!r.approvedAt && (
                      <button
                        onClick={() => void approve(r.id)}
                        disabled={loading}
                        className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>

                {expanded === r.id && (
                  <div className="border-t border-border bg-slate-50/60 dark:bg-slate-900/30 p-4">
                    <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-foreground max-h-80 overflow-y-auto">
                      {content[r.id] ?? 'Loading preview…'}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {reports.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <FileText size={28} className="text-secondary" />
          <p className="text-sm font-medium text-secondary">No reports generated yet</p>
          <p className="max-w-xs text-xs text-secondary">
            Use the buttons above to generate reports for each audience:
            orthodontist, patient, referring dentist, or laboratory.
          </p>
        </div>
      )}
    </div>
  );
}
