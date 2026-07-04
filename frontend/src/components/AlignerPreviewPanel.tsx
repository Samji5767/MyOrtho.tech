"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Package,
  Save,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Arch = "upper" | "lower";
type StageType = "active" | "passive" | "retention";

interface AttachmentWindow {
  toothFDI: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PressureArea {
  region: string;
  intensity: "light" | "medium" | "heavy";
}

interface Trimline {
  points: { x: number; y: number }[];
  type: string;
}

interface AlignerDesign {
  id: string;
  setupId: string;
  alignerNumber: number;
  arch: Arch;
  stageType: StageType;
  label: string;
  thicknessMm: number;
  hasRelief: boolean;
  attachmentWindows: AttachmentWindow[];
  pressureAreas: PressureArea[];
  trimline: Trimline | null;
  exportReady: boolean;
  createdAt: string;
}

type FilterTab = "all" | "upper" | "lower" | "active" | "retention";

// ─── Aligner card ─────────────────────────────────────────────────────────────

function AlignerCard({
  aligner,
  onUpdated,
}: {
  aligner: AlignerDesign;
  onUpdated: (updated: AlignerDesign) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [thickness, setThickness] = useState(aligner.thicknessMm);
  const [hasRelief, setHasRelief] = useState(aligner.hasRelief);
  const [label, setLabel] = useState(aligner.label);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const archLabel = aligner.arch === "upper" ? "U" : "L";
  const numberBadge = `${archLabel}-${String(aligner.alignerNumber).padStart(2, "0")}`;

  const stageColors: Record<StageType, string> = {
    active: "bg-blue-100 text-blue-700",
    passive: "bg-slate-100 text-slate-600",
    retention: "bg-purple-100 text-purple-700",
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/aligner-design/${aligner.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thicknessMm: thickness, hasRelief, label }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: AlignerDesign = await res.json();
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
      {/* Card header */}
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-[color:var(--muted)] transition-colors"
      >
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-sm font-bold text-[color:var(--foreground)]">
            {numberBadge}
          </span>
          <span
            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold capitalize ${stageColors[aligner.stageType]}`}
          >
            {aligner.stageType}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[color:var(--foreground)]">
            {aligner.label}
          </p>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[color:var(--muted-foreground)]">
            <span>{aligner.thicknessMm} mm</span>
            {aligner.hasRelief && (
              <span className="rounded bg-indigo-100 px-1 text-indigo-700">Relief</span>
            )}
            {aligner.attachmentWindows.length > 0 && (
              <span>{aligner.attachmentWindows.length} att. windows</span>
            )}
            {aligner.pressureAreas.length > 0 && (
              <span>{aligner.pressureAreas.length} pressure areas</span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {aligner.exportReady ? (
            <CheckCircle2 size={15} className="text-green-500" />
          ) : (
            <Clock size={15} className="text-amber-400" />
          )}
        </div>
        {expanded ? (
          <ChevronDown size={14} className="shrink-0 text-[color:var(--muted-foreground)]" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-[color:var(--muted-foreground)]" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[color:var(--border)] p-4 space-y-4">
          {/* Editable fields */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="w-28 shrink-0 text-xs text-[color:var(--muted-foreground)]">
                Label
              </label>
              {editing ? (
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1.5 text-xs text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
                />
              ) : (
                <span className="text-xs text-[color:var(--foreground)]">{label}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="w-28 shrink-0 text-xs text-[color:var(--muted-foreground)]">
                Thickness (mm)
              </label>
              {editing ? (
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="3"
                  value={thickness}
                  onChange={(e) => setThickness(parseFloat(e.target.value))}
                  className="w-24 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1.5 text-xs text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
                />
              ) : (
                <span className="text-xs text-[color:var(--foreground)]">{thickness} mm</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="w-28 shrink-0 text-xs text-[color:var(--muted-foreground)]">
                Has Relief
              </label>
              {editing ? (
                <button
                  type="button"
                  onClick={() => setHasRelief((v) => !v)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${hasRelief ? "bg-[color:var(--primary)]" : "bg-slate-300"}`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${hasRelief ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </button>
              ) : (
                <span className="text-xs text-[color:var(--foreground)]">
                  {hasRelief ? "Yes" : "No"}
                </span>
              )}
            </div>
          </div>

          {/* Trimline */}
          {aligner.trimline && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-[color:var(--foreground)]">
                Trimline ({aligner.trimline.type})
              </h4>
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)] px-3 py-2">
                <p className="font-mono text-[10px] text-[color:var(--muted-foreground)]">
                  {aligner.trimline.points.length} control points
                </p>
              </div>
            </div>
          )}

          {/* Attachment windows */}
          {aligner.attachmentWindows.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-[color:var(--foreground)]">
                Attachment Windows
              </h4>
              <div className="space-y-1">
                {aligner.attachmentWindows.map((aw) => (
                  <div
                    key={`${aw.toothFDI}-${aw.type}`}
                    className="flex items-center justify-between rounded border border-[color:var(--border)] bg-[color:var(--muted)] px-2 py-1 text-[10px]"
                  >
                    <span className="font-mono font-semibold">{aw.toothFDI}</span>
                    <span className="text-[color:var(--muted-foreground)]">{aw.type}</span>
                    <span className="font-mono text-[color:var(--muted-foreground)]">
                      {aw.width.toFixed(1)}×{aw.height.toFixed(1)} mm
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pressure areas */}
          {aligner.pressureAreas.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-[color:var(--foreground)]">
                Pressure Areas
              </h4>
              <div className="flex flex-wrap gap-1">
                {aligner.pressureAreas.map((pa) => {
                  const c =
                    pa.intensity === "heavy"
                      ? "bg-red-100 text-red-700"
                      : pa.intensity === "medium"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600";
                  return (
                    <span
                      key={`${pa.region}-${pa.intensity}`}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c}`}
                    >
                      {pa.region}
                      <span className="opacity-70">({pa.intensity})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {saveError && (
            <p className="text-xs text-red-600">{saveError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--primary-foreground)] disabled:opacity-50"
                >
                  <Save size={12} />
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setThickness(aligner.thicknessMm);
                    setHasRelief(aligner.hasRelief);
                    setLabel(aligner.label);
                  }}
                  className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)]"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--muted)] transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AlignerPreviewPanel({
  setupId,
}: {
  setupId?: string;
}) {
  const [aligners, setAligners] = useState<AlignerDesign[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

  const loadAligners = useCallback(async () => {
    if (!setupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/aligner-design?setupId=${encodeURIComponent(setupId)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAligners(Array.isArray(json) ? json : json.aligners ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setupId]);

  useEffect(() => {
    loadAligners();
  }, [loadAligners]);

  const generateAligners = async () => {
    if (!setupId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/aligner-design/generate/${setupId}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAligners(Array.isArray(json) ? json : json.aligners ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdated = (updated: AlignerDesign) => {
    setAligners((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upper", label: "Upper" },
    { key: "lower", label: "Lower" },
    { key: "active", label: "Active" },
    { key: "retention", label: "Retention" },
  ];

  const filtered = aligners.filter((a) => {
    if (filter === "all") return true;
    if (filter === "upper") return a.arch === "upper";
    if (filter === "lower") return a.arch === "lower";
    if (filter === "active") return a.stageType === "active";
    if (filter === "retention") return a.stageType === "retention";
    return true;
  });

  if (!setupId) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Package size={40} className="text-[color:var(--muted-foreground)]" />
        <p className="text-sm text-[color:var(--muted-foreground)]">
          No setup selected. Create or select a digital setup to view aligners.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-[color:var(--foreground)]">
          Aligner Preview
        </h2>
        <button
          type="button"
          onClick={generateAligners}
          disabled={generating || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-xs font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={13} className={generating ? "animate-spin" : ""} />
          {generating ? "Generating…" : "Generate Aligners"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats row */}
      {aligners.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: aligners.length },
            {
              label: "Upper",
              value: aligners.filter((a) => a.arch === "upper").length,
            },
            {
              label: "Lower",
              value: aligners.filter((a) => a.arch === "lower").length,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] py-3"
            >
              <span className="text-2xl font-bold text-[color:var(--foreground)]">
                {s.value}
              </span>
              <span className="text-xs text-[color:var(--muted-foreground)]">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
              filter === t.key
                ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[color:var(--muted)]" />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Package size={36} className="text-[color:var(--muted-foreground)]" />
          <p className="text-sm text-[color:var(--muted-foreground)]">
            {aligners.length === 0
              ? "No aligners generated yet. Click \"Generate Aligners\" to start."
              : "No aligners match the current filter."}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((a) => (
            <AlignerCard
              key={a.id}
              aligner={a}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
