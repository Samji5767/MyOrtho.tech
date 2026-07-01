"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package,
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  Factory,
  CheckSquare,
  Square,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type StageType = "active" | "passive" | "retention";

interface ManifestEntry {
  number: number;
  label: string;
  arch: "upper" | "lower";
  stageType: StageType;
  alignerNumber: number;
}

interface ProductionStats {
  totalToothMovements: number;
  averageConfidence: number;
  predictedOutcome: string;
  stageBreakdown: { type: StageType; count: number }[];
  iprUpperMm: number;
  iprLowerMm: number;
}

interface ManufacturingPackage {
  setupId: string;
  totalAligners: number;
  upperAligners: number;
  lowerAligners: number;
  totalStages: number;
  exportReady: boolean;
  generatedAt: string;
  manifest: ManifestEntry[];
  productionStats: ProductionStats;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3 shadow-lg">
      <CheckCircle2 size={16} className="text-green-600" />
      <span className="text-sm font-semibold text-green-800">{message}</span>
      <button type="button" onClick={onClose} className="ml-2 text-green-500 hover:text-green-700">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-2xl">
        <Factory size={32} className="mb-3 text-[color:var(--primary)]" />
        <h3 className="text-base font-bold text-[color:var(--foreground)]">Confirm Export</h3>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
          >
            Confirm Export
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition-transform active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ManufacturingPackagePanel({
  setupId,
  caseId,
  token,
}: {
  setupId?: string;
  caseId: string;
  token: string;
}) {
  const [data, setData] = useState<ManufacturingPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: "qa", label: "QA Check passed", checked: false },
    { id: "clinician", label: "Clinician has approved setup", checked: false },
    { id: "stages", label: "All stages generated", checked: false },
    { id: "designs", label: "Aligner designs finalized", checked: false },
    { id: "goals", label: "Treatment goals approved", checked: false },
    { id: "consent", label: "Patient consent documented", checked: false },
  ]);

  const loadPackage = useCallback(async () => {
    if (!setupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/aligner-design/manufacturing-package/${setupId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ManufacturingPackage = await res.json();
      setData(json);
      // Auto-check QA item if export_ready
      if (json.exportReady) {
        setChecklist((prev) =>
          prev.map((c) => (c.id === "qa" ? { ...c, checked: true } : c))
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setupId, token]);

  useEffect(() => {
    loadPackage();
  }, [loadPackage]);

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const allChecked = checklist.every((c) => c.checked);
  const exportReady = data?.exportReady && allChecked;

  const stageColors: Record<StageType, string> = {
    active: "bg-white",
    passive: "bg-slate-50",
    retention: "bg-purple-50",
  };

  const stageBarColors: Record<StageType, string> = {
    active: "bg-blue-500",
    passive: "bg-slate-400",
    retention: "bg-purple-500",
  };

  if (!setupId) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Factory size={40} className="text-[color:var(--muted-foreground)]" />
        <p className="text-sm text-[color:var(--muted-foreground)]">
          No setup selected. Complete the digital setup to generate a manufacturing package.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {showConfirm && (
        <ConfirmDialog
          message="This will export the full manufacturing package for production. Please confirm all checklist items have been verified."
          onConfirm={() => {
            setShowConfirm(false);
            setToast("Manufacturing package export initiated.");
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-[color:var(--foreground)]">
          Manufacturing Package
        </h2>
        <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
          Case {caseId}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[color:var(--muted)]" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Package Overview */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
              Package Overview
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total Aligners", value: data.totalAligners, big: true },
                { label: "Upper", value: data.upperAligners },
                { label: "Lower", value: data.lowerAligners },
                { label: "Total Stages", value: data.totalStages },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] py-3"
                >
                  <span
                    className={`font-bold text-[color:var(--foreground)] ${
                      s.big ? "text-4xl" : "text-2xl"
                    }`}
                  >
                    {s.value}
                  </span>
                  <span className="text-xs text-[color:var(--muted-foreground)]">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Export ready */}
            {data.exportReady ? (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircle2 size={16} className="shrink-0 text-green-600" />
                <span className="text-sm font-semibold text-green-700">
                  Ready for Export
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <XCircle size={16} className="shrink-0 text-red-600" />
                <span className="text-sm font-semibold text-red-700">
                  Not Ready — Resolve outstanding issues
                </span>
              </div>
            )}

            <p className="text-[10px] text-[color:var(--muted-foreground)]">
              Generated: {new Date(data.generatedAt).toLocaleString()}
            </p>
          </div>

          {/* Export Manifest */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[color:var(--border)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
                Export Manifest
              </h3>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 border-b border-[color:var(--border)] bg-[color:var(--card)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-[color:var(--muted-foreground)]">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-[color:var(--muted-foreground)]">Label</th>
                    <th className="px-3 py-2 text-left font-semibold text-[color:var(--muted-foreground)]">Arch</th>
                    <th className="px-3 py-2 text-left font-semibold text-[color:var(--muted-foreground)]">Type</th>
                    <th className="px-3 py-2 text-right font-semibold text-[color:var(--muted-foreground)]">Aligner #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border)]">
                  {data.manifest.map((m) => (
                    <tr
                      key={m.number}
                      className={stageColors[m.stageType]}
                    >
                      <td className="px-3 py-2 font-mono">{m.number}</td>
                      <td className="px-3 py-2 text-[color:var(--foreground)]">{m.label}</td>
                      <td className="px-3 py-2 capitalize text-[color:var(--muted-foreground)]">
                        {m.arch}
                      </td>
                      <td className="px-3 py-2 capitalize text-[color:var(--muted-foreground)]">
                        {m.stageType}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{m.alignerNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Manufacturing Checklist */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
              Manufacturing Checklist
            </h3>
            <div className="space-y-2">
              {checklist.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleChecklist(item.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[color:var(--muted)] transition-colors"
                >
                  {item.checked ? (
                    <CheckSquare size={16} className="shrink-0 text-[color:var(--primary)]" />
                  ) : (
                    <Square size={16} className="shrink-0 text-[color:var(--muted-foreground)]" />
                  )}
                  <span
                    className={`text-sm ${
                      item.checked
                        ? "text-[color:var(--foreground)]"
                        : "text-[color:var(--muted-foreground)]"
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.checked && (
                    <CheckCircle2 size={13} className="ml-auto shrink-0 text-green-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Export buttons */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
              Export
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                disabled={!exportReady}
                onClick={() => setToast("STL package export started.")}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--foreground)] transition-all hover:bg-[color:var(--muted)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={15} />
                Export STL Package
              </button>
              <button
                type="button"
                onClick={() => setToast("Report generation initiated.")}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--foreground)] transition-all hover:bg-[color:var(--muted)] active:scale-95"
              >
                <FileText size={15} />
                Export Treatment Report PDF
              </button>
              <button
                type="button"
                disabled={!exportReady}
                onClick={() => setShowConfirm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-[color:var(--primary-foreground)] transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Factory size={15} />
                Export Manufacturing Package
              </button>
              {!exportReady && (
                <p className="text-center text-xs text-[color:var(--muted-foreground)]">
                  Complete all checklist items and ensure QA is passed to enable export.
                </p>
              )}
            </div>
          </div>

          {/* Production Report */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
              Production Report
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Total Movements",
                  value: data.productionStats.totalToothMovements,
                },
                {
                  label: "Avg Confidence",
                  value: `${Math.round(data.productionStats.averageConfidence * 100)}%`,
                },
                {
                  label: "Predicted Outcome",
                  value: data.productionStats.predictedOutcome,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3 text-center"
                >
                  <span className="text-lg font-bold text-[color:var(--foreground)]">
                    {s.value}
                  </span>
                  <span className="text-[10px] text-[color:var(--muted-foreground)]">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Stage type breakdown bar chart */}
            <div>
              <h4 className="mb-2 text-xs font-semibold text-[color:var(--foreground)]">
                Stage Type Breakdown
              </h4>
              <div className="space-y-2">
                {data.productionStats.stageBreakdown.map((s) => {
                  const pct = Math.round(
                    (s.count / data.totalStages) * 100
                  );
                  return (
                    <div key={s.type} className="flex items-center gap-3 text-xs">
                      <span className="w-20 shrink-0 capitalize text-[color:var(--muted-foreground)]">
                        {s.type}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-[color:var(--muted)] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${stageBarColors[s.type]}`}
                          style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
                        />
                      </div>
                      <span className="w-14 text-right tabular-nums text-[color:var(--muted-foreground)]">
                        {s.count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* IPR summary */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "IPR Upper", value: `${data.productionStats.iprUpperMm.toFixed(2)} mm` },
                { label: "IPR Lower", value: `${data.productionStats.iprLowerMm.toFixed(2)} mm` },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] py-3"
                >
                  <span className="text-base font-bold text-[color:var(--foreground)]">
                    {s.value}
                  </span>
                  <span className="text-[10px] text-[color:var(--muted-foreground)]">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!loading && !data && !error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Package size={40} className="text-[color:var(--muted-foreground)]" />
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Manufacturing package not yet available for this setup.
          </p>
        </div>
      )}
    </div>
  );
}
