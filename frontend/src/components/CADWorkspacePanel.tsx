"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Unlock,
  Zap,
} from "lucide-react";
import { Card, Spinner, EmptyState } from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToothMovement {
  tooth_fdi: number;
  mesial: number;
  distal: number;
  buccal: number;
  lingual: number;
  intrusion: number;
  extrusion: number;
  mesial_rotation: number;
  distal_rotation: number;
  mesial_tip: number;
  distal_tip: number;
  torque: number;
  root_translation: number;
  root_torque: number;
  root_tip: number;
  locked: boolean;
}

interface DigitalSetup {
  id: string;
  case_id: string;
  name: string;
  status: string;
  approved: boolean;
  approved_at?: string;
  tooth_movements: ToothMovement[];
  created_at: string;
}

// ─── Tooth Metadata ───────────────────────────────────────────────────────────

const TOOTH_NAMES: Record<number, string> = {
  1: "Central Incisor",
  2: "Lateral Incisor",
  3: "Canine",
  4: "1st Premolar",
  5: "2nd Premolar",
  6: "1st Molar",
  7: "2nd Molar",
  8: "3rd Molar",
};

function toothName(fdi: number): string {
  return TOOTH_NAMES[fdi % 10] ?? `Tooth ${fdi}`;
}

// Upper arch FDI numbers from right to left: 18,17,...,11,21,...,28
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
// Lower arch FDI numbers from right to left: 48,47,...,41,31,...,38
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// SVG arch dimensions
const SVG_W = 520;
const SVG_H = 220;
const TOOTH_W = 18;
const TOOTH_H = 26;

// Precompute ellipse positions for teeth along arch
function archPositions(teeth: number[], cx: number, cy: number, rx: number, ry: number, startAngle: number, endAngle: number): { x: number; y: number; fdi: number }[] {
  return teeth.map((fdi, i) => {
    const t = teeth.length === 1 ? 0.5 : i / (teeth.length - 1);
    const angle = startAngle + t * (endAngle - startAngle);
    const rad = (angle * Math.PI) / 180;
    return {
      fdi,
      x: cx + rx * Math.cos(rad) - TOOTH_W / 2,
      y: cy + ry * Math.sin(rad) - TOOTH_H / 2,
    };
  });
}

const UPPER_POSITIONS = archPositions(UPPER_TEETH, SVG_W / 2, 55, 210, 60, 180, 360);
const LOWER_POSITIONS = archPositions(LOWER_TEETH, SVG_W / 2, SVG_H - 55, 210, 60, 0, 180);

// ─── Movement Helpers ─────────────────────────────────────────────────────────

function defaultMovement(fdi: number): ToothMovement {
  return {
    tooth_fdi: fdi,
    mesial: 0, distal: 0, buccal: 0, lingual: 0, intrusion: 0, extrusion: 0,
    mesial_rotation: 0, distal_rotation: 0,
    mesial_tip: 0, distal_tip: 0, torque: 0,
    root_translation: 0, root_torque: 0, root_tip: 0,
    locked: false,
  };
}

function hasMovement(m: ToothMovement): boolean {
  return [m.mesial, m.distal, m.buccal, m.lingual, m.intrusion, m.extrusion,
    m.mesial_rotation, m.distal_rotation, m.mesial_tip, m.distal_tip, m.torque,
    m.root_translation, m.root_torque, m.root_tip].some((v) => Math.abs(v) > 0.001);
}

function totalAbsMovement(m: ToothMovement): number {
  return Math.abs(m.mesial) + Math.abs(m.distal) + Math.abs(m.buccal) +
    Math.abs(m.lingual) + Math.abs(m.intrusion) + Math.abs(m.extrusion) +
    Math.abs(m.mesial_rotation) + Math.abs(m.distal_rotation) +
    Math.abs(m.mesial_tip) + Math.abs(m.distal_tip) + Math.abs(m.torque);
}

function movementColorClass(v: number): string {
  const abs = Math.abs(v);
  if (abs < 0.001) return "text-secondary";
  if (abs < 1) return "text-emerald-600";
  if (abs < 3) return "text-amber-600";
  return "text-rose-600";
}

// ─── Arch SVG Component ───────────────────────────────────────────────────────

