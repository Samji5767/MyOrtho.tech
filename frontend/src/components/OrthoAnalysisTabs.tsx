"use client";

import { useState, useMemo } from "react";
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
import {
  useCasePlanning,
  type PlanningAttachment,
  type PlanningIPR,
  type PlanningMeasurement,
} from "@/components/CasePlanningContext";
import {
  buildDemoToothPositions,
  computeArchMetrics,
  computeCrowding,
  computeOcclusionContacts,
} from "@/lib/meshAnalysis";


// ─── Dynamic imports (heavy) ──────────────────────────────────────────────────

const AlignerStaging = dynamic(() => import("@/components/AlignerStaging"), {
  ssr: false,
  loading: () => <div className="h-48 animate-skeleton rounded-xl" />,
});

const ClinicalScoreDashboardDynamic = dynamic(
  () => import("@/components/ClinicalScoreDashboard").then((m) => ({ default: m.ClinicalScoreDashboard })),
  { ssr: false, loading: () => <div className="h-64 animate-skeleton rounded-xl" /> },
);

const TreatmentSimulationPlayerDynamic = dynamic(
  () => import("@/components/TreatmentSimulationPlayer"),
  { ssr: false, loading: () => <div className="h-64 animate-skeleton rounded-xl" /> },
);

const ManufacturingReadinessPanelDynamic = dynamic(
  () => import("@/components/ManufacturingReadinessPanel").then((m) => ({ default: m.ManufacturingReadinessPanel })),
  { ssr: false, loading: () => <div className="h-64 animate-skeleton rounded-xl" /> },
);

const PatientReportPanelDynamic = dynamic(
  () => import("@/components/PatientReportPanel").then((m) => ({ default: m.PatientReportPanel })),
  { ssr: false, loading: () => <div className="h-40 animate-skeleton rounded-xl" /> },
);

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
  | "review"
  | "export"
  | "dashboard"
  | "simulation"
  | "manufacturing"
  | "patient";

