"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, Loader2, MinusCircle, Plus, Trash2 } from "lucide-react";
import {
  CephAnalysis, CephMeasurements, CreateCephDto,
  listCephAnalyses, createCephAnalysis, deleteCephAnalysis, CEPH_NORMS,
} from "@/lib/api/ceph";

// ─── Measurement status ───────────────────────────────────────────────────────

type MeasurementStatus = "normal" | "high" | "low" | "empty";

function measurementStatus(
  key: keyof CephMeasurements,
  value: number | undefined,
): MeasurementStatus {
  if (value == null) return "empty";
  const norm = CEPH_NORMS[key];
  if (!norm || norm.min === 0 && norm.max === 0) return "empty";
  if (value < norm.min) return "low";
  if (value > norm.max) return "high";
  return "normal";
}

function StatusIcon({ status }: { status: MeasurementStatus }) {
  if (status === "normal") return <CheckCircle2 size={12} className="text-green-500" />;
  if (status === "high" || status === "low") return <AlertTriangle size={12} className="text-amber-500" />;
  return <MinusCircle size={12} className="text-[color:var(--muted-foreground)]" />;
}

function statusColor(status: MeasurementStatus) {
  if (status === "normal") return "text-green-600 dark:text-green-400";
  if (status === "high" || status === "low") return "text-amber-600 dark:text-amber-400";
  return "text-[color:var(--muted-foreground)]";
}

// ─── Classification badges ────────────────────────────────────────────────────

function ClassBadge({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  const color = label === "Skeletal Class"
    ? value === "I" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    : value === "II" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
    : label === "Vertical Pattern"
    ? value === "normodivergent" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-[color:var(--muted-foreground)]">{label}</span>
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${color}`}>
        {label === "Skeletal Class" ? `Class ${value}` : value.replace(/_/g, " ")}
      </span>
    </div>
  );
}

// ─── Measurement Row ──────────────────────────────────────────────────────────

function MeasurementRow({
  fieldKey,
  value,
  editing,
  onChange,
}: {
  fieldKey: keyof typeof CEPH_NORMS;
  value: number | undefined;
  editing: boolean;
  onChange: (v: number | undefined) => void;
}) {
  const norm = CEPH_NORMS[fieldKey];
  const status = measurementStatus(fieldKey, value);

  if (fieldKey === "softTissue") return null;

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-[color:var(--border)] last:border-0">
      <StatusIcon status={status} />
      <span className="flex-1 text-sm text-[color:var(--foreground)]">{norm.label}</span>
      <span className="text-xs text-[color:var(--muted-foreground)] w-14 text-right">
        {norm.min}–{norm.max}{norm.unit}
      </span>
      {editing ? (
        <input
          type="number"
          step="0.1"
          value={value ?? ""}
          onChange={e => onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
          className="w-20 rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-0.5 text-right text-sm text-[color:var(--foreground)]"
          placeholder="—"
        />
      ) : (
        <span className={`w-20 text-right text-sm font-mono font-semibold ${statusColor(status)}`}>
          {value != null ? `${value.toFixed(1)}${norm.unit}` : "—"}
        </span>
      )}
    </div>
  );
}

// ─── Analysis card ────────────────────────────────────────────────────────────

function AnalysisCard({
  analysis,
  onDelete,
}: {
  analysis: CephAnalysis;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const m = analysis.measurements;

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(x => !x)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[color:var(--muted)]"
      >
        <div className="flex-1">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            Cephalometric Analysis
          </p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {new Date(analysis.createdAt).toLocaleDateString()} · {analysis.createdByEmail ?? "Unknown"}
          </p>
        </div>
        {/* Mini classification summary */}
        <div className="flex gap-3 items-center">
          {analysis.skeletalClass && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              analysis.skeletalClass === "I" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : analysis.skeletalClass === "II" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
            }`}>
              Class {analysis.skeletalClass}
            </span>
          )}
          {analysis.verticalPattern && (
            <span className="text-xs text-[color:var(--muted-foreground)] capitalize hidden sm:block">
              {analysis.verticalPattern.replace(/_/g, " ")}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-[color:var(--muted-foreground)]" /> : <ChevronDown size={14} className="text-[color:var(--muted-foreground)]" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[color:var(--border)]">
          {/* Classification row */}
          <div className="flex gap-6 justify-center py-3 border-b border-[color:var(--border)] mb-3">
            <ClassBadge label="Skeletal Class" value={analysis.skeletalClass} />
            <ClassBadge label="Vertical Pattern" value={analysis.verticalPattern} />
            <ClassBadge label="Growth Pattern" value={analysis.growthPattern} />
          </div>

          {/* Measurements */}
          <div>
            {(Object.keys(CEPH_NORMS) as Array<keyof typeof CEPH_NORMS>).map(key => {
              if (key === "softTissue") return null;
              return (
                <MeasurementRow
                  key={key}
                  fieldKey={key}
                  value={m[key] as number | undefined}
                  editing={false}
                  onChange={() => {}}
                />
              );
            })}
          </div>

          {analysis.aiNotes && (
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
              <p className="font-medium mb-1">AI Notes</p>
              <p className="leading-relaxed">{analysis.aiNotes}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => onDelete(analysis.id)}
            className="mt-3 flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600"
          >
            <Trash2 size={12} /> Delete analysis
          </button>
        </div>
      )}
    </div>
  );
}

