"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Minus,
  Plus,
  RotateCcw,
  Ruler,
  Trash2,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/DesignSystem";
import { useToast } from "@/components/ToastContext";

// ─── Dynamic imports (heavy) ──────────────────────────────────────────────────

const AlignerStaging = dynamic(() => import("@/components/AlignerStaging"), {
  ssr: false,
  loading: () => <div className="h-48 animate-skeleton rounded-xl" />,
});

// ─── Shared utilities ─────────────────────────────────────────────────────────

function EstimatedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
      <AlertTriangle size={8} /> Estimated
    </span>
  );
}

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-300/60 bg-blue-50/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">
      Demo
    </span>
  );
}

const INPUT_CLS = [
  "h-9 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]",
  "px-3 text-sm text-[color:var(--foreground)]",
  "focus:border-[color:var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/20 transition-colors",
].join(" ");

const SELECT_CLS = `${INPUT_CLS} appearance-none cursor-pointer`;

// ─── Tab definitions ──────────────────────────────────────────────────────────

type AnalysisTab =
  | "overview"
  | "measurements"
  | "occlusion"
  | "movements"
  | "attachments"
  | "ipr"
  | "staging"
  | "export";

const ANALYSIS_TABS: { key: AnalysisTab; label: string }[] = [
  { key: "overview",     label: "Overview"   },
  { key: "measurements", label: "Measurements" },
  { key: "occlusion",   label: "Occlusion"  },
  { key: "movements",   label: "Movements"  },
  { key: "attachments", label: "Attachments"},
  { key: "ipr",         label: "IPR"        },
  { key: "staging",     label: "Staging"    },
  { key: "export",      label: "Export"     },
];

// ─── FDI tooth list helper ────────────────────────────────────────────────────

const UPPER_FDI = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER_FDI = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const ALL_FDI   = [...UPPER_FDI, ...LOWER_FDI];

