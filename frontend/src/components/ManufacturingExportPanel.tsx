"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  AVAILABLE_EXPORT_TYPES,
  EXPORT_TYPE_LABELS,
  createExport,
  exportDownloadUrl,
  getManufacturingReadiness,
  listExports,
  type ExportType,
  type ManufactureExport,
  type ManufacturingReadiness,
} from "@/lib/api/manufacturingPrep";

function formatBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusChip({ status }: { status: ManufactureExport["status"] }) {
  const cls =
    status === "completed"
      ? "bg-emerald-500/10 text-emerald-600"
      : status === "failed"
        ? "bg-rose-500/10 text-rose-600"
        : "bg-blue-500/10 text-blue-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

function ExportRow({ exp, caseId }: { exp: ManufactureExport; caseId: string }) {
  const [open, setOpen] = useState(false);
  const shellValidation = exp.manifest?.shellValidation ?? [];
  const qa = exp.manifest?.qaData as Record<string, unknown> | undefined;
  const validShells = shellValidation.filter(s => s.valid).length;

  return (
    <div className="bg-[color:var(--card)] px-4 py-3">
      <div className="flex items-center gap-3">
        <Package size={15} className="shrink-0 text-[color:var(--muted-foreground)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[color:var(--foreground)]">
              {EXPORT_TYPE_LABELS[exp.exportType] ?? exp.exportType}
            </span>
            <StatusChip status={exp.status} />
            {shellValidation.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <ShieldCheck size={10} /> {validShells}/{shellValidation.length} shells validated
              </span>
            )}
          </div>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            {new Date(exp.generatedAt).toLocaleString()}
            {exp.generatedByEmail ? ` · ${exp.generatedByEmail}` : ""}
            {exp.fileName ? ` · ${exp.fileName} (${formatBytes(exp.fileSizeBytes)})` : ""}
          </p>
        </div>
        {exp.status === "completed" && exp.hasFile && (
          <a
            href={exportDownloadUrl(caseId, exp.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
          >
            <Download size={12} /> Download
          </a>
        )}
        {(qa || shellValidation.length > 0) && (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="shrink-0 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            {open ? "Hide" : "Details"}
          </button>
        )}
      </div>

      {exp.status === "failed" && exp.errorMessage && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-600">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {exp.errorMessage}
        </p>
      )}

      {open && qa && (
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-[color:var(--background)] p-3 text-[11px] sm:grid-cols-3">
          {Object.entries(qa).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-[color:var(--muted-foreground)]">{k}</span>
              <span className="font-semibold tabular-nums text-[color:var(--foreground)]">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {open && shellValidation.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg bg-[color:var(--background)] p-3 text-[11px]">
          {shellValidation.map(s => (
            <div key={s.file} className="flex items-center justify-between gap-2">
              <span className="font-mono text-[color:var(--muted-foreground)]">{s.file}</span>
              {s.valid ? (
                <span className="flex items-center gap-1 font-semibold text-emerald-600">
                  <CheckCircle2 size={10} /> watertight
                </span>
              ) : (
                <span className="flex items-center gap-1 font-semibold text-rose-600">
                  <X size={10} /> {s.issues.join("; ") || "invalid"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ManufacturingExportPanel({ caseId, planId }: { caseId: string; planId: string }) {
  const [readiness, setReadiness] = useState<ManufacturingReadiness | null>(null);
  const [exports, setExports] = useState<ManufactureExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<ExportType | null>(null);
  const [exportType, setExportType] = useState<ExportType>("aligner_models");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, list] = await Promise.all([
        getManufacturingReadiness(caseId).catch(() => null),
        listExports(caseId),
      ]);
      setReadiness(r);
      setExports(list);
    } catch (e: any) {
      setError(e.message ?? "Failed to load exports");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const runExport = async () => {
    setCreating(exportType); setError("");
    try {
      const created = await createExport(caseId, {
        exportFormat: "zip",
        exportType,
        treatmentPlanId: planId,
      });
      setExports(prev => [created, ...prev]);
    } catch (e: any) {
      setError(e.message ?? "Export failed");
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Readiness summary */}
      {readiness && (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">Manufacturing readiness</p>
              <p className="mt-0.5 text-sm text-[color:var(--foreground)]">{readiness.printabilityScore.recommendation}</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-black tabular-nums ${readiness.printabilityScore.overall >= 80 ? "text-emerald-600" : readiness.printabilityScore.overall >= 60 ? "text-amber-500" : "text-rose-500"}`}>
                {readiness.printabilityScore.overall}
              </p>
              <p className="text-[10px] text-[color:var(--muted-foreground)]">score</p>
            </div>
          </div>
          {readiness.qaIssueCount > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle size={11} /> {readiness.qaIssueCount} open QA issue{readiness.qaIssueCount > 1 ? "s" : ""} — review before manufacturing
            </p>
          )}
        </div>
      )}

      {/* New export */}
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[color:var(--primary)]" />
          <h3 className="text-sm font-bold text-[color:var(--foreground)]">New manufacturing export</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={exportType}
            onChange={e => setExportType(e.target.value as ExportType)}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
          >
            {(Object.keys(EXPORT_TYPE_LABELS) as ExportType[]).map(t => (
              <option key={t} value={t} disabled={!AVAILABLE_EXPORT_TYPES.includes(t)}>
                {EXPORT_TYPE_LABELS[t]}{AVAILABLE_EXPORT_TYPES.includes(t) ? "" : " — not available yet"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={runExport}
            disabled={!!creating}
            className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
            {creating === "aligner_models" ? "Generating shells…" : "Create export"}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh exports"
            className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <p className="text-[11px] leading-snug text-[color:var(--muted-foreground)]">
          Aligner shell exports generate watertight offset shells from the per-stage meshes and
          validate every shell geometrically before packaging; exports with any invalid shell are
          refused. Attachment templates, bonding trays, and surgical guides have no geometry
          pipeline yet and cannot be exported.
        </p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>

      {/* Export history */}
      {exports.length > 0 && (
        <div className="divide-y divide-[color:var(--border)] overflow-hidden rounded-xl border border-[color:var(--border)]">
          {exports.map(exp => <ExportRow key={exp.id} exp={exp} caseId={caseId} />)}
        </div>
      )}
      {!loading && exports.length === 0 && (
        <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-center text-xs text-[color:var(--muted-foreground)]">
          No exports yet for this case.
        </p>
      )}
    </div>
  );
}

export default ManufacturingExportPanel;