function ArchDiagram({
  movements,
  selectedTooth,
  onSelectTooth,
}: {
  movements: ToothMovement[];
  selectedTooth: number | null;
  onSelectTooth: (fdi: number) => void;
}) {
  const movMap = new Map(movements.map((m) => [m.tooth_fdi, m]));

  const renderTeeth = (positions: { x: number; y: number; fdi: number }[]) =>
    positions.map(({ x, y, fdi }) => {
      const mv = movMap.get(fdi);
      const isSelected = selectedTooth === fdi;
      const isLocked = mv?.locked ?? false;
      const hasMov = mv ? hasMovement(mv) : false;

      let fill = "white";
      let stroke = "#94a3b8";
      let strokeW = 1;

      if (isSelected) { fill = "#eef2ff"; stroke = "#4f46e5"; strokeW = 2; }
      else if (isLocked) { fill = "#f1f5f9"; stroke = "#94a3b8"; }
      else if (hasMov) { fill = "#eff6ff"; stroke = "#3b82f6"; }

      return (
        <g key={fdi} onClick={() => onSelectTooth(fdi)} style={{ cursor: "pointer" }}>
          <rect
            x={x} y={y}
            width={TOOTH_W} height={TOOTH_H}
            rx={3} ry={3}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeW}
          />
          <text
            x={x + TOOTH_W / 2}
            y={y + TOOTH_H / 2 + 4}
            textAnchor="middle"
            fontSize={8}
            fontWeight={isSelected ? "700" : "500"}
            fill={isSelected ? "#4f46e5" : "#334155"}
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {fdi}
          </text>
          {isLocked && (
            <text x={x + TOOTH_W - 4} y={y + 8} fontSize={7} fill="#94a3b8" style={{ pointerEvents: "none" }}>🔒</text>
          )}
        </g>
      );
    });

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" className="max-w-full">
      {/* Upper arch guide */}
      <ellipse cx={SVG_W / 2} cy={55} rx={215} ry={65} fill="none" stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 3" />
      {/* Lower arch guide */}
      <ellipse cx={SVG_W / 2} cy={SVG_H - 55} rx={215} ry={65} fill="none" stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 3" />
      {/* Labels */}
      <text x={12} y={30} fontSize={9} fill="#94a3b8" fontWeight="600">UPPER</text>
      <text x={12} y={SVG_H - 12} fontSize={9} fill="#94a3b8" fontWeight="600">LOWER</text>
      {renderTeeth(UPPER_POSITIONS)}
      {renderTeeth(LOWER_POSITIONS)}
    </svg>
  );
}

// ─── Movement Control Row ─────────────────────────────────────────────────────

function MovementRow({
  label,
  value,
  step,
  unit,
  onDelta,
  disabled,
}: {
  label: string;
  value: number;
  step: number;
  unit: string;
  onDelta: (delta: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="w-32 text-xs text-secondary">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onDelta(-step)}
          disabled={disabled}
          className="flex h-6 w-6 items-center justify-center rounded border border-border text-xs font-bold text-secondary hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-40"
        >−</button>
        <span className={`w-14 text-center text-xs font-semibold tabular-nums ${movementColorClass(value)}`}>
          {value === 0 ? "0" : value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2)} {unit}
        </span>
        <button
          onClick={() => onDelta(step)}
          disabled={disabled}
          className="flex h-6 w-6 items-center justify-center rounded border border-border text-xs font-bold text-secondary hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-40"
        >+</button>
      </div>
    </div>
  );
}

// ─── Tooth Editor Panel ───────────────────────────────────────────────────────

