"use client";
import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { generateTreatmentSummary } from '@/lib/api/reports';

const API_BASE = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL ?? '') : '';

export function ReportDownloadButton({ caseId }: { caseId: string }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setGenerating(true);
    setError(null);
    try {
      const report = await generateTreatmentSummary(caseId);
      const url = `${API_BASE}/api/cases/${caseId}/reports/${report.id}/download`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `treatment-report-${report.id.slice(0, 8)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={generating}
        className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] px-4 h-9 text-sm font-semibold text-[color:var(--foreground)] hover:border-[color:var(--primary)] transition-colors disabled:opacity-50"
      >
        {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
        {generating ? 'Generating…' : 'Download Report'}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
