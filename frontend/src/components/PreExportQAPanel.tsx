"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/DesignSystem";
import {
  listQAReports,
  runQA,
  approveQAReport,
  QA_CHECK_LABELS,
  type QAReport,
  type QACheck,
} from "@/lib/api/preexportQa";
import {
  listExports,
  createExport,
  EXPORT_TYPE_LABELS,
  FORMAT_LABELS,
  type ManufactureExport,
  type ExportType,
  type ExportFormat,
} from "@/lib/api/manufacturingPrep";

// ─── Disclaimer ───────────────────────────────────────────────────────────────

function ExportDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span>
        <strong>Clinician approval required.</strong> Pre-export QA and manufacturing output require clinician sign-off before physical production begins. AI-generated outputs are clinical decision support only.
      </span>
    </div>
  );
}

// ─── QA check row ────────────────────────────────────────────────────────────

function CheckRow({ check }: { check: QACheck }) {
  const icons = {
    pass:    <CheckCircle2 size={15} className="text-emerald-500" />,
    warning: <AlertTriangle size={15} className="text-amber-500" />,
    fail:    <XCircle size={15} className="text-red-500" />,
  };
  const rowCls = {
    pass:    "",
    warning: "bg-amber-50/50 dark:bg-amber-500/5",
    fail:    "bg-red-50/50 dark:bg-red-500/5",
  };

  return (
    <div className={`flex items-start gap-3 rounded-xl border border-[color:var(--border)] px-3 py-2.5 ${rowCls[check.status]}`}>
      <span className="mt-0.5 shrink-0">{icons[check.status]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[color:var(--foreground)]">
          {QA_CHECK_LABELS[check.key] ?? check.key}
        </p>
        <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{check.detail}</p>
      </div>
    </div>
  );
}

// ─── QA overall badge ─────────────────────────────────────────────────────────

function QAStatusBadge({ status }: { status: QAReport["overallStatus"] }) {
  const map = {
    pending:  { label: "Pending",  tone: "neutral"  as const },
    passed:   { label: "Passed",   tone: "success"  as const },
    warnings: { label: "Warnings", tone: "warning"  as const },
    failed:   { label: "Failed",   tone: "danger"   as const },
  };
  const { label, tone } = map[status];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

// ─── QA Panel section ─────────────────────────────────────────────────────────

function QASection({ caseId }: { caseId: string }) {
  const [reports, setReports] = useState<QAReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listQAReports(caseId);
      setReports(list);
    } catch {
      // leave empty
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  async function handleRun() {
    setRunning(true);
    setError("");
    try {
      const report = await runQA(caseId);
      setReports((prev) => [report, ...prev]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "QA run failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleApprove(reportId: string) {
    setApproving(true);
    setError("");
    try {
      const updated = await approveQAReport(caseId, reportId, notes.trim() || undefined);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }

  const latest = reports[0] ?? null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-[color:var(--primary)]" />
        <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Pre-Export QA</h3>
        <button
          type="button"
          onClick={load}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--muted-foreground)] transition-transform active:scale-90"
        >
          <RefreshCw size={14} />
        </button>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="flex h-8 items-center gap-1.5 rounded-full bg-[color:var(--primary)] px-3 text-xs font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <FileCheck size={12} />}
          Run QA
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-[color:var(--muted-foreground)]" />
        </div>
      ) : !latest ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <ShieldCheck size={24} className="text-[color:var(--muted-foreground)]" />
          <p className="text-sm text-[color:var(--muted-foreground)]">
            No QA reports yet. Run the 10-check pre-export validation.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-xs">
            <QAStatusBadge status={latest.overallStatus} />
            <span className="text-emerald-600 dark:text-emerald-400">
              {latest.passCount} passed
            </span>
            {latest.warningCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {latest.warningCount} warnings
              </span>
            )}
            {latest.failCount > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {latest.failCount} failed
              </span>
            )}
            <span className="ml-auto text-[color:var(--muted-foreground)]">
              {new Date(latest.generatedAt).toLocaleDateString()}
            </span>
          </div>

          {/* All checks */}
          <div className="space-y-2">
            {latest.checks.map((check) => (
              <CheckRow key={check.key} check={check} />
            ))}
          </div>

          {/* Approve */}
          {!latest.approvedAt ? (
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold text-[color:var(--foreground)]">
                Clinician Sign-off
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional approval notes…"
                className="mb-3 w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)] placeholder:text-[color:var(--muted-foreground)]"
              />
              <button
                type="button"
                onClick={() => handleApprove(latest.id)}
                disabled={approving || latest.overallStatus === "failed"}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
              >
                {approving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                Approve for Export
              </button>
              {latest.overallStatus === "failed" && (
                <p className="mt-2 text-[10px] text-red-500 dark:text-red-400">
                  QA must pass (or pass with warnings) before clinician sign-off.
                </p>
              )}
            </Card>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-2.5 text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 size={13} />
              Approved by {latest.approvedByEmail ?? "clinician"} ·{" "}
              {new Date(latest.approvedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Manufacturing export form ────────────────────────────────────────────────

const EXPORT_TYPES: ExportType[] = [
  "stage_models", "aligner_models", "attachment_models",
  "ibt", "surgical_guide", "full_case", "qa_report",
];

const EXPORT_FORMATS: ExportFormat[] = ["stl", "obj", "3mf", "ply", "zip"];

function ManufacturingSection({ caseId }: { caseId: string }) {
  const [exports, setExports] = useState<ManufactureExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [exportType, setExportType] = useState<ExportType>("full_case");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("stl");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listExports(caseId);
      setExports(list);
    } catch {
      // leave empty
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const exp = await createExport(caseId, { exportType, exportFormat });
      setExports((prev) => [exp, ...prev]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export creation failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Download size={16} className="text-[color:var(--primary)]" />
        <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Manufacturing Export</h3>
        <button
          type="button"
          onClick={load}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--muted-foreground)] transition-transform active:scale-90"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Export form */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
              Export type
            </label>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as ExportType)}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)]"
            >
              {EXPORT_TYPES.map((t) => (
                <option key={t} value={t}>{EXPORT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
              Format
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)]"
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] py-2.5 text-xs font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
        >
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Create Export Package
        </button>
      </Card>

      {/* Export history */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-[color:var(--muted-foreground)]" />
        </div>
      ) : exports.length > 0 ? (
        <div className="space-y-2">
          {exports.map((exp) => {
            const statusMap = {
              pending:    { tone: "neutral" as const, label: "Pending" },
              processing: { tone: "info"    as const, label: "Processing" },
              completed:  { tone: "success" as const, label: "Completed" },
              failed:     { tone: "danger"  as const, label: "Failed" },
            };
            const { tone, label } = statusMap[exp.status];
            const sizeKb = exp.manifest.estimatedSizeBytes
              ? Math.round(exp.manifest.estimatedSizeBytes / 1024)
              : null;

            return (
              <div
                key={exp.id}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[color:var(--foreground)]">
                    {EXPORT_TYPE_LABELS[exp.exportType]}
                  </span>
                  <StatusBadge tone={tone}>{label}</StatusBadge>
                  <span className="ml-auto text-[10px] text-[color:var(--muted-foreground)]">
                    {FORMAT_LABELS[exp.exportFormat]}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[color:var(--muted-foreground)]">
                  <span>{exp.manifest.fileCount} files</span>
                  {sizeKb != null && <span>~{sizeKb} KB</span>}
                  <span>{new Date(exp.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-3 text-center text-xs text-[color:var(--muted-foreground)]">
          No exports yet for this case.
        </p>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function PreExportQAPanel({ caseId }: { caseId: string }) {
  return (
    <div className="space-y-6">
      <ExportDisclaimer />
      <QASection caseId={caseId} />
      <div className="h-px bg-[color:var(--border)]" />
      <ManufacturingSection caseId={caseId} />
    </div>
  );
}
