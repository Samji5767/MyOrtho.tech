"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Stethoscope,
  X,
} from "lucide-react";
import { Button, Card } from "@/components/DesignSystem";
import {
  getLatestAnalysis,
  createAnalysis,
  updateAnalysis,
  type CaseAnalysis,
  type IprEntry,
} from "@/lib/api/analysis";

// ─── Bolton norm ranges ───────────────────────────────────────────────────────

const BOLTON_OVERALL_NORM = { mean: 91.3, low: 87.5, high: 95.1 };
const BOLTON_ANTERIOR_NORM = { mean: 77.2, low: 73.9, high: 80.5 };

// ─── Default tooth widths (FDI notation) ─────────────────────────────────────

const DEFAULT_MAX: Record<string, number> = {
  "17": 11.0, "16": 10.0, "15": 7.0, "14": 7.2,
  "13": 8.0, "12": 6.5, "11": 8.5,
  "21": 8.5, "22": 6.5, "23": 8.0,
  "24": 7.2, "25": 7.0, "26": 10.0, "27": 11.0,
};

const DEFAULT_MAN: Record<string, number> = {
  "47": 10.5, "46": 10.5, "45": 7.1, "44": 7.0,
  "43": 6.9, "42": 5.9, "41": 5.4,
  "31": 5.4, "32": 5.9, "33": 6.9,
  "34": 7.0, "35": 7.1, "36": 10.5, "37": 10.5,
};

// Anterior 6 FDI keys for each arch
const MAX_ANTERIOR = ["13", "12", "11", "21", "22", "23"];
const MAN_ANTERIOR = ["33", "32", "31", "41", "42", "43"];

// ─── Bolton calculation ───────────────────────────────────────────────────────

function computeBolton(max: Record<string, number>, man: Record<string, number>) {
  const sumMax12 = Object.values(max).reduce((a, b) => a + b, 0);
  const sumMan12 = Object.values(man).reduce((a, b) => a + b, 0);
  const overall = sumMax12 > 0 ? (sumMan12 / sumMax12) * 100 : null;

  const sumMax6 = MAX_ANTERIOR.reduce((a, k) => a + (max[k] ?? 0), 0);
  const sumMan6 = MAN_ANTERIOR.reduce((a, k) => a + (man[k] ?? 0), 0);
  const anterior = sumMax6 > 0 ? (sumMan6 / sumMax6) * 100 : null;

  return { overall, anterior };
}

// ─── Complexity score ─────────────────────────────────────────────────────────

function computeComplexity(opts: {
  overjet: number;
  overbite: number;
  upperCrowding: number;
  lowerCrowding: number;
}) {
  let score = 20;
  if (opts.overjet > 5)        score += 30;
  else if (opts.overjet > 3.5) score += 15;
  else if (opts.overjet < 0)   score += 35;
  if (opts.overbite > 4)       score += 15;
  else if (opts.overbite < 0)  score += 20;
  if (opts.upperCrowding > 6)  score += 20;
  else if (opts.upperCrowding > 3) score += 10;
  if (opts.lowerCrowding > 6)  score += 20;
  else if (opts.lowerCrowding > 3) score += 10;
  return Math.min(score, 100);
}

// ─── Gauge bar ────────────────────────────────────────────────────────────────