function toothLabel(fdi: number): string {
  const names: Record<number, string> = {
    11:"UR1",12:"UR2",13:"UR3",14:"UR4",15:"UR5",16:"UR6",17:"UR7",18:"UR8",
    21:"UL1",22:"UL2",23:"UL3",24:"UL4",25:"UL5",26:"UL6",27:"UL7",28:"UL8",
    31:"LL1",32:"LL2",33:"LL3",34:"LL4",35:"LL5",36:"LL6",37:"LL7",38:"LL8",
    41:"LR1",42:"LR2",43:"LR3",44:"LR4",45:"LR5",46:"LR6",47:"LR7",48:"LR8",
  };
  return names[fdi] ? `${fdi} (${names[fdi]})` : String(fdi);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ caseId, patientName }: { caseId: string | null; patientName: string }) {
  const metrics = [
    { label: "Estimated stages",     value: "22",        sub: "Aligner steps", tone: "primary" },
    { label: "Total IPR",            value: "2.4 mm",    sub: "Across 6 sites", tone: "warning" },
    { label: "Attachments",          value: "8",         sub: "Upper + lower", tone: "info" },
    { label: "Treat. duration",      value: "11 mo",     sub: "Estimated", tone: "success" },
  ] as const;

  const readiness = [
    { label: "Scan uploaded",        done: !!caseId },
    { label: "Segmentation reviewed", done: false },
    { label: "Occlusion recorded",   done: false },
    { label: "Movements planned",    done: false },
    { label: "Attachments set",      done: false },
    { label: "IPR mapped",           done: false },
    { label: "Staging generated",    done: false },
    { label: "Export approved",      done: false },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">
          {patientName || "No case loaded"}
        </p>
        <DemoBadge />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4">
            <p className="text-xl font-bold text-[color:var(--foreground)]">{m.value}</p>
            <p className="text-[10px] font-semibold text-[color:var(--foreground)] mt-0.5">{m.label}</p>
            <p className="text-[10px] text-[color:var(--muted-foreground)]">{m.sub}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)] mb-3">Plan Readiness</p>
        <div className="space-y-1.5">
          {readiness.map((r) => (
            <div key={r.label} className="flex items-center gap-2.5">
              {r.done
                ? <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                : <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[color:var(--border)]" />
              }
              <span className={`text-xs ${r.done ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>
                {r.label}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <strong>Demo values shown.</strong> Connect a case and AI backend to display real clinical calculations. All planning values must be reviewed by a licensed clinician before treatment.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: MEASUREMENTS
// ─────────────────────────────────────────────────────────────────────────────

interface Measurement {
  id: string;
  label: string;
  value: string;
  unit: string;
  note: string;
}

const DEFAULT_MEASUREMENTS: Measurement[] = [
  { id: "overjet",    label: "Overjet",             value: "4.2", unit: "mm", note: "Pre-treatment" },
  { id: "overbite",   label: "Overbite",            value: "3.1", unit: "mm", note: "Pre-treatment" },
  { id: "intercan",   label: "Intercanine Width",   value: "32.4",unit: "mm", note: "Upper arch" },
  { id: "intermol",   label: "Intermolar Width",    value: "51.8",unit: "mm", note: "Upper arch" },
  { id: "arch_u",     label: "Upper Arch Length",   value: "78.2",unit: "mm", note: "Pre-treatment" },
  { id: "arch_l",     label: "Lower Arch Length",   value: "75.6",unit: "mm", note: "Pre-treatment" },
  { id: "crowding_u", label: "Upper Crowding",      value: "4.8", unit: "mm", note: "Estimated" },
  { id: "crowding_l", label: "Lower Crowding",      value: "3.2", unit: "mm", note: "Estimated" },
];

function MeasurementsTab() {
  const { toast } = useToast();
  const [measurements, setMeasurements] = useState<Measurement[]>(DEFAULT_MEASUREMENTS);

  function exportMeasurements() {
    const blob = new Blob([JSON.stringify(measurements, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "myortho-measurements.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Measurements exported", description: "Saved as myortho-measurements.json", type: "success" });
  }

  function updateValue(id: string, value: string) {
    setMeasurements((prev) => prev.map((m) => m.id === id ? { ...m, value } : m));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)]">Arch Measurements</p>
        <EstimatedBadge />
        <button
          type="button"
          onClick={exportMeasurements}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-xl border border-[color:var(--border)] px-2.5 text-xs font-semibold text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-colors"
        >
          <Download size={11} /> Export JSON
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[color:var(--border)] bg-[color-mix(in_srgb,var(--border)_30%,transparent)]">
              <th className="px-3 py-2 text-left font-semibold text-[color:var(--foreground)]">Measurement</th>
              <th className="px-3 py-2 text-center font-semibold text-[color:var(--foreground)]">Value (mm)</th>
              <th className="px-3 py-2 text-left font-semibold text-[color:var(--muted-foreground)]">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border)]">
            {measurements.map((m) => (
              <tr key={m.id} className="bg-[color:var(--card)]">
                <td className="px-3 py-2 font-medium text-[color:var(--foreground)]">{m.label}</td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    step="0.1"
                    value={m.value}
                    onChange={(e) => updateValue(m.id, e.target.value)}
                    className="w-20 rounded-lg border border-[color:var(--border)] bg-transparent px-2 py-1 text-center text-xs focus:border-[color:var(--primary)] focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2 text-[color:var(--muted-foreground)]">{m.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        All values are estimated from demo data. Connect 3D scan geometry for real point-to-point measurements.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: OCCLUSION
// ─────────────────────────────────────────────────────────────────────────────

function OcclusionTab() {
  const [showContacts, setShowContacts] = useState(true);

  const indicators = [
    { label: "Angle Class",      value: "Class II Div 1", tone: "warning" as const },
    { label: "Overjet",          value: "4.2 mm",         tone: "warning" as const },
    { label: "Overbite",         value: "3.1 mm",         tone: "info" as const    },
    { label: "Midline Shift",    value: "1.5 mm (R)",     tone: "warning" as const },
    { label: "Deep Bite",        value: "Not detected",   tone: "success" as const },
    { label: "Open Bite",        value: "Not detected",   tone: "success" as const },
    { label: "Crossbite",        value: "Not detected",   tone: "success" as const },
  ];

  const contacts = [
    { pair: "16–46", type: "Cusp-to-fossa",  status: "Good" },
    { pair: "17–47", type: "Cusp-to-fossa",  status: "Good" },
    { pair: "26–36", type: "Cusp-to-fossa",  status: "Good" },
    { pair: "13–43", type: "Cusp tip",       status: "Premature" },
    { pair: "23–33", type: "Cusp tip",       status: "Good" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)]">Bite Relationship</p>
        <DemoBadge />
        <button
          type="button"
          onClick={() => setShowContacts((v) => !v)}
          className="ml-auto text-[10px] text-[color:var(--primary)] hover:underline"
        >
          {showContacts ? "Hide" : "Show"} contacts
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {indicators.map((ind) => (
          <div key={ind.label} className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5">
            <span className="text-xs text-[color:var(--foreground)]">{ind.label}</span>
            <StatusBadge tone={ind.tone}>{ind.value}</StatusBadge>
          </div>
        ))}
      </div>

      {showContacts && (
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)] mb-3">Contact Points</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[color:var(--border)]">
                  <th className="pb-1.5 text-left font-semibold text-[color:var(--foreground)]">Pair</th>
                  <th className="pb-1.5 text-left font-semibold text-[color:var(--foreground)]">Type</th>
                  <th className="pb-1.5 text-left font-semibold text-[color:var(--foreground)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]">
                {contacts.map((c) => (
                  <tr key={c.pair}>
                    <td className="py-1.5 font-mono text-[color:var(--foreground)]">{c.pair}</td>
                    <td className="py-1.5 text-[color:var(--muted-foreground)]">{c.type}</td>
                    <td className="py-1.5">
                      <StatusBadge tone={c.status === "Good" ? "success" : "warning"}>{c.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        Occlusion data is demo/estimated. Real contact analysis requires AI mesh intersection computation.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: TOOTH MOVEMENTS
// ─────────────────────────────────────────────────────────────────────────────

interface ToothMovement {
  fdi: number;
  tx: number; ty: number; tz: number;
  tip: number; torque: number; rotation: number;
}

const EMPTY_MOVEMENT = (fdi: number): ToothMovement => ({
  fdi, tx: 0, ty: 0, tz: 0, tip: 0, torque: 0, rotation: 0,
});

type MovField = keyof Omit<ToothMovement, "fdi">;

const MOV_FIELDS: { key: MovField; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "tx",       label: "Mesial/Distal",    unit: "mm", min: -10, max: 10,  step: 0.1 },
  { key: "ty",       label: "Buccal/Lingual",   unit: "mm", min: -8,  max: 8,   step: 0.1 },
  { key: "tz",       label: "Intrusion/Extrusion", unit: "mm", min: -5, max: 5,  step: 0.1 },
  { key: "tip",      label: "Tip",              unit: "°",  min: -30, max: 30,  step: 0.5 },
  { key: "torque",   label: "Torque",           unit: "°",  min: -30, max: 30,  step: 0.5 },
  { key: "rotation", label: "Rotation",         unit: "°",  min: -45, max: 45,  step: 0.5 },
];

function MovementsTab() {
  const { toast } = useToast();
  const [selectedFdi, setSelectedFdi] = useState<number>(11);
  const [movements, setMovements] = useState<Record<number, ToothMovement>>({});

  const current = movements[selectedFdi] ?? EMPTY_MOVEMENT(selectedFdi);

  function updateField(field: MovField, val: number) {
    setMovements((prev) => ({
      ...prev,
      [selectedFdi]: { ...current, [field]: val },
    }));
  }

  function resetTooth() {
    setMovements((prev) => {
      const next = { ...prev };
      delete next[selectedFdi];
      return next;
    });
    toast({ title: `FDI ${selectedFdi} reset`, type: "info" });
  }

  function exportMovements() {
    const data = ALL_FDI.map((fdi) => movements[fdi] ?? EMPTY_MOVEMENT(fdi));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "myortho-movements.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Movements exported", type: "success" });
  }

  const movedCount = Object.values(movements).filter(
    (m) => Object.values(m).some((v, i) => i > 0 && v !== 0)
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)]">Tooth Movements</p>
        <EstimatedBadge />
        <StatusBadge tone="info">{movedCount} teeth with movements</StatusBadge>
        <button type="button" onClick={exportMovements}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-xl border border-[color:var(--border)] px-2.5 text-xs font-semibold text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-colors">
          <Download size={11} /> Export
        </button>
      </div>

      {/* Tooth selector */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">Select Tooth (FDI)</p>
        <div className="space-y-1">
          {[UPPER_FDI, LOWER_FDI].map((row, ri) => (
            <div key={ri} className="flex flex-wrap gap-1">
              {row.map((fdi) => {
                const hasMov = movements[fdi] && Object.entries(movements[fdi]).some(([k, v]) => k !== "fdi" && v !== 0);
                return (
                  <button
                    key={fdi}
                    type="button"
                    onClick={() => setSelectedFdi(fdi)}
                    className={[
                      "h-7 w-9 rounded-lg text-[10px] font-bold transition-colors",
                      selectedFdi === fdi
                        ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                        : hasMov
                        ? "border border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]",
                    ].join(" ")}
                  >
                    {fdi}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Movement controls */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">FDI {selectedFdi} — {toothLabel(selectedFdi)}</p>
          <button type="button" onClick={resetTooth}
            className="inline-flex items-center gap-1 text-[10px] text-[color:var(--muted-foreground)] hover:text-red-500 transition-colors">
            <RotateCcw size={10} /> Reset
          </button>
        </div>
        <div className="space-y-3">
          {MOV_FIELDS.map((f) => (
            <div key={f.key}>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">
                  {f.label}
                </label>
                <span className="text-xs font-bold text-[color:var(--foreground)]">
                  {current[f.key] > 0 ? "+" : ""}{Number(current[f.key]).toFixed(1)} {f.unit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => updateField(f.key, Math.max(f.min, current[f.key] - f.step))}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-colors">
                  <Minus size={10} />
                </button>
                <input
                  type="range"
                  min={f.min} max={f.max} step={f.step}
                  value={current[f.key]}
                  onChange={(e) => updateField(f.key, parseFloat(e.target.value))}
                  className="flex-1 accent-[color:var(--primary)]"
                />
                <button type="button"
                  onClick={() => updateField(f.key, Math.min(f.max, current[f.key] + f.step))}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-colors">
                  <Plus size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        Movements are stored locally and affect the CAD scene transform. Values must be validated by clinician before treatment staging.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: ATTACHMENTS
// ─────────────────────────────────────────────────────────────────────────────

interface AttachmentEntry {
  id: string;
  fdi: number;
  type: string;
  surface: string;
  stage: number;
}

const ATTACHMENT_TYPES = [
  "Rectangular",
  "Horizontal Rectangular",
  "Vertical Rectangular",
  "Ellipsoid",
  "Beveled",
  "Rotation",
  "Extrusion",
  "Retention",
];

const SURFACES = ["Buccal", "Lingual", "Mesial", "Distal"];

let attId = 0;
function newAttId() { return `att_${++attId}`; }

function AttachmentsTab() {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([
    { id: newAttId(), fdi: 13, type: "Rotation",          surface: "Buccal", stage: 1 },
    { id: newAttId(), fdi: 23, type: "Rotation",          surface: "Buccal", stage: 1 },
    { id: newAttId(), fdi: 14, type: "Vertical Rectangular", surface: "Buccal", stage: 2 },
    { id: newAttId(), fdi: 24, type: "Vertical Rectangular", surface: "Buccal", stage: 2 },
  ]);
  const [newFdi, setNewFdi]   = useState<number>(11);
  const [newType, setNewType] = useState(ATTACHMENT_TYPES[0]);
  const [newSurf, setNewSurf] = useState(SURFACES[0]);
  const [newStage, setNewStage] = useState(1);

  function addAttachment() {
    const entry: AttachmentEntry = { id: newAttId(), fdi: newFdi, type: newType, surface: newSurf, stage: newStage };
    setAttachments((prev) => [...prev, entry]);
    toast({ title: `Attachment added — FDI ${newFdi}`, type: "success" });
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function exportAttachments() {
    const blob = new Blob([JSON.stringify(attachments, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "myortho-attachments.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Attachments exported", type: "success" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)]">Attachment Plan</p>
        <StatusBadge tone="info">{attachments.length} attachments</StatusBadge>
        <button type="button" onClick={exportAttachments}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-xl border border-[color:var(--border)] px-2.5 text-xs font-semibold text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-colors">
          <Download size={11} /> Export
        </button>
      </div>

      {/* Add form */}
      <Card className="p-4">
        <p className="mb-3 text-xs font-semibold text-[color:var(--foreground)]">Add Attachment</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">Tooth (FDI)</label>
            <select value={newFdi} onChange={(e) => setNewFdi(Number(e.target.value))} className={SELECT_CLS}>
              {ALL_FDI.map((f) => <option key={f} value={f}>{toothLabel(f)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">Type</label>
            <select value={newType} onChange={(e) => setNewType(e.target.value)} className={SELECT_CLS}>
              {ATTACHMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">Surface</label>
            <select value={newSurf} onChange={(e) => setNewSurf(e.target.value)} className={SELECT_CLS}>
              {SURFACES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">Stage</label>
            <input type="number" min={1} value={newStage} onChange={(e) => setNewStage(Number(e.target.value))} className={INPUT_CLS} />
          </div>
        </div>
        <button type="button" onClick={addAttachment}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 text-xs font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95">
          <Plus size={12} /> Add Attachment
        </button>
      </Card>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[color:var(--border)] bg-[color-mix(in_srgb,var(--border)_30%,transparent)]">
                <th className="px-3 py-2 text-left font-semibold">Tooth</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Surface</th>
                <th className="px-3 py-2 text-center font-semibold">Stage</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {attachments.map((a) => (
                <tr key={a.id} className="bg-[color:var(--card)]">
                  <td className="px-3 py-2 font-mono">{a.fdi}</td>
                  <td className="px-3 py-2 text-[color:var(--foreground)]">{a.type}</td>
                  <td className="px-3 py-2 text-[color:var(--muted-foreground)]">{a.surface}</td>
                  <td className="px-3 py-2 text-center text-[color:var(--muted-foreground)]">{a.stage}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeAttachment(a.id)}
                      className="text-[color:var(--muted-foreground)] hover:text-red-500 transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: IPR
// ─────────────────────────────────────────────────────────────────────────────

interface IPREntry {
  id: string;
  toothA: number;
  toothB: number;
  amount: number;
  stage: number;
  safety: "safe" | "warning" | "unsafe";
}

let iprId = 0;
function newIprId() { return `ipr_${++iprId}`; }

const IPR_SAFETY_THRESHOLD = { warning: 0.3, unsafe: 0.5 };

function iprSafety(amount: number): IPREntry["safety"] {
  if (amount >= IPR_SAFETY_THRESHOLD.unsafe) return "unsafe";
  if (amount >= IPR_SAFETY_THRESHOLD.warning) return "warning";
  return "safe";
}

function IPRTab() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<IPREntry[]>([
    { id: newIprId(), toothA: 12, toothB: 13, amount: 0.2, stage: 3, safety: "safe" },
    { id: newIprId(), toothA: 22, toothB: 23, amount: 0.2, stage: 3, safety: "safe" },
    { id: newIprId(), toothA: 32, toothB: 33, amount: 0.25, stage: 5, safety: "safe" },
  ]);
  const [fdiA, setFdiA] = useState<number>(11);
  const [fdiB, setFdiB] = useState<number>(12);
  const [amount, setAmount] = useState(0.2);
  const [stage, setStage] = useState(1);

  function addIPR() {
    if (fdiA === fdiB) {
      toast({ title: "Select two different teeth", type: "error" });
      return;
    }
    const safety = iprSafety(amount);
    if (safety === "unsafe") {
      toast({ title: `IPR ${amount} mm may be excessive — review enamel thickness`, type: "warning" });
    }
    setEntries((prev) => [...prev, { id: newIprId(), toothA: fdiA, toothB: fdiB, amount, stage, safety }]);
    toast({ title: `IPR added: ${fdiA}|${fdiB} — ${amount} mm`, type: "success" });
  }

  function removeIPR(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function exportIPR() {
    const total = entries.reduce((s, e) => s + e.amount, 0);
    const report = { entries, totalIPRmm: total.toFixed(2), generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "myortho-ipr-plan.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "IPR plan exported", type: "success" });
  }

  const totalIPR = entries.reduce((s, e) => s + e.amount, 0);
  const hasUnsafe = entries.some((e) => e.safety === "unsafe");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)]">IPR Plan</p>
        <EstimatedBadge />
        <StatusBadge tone={hasUnsafe ? "danger" : "success"}>Total: {totalIPR.toFixed(2)} mm</StatusBadge>
        <button type="button" onClick={exportIPR}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-xl border border-[color:var(--border)] px-2.5 text-xs font-semibold text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-colors">
          <Download size={11} /> Export
        </button>
      </div>

      {hasUnsafe && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50/60 px-3 py-2 text-xs text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          One or more IPR values exceed 0.5 mm. Review enamel thickness before proceeding.
        </div>
      )}

      {/* Add form */}
      <Card className="p-4">
        <p className="mb-3 text-xs font-semibold text-[color:var(--foreground)]">Add IPR Site</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">Tooth A</label>
            <select value={fdiA} onChange={(e) => setFdiA(Number(e.target.value))} className={SELECT_CLS}>
              {ALL_FDI.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">Tooth B</label>
            <select value={fdiB} onChange={(e) => setFdiB(Number(e.target.value))} className={SELECT_CLS}>
              {ALL_FDI.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">Amount (mm)</label>
            <input type="number" min={0.05} max={0.8} step={0.05} value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))} className={INPUT_CLS} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">Before Stage</label>
            <input type="number" min={1} value={stage} onChange={(e) => setStage(Number(e.target.value))} className={INPUT_CLS} />
          </div>
        </div>
        <button type="button" onClick={addIPR}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 text-xs font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95">
          <Plus size={12} /> Add IPR Site
        </button>
      </Card>

      {/* IPR table */}
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[color:var(--border)] bg-[color-mix(in_srgb,var(--border)_30%,transparent)]">
                <th className="px-3 py-2 text-left font-semibold">Contact</th>
                <th className="px-3 py-2 text-center font-semibold">Amount</th>
                <th className="px-3 py-2 text-center font-semibold">Stage</th>
                <th className="px-3 py-2 text-center font-semibold">Safety</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {entries.map((e) => (
                <tr key={e.id} className="bg-[color:var(--card)]">
                  <td className="px-3 py-2 font-mono">{e.toothA} | {e.toothB}</td>
                  <td className="px-3 py-2 text-center font-semibold">{e.amount.toFixed(2)} mm</td>
                  <td className="px-3 py-2 text-center text-[color:var(--muted-foreground)]">{e.stage}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge tone={e.safety === "safe" ? "success" : e.safety === "warning" ? "warning" : "danger"}>
                      {e.safety}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeIPR(e.id)}
                      className="text-[color:var(--muted-foreground)] hover:text-red-500 transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: STAGING
// ─────────────────────────────────────────────────────────────────────────────

function StagingTab({ caseId, patientName }: { caseId: string | null; patientName: string }) {
  if (!caseId) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Activity size={28} className="text-[color:var(--muted-foreground)]" />
        <p className="text-sm font-semibold text-[color:var(--foreground)]">Load a case to view staging</p>
        <p className="text-xs text-[color:var(--muted-foreground)]">Select a case from the dashboard to activate staging timeline.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)]">Aligner Staging Timeline</p>
        <DemoBadge />
      </div>
      <AlignerStaging caseId={caseId} patientName={patientName} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function ExportTab({ caseId, patientName }: { caseId: string | null; patientName: string }) {
  const { toast } = useToast();

  const checklist = [
    { label: "Case information complete",     done: !!caseId },
    { label: "Scan uploaded & validated",     done: false },
    { label: "Segmentation approved",         done: false },
    { label: "Occlusion recorded",            done: false },
    { label: "Movements planned",             done: false },
    { label: "Attachments assigned",          done: false },
    { label: "IPR mapped",                    done: false },
    { label: "Stages generated",              done: false },
    { label: "Doctor approval received",      done: false },
  ];

  const readyCount = checklist.filter((c) => c.done).length;
  const isReady    = readyCount === checklist.length;

  function exportSummary() {
    const report = {
      disclaimer: "This report is generated for planning/demo support and must be clinically reviewed before patient treatment or manufacturing.",
      caseId,
      patientName,
      exportedAt: new Date().toISOString(),
      checklistStatus: checklist,
      readyForManufacturing: isReady,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `myortho-treatment-plan-${caseId ?? "demo"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Treatment plan exported", description: "JSON summary saved", type: "success" });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)]">Export Readiness</p>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{readyCount}/{checklist.length} items complete</p>
          <StatusBadge tone={isReady ? "success" : "warning"}>{isReady ? "Ready" : "Not ready"}</StatusBadge>
        </div>
        <div className="space-y-1.5">
          {checklist.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5">
              {c.done
                ? <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                : <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[color:var(--border)]" />
              }
              <span className={`text-xs ${c.done ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <strong>Disclaimer:</strong> This report is generated for planning/demo support and must be clinically reviewed before patient treatment or manufacturing.
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportSummary}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95">
          <Download size={14} /> Export Treatment Plan (JSON)
        </button>
        <button type="button"
          onClick={() => { const c = document.querySelector<HTMLCanvasElement>("canvas"); if (!c) { toast({ title: "No 3D canvas found — open CAD Studio first", type: "error" }); return; } try { const url = c.toDataURL("image/png"); const a = document.createElement("a"); a.download = `myortho-snapshot-${patientName.replace(/\s+/g,"-") || "plan"}.png`; a.href = url; a.click(); toast({ title: "Snapshot saved", type: "success" }); } catch { toast({ title: "Snapshot failed — enable CAD Studio first", type: "error" }); } }}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[color:var(--border)] px-4 text-sm font-semibold text-[color:var(--foreground)] transition-transform active:scale-95 hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]">
          <Ruler size={14} /> Save CAD Snapshot
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface OrthoAnalysisTabsProps {
  caseId: string | null;
  patientName: string;
}

export default function OrthoAnalysisTabs({ caseId, patientName }: OrthoAnalysisTabsProps) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>("overview");

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
      {/* Tab bar */}
      <div className="no-scrollbar flex overflow-x-auto border-b border-[color:var(--border)]">
        {ANALYSIS_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={[
              "shrink-0 px-3 py-2.5 text-[11px] font-semibold whitespace-nowrap transition-colors border-b-2",
              activeTab === key
                ? "border-[color:var(--primary)] text-[color:var(--primary)]"
                : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "overview"     && <OverviewTab     caseId={caseId} patientName={patientName} />}
        {activeTab === "measurements" && <MeasurementsTab />}
        {activeTab === "occlusion"    && <OcclusionTab    />}
        {activeTab === "movements"    && <MovementsTab    />}
        {activeTab === "attachments"  && <AttachmentsTab  />}
        {activeTab === "ipr"          && <IPRTab          />}
        {activeTab === "staging"      && <StagingTab      caseId={caseId} patientName={patientName} />}
        {activeTab === "export"       && <ExportTab       caseId={caseId} patientName={patientName} />}
      </div>
    </div>
  );
}