const ANALYSIS_TABS: { key: AnalysisTab; label: string }[] = [
  { key: "overview",       label: "Overview"      },
  { key: "dashboard",      label: "Dashboard"     },
  { key: "simulation",     label: "Simulation"    },
  { key: "measurements",   label: "Measurements"  },
  { key: "occlusion",      label: "Occlusion"     },
  { key: "movements",      label: "Movements"     },
  { key: "attachments",    label: "Attachments"   },
  { key: "ipr",            label: "IPR"           },
  { key: "staging",        label: "Staging"       },
  { key: "manufacturing",  label: "Manufacturing" },
  { key: "patient",        label: "Patient"       },
  { key: "review",         label: "Review"        },
  { key: "export",         label: "Export"        },
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

function MeasurementsTab() {
  const { toast } = useToast();
  const { state, dispatch } = useCasePlanning();
  const measurements = state.measurements;

  function computeFromDemo() {
    const positions = buildDemoToothPositions();
    const metrics   = computeArchMetrics(positions);
    const upperCrow = computeCrowding(positions, "upper");
    const lowerCrow = computeCrowding(positions, "lower");
    const computed: PlanningMeasurement[] = [
      { id: "overjet",    label: "Overjet",            value: "4.2",                                  unit: "mm", note: "Demo value" },
      { id: "overbite",   label: "Overbite",           value: "3.1",                                  unit: "mm", note: "Demo value" },
      { id: "intercan",   label: "Intercanine Width",  value: metrics.intercanineWidthMm.toFixed(1),  unit: "mm", note: "Demo geometry" },
      { id: "intermol",   label: "Intermolar Width",   value: metrics.intermolarWidthMm.toFixed(1),   unit: "mm", note: "Demo geometry" },
      { id: "arch_u",     label: "Upper Arch Length",  value: metrics.upperArchLengthMm.toFixed(1),   unit: "mm", note: "Demo geometry" },
      { id: "arch_l",     label: "Lower Arch Length",  value: metrics.lowerArchLengthMm.toFixed(1),   unit: "mm", note: "Demo geometry" },
      { id: "crowding_u", label: "Upper Crowding",     value: upperCrow.crowdingMm.toFixed(1),        unit: "mm", note: "Demo computed" },
      { id: "crowding_l", label: "Lower Crowding",     value: lowerCrow.crowdingMm.toFixed(1),        unit: "mm", note: "Demo computed" },
    ];
    dispatch({ type: "SET_MEASUREMENTS", measurements: computed });
    toast({ title: "Computed from demo geometry", description: "Connect real scan for clinical accuracy.", type: "info" });
  }

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
    dispatch({ type: "UPDATE_MEASUREMENT", id, value });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)]">Arch Measurements</p>
        <EstimatedBadge />
        <button
          type="button"
          onClick={computeFromDemo}
          className="inline-flex h-7 items-center gap-1.5 rounded-xl border border-[color:var(--border)] px-2.5 text-xs font-semibold text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-colors"
        >
          <Ruler size={11} /> Compute
        </button>
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
  const { dispatch } = useCasePlanning();
  const [showContacts, setShowContacts] = useState(true);

  const contacts = useMemo(() => {
    const positions = buildDemoToothPositions();
    return computeOcclusionContacts(positions);
  }, []);

  const activeContacts = contacts.filter((c) => c.contactType !== "none");

  const indicators = [
    { label: "Angle Class",   value: "Class II Div 1", tone: "warning" as const },
    { label: "Overjet",       value: "4.2 mm",         tone: "warning" as const },
    { label: "Overbite",      value: "3.1 mm",         tone: "info"    as const },
    { label: "Midline Shift", value: "1.5 mm (R)",     tone: "warning" as const },
    { label: "Deep Bite",     value: "Not detected",   tone: "success" as const },
    { label: "Open Bite",     value: "Not detected",   tone: "success" as const },
    { label: "Crossbite",     value: "Not detected",   tone: "success" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)]">Bite Relationship</p>
        <DemoBadge />
        <button
          type="button"
          onClick={() => dispatch({ type: "TOGGLE_OCCLUSION_CONTACTS" })}
          className="ml-auto text-[10px] text-[color:var(--primary)] hover:underline"
        >
          Toggle 3D markers
        </button>
        <button
          type="button"
          onClick={() => setShowContacts((v) => !v)}
          className="text-[10px] text-[color:var(--primary)] hover:underline"
        >
          {showContacts ? "Hide" : "Show"} table
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
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)] mb-3">
            Proximity Contacts ({activeContacts.length} active)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[color:var(--border)]">
                  <th className="pb-1.5 text-left font-semibold text-[color:var(--foreground)]">Pair</th>
                  <th className="pb-1.5 text-right font-semibold text-[color:var(--foreground)]">Dist (mm)</th>
                  <th className="pb-1.5 text-left font-semibold text-[color:var(--foreground)]">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]">
                {activeContacts.slice(0, 10).map((c) => (
                  <tr key={`${c.upperFdi}-${c.lowerFdi}`}>
                    <td className="py-1.5 font-mono text-[color:var(--foreground)]">{c.upperFdi}–{c.lowerFdi}</td>
                    <td className="py-1.5 text-right tabular-nums text-[color:var(--muted-foreground)]">{c.distanceMm.toFixed(1)}</td>
                    <td className="py-1.5">
                      <StatusBadge tone={
                        c.contactType === "heavy" ? "danger" :
                        c.contactType === "light" ? "warning" : "info"
                      }>{c.contactType}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        Proximity-based contacts from demo geometry. Real occlusal analysis requires AI mesh intersection.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: TOOTH MOVEMENTS
// ─────────────────────────────────────────────────────────────────────────────

type MovField = "tx" | "ty" | "tz" | "tip" | "torque" | "rotation";

const MOV_FIELDS: { key: MovField; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "tx",       label: "Mesial/Distal",       unit: "mm", min: -10, max: 10, step: 0.1 },
  { key: "ty",       label: "Buccal/Lingual",      unit: "mm", min: -8,  max: 8,  step: 0.1 },
  { key: "tz",       label: "Intrusion/Extrusion", unit: "mm", min: -5,  max: 5,  step: 0.1 },
  { key: "tip",      label: "Tip",                 unit: "°",  min: -30, max: 30, step: 0.5 },
  { key: "torque",   label: "Torque",              unit: "°",  min: -30, max: 30, step: 0.5 },
  { key: "rotation", label: "Rotation",            unit: "°",  min: -45, max: 45, step: 0.5 },
];

function MovementsTab() {
  const { toast } = useToast();
  const { state, dispatch } = useCasePlanning();
  const [selectedFdi, setSelectedFdi] = useState<number>(11);

  const movements = state.movements;
  const current = movements[selectedFdi] ?? { fdi: selectedFdi, tx: 0, ty: 0, tz: 0, tip: 0, torque: 0, rotation: 0 };

  function updateField(field: MovField, val: number) {
    dispatch({ type: "UPDATE_MOVEMENT", fdi: selectedFdi, mov: { [field]: val } });
  }

  function resetTooth() {
    dispatch({ type: "RESET_MOVEMENT", fdi: selectedFdi });
    toast({ title: `FDI ${selectedFdi} reset`, type: "info" });
  }

  function exportMovements() {
    const data = ALL_FDI.map((fdi) => movements[fdi] ?? { fdi, tx: 0, ty: 0, tz: 0, tip: 0, torque: 0, rotation: 0 });
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
    (m) => m.tx !== 0 || m.ty !== 0 || m.tz !== 0 || m.tip !== 0 || m.torque !== 0 || m.rotation !== 0
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
                const m = movements[fdi];
                const hasMov = m && (m.tx !== 0 || m.ty !== 0 || m.tz !== 0 || m.tip !== 0 || m.torque !== 0 || m.rotation !== 0);
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

let attCounter = 100;
function newAttId() { return `att_${++attCounter}`; }

function AttachmentsTab() {
  const { toast } = useToast();
  const { state, dispatch } = useCasePlanning();
  const attachments = state.attachments;
  const [newFdi, setNewFdi]   = useState<number>(11);
  const [newType, setNewType] = useState(ATTACHMENT_TYPES[0]);
  const [newSurf, setNewSurf] = useState(SURFACES[0]);
  const [newStage, setNewStage] = useState(1);

  function addAttachment() {
    const entry: PlanningAttachment = { id: newAttId(), fdi: newFdi, type: newType, surface: newSurf, stage: newStage };
    dispatch({ type: "ADD_ATTACHMENT", entry });
    toast({ title: `Attachment added — FDI ${newFdi}`, type: "success" });
  }

  function removeAttachment(id: string) {
    dispatch({ type: "REMOVE_ATTACHMENT", id });
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

let iprCounter = 100;
function newIprId() { return `ipr_${++iprCounter}`; }

function iprSafety(amount: number): PlanningIPR["safety"] {
  if (amount >= 0.5) return "unsafe";
  if (amount >= 0.3) return "warning";
  return "safe";
}

function IPRTab() {
  const { toast } = useToast();
  const { state, dispatch } = useCasePlanning();
  const entries = state.iprEntries;
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
    const entry: PlanningIPR = { id: newIprId(), toothA: fdiA, toothB: fdiB, amount, stage, safety };
    dispatch({ type: "ADD_IPR", entry });
    toast({ title: `IPR added: ${fdiA}|${fdiB} — ${amount} mm`, type: "success" });
  }

  function removeIPR(id: string) {
    dispatch({ type: "REMOVE_IPR", id });
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
// TAB: REVIEW
// ─────────────────────────────────────────────────────────────────────────────

function ReviewTab({ caseId }: { caseId: string | null }) {
  const { toast } = useToast();
  const { state, dispatch } = useCasePlanning();

  const workflowCompleted = Object.values(state.workflowSteps).filter((s) => s === "complete").length;
  const WORKFLOW_TOTAL = 12;
  const workflowPct = workflowCompleted / WORKFLOW_TOTAL;

  const planChecklist = [
    { label: "Case loaded",         done: !!caseId },
    { label: "Movements planned",   done: Object.keys(state.movements).length > 0 },
    { label: "Attachments planned", done: state.attachments.length > 0 },
    { label: "IPR mapped",          done: state.iprEntries.length > 0 },
    { label: "Stages defined",      done: state.totalStages > 0 },
  ];
  const planScore = planChecklist.filter((c) => c.done).length / planChecklist.length;
  const readiness = Math.round((workflowPct * 0.6 + planScore * 0.4) * 100);

  const warnings: string[] = [];
  if (state.iprEntries.some((e) => e.safety === "unsafe"))
    warnings.push("One or more IPR entries exceed 0.5 mm.");
  if (Object.keys(state.movements).length === 0)
    warnings.push("No tooth movements planned.");
  if (!caseId)
    warnings.push("No case loaded — all values are demo only.");
  if (state.reviewNotes.trim() === "")
    warnings.push("No clinician review notes added.");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--primary)]">Treatment Review</p>
        <DemoBadge />
      </div>

      {/* Readiness score */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">Plan Readiness</p>
          <StatusBadge tone={readiness >= 80 ? "success" : readiness >= 50 ? "warning" : "danger"}>
            {readiness}%
          </StatusBadge>
        </div>
        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_60%,transparent)]">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${readiness >= 80 ? "bg-emerald-500" : readiness >= 50 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${readiness}%` }}
          />
        </div>
        <div className="space-y-1.5">
          {planChecklist.map((c) => (
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
          <div className="flex items-center gap-2.5">
            <div className={`h-3.5 w-3.5 shrink-0 rounded-full ${workflowPct >= 1 ? "bg-emerald-500" : workflowPct > 0.4 ? "bg-amber-500" : "bg-[color:var(--border)]"}`} />
            <span className="text-xs text-[color:var(--foreground)]">
              Workflow: {workflowCompleted}/{WORKFLOW_TOTAL} steps complete
            </span>
          </div>
        </div>
      </Card>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 space-y-1.5 dark:border-amber-500/20 dark:bg-amber-500/10">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Warnings
          </p>
          {warnings.map((w) => (
            <div key={w} className="flex items-start gap-1.5">
              <AlertTriangle size={10} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-800 dark:text-amber-300">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* Clinician notes */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">
          Clinician Review Notes
        </label>
        <textarea
          rows={4}
          value={state.reviewNotes}
          onChange={(e) => dispatch({ type: "SET_REVIEW_NOTES", notes: e.target.value })}
          placeholder="Add clinical observations, approvals, or concerns..."
          className="w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-xs text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/20 transition-colors"
        />
      </div>

      {/* Approve button */}
      <button
        type="button"
        onClick={() => {
          if (readiness < 50) {
            toast({ title: "Readiness too low", description: "Complete more planning steps before approving.", type: "warning" });
            return;
          }
          toast({ title: "Review noted", description: "Export plan for full clinical sign-off.", type: "success" });
        }}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
      >
        <CheckCircle2 size={14} /> Approve Plan (Session Only)
      </button>

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <strong>Disclaimer:</strong> Session approval is for planning reference only and does not constitute clinical authorization. All treatment plans must be reviewed and signed by a licensed clinician before manufacturing or patient treatment.
      </div>
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
// SHARED: requires case + plan placeholder
// ─────────────────────────────────────────────────────────────────────────────

function RequiresCasePlan({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Activity size={28} className="text-[color:var(--muted-foreground)]" />
      <p className="text-sm font-semibold text-[color:var(--foreground)]">Case and plan required</p>
      <p className="text-xs text-[color:var(--muted-foreground)]">
        Load a case and generate a treatment plan to access {feature}.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: DASHBOARD (Phase 3C)
// ─────────────────────────────────────────────────────────────────────────────

function DashboardTab({ caseId, planId }: { caseId: string | null; planId: string | null }) {
  if (!caseId || !planId) return <RequiresCasePlan feature="the clinical scoring dashboard" />;
  return <ClinicalScoreDashboardDynamic caseId={caseId} planId={planId} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: SIMULATION (Phase 3B)
// ─────────────────────────────────────────────────────────────────────────────

function SimulationTab({ caseId, planId }: { caseId: string | null; planId: string | null }) {
  if (!caseId || !planId) return <RequiresCasePlan feature="treatment simulation" />;
  return <TreatmentSimulationPlayerDynamic caseId={caseId} planId={planId} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: MANUFACTURING (Phase 3D)
// ─────────────────────────────────────────────────────────────────────────────

function ManufacturingTab({ caseId, planId }: { caseId: string | null; planId: string | null }) {
  if (!caseId || !planId) return <RequiresCasePlan feature="manufacturing readiness" />;
  return <ManufacturingReadinessPanelDynamic caseId={caseId} planId={planId} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PATIENT (Phase 3E)
// ─────────────────────────────────────────────────────────────────────────────

function PatientTab({ caseId, planId }: { caseId: string | null; planId: string | null }) {
  if (!caseId || !planId) return <RequiresCasePlan feature="the patient report" />;
  return <PatientReportPanelDynamic caseId={caseId} planId={planId} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface OrthoAnalysisTabsProps {
  caseId: string | null;
  patientName: string;
  planId?: string | null;
}

export default function OrthoAnalysisTabs({ caseId, patientName, planId = null }: OrthoAnalysisTabsProps) {
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
        {activeTab === "overview"       && <OverviewTab      caseId={caseId} patientName={patientName} />}
        {activeTab === "dashboard"      && <DashboardTab     caseId={caseId} planId={planId} />}
        {activeTab === "simulation"     && <SimulationTab    caseId={caseId} planId={planId} />}
        {activeTab === "measurements"   && <MeasurementsTab />}
        {activeTab === "occlusion"      && <OcclusionTab    />}
        {activeTab === "movements"      && <MovementsTab    />}
        {activeTab === "attachments"    && <AttachmentsTab  />}
        {activeTab === "ipr"            && <IPRTab          />}
        {activeTab === "staging"        && <StagingTab      caseId={caseId} patientName={patientName} />}
        {activeTab === "manufacturing"  && <ManufacturingTab caseId={caseId} planId={planId} />}
        {activeTab === "patient"        && <PatientTab      caseId={caseId} planId={planId} />}
        {activeTab === "review"         && <ReviewTab       caseId={caseId} />}
        {activeTab === "export"         && <ExportTab       caseId={caseId} patientName={patientName} />}
      </div>
    </div>
  );
}