function BoltonGauge({ value, norm, label }: {
  value: number | null;
  norm: { mean: number; low: number; high: number };
  label: string;
}) {
  if (value === null) return null;
  const isHigh = value > norm.high;
  const isLow  = value < norm.low;
  const tone   = isHigh || isLow ? "text-amber-600" : "text-emerald-600";
  const msg    = isHigh ? "Upper excess" : isLow ? "Lower excess" : "Within norm";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[color:var(--foreground)]">{label}</span>
        <span className={`font-black tabular-nums ${tone}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-[color:var(--muted)]/40">
        <div
          className={`h-full rounded-full transition-all ${isHigh || isLow ? "bg-amber-400" : "bg-emerald-500"}`}
          style={{ width: `${Math.min(100, Math.max(0, ((value - 70) / 30) * 100))}%` }}
        />
        {/* Norm range marker */}
        <div
          className="absolute top-0 h-full border-x border-white/60 bg-emerald-500/20"
          style={{
            left:  `${((norm.low  - 70) / 30) * 100}%`,
            width: `${((norm.high - norm.low) / 30) * 100}%`,
          }}
        />
      </div>
      <p className={`text-[10px] font-semibold ${tone}`}>
        {msg} · norm {norm.low}–{norm.high}%
      </p>
    </div>
  );
}

// ─── Tooth width row ──────────────────────────────────────────────────────────

function ToothRow({ fdi, value, onChange }: {
  fdi: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-center text-[10px] font-bold text-[color:var(--muted-foreground)]">{fdi}</span>
      <input
        type="range"
        min={4.0}
        max={14.0}
        step={0.1}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[color:var(--border)] accent-[color:var(--primary)]"
      />
      <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-[color:var(--foreground)]">{value.toFixed(1)}</span>
    </div>
  );
}

// ─── IPR schedule row ─────────────────────────────────────────────────────────

function IprRow({ entry, onChange, onRemove }: {
  entry: IprEntry;
  onChange: (e: IprEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 py-2">
      <div className="flex gap-1.5 items-center flex-1 flex-wrap">
        <span className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">Stage</span>
        <input
          type="number"
          min={1}
          max={60}
          value={entry.stage}
          onChange={e => onChange({ ...entry, stage: parseInt(e.target.value, 10) || 1 })}
          className="w-12 rounded border border-[color:var(--border)] bg-[color:var(--background)] px-1.5 py-0.5 text-xs text-[color:var(--foreground)] outline-none"
        />
        <input
          type="text"
          placeholder="FDI A"
          value={entry.toothA}
          onChange={e => onChange({ ...entry, toothA: e.target.value })}
          className="w-14 rounded border border-[color:var(--border)] bg-[color:var(--background)] px-1.5 py-0.5 text-xs text-[color:var(--foreground)] outline-none"
        />
        <X size={10} className="text-[color:var(--muted-foreground)]" />
        <input
          type="text"
          placeholder="FDI B"
          value={entry.toothB}
          onChange={e => onChange({ ...entry, toothB: e.target.value })}
          className="w-14 rounded border border-[color:var(--border)] bg-[color:var(--background)] px-1.5 py-0.5 text-xs text-[color:var(--foreground)] outline-none"
        />
        <input
          type="number"
          min={0.1}
          max={2.0}
          step={0.05}
          value={entry.amountMm}
          onChange={e => onChange({ ...entry, amountMm: parseFloat(e.target.value) || 0.1 })}
          className="w-16 rounded border border-[color:var(--border)] bg-[color:var(--background)] px-1.5 py-0.5 text-xs text-[color:var(--foreground)] outline-none"
        />
        <span className="text-[10px] text-[color:var(--muted-foreground)]">mm</span>
      </div>
      <button type="button" onClick={onRemove} className="shrink-0 text-red-400 hover:text-red-600">
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function ClinicalAnalysisPanel({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Measurements
  const [maxWidths, setMaxWidths] = useState<Record<string, number>>({ ...DEFAULT_MAX });
  const [manWidths, setManWidths] = useState<Record<string, number>>({ ...DEFAULT_MAN });
  const [overjet,       setOverjet]       = useState(2.5);
  const [overbite,      setOverbite]      = useState(2.0);
  const [upperCrowding, setUpperCrowding] = useState(2.0);
  const [lowerCrowding, setLowerCrowding] = useState(1.5);
  const [angleClass,    setAngleClass]    = useState<string>("Class I");
  const [notes,         setNotes]         = useState("");

  // IPR schedule
  const [iprSchedule, setIprSchedule] = useState<IprEntry[]>([]);

  // Live Bolton + complexity
  const { overall, anterior } = useMemo(
    () => computeBolton(maxWidths, manWidths),
    [maxWidths, manWidths],
  );
  const complexity = useMemo(
    () => computeComplexity({ overjet, overbite, upperCrowding, lowerCrowding }),
    [overjet, overbite, upperCrowding, lowerCrowding],
  );

  // Load latest analysis from backend
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLatestAnalysis(caseId);
      if (data) {
        setExistingId(data.id);
        setLastSavedAt(data.updatedAt ?? data.createdAt);
        if (data.toothMeasurements && Object.keys(data.toothMeasurements).length > 0) {
          // split back into max/man by key range
          const max: Record<string, number> = {};
          const man: Record<string, number> = {};
          for (const [k, v] of Object.entries(data.toothMeasurements)) {
            const n = parseInt(k, 10);
            if (n >= 11 && n <= 28) max[k] = v;
            else if (n >= 31 && n <= 48) man[k] = v;
          }
          if (Object.keys(max).length > 0) setMaxWidths({ ...DEFAULT_MAX, ...max });
          if (Object.keys(man).length > 0) setManWidths({ ...DEFAULT_MAN, ...man });
        }
        if (data.angleClass)       setAngleClass(data.angleClass);
        if (data.overjetMm != null) setOverjet(data.overjetMm);
        if (data.overbiteM != null) setOverbite(data.overbiteM);
        if (data.upperCrowdingMm != null) setUpperCrowding(data.upperCrowdingMm);
        if (data.lowerCrowdingMm != null) setLowerCrowding(data.lowerCrowdingMm);
        if (data.iprSchedule?.length)     setIprSchedule(data.iprSchedule);
        if (data.notes)            setNotes(data.notes);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("403")) {
        setError("Access denied — clinical analysis requires authentication.");
      }
      // Silently ignore 404 (no analysis yet)
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  // Auto-dismiss saved toast
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();
  function flashSaved() {
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 3000);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const dto = {
      boltonOverall:   overall  ?? undefined,
      boltonAnterior:  anterior ?? undefined,
      toothMeasurements: { ...maxWidths, ...manWidths },
      angleClass,
      overjetMm:        overjet,
      overbiteM:        overbite,
      upperCrowdingMm:  upperCrowding,
      lowerCrowdingMm:  lowerCrowding,
      iprSchedule,
      complexityScore:  complexity,
      notes:            notes || undefined,
    };
    try {
      let saved: CaseAnalysis;
      if (existingId) {
        saved = await updateAnalysis(caseId, existingId, dto);
      } else {
        saved = await createAnalysis(caseId, dto);
        setExistingId(saved.id);
      }
      setLastSavedAt(saved.updatedAt ?? saved.createdAt);
      flashSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addIprEntry() {
    setIprSchedule(prev => [...prev, { stage: 1, toothA: "12", toothB: "11", amountMm: 0.2 }]);
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-3 text-[color:var(--muted-foreground)]">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading analysis…</span>
      </div>
    );
  }

  const complexityColor = complexity >= 70 ? "text-red-500" : complexity >= 40 ? "text-amber-500" : "text-emerald-600";

  return (
    <div className="space-y-4">

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Clinical analysis indices are workflow tools only. Not diagnostically validated. All values require
        review and sign-off by a licensed orthodontist before clinical use.
      </div>

      {/* Results summary */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 size={15} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Analysis Summary</h3>
          </div>
          <div className="flex items-center gap-2">
            {lastSavedAt && (
              <span className="text-[10px] text-[color:var(--muted-foreground)]">
                Saved {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            )}
            {saved && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <CheckCircle2 size={11} /> Saved
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Bolton ratios */}
          <div className="space-y-3">
            <BoltonGauge value={overall}  norm={BOLTON_OVERALL_NORM}  label="Bolton Overall (12:12)" />
            <BoltonGauge value={anterior} norm={BOLTON_ANTERIOR_NORM} label="Bolton Anterior (6:6)" />
          </div>

          {/* Classification + complexity */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">Angle Classification</p>
              <select
                value={angleClass}
                onChange={e => setAngleClass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm font-bold text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
              >
                {["Class I", "Class II", "Class II Div 1", "Class II Div 2", "Class III"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">Case Complexity</p>
                <span className={`text-lg font-black tabular-nums ${complexityColor}`}>{complexity}/100</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[color:var(--muted)]/40">
                <div
                  className={`h-full rounded-full transition-all ${complexity >= 70 ? "bg-red-500" : complexity >= 40 ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{ width: `${complexity}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-[color:var(--muted-foreground)]">
                {complexity < 40 ? "Straightforward" : complexity < 70 ? "Moderate complexity" : "Complex — multi-phase likely"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Clinical measurements */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Stethoscope size={15} className="text-[color:var(--primary)]" />
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Clinical Measurements</h3>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {[
            { label: "Overjet",          val: overjet,       set: setOverjet,       min: -5, max: 15, step: 0.1, unit: "mm", warn: overjet > 5 || overjet < 0 },
            { label: "Overbite",         val: overbite,      set: setOverbite,      min: -5, max: 10, step: 0.1, unit: "mm", warn: overbite > 4 || overbite < 0 },
            { label: "Upper arch crowding (+) / spacing (−)", val: upperCrowding, set: setUpperCrowding, min: -5, max: 12, step: 0.5, unit: "mm", warn: Math.abs(upperCrowding) > 6 },
            { label: "Lower arch crowding (+) / spacing (−)", val: lowerCrowding, set: setLowerCrowding, min: -5, max: 12, step: 0.5, unit: "mm", warn: Math.abs(lowerCrowding) > 6 },
          ].map(({ label, val, set, min, max, step, unit, warn }) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">{label}</span>
                <span className={`text-sm font-black tabular-nums ${warn ? "text-amber-500" : "text-[color:var(--foreground)]"}`}>
                  {val > 0 ? "+" : ""}{val.toFixed(1)} {unit}
                </span>
              </div>
              <input
                type="range" min={min} max={max} step={step} value={val}
                onChange={e => set(parseFloat(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[color:var(--border)] accent-[color:var(--primary)]"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Bolton tooth widths */}
      <Card className="p-5">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <BarChart3 size={14} className="text-[color:var(--primary)]" />
            Tooth Widths — Maxillary (FDI 11–27)
            <span className="ml-auto text-xs font-normal text-[color:var(--muted-foreground)]">
              Σ {Object.values(maxWidths).reduce((a, b) => a + b, 0).toFixed(1)} mm
            </span>
          </summary>
          <div className="mt-3 space-y-1.5">
            {Object.entries(maxWidths).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([fdi, v]) => (
              <ToothRow key={fdi} fdi={fdi} value={v}
                onChange={val => setMaxWidths(prev => ({ ...prev, [fdi]: val }))} />
            ))}
          </div>
        </details>
      </Card>

      <Card className="p-5">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <BarChart3 size={14} className="text-[color:var(--primary)]" />
            Tooth Widths — Mandibular (FDI 31–47)
            <span className="ml-auto text-xs font-normal text-[color:var(--muted-foreground)]">
              Σ {Object.values(manWidths).reduce((a, b) => a + b, 0).toFixed(1)} mm
            </span>
          </summary>
          <div className="mt-3 space-y-1.5">
            {Object.entries(manWidths).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([fdi, v]) => (
              <ToothRow key={fdi} fdi={fdi} value={v}
                onChange={val => setManWidths(prev => ({ ...prev, [fdi]: val }))} />
            ))}
          </div>
        </details>
      </Card>

      {/* IPR schedule */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scissors size={14} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">IPR Schedule</h3>
          </div>
          <button
            type="button"
            onClick={addIprEntry}
            className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            <Plus size={11} /> Add
          </button>
        </div>

        {iprSchedule.length === 0 ? (
          <p className="text-center text-xs text-[color:var(--muted-foreground)] py-4">No IPR events planned. Click Add to schedule interproximal reduction.</p>
        ) : (
          <div className="space-y-2">
            {iprSchedule.map((entry, i) => (
              <IprRow
                key={i}
                entry={entry}
                onChange={updated => setIprSchedule(prev => prev.map((e, j) => j === i ? updated : e))}
                onRemove={() => setIprSchedule(prev => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card className="p-5">
        <label className="mb-2 block text-xs font-semibold text-[color:var(--muted-foreground)]">Clinical Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Clinician notes, observations, contraindications…"
          className="w-full resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
        />
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-50/60 px-3 py-2 text-xs text-red-600 dark:border-red-700/30 dark:bg-red-900/10">
          <AlertTriangle size={12} className="shrink-0" /> {error}
        </div>
      )}

      {/* Save / Reload */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {existingId ? "Update Analysis" : "Save Analysis"}
        </Button>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} /> Reload
        </Button>
        {existingId && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setExistingId(null); }}
          >
            <Plus size={13} /> New Version
          </Button>
        )}
      </div>

      {/* Legend note */}
      <p className="text-[10px] text-[color:var(--muted-foreground)]">
        Bolton norms: Overall 91.3 ± 1.91% (87.5–95.1), Anterior 77.2 ± 1.65% (73.9–80.5).
        Source: Bolton 1958; values for reference only.
      </p>
    </div>
  );
}
