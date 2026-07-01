"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Edit2,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  StatusBadge,
  EmptyState,
  Spinner,
} from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToothMovementGoal {
  tooth_fdi: number;
  mesial_distal: number;
  buccal_lingual: number;
  intrusion_extrusion: number;
  rotation: number;
  torque: number;
  confidence: number;
}

interface IprPoint {
  contact: string;
  amount_mm: number;
  priority: "low" | "medium" | "high";
}

interface IprPlan {
  upper: IprPoint[];
  lower: IprPoint[];
  upper_total_mm: number;
  lower_total_mm: number;
}

interface AttachmentPlan {
  tooth_fdi: number;
  type: "horizontal" | "vertical" | "rectangular" | "optimized";
  reason?: string;
}

interface TreatmentGoals {
  id: string;
  case_id: string;
  predicted_aligners: number;
  duration_weeks: number;
  refinements: number;
  confidence_pct: number;
  ideal_arch_form: string;
  anchorage_strategy: string;
  retention_strategy: string;
  ipr_plan: IprPlan;
  tooth_movement_goals: ToothMovementGoal[];
  attachment_plan: AttachmentPlan[];
  ai_rationale: string;
  approved: boolean;
  approved_at?: string;
  notes?: string;
  created_at: string;
}

interface GenerateForm {
  crowding_upper: string;
  crowding_lower: string;
  overjet: string;
  overbite: string;
  angle_class: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toothName(fdi: number): string {
  const n = fdi % 10;
  const names: Record<number, string> = {
    1: "Central Incisor",
    2: "Lateral Incisor",
    3: "Canine",
    4: "1st Premolar",
    5: "2nd Premolar",
    6: "1st Molar",
    7: "2nd Molar",
    8: "3rd Molar",
  };
  return names[n] ?? `Tooth ${fdi}`;
}

function movementColor(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1) return "text-emerald-600";
  if (abs < 3) return "text-amber-600";
  return "text-rose-600";
}

function movementBg(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1) return "bg-emerald-50 dark:bg-emerald-950/30";
  if (abs < 3) return "bg-amber-50 dark:bg-amber-950/30";
  return "bg-rose-50 dark:bg-rose-950/30";
}

