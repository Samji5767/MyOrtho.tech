"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  Loader2,
  Lock,
  RotateCcw,
  Unlock,
  XCircle,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";
import { listPlans, listStages } from "@/lib/api/treatmentPlans";
import {
  listToothMovements,
  upsertToothMovement,
  type ToothMovement,
} from "@/lib/api/toothMovements";
import { ApiError } from "@/lib/api/client";

// FDI quadrant labels for selector
const FDI_GROUPS = [
  { label: "UR",  teeth: [11,12,13,14,15,16,17,18] },
  { label: "UL",  teeth: [21,22,23,24,25,26,27,28] },
  { label: "LL",  teeth: [31,32,33,34,35,36,37,38] },
  { label: "LR",  teeth: [41,42,43,44,45,46,47,48] },
];

interface FieldDef {
  key: keyof ToothMovement;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const MOVEMENT_FIELDS: FieldDef[] = [
  { key: "translateX",  label: "Translate X",  unit: "mm",  min: -15, max: 15,  step: 0.1 },
  { key: "translateY",  label: "Translate Y",  unit: "mm",  min: -15, max: 15,  step: 0.1 },
  { key: "translateZ",  label: "Translate Z",  unit: "mm",  min: -15, max: 15,  step: 0.1 },
  { key: "rotateX",     label: "Rotate X",     unit: "°",   min: -45, max: 45,  step: 0.5 },
  { key: "rotateY",     label: "Rotate Y",     unit: "°",   min: -45, max: 45,  step: 0.5 },
  { key: "rotateZ",     label: "Rotate Z",     unit: "°",   min: -45, max: 45,  step: 0.5 },
  { key: "tip",         label: "Tip",          unit: "°",   min: -30, max: 30,  step: 0.5 },
  { key: "torque",      label: "Torque",       unit: "°",   min: -30, max: 30,  step: 0.5 },
  { key: "intrusion",   label: "Intrusion",    unit: "mm",  min: -5,  max: 5,   step: 0.1 },
  { key: "extrusion",   label: "Extrusion",    unit: "mm",  min: -5,  max: 5,   step: 0.1 },
];

interface PlanOption { id: string; label: string }
interface StageOption { id: string; stageNumber: number }

function downloadJson(data: ToothMovement[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function downloadCsv(data: ToothMovement[], filename: string) {
  const header = [
    "fdiNumber","translateX","translateY","translateZ",
    "rotateX","rotateY","rotateZ","tip","torque","intrusion","extrusion","isLocked","notes",
  ].join(",");
  const rows = data.map((m) =>
    [
      m.fdiNumber,m.translateX,m.translateY,m.translateZ,
      m.rotateX,m.rotateY,m.rotateZ,m.tip,m.torque,m.intrusion,m.extrusion,
      m.isLocked,m.notes ?? "",
    ].join(",")
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export default function ToothTransformPanel({ caseId }: { caseId: string }) {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [planId, setPlanId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null);
  const [movements, setMovements] = useState<ToothMovement[]>([]);
  const [editing, setEditing] = useState<Partial<ToothMovement>>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load plans on mount
  useEffect(() => {
    listPlans(caseId)
      .then((data) => {
        const opts = (Array.isArray(data) ? data : []).map((p) => ({
          id: p.id,
          label: `Plan (${p.estimatedStages} stages)${p.doctorApproval ? " ✓ Approved" : ""}`,
        }));
        setPlans(opts);
        if (opts.length > 0) setPlanId(opts[0].id);
      })
      .catch(() => setLoadError("Failed to load treatment plans"));
  }, [caseId]);

  // Load stages when plan changes
  useEffect(() => {
    if (!planId) return;
    listStages(caseId, planId)
      .then((data) => {
        const stgs = (Array.isArray(data) ? data : []).map((s) => ({
          id: s.id,
          stageNumber: s.stageNumber,
        }));
        setStages(stgs);
        if (stgs.length > 0) setStageId(stgs[0].id);
        else setStageId("");
      })
      .catch(() => setLoadError("Failed to load stages"));
  }, [caseId, planId]);

  // Load movements when stage changes
  const loadMovements = useCallback(async () => {
    if (!planId || !stageId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listToothMovements(caseId, planId, stageId);
      setMovements(data);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Failed to load movements");
    } finally {
      setLoading(false);
    }
  }, [caseId, planId, stageId]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  // Populate editor when tooth selected
  useEffect(() => {
    if (selectedFdi == null) return;
    const existing = movements.find((m) => m.fdiNumber === selectedFdi);
    setEditing(existing ?? { fdiNumber: selectedFdi });
    setSaveError(null);
  }, [selectedFdi, movements]);

  async function handleSave() {
    if (selectedFdi == null || !planId || !stageId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const dto = {
        fdiNumber: selectedFdi,
        translateX: (editing.translateX as number) ?? 0,
        translateY: (editing.translateY as number) ?? 0,
        translateZ: (editing.translateZ as number) ?? 0,
        rotateX:    (editing.rotateX as number) ?? 0,
        rotateY:    (editing.rotateY as number) ?? 0,
        rotateZ:    (editing.rotateZ as number) ?? 0,
        tip:        (editing.tip as number) ?? 0,
        torque:     (editing.torque as number) ?? 0,
        intrusion:  (editing.intrusion as number) ?? 0,
        extrusion:  (editing.extrusion as number) ?? 0,
        isLocked:   !!(editing.isLocked),
        notes:      editing.notes as string | undefined,
      };
      const saved = await upsertToothMovement(caseId, planId, stageId, dto);
      setMovements((prev) => {
        const idx = prev.findIndex((m) => m.fdiNumber === selectedFdi);
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
        return [...prev, saved];
      });
      setEditing(saved);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const currentMovement = movements.find((m) => m.fdiNumber === selectedFdi);
  const hasMovement = currentMovement != null;

  return (
    <div className="space-y-4">
      {/* Honesty header */}
      <div className="rounded-xl border border-blue-200/60 bg-blue-50/60 px-3 py-2 text-xs text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
        <strong>Movement editing: Implemented</strong> — per-tooth data persisted in DB.{" "}
        Automated alignment: <em>Planned</em>. AI movement proposals: <em>Simulated</em> (not available).
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <XCircle size={12} className="shrink-0" /> {loadError}
        </div>
      )}

      {/* Plan + Stage selectors */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--muted-foreground)]">Plan</label>
            <div className="relative">
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 pr-8 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40"
              >
                {plans.length === 0 && <option value="">No plans</option>}
                {plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5 text-[color:var(--muted-foreground)]" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--muted-foreground)]">Stage</label>
            <div className="relative">
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                disabled={stages.length === 0}
                className="w-full appearance-none rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 pr-8 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40 disabled:opacity-50"
              >
                {stages.length === 0 && <option value="">No stages</option>}
                {stages.map((s) => <option key={s.id} value={s.id}>Stage {s.stageNumber}</option>)}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5 text-[color:var(--muted-foreground)]" />
            </div>
          </div>
        </div>
      </Card>

      {/* FDI tooth selector */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Select Tooth (FDI)</h3>
          {movements.length > 0 && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => downloadJson(movements, `movements-stage-${stageId.slice(0,8)}.json`)}>
                <Download size={11} /> JSON
              </Button>
              <Button variant="secondary" size="sm" onClick={() => downloadCsv(movements, `movements-stage-${stageId.slice(0,8)}.csv`)}>
                <Download size={11} /> CSV
              </Button>
            </div>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-[color:var(--muted-foreground)]" />
          </div>
        ) : (
          <div className="space-y-3">
            {FDI_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">
                  {group.label === "UR" ? "Upper Right" : group.label === "UL" ? "Upper Left" : group.label === "LL" ? "Lower Left" : "Lower Right"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.teeth.map((fdi) => {
                    const moved = movements.find((m) => m.fdiNumber === fdi);
                    const locked = moved?.isLocked;
                    return (
                      <button
                        key={fdi}
                        type="button"
                        onClick={() => setSelectedFdi(fdi === selectedFdi ? null : fdi)}
                        className={[
                          "relative flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition-all active:scale-95",
                          selectedFdi === fdi
                            ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                            : moved
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                        ].join(" ")}
                      >
                        {fdi}
                        {locked && (
                          <Lock size={6} className="absolute bottom-0.5 right-0.5 text-amber-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10px] text-[color:var(--muted-foreground)]">
          Green = has recorded movement. Lock icon = locked stage.
        </p>
      </Card>

      {/* Movement editor */}
      {selectedFdi != null && stageId && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                Tooth FDI {selectedFdi}
              </h3>
              {hasMovement && (
                <StatusBadge tone="success">Saved</StatusBadge>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                setEditing((prev) => ({ ...prev, isLocked: !prev.isLocked }))
              }
              className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
            >
              {editing.isLocked ? <Lock size={11} className="text-amber-500" /> : <Unlock size={11} />}
              {editing.isLocked ? "Locked" : "Lock"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MOVEMENT_FIELDS.map((field) => {
              const val = (editing[field.key] as number | undefined) ?? 0;
              return (
                <div key={field.key}>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
                    {field.label} ({field.unit})
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={val}
                      disabled={!!(editing.isLocked)}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))
                      }
                      className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1.5 text-sm tabular-nums text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40 disabled:opacity-50"
                    />
                    {val !== 0 && (
                      <button
                        type="button"
                        onClick={() => setEditing((prev) => ({ ...prev, [field.key]: 0 }))}
                        className="shrink-0 rounded-full p-0.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                        title="Reset to 0"
                      >
                        <RotateCcw size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">Notes</label>
            <textarea
              rows={2}
              value={(editing.notes as string | undefined) ?? ""}
              disabled={!!(editing.isLocked)}
              onChange={(e) => setEditing((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Clinical notes for this tooth…"
              className="w-full resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40 disabled:opacity-50"
            />
          </div>

          {saveError && (
            <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
              <XCircle size={11} className="shrink-0" /> {saveError}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving || !!(editing.isLocked)}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              Save movement
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSelectedFdi(null)}>
              Close
            </Button>
          </div>
        </Card>
      )}

      {/* Movement table */}
      {movements.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[color:var(--border)] px-4 py-3">
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
              Movement Table
              <span className="ml-1.5 font-normal text-[color:var(--muted-foreground)]">
                ({movements.length} tooth{movements.length !== 1 ? "teeth" : ""} with recorded movements)
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[color:var(--muted)]/30">
                <tr>
                  {["FDI","Tx","Ty","Tz","Rx","Ry","Rz","Tip","Torq","Int","Ext","Lock"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-[color:var(--muted-foreground)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]">
                {movements.sort((a, b) => a.fdiNumber - b.fdiNumber).map((m) => (
                  <tr
                    key={m.id}
                    className="cursor-pointer hover:bg-[color:var(--muted)]/20"
                    onClick={() => setSelectedFdi(m.fdiNumber)}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-bold text-[color:var(--foreground)]">{m.fdiNumber}</td>
                    {[m.translateX,m.translateY,m.translateZ,m.rotateX,m.rotateY,m.rotateZ,m.tip,m.torque,m.intrusion,m.extrusion].map((v, i) => (
                      <td key={i} className={`whitespace-nowrap px-3 py-2 tabular-nums ${v !== 0 ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>
                        {v.toFixed(1)}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {m.isLocked ? <Lock size={11} className="text-amber-500" /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        All movements are for treatment planning only. Verify with a licensed orthodontist before manufacturing.
      </div>
    </div>
  );
}