// ─── New analysis form ─────────────────────────────────────────────────────────

function NewCephForm({
  caseId,
  onCreated,
  onCancel,
}: {
  caseId: string;
  onCreated: (a: CephAnalysis) => void;
  onCancel: () => void;
}) {
  const initialMeasurements: CephMeasurements = {};
  const [measurements, setMeasurements] = useState<CephMeasurements>(initialMeasurements);
  const [aiNotes, setAiNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setM = (key: keyof CephMeasurements, value: number | undefined) => {
    setMeasurements(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setBusy(true); setError("");
    try {
      const dto: CreateCephDto = { ...measurements, aiNotes: aiNotes || undefined };
      const analysis = await createCephAnalysis(caseId, dto);
      onCreated(analysis);
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const hasAnyMeasurement = Object.values(measurements).some(v => v != null);

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
      <h3 className="mb-3 text-sm font-bold text-[color:var(--foreground)]">New Cephalometric Analysis</h3>

      {/* Measurements */}
      <div className="mb-4">
        {(Object.keys(CEPH_NORMS) as Array<keyof typeof CEPH_NORMS>).map(key => {
          if (key === "softTissue") return null;
          return (
            <MeasurementRow
              key={key}
              fieldKey={key}
              value={measurements[key] as number | undefined}
              editing={true}
              onChange={v => setM(key, v)}
            />
          );
        })}
      </div>

      {/* AI notes */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-[color:var(--muted-foreground)]">
          Clinical Notes (optional)
        </label>
        <textarea
          value={aiNotes}
          onChange={e => setAiNotes(e.target.value)}
          rows={2}
          placeholder="Clinical interpretation…"
          className="w-full resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
        />
      </div>

      {error && <p className="mb-2 text-xs text-rose-500">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || !hasAnyMeasurement}
          className="flex items-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          Save Analysis
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CephalometricPanel({ caseId }: { caseId: string }) {
  const [analyses, setAnalyses] = useState<CephAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, [caseId]);

  async function load() {
    setLoading(true); setError("");
    try {
      setAnalyses(await listCephAnalyses(caseId));
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCephAnalysis(caseId, id);
      setAnalyses(prev => prev.filter(a => a.id !== id));
    } catch (e: any) {
      alert(e.message ?? "Delete failed");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[color:var(--muted-foreground)]">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-sm">Loading cephalometric analyses…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[color:var(--foreground)]">Cephalometric Analysis</h2>
          <p className="text-xs text-[color:var(--muted-foreground)]">SNA · SNB · ANB · FMA · IMPA and 9 additional measurements</p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-xs font-medium text-[color:var(--primary-foreground)] hover:opacity-90"
          >
            <Plus size={12} /> New Analysis
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        <span>Cephalometric analysis values are entered manually. Classifications are computed from entered values using standard population norms. Not diagnostically validated — a licensed orthodontist must review all measurements.</span>
      </div>

      {/* Norm reference */}
      <details className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--muted)]">
          <Info size={13} className="text-[color:var(--muted-foreground)]" />
          Population Norms Reference
        </summary>
        <div className="px-4 pb-4 border-t border-[color:var(--border)]">
          <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 mt-3">
            {(Object.entries(CEPH_NORMS) as Array<[keyof typeof CEPH_NORMS, typeof CEPH_NORMS[keyof typeof CEPH_NORMS]]>).map(([key, norm]) => {
              if (key === "softTissue") return null;
              return (
                <div key={key} className="flex items-center gap-2 py-1 border-b border-[color:var(--border)] last:border-0 text-xs">
                  <span className="flex-1 text-[color:var(--foreground)]">{norm.label}</span>
                  <span className="text-[color:var(--muted-foreground)] font-mono">{norm.min}–{norm.max}{norm.unit}</span>
                </div>
              );
            })}
          </div>
        </div>
      </details>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* New form */}
      {showForm && (
        <NewCephForm
          caseId={caseId}
          onCreated={a => { setAnalyses(prev => [a, ...prev]); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Existing analyses */}
      {analyses.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-2 py-12 text-[color:var(--muted-foreground)]">
          <Info size={24} strokeWidth={1.5} />
          <p className="text-sm">No cephalometric analyses yet</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-1 text-xs text-[color:var(--primary)] hover:underline"
          >
            Create first analysis →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map(a => (
            <AnalysisCard key={a.id} analysis={a} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