function priorityColor(p: string): string {
  if (p === "high") return "text-rose-600 bg-rose-50 border-rose-200";
  if (p === "medium") return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

function weeksToMonths(weeks: number): string {
  const months = Math.floor(weeks / 4.33);
  const remWeeks = Math.round(weeks - months * 4.33);
  if (months === 0) return `${weeks}w`;
  if (remWeeks === 0) return `${months}mo`;
  return `${months}mo / ${remWeeks}w`;
}

function maxMovement(t: ToothMovementGoal): number {
  return Math.max(
    Math.abs(t.mesial_distal),
    Math.abs(t.buccal_lingual),
    Math.abs(t.intrusion_extrusion),
    Math.abs(t.rotation),
    Math.abs(t.torque)
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCards({ goals }: { goals: TreatmentGoals }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Aligners */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 p-4 text-center">
        <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{goals.predicted_aligners}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-500">Predicted Aligners</p>
      </div>
      {/* Duration */}
      <div className="rounded-xl border border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40 p-4 text-center">
        <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">{weeksToMonths(goals.duration_weeks)}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-purple-500">Duration</p>
      </div>
      {/* Refinements */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 p-4 text-center">
        <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{goals.refinements}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-500">Refinements</p>
      </div>
      {/* Confidence */}
      <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40 p-4 text-center">
        <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">{goals.confidence_pct}%</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-orange-500">AI Confidence</p>
      </div>
    </div>
  );
}

function ArchStrategyCard({ goals }: { goals: TreatmentGoals }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
        <Target className="h-4 w-4 text-indigo-500" />
        Arch Form &amp; Strategy
      </h3>
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="text-xs text-secondary mb-1">Ideal Arch Form</p>
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
            {goals.ideal_arch_form}
          </span>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs text-secondary mb-1">Anchorage Strategy</p>
          <p className="text-sm text-foreground">{goals.anchorage_strategy}</p>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs text-secondary mb-1">Retention Strategy</p>
          <p className="text-sm text-foreground">{goals.retention_strategy}</p>
        </div>
      </div>
    </Card>
  );
}

function IprSummaryCard({ iprPlan }: { iprPlan: IprPlan }) {
  const [expanded, setExpanded] = useState<"upper" | "lower" | null>(null);
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">IPR Summary</h3>
      <div className="grid grid-cols-2 gap-4">
        {(["upper", "lower"] as const).map((arch) => {
          const total = arch === "upper" ? iprPlan.upper_total_mm : iprPlan.lower_total_mm;
          const points = arch === "upper" ? iprPlan.upper : iprPlan.lower;
          const isOpen = expanded === arch;
          return (
            <div key={arch} className="rounded-lg border border-border p-3">
              <button
                onClick={() => setExpanded(isOpen ? null : arch)}
                className="flex w-full items-center justify-between"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  {arch} arch
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{total.toFixed(1)} mm</span>
                  {isOpen ? <ChevronDown className="h-3 w-3 text-secondary" /> : <ChevronRight className="h-3 w-3 text-secondary" />}
                </div>
              </button>
              {isOpen && points.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {points.map((pt, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{pt.contact}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pt.amount_mm.toFixed(2)} mm</span>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${priorityColor(pt.priority)}`}>
                          {pt.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isOpen && points.length === 0 && (
                <p className="mt-2 text-xs text-secondary">No IPR points</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ToothMovementTable({ goals }: { goals: ToothMovementGoal[] }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Tooth Movement Goals</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {["Tooth FDI", "M/D (mm)", "B/L (mm)", "I/E (mm)", "Rot (°)", "Torque (°)", "AI Conf"].map((h) => (
                <th key={h} className="pb-2 pr-3 text-left font-semibold text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goals.map((t) => {
              const maxMov = maxMovement(t);
              return (
                <tr key={t.tooth_fdi} className={`border-b border-border/50 ${movementBg(maxMov)}`}>
                  <td className="py-2 pr-3 font-semibold text-foreground">
                    {t.tooth_fdi}
                    <span className="ml-1 text-[10px] text-secondary">({toothName(t.tooth_fdi)})</span>
                  </td>
                  <td className={`py-2 pr-3 font-medium ${movementColor(t.mesial_distal)}`}>{t.mesial_distal.toFixed(2)}</td>
                  <td className={`py-2 pr-3 font-medium ${movementColor(t.buccal_lingual)}`}>{t.buccal_lingual.toFixed(2)}</td>
                  <td className={`py-2 pr-3 font-medium ${movementColor(t.intrusion_extrusion)}`}>{t.intrusion_extrusion.toFixed(2)}</td>
                  <td className={`py-2 pr-3 font-medium ${movementColor(t.rotation)}`}>{t.rotation.toFixed(1)}</td>
                  <td className={`py-2 pr-3 font-medium ${movementColor(t.torque)}`}>{t.torque.toFixed(1)}</td>
                  <td className="py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      t.confidence >= 0.8 ? "bg-emerald-100 text-emerald-700" :
                      t.confidence >= 0.6 ? "bg-amber-100 text-amber-700" :
                      "bg-rose-100 text-rose-700"
                    }`}>
                      {Math.round(t.confidence * 100)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px] text-secondary">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> &lt;1mm</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> 1–3mm</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-400" /> &gt;3mm</span>
      </div>
    </Card>
  );
}

function AttachmentPlanCard({ plan }: { plan: AttachmentPlan[] }) {
  const upper = plan.filter((a) => a.tooth_fdi >= 11 && a.tooth_fdi <= 28);
  const lower = plan.filter((a) => a.tooth_fdi >= 31 && a.tooth_fdi <= 48);

  const typeColor: Record<string, string> = {
    horizontal: "bg-blue-50 text-blue-700 border-blue-200",
    vertical: "bg-purple-50 text-purple-700 border-purple-200",
    rectangular: "bg-indigo-50 text-indigo-700 border-indigo-200",
    optimized: "bg-teal-50 text-teal-700 border-teal-200",
  };

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Attachment Plan</h3>
      {[{ label: "Upper Arch", items: upper }, { label: "Lower Arch", items: lower }].map(({ label, items }) => (
        <div key={label} className="mb-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
          {items.length === 0 ? (
            <p className="text-xs text-secondary">No attachments</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {items.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5">
                  <span className="text-xs font-bold text-foreground">{a.tooth_fdi}</span>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${typeColor[a.type] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>
                    {a.type}
                  </span>
                  {a.reason && <span className="text-[10px] text-secondary">{a.reason}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

function AIRationaleCard({ rationale, confidence }: { rationale: string; confidence: number }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          AI Rationale
        </h3>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
          confidence >= 80 ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
          confidence >= 60 ? "border-amber-200 bg-amber-50 text-amber-700" :
          "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          {confidence}% confidence
        </span>
      </div>
      <p className="text-sm leading-relaxed text-secondary">{rationale}</p>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TreatmentGoalsPanel({ caseId, token }: { caseId: string; token: string }) {
  const [goals, setGoals] = useState<TreatmentGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ aligner_count: string; duration_weeks: string; notes: string }>({ aligner_count: "", duration_weeks: "", notes: "" });

  const [form, setForm] = useState<GenerateForm>({
    crowding_upper: "",
    crowding_lower: "",
    overjet: "",
    overbite: "",
    angle_class: "I",
  });

  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/treatment-goals?caseId=${caseId}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as TreatmentGoals | null;
      setGoals(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load goals";
      if (!msg.includes("404")) setError(msg);
    } finally {
      setLoading(false);
    }
  }, [caseId, token]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/treatment-goals/generate", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          caseId,
          crowding_upper: parseFloat(form.crowding_upper) || 0,
          crowding_lower: parseFloat(form.crowding_lower) || 0,
          overjet: parseFloat(form.overjet) || 0,
          overbite: parseFloat(form.overbite) || 0,
          angle_class: form.angle_class,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as TreatmentGoals;
      setGoals(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate goals");
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!goals) return;
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/treatment-goals/${goals.id}/approve`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json() as TreatmentGoals;
      setGoals(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!goals) return;
    setError(null);
    try {
      const res = await fetch(`/api/treatment-goals/${goals.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          predicted_aligners: parseInt(editDraft.aligner_count) || goals.predicted_aligners,
          duration_weeks: parseInt(editDraft.duration_weeks) || goals.duration_weeks,
          notes: editDraft.notes,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json() as TreatmentGoals;
      setGoals(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const startEdit = () => {
    if (!goals) return;
    setEditDraft({
      aligner_count: String(goals.predicted_aligners),
      duration_weeks: String(goals.duration_weeks),
      notes: goals.notes ?? "",
    });
    setEditing(true);
  };

  // ── Generate form (no goals yet or always visible at top)
  const generateForm = (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        Generate AI Treatment Goals
      </h3>
      <form onSubmit={handleGenerate}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { key: "crowding_upper", label: "Crowding Upper (mm)" },
            { key: "crowding_lower", label: "Crowding Lower (mm)" },
            { key: "overjet", label: "Overjet (mm)" },
            { key: "overbite", label: "Overbite (mm)" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-secondary">{label}</label>
              <input
                type="number"
                step="0.1"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                value={form[key as keyof GenerateForm]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder="0.0"
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">Angle Class</label>
            <select
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              value={form.angle_class}
              onChange={(e) => setForm((f) => ({ ...f, angle_class: e.target.value }))}
            >
              <option value="I">Class I</option>
              <option value="II">Class II</option>
              <option value="III">Class III</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating…" : "Generate AI Goals"}
          </button>
        </div>
      </form>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {generateForm}
        <div className="flex items-center justify-center py-16">
          <Spinner size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {generateForm}

      {!goals && !loading && (
        <EmptyState
          icon={ClipboardList}
          title="No treatment goals yet"
          body="Fill in the measurements above and click Generate AI Goals to create a treatment plan."
        />
      )}

      {goals && (
        <>
          {/* Approval bar */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              {goals.approved ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approved
                  {goals.approved_at && (
                    <span className="font-normal text-emerald-500 ml-1">
                      {new Date(goals.approved_at).toLocaleDateString()}
                    </span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  <Activity className="h-3.5 w-3.5" />
                  Pending Approval
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <Save className="h-3.5 w-3.5" /> Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEdit}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit Goals
                  </button>
                  {!goals.approved && (
                    <button
                      onClick={handleApprove}
                      disabled={approving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve Goals
                    </button>
                  )}
                  <button
                    onClick={fetchGoals}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Edit form */}
          {editing && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Edit Key Fields</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary">Aligner Count</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={editDraft.aligner_count}
                    onChange={(e) => setEditDraft((d) => ({ ...d, aligner_count: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary">Duration (weeks)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={editDraft.duration_weeks}
                    onChange={(e) => setEditDraft((d) => ({ ...d, duration_weeks: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-secondary">Notes</label>
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={editDraft.notes}
                    onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))}
                    placeholder="Clinical notes…"
                  />
                </div>
              </div>
            </Card>
          )}

          <SummaryCards goals={goals} />
          <ArchStrategyCard goals={goals} />
          <IprSummaryCard iprPlan={goals.ipr_plan} />

          {goals.tooth_movement_goals.length > 0 && (
            <ToothMovementTable goals={goals.tooth_movement_goals} />
          )}

          {goals.attachment_plan.length > 0 && (
            <AttachmentPlanCard plan={goals.attachment_plan} />
          )}

          <AIRationaleCard rationale={goals.ai_rationale} confidence={goals.confidence_pct} />

          {goals.notes && (
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Clinical Notes</h3>
              <p className="text-sm text-secondary">{goals.notes}</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