function ToothEditorPanel({
  fdi,
  movement,
  setupId,
  token,
  onMovementUpdated,
}: {
  fdi: number;
  movement: ToothMovement;
  setupId: string;
  token: string;
  onMovementUpdated: (m: ToothMovement) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const applyDelta = async (movementType: string, deltaValue: number) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/digital-setup/${setupId}/move`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ toothFdi: fdi, movementType, deltaValue }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json() as ToothMovement;
      onMovementUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply movement");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/digital-setup/${setupId}/reset-tooth/${fdi}`, {
        method: "PATCH",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json() as ToothMovement;
      onMovementUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset");
    } finally {
      setSaving(false);
    }
  };

  const handleLockToggle = async () => {
    await applyDelta("lock_toggle", movement.locked ? 0 : 1);
  };

  const totalMov = totalAbsMovement(movement);
  const isLocked = movement.locked;

  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Tooth {fdi}</p>
          <p className="text-sm font-bold text-foreground">{toothName(fdi)}</p>
        </div>
        <div className="flex items-center gap-1">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
          <button
            onClick={handleLockToggle}
            disabled={saving}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${
              isLocked
                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-border text-secondary hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {isLocked ? "Locked" : "Lock"}
          </button>
          <button
            onClick={handleReset}
            disabled={saving || isLocked}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold text-secondary hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Translation */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-secondary">Translation (mm)</p>
        <MovementRow label="Mesial" value={movement.mesial} step={0.25} unit="mm" onDelta={(d) => applyDelta("mesial", d)} disabled={saving || isLocked} />
        <MovementRow label="Distal" value={movement.distal} step={0.25} unit="mm" onDelta={(d) => applyDelta("distal", d)} disabled={saving || isLocked} />
        <MovementRow label="Buccal" value={movement.buccal} step={0.25} unit="mm" onDelta={(d) => applyDelta("buccal", d)} disabled={saving || isLocked} />
        <MovementRow label="Lingual" value={movement.lingual} step={0.25} unit="mm" onDelta={(d) => applyDelta("lingual", d)} disabled={saving || isLocked} />
        <MovementRow label="Intrusion" value={movement.intrusion} step={0.25} unit="mm" onDelta={(d) => applyDelta("intrusion", d)} disabled={saving || isLocked} />
        <MovementRow label="Extrusion" value={movement.extrusion} step={0.25} unit="mm" onDelta={(d) => applyDelta("extrusion", d)} disabled={saving || isLocked} />
      </div>

      {/* Rotation */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-secondary">Rotation (°)</p>
        <MovementRow label="Mesial Rotation" value={movement.mesial_rotation} step={1} unit="°" onDelta={(d) => applyDelta("mesial_rotation", d)} disabled={saving || isLocked} />
        <MovementRow label="Distal Rotation" value={movement.distal_rotation} step={1} unit="°" onDelta={(d) => applyDelta("distal_rotation", d)} disabled={saving || isLocked} />
      </div>

      {/* Angulation */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-secondary">Angulation (°)</p>
        <MovementRow label="Mesial Tip" value={movement.mesial_tip} step={0.5} unit="°" onDelta={(d) => applyDelta("mesial_tip", d)} disabled={saving || isLocked} />
        <MovementRow label="Distal Tip" value={movement.distal_tip} step={0.5} unit="°" onDelta={(d) => applyDelta("distal_tip", d)} disabled={saving || isLocked} />
      </div>

      {/* Torque */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-secondary">Torque (°)</p>
        <MovementRow label="Torque" value={movement.torque} step={0.5} unit="°" onDelta={(d) => applyDelta("torque", d)} disabled={saving || isLocked} />
        <p className="mt-1 text-[10px] text-secondary">+ = labial root torque</p>
      </div>

      {/* Root */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-secondary">Root</p>
        <MovementRow label="Root Translation" value={movement.root_translation} step={0.25} unit="mm" onDelta={(d) => applyDelta("root_translation", d)} disabled={saving || isLocked} />
        <MovementRow label="Root Torque" value={movement.root_torque} step={0.5} unit="°" onDelta={(d) => applyDelta("root_torque", d)} disabled={saving || isLocked} />
        <MovementRow label="Root Tip" value={movement.root_tip} step={0.5} unit="°" onDelta={(d) => applyDelta("root_tip", d)} disabled={saving || isLocked} />
      </div>

      {/* Movement Summary */}
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/30 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Movement Summary</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            { label: "M/D", value: movement.mesial - movement.distal, unit: "mm" },
            { label: "B/L", value: movement.buccal - movement.lingual, unit: "mm" },
            { label: "I/E", value: movement.intrusion - movement.extrusion, unit: "mm" },
            { label: "Rotation", value: movement.mesial_rotation - movement.distal_rotation, unit: "°" },
            { label: "Torque", value: movement.torque, unit: "°" },
            { label: "Total abs", value: totalMov, unit: "mm" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-secondary">{label}</span>
              <span className={`font-semibold tabular-nums ${movementColorClass(value)}`}>
                {value === 0 ? "0" : value > 0 ? `+${Math.abs(value).toFixed(2)}` : `-${Math.abs(value).toFixed(2)}`}{unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CADWorkspacePanel({
  caseId,
  token,
  onRunBiomechanics,
}: {
  caseId: string;
  token: string;
  onRunBiomechanics?: (setupId: string) => void;
}) {
  const [setups, setSetups] = useState<DigitalSetup[]>([]);
  const [activeSetup, setActiveSetup] = useState<DigitalSetup | null>(null);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingSetup, setCreatingSetup] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchSetups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/digital-setup?caseId=${caseId}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as DigitalSetup[];
      setSetups(data);
      if (data.length > 0 && !activeSetup) setActiveSetup(data[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load setups");
    } finally {
      setLoading(false);
    }
  }, [caseId, token]);

  useEffect(() => { fetchSetups(); }, [fetchSetups]);

  const handleNewSetup = async () => {
    setCreatingSetup(true);
    setError(null);
    try {
      const res = await fetch("/api/digital-setup", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ caseId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json() as DigitalSetup;
      setSetups((prev) => [...prev, created]);
      setActiveSetup(created);
      setSelectedTooth(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create setup");
    } finally {
      setCreatingSetup(false);
    }
  };

  const handleApprove = async () => {
    if (!activeSetup) return;
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/digital-setup/${activeSetup.id}/approve`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json() as DigitalSetup;
      setActiveSetup(updated);
      setSetups((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  const handleMovementUpdated = (updatedMovement: ToothMovement) => {
    if (!activeSetup) return;
    const updatedSetup: DigitalSetup = {
      ...activeSetup,
      tooth_movements: activeSetup.tooth_movements.some((m) => m.tooth_fdi === updatedMovement.tooth_fdi)
        ? activeSetup.tooth_movements.map((m) => m.tooth_fdi === updatedMovement.tooth_fdi ? updatedMovement : m)
        : [...activeSetup.tooth_movements, updatedMovement],
    };
    setActiveSetup(updatedSetup);
    setSetups((prev) => prev.map((s) => (s.id === updatedSetup.id ? updatedSetup : s)));
  };

  const getMovement = (fdi: number): ToothMovement => {
    return activeSetup?.tooth_movements.find((m) => m.tooth_fdi === fdi) ?? defaultMovement(fdi);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Setup selector + action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-secondary">Setup:</label>
          <div className="relative">
            <select
              value={activeSetup?.id ?? ""}
              onChange={(e) => {
                const s = setups.find((x) => x.id === e.target.value);
                if (s) { setActiveSetup(s); setSelectedTooth(null); }
              }}
              className="appearance-none rounded-lg border border-border bg-card py-2 pl-3 pr-8 text-sm text-foreground focus:border-indigo-400 focus:outline-none"
            >
              {setups.length === 0 && <option value="">No setups</option>}
              {setups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.approved ? "✓" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
          </div>
          <button
            onClick={handleNewSetup}
            disabled={creatingSetup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-secondary hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
          >
            {creatingSetup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            New Setup
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeSetup?.approved && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approved
            </span>
          )}
          {activeSetup && !activeSetup.approved && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Approve Setup
            </button>
          )}
          {activeSetup && onRunBiomechanics && (
            <button
              onClick={() => onRunBiomechanics(activeSetup.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Zap className="h-3.5 w-3.5" />
              Run Biomechanics
            </button>
          )}
          <button
            onClick={fetchSetups}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-2 text-xs text-secondary hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!activeSetup ? (
        <EmptyState
          icon={Plus}
          title="No digital setups"
          body="Click New Setup to create a digital setup for this case."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          {/* Arch diagram */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Tooth Arch — Click to select</p>
              {selectedTooth && (
                <button
                  onClick={() => setSelectedTooth(null)}
                  className="text-xs text-secondary hover:text-foreground"
                >
                  Deselect
                </button>
              )}
            </div>
            <ArchDiagram
              movements={activeSetup.tooth_movements}
              selectedTooth={selectedTooth}
              onSelectTooth={setSelectedTooth}
            />
            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-secondary">
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded border border-slate-300 bg-white" /> Unselected</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded border-2 border-indigo-500 bg-indigo-50" /> Selected</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded border border-blue-400 bg-blue-50" /> Has movements</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded border border-slate-300 bg-slate-100" /> Locked</span>
            </div>
          </Card>

          {/* Tooth editor */}
          {selectedTooth !== null ? (
            <Card className="p-4">
              <ToothEditorPanel
                fdi={selectedTooth}
                movement={getMovement(selectedTooth)}
                setupId={activeSetup.id}
                token={token}
                onMovementUpdated={handleMovementUpdated}
              />
            </Card>
          ) : (
            <Card className="flex items-center justify-center p-8">
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Select a tooth</p>
                <p className="mt-1 text-xs text-secondary">Click any tooth in the arch diagram to edit its movements.</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
