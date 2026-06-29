"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/DesignSystem";
import {
  listPrescriptions,
  upsertPrescription,
  deletePrescription,
  approvePrescriptions,
  type MovementPrescription,
  type MovementPrescriptionDto,
} from "@/lib/api/tooth-movement";

// ─── Movement limits for inline validation ────────────────────────────────────

const LIMITS = {
  translation_mm:  0.30,
  rotation_deg:    3.0,
  torque_deg:      3.5,
  tip_deg:         4.0,
  intrusion_mm:    0.40,
  extrusion_mm:    0.75,
  mesiodistal_mm:  0.30,
  expansion_mm:    0.30,
};

// ─── FDI grids ────────────────────────────────────────────────────────────────

const UPPER = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28];
const LOWER = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];

function toothMoveMagnitude(p: MovementPrescription | undefined): number {
  if (!p) return 0;
  return Math.max(
    p.translationMesialMm, p.translationDistalMm,
    p.translationBuccalMm, p.translationLingualMm,
    p.intrusionMm, p.extrusionMm,
    p.mesializationMm, p.distalizationMm,
    p.expansionMm, p.constrictionMm,
    p.rootMovementMm,
    Math.abs(p.rotationDeg) * 0.12,
    Math.abs(p.torqueDeg) * 0.12,
    Math.abs(p.tipMesialDeg) * 0.12,
    Math.abs(p.tipDistalDeg) * 0.12,
  );
}

function magnitudeColor(mag: number): string {
  if (mag === 0) return "bg-[color:var(--border)] text-[color:var(--muted-foreground)]";
  if (mag <= LIMITS.translation_mm) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
  if (mag <= LIMITS.translation_mm * 2) return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
  return "bg-red-500/20 text-red-700 dark:text-red-300";
}

// ─── Number field with inline limit warning ───────────────────────────────────

function MovField({
  label, value, onChange, limit, unit = "mm", step = 0.05, min = 0, max = 5,
}: {
  label: string; value: number; onChange: (v: number) => void;
  limit: number; unit?: string; step?: number; min?: number; max?: number;
}) {
  const over = value > limit;
  return (
    <div className="space-y-0.5">
      <label className={`block text-[9px] font-semibold uppercase tracking-wide ${
        over ? "text-amber-600 dark:text-amber-400" : "text-[color:var(--muted-foreground)]"
      }`}>
        {label} ({unit}){over && ` ⚠ >${limit}`}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`h-8 w-full rounded-lg border bg-[color:var(--card)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none ${
          over
            ? "border-amber-400/60 focus:border-amber-500"
            : "border-[color:var(--border)] focus:border-[color:var(--primary)]"
        }`}
      />
    </div>
  );
}

// ─── Signed number field (for rotation / torque) ─────────────────────────────

function SignedMovField({
  label, value, onChange, limit, unit = "°",
}: {
  label: string; value: number; onChange: (v: number) => void;
  limit: number; unit?: string;
}) {
  const over = Math.abs(value) > limit;
  return (
    <div className="space-y-0.5">
      <label className={`block text-[9px] font-semibold uppercase tracking-wide ${
        over ? "text-amber-600 dark:text-amber-400" : "text-[color:var(--muted-foreground)]"
      }`}>
        {label} ({unit}){over && ` ⚠ >±${limit}`}
      </label>
      <input
        type="number"
        value={value}
        min={-30}
        max={30}
        step={0.5}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`h-8 w-full rounded-lg border bg-[color:var(--card)] px-2 text-sm text-[color:var(--foreground)] focus:outline-none ${
          over
            ? "border-amber-400/60 focus:border-amber-500"
            : "border-[color:var(--border)] focus:border-[color:var(--primary)]"
        }`}
      />
    </div>
  );
}

// ─── Prescription form ────────────────────────────────────────────────────────

const BLANK: MovementPrescriptionDto = {
  toothNumber: 0,
  translationMesialMm: 0, translationDistalMm: 0,
  translationBuccalMm: 0, translationLingualMm: 0,
  intrusionMm: 0, extrusionMm: 0,
  rotationDeg: 0, torqueDeg: 0,
  tipMesialDeg: 0, tipDistalDeg: 0,
  mesializationMm: 0, distalizationMm: 0,
  expansionMm: 0, constrictionMm: 0,
  rootMovementMm: 0, notes: "",
};

function PrescriptionForm({
  fdi,
  existing,
  caseId,
  planId,
  onSaved,
  onDeleted,
}: {
  fdi: number;
  existing: MovementPrescription | undefined;
  caseId: string;
  planId: string;
  onSaved: (p: MovementPrescription) => void;
  onDeleted: (fdi: number) => void;
}) {
  const [form, setForm] = useState<MovementPrescriptionDto>(() =>
    existing
      ? { ...existing, toothNumber: fdi }
      : { ...BLANK, toothNumber: fdi },
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when selected tooth changes
  useEffect(() => {
    setForm(existing ? { ...existing, toothNumber: fdi } : { ...BLANK, toothNumber: fdi });
    setError(null);
  }, [fdi, existing]);

  function set<K extends keyof MovementPrescriptionDto>(key: K, val: MovementPrescriptionDto[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertPrescription(caseId, planId, form);
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await deletePrescription(caseId, planId, fdi);
      onDeleted(fdi);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-[color:var(--primary-glow)] px-2.5 py-1 text-sm font-bold text-[color:var(--primary)]">
          FDI {fdi}
        </span>
        <span className="text-xs text-[color:var(--muted-foreground)]">
          {fdi >= 11 && fdi <= 28 ? "Upper arch" : "Lower arch"}
        </span>
        {existing?.approvedAt && (
          <StatusBadge tone="success">Approved</StatusBadge>
        )}
      </div>

      {/* Translation */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">
          Translation
        </p>
        <div className="grid grid-cols-2 gap-2">
          <MovField label="Mesial" value={form.translationMesialMm ?? 0} onChange={v => set("translationMesialMm", v)} limit={LIMITS.translation_mm} />
          <MovField label="Distal" value={form.translationDistalMm ?? 0} onChange={v => set("translationDistalMm", v)} limit={LIMITS.translation_mm} />
          <MovField label="Buccal" value={form.translationBuccalMm ?? 0} onChange={v => set("translationBuccalMm", v)} limit={LIMITS.translation_mm} />
          <MovField label="Lingual" value={form.translationLingualMm ?? 0} onChange={v => set("translationLingualMm", v)} limit={LIMITS.translation_mm} />
        </div>
      </div>

      {/* Vertical */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">
          Vertical
        </p>
        <div className="grid grid-cols-2 gap-2">
          <MovField label="Intrusion" value={form.intrusionMm ?? 0} onChange={v => set("intrusionMm", v)} limit={LIMITS.intrusion_mm} max={3} />
          <MovField label="Extrusion" value={form.extrusionMm ?? 0} onChange={v => set("extrusionMm", v)} limit={LIMITS.extrusion_mm} max={3} />
        </div>
      </div>

      {/* Angular */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">
          Rotation & Angulation
        </p>
        <div className="grid grid-cols-2 gap-2">
          <SignedMovField label="Rotation" value={form.rotationDeg ?? 0} onChange={v => set("rotationDeg", v)} limit={LIMITS.rotation_deg} />
          <SignedMovField label="Torque" value={form.torqueDeg ?? 0} onChange={v => set("torqueDeg", v)} limit={LIMITS.torque_deg} />
          <SignedMovField label="Tip Mesial" value={form.tipMesialDeg ?? 0} onChange={v => set("tipMesialDeg", v)} limit={LIMITS.tip_deg} />
          <SignedMovField label="Tip Distal" value={form.tipDistalDeg ?? 0} onChange={v => set("tipDistalDeg", v)} limit={LIMITS.tip_deg} />
        </div>
      </div>

      {/* Arch */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">
          Arch Movements
        </p>
        <div className="grid grid-cols-2 gap-2">
          <MovField label="Mesialization" value={form.mesializationMm ?? 0} onChange={v => set("mesializationMm", v)} limit={LIMITS.mesiodistal_mm} />
          <MovField label="Distalization" value={form.distalizationMm ?? 0} onChange={v => set("distalizationMm", v)} limit={LIMITS.mesiodistal_mm} />
          <MovField label="Expansion" value={form.expansionMm ?? 0} onChange={v => set("expansionMm", v)} limit={LIMITS.expansion_mm} />
          <MovField label="Constriction" value={form.constrictionMm ?? 0} onChange={v => set("constrictionMm", v)} limit={LIMITS.expansion_mm} />
        </div>
      </div>

      {/* Root */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">
          Root Movement
        </p>
        <MovField label="Root apex displacement" value={form.rootMovementMm ?? 0} onChange={v => set("rootMovementMm", v)} limit={LIMITS.translation_mm * 2} max={3} />
      </div>

      {/* Notes */}
      <div className="space-y-0.5">
        <label className="block text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Notes</label>
        <textarea
          value={form.notes ?? ""}
          onChange={e => set("notes", e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1.5 text-sm text-[color:var(--foreground)] focus:outline-none focus:border-[color:var(--primary)] resize-none"
        />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-500">
          <XCircle size={12} />{error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[color:var(--primary)] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? "Saving…" : "Save Prescription"}
        </button>
        {existing && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="flex items-center justify-center gap-1 rounded-xl border border-red-300/50 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

export default function ToothMovementEditor({ caseId, planId }: Props) {
  const [prescriptions, setPrescriptions] = useState<MovementPrescription[]>([]);
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [approveResult, setApproveResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPrescriptions(await listPrescriptions(caseId, planId));
    } catch { /* swallow */ }
    setLoading(false);
  }, [caseId, planId]);

  useEffect(() => { void load(); }, [load]);

  const byFdi = new Map(prescriptions.map(p => [p.toothNumber, p]));

  function handleSaved(p: MovementPrescription) {
    setPrescriptions(prev => {
      const idx = prev.findIndex(x => x.toothNumber === p.toothNumber);
      return idx >= 0 ? prev.map((x, i) => i === idx ? p : x) : [...prev, p];
    });
  }

  function handleDeleted(fdi: number) {
    setPrescriptions(prev => prev.filter(p => p.toothNumber !== fdi));
  }

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await approvePrescriptions(caseId, planId);
      setApproveResult(`${res.approvedCount} prescription${res.approvedCount !== 1 ? "s" : ""} approved`);
      await load();
    } catch { /* swallow */ }
    setApproving(false);
  }

  function renderRow(fdis: number[], label: string) {
    return (
      <div className="space-y-1">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">{label}</p>
        <div className="flex flex-wrap gap-1">
          {fdis.map(fdi => {
            const p = byFdi.get(fdi);
            const mag = toothMoveMagnitude(p);
            const isSelected = selectedFdi === fdi;
            return (
              <button
                key={fdi}
                type="button"
                onClick={() => setSelectedFdi(fdi === selectedFdi ? null : fdi)}
                className={[
                  "flex h-9 w-9 flex-col items-center justify-center rounded-lg border text-[9px] font-bold transition-all",
                  magnitudeColor(mag),
                  isSelected ? "ring-2 ring-[color:var(--primary)] ring-offset-1" : "",
                ].join(" ")}
                title={`FDI ${fdi}${p ? ` · ${mag.toFixed(2)}mm eq.` : ""}`}
              >
                <span>{fdi}</span>
                {p && <span className="text-[7px] opacity-70">{mag.toFixed(1)}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Movement prescriptions are AI-assisted. Clinician approval required before staging or manufacturing.
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* Left: FDI grid */}
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Select Tooth</h3>
              <div className="flex items-center gap-3 text-[9px] text-[color:var(--muted-foreground)]">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/20 inline-block"/>Within limit</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500/20 inline-block"/>Near limit</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-500/20 inline-block"/>Over limit</span>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[color:var(--muted-foreground)]" /></div>
            ) : (
              <div className="space-y-3">
                {renderRow(UPPER, "Upper arch")}
                {renderRow(LOWER, "Lower arch")}
              </div>
            )}
          </Card>

          {/* Summary stats */}
          {prescriptions.length > 0 && (
            <Card className="p-4">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <p className="text-lg font-bold tabular-nums text-[color:var(--foreground)]">{prescriptions.length}</p>
                  <p className="text-[color:var(--muted-foreground)]">Teeth prescribed</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-[color:var(--foreground)]">
                    {prescriptions.filter(p => p.approvedAt).length}
                  </p>
                  <p className="text-[color:var(--muted-foreground)]">Approved</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {prescriptions.filter(p => {
                      const mag = toothMoveMagnitude(p);
                      return mag > LIMITS.translation_mm;
                    }).length}
                  </p>
                  <p className="text-[color:var(--muted-foreground)]">Over limit</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
                >
                  {approving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                  Approve All
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedFdi(null); void load(); }}
                  className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
                >
                  <RotateCcw size={11} />
                </button>
              </div>
              {approveResult && (
                <p className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={10} />{approveResult}
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Right: prescription form */}
        <div>
          {selectedFdi ? (
            <Card className="p-4">
              <PrescriptionForm
                fdi={selectedFdi}
                existing={byFdi.get(selectedFdi)}
                caseId={caseId}
                planId={planId}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
              />
            </Card>
          ) : (
            <Card className="flex h-40 flex-col items-center justify-center p-4 text-center">
              <p className="text-sm font-medium text-[color:var(--foreground)]">Select a tooth</p>
              <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">Click any tooth in the grid to enter movement values</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
