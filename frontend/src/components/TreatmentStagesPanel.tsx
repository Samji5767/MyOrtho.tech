"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Card, EmptyState, Spinner } from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

type StageType = "active" | "passive" | "retention";

interface StageToothMovement {
  tooth_fdi: number;
  movement_type: string;
  value: number;
}

interface StageAttachment {
  tooth_fdi: number;
  type: string;
}

interface StageIpr {
  contact: string;
  amount_mm: number;
}

interface TreatmentStage {
  id: string;
  setup_id: string;
  stage_number: number;
  stage_type: StageType;
  active_tooth_count: number;
  has_attachments: boolean;
  has_ipr: boolean;
  max_movement_mm: number;
  tooth_movements: StageToothMovement[];
  attachments: StageAttachment[];
  ipr_points: StageIpr[];
  notes?: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_TYPE_COLOR: Record<StageType, string> = {
  active: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  passive: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  retention: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
};

function stageCounts(stages: TreatmentStage[]) {
  return {
    active: stages.filter((s) => s.stage_type === "active").length,
    passive: stages.filter((s) => s.stage_type === "passive").length,
    retention: stages.filter((s) => s.stage_type === "retention").length,
    total: stages.length,
  };
}

function movementColor(v: number): string {
  if (Math.abs(v) < 0.001) return "text-secondary";
  if (Math.abs(v) < 1) return "text-emerald-600";
  if (Math.abs(v) < 3) return "text-amber-600";
  return "text-rose-600";
}

// ─── Stage Card (timeline item) ───────────────────────────────────────────────

function StageCard({
  stage,
  isSelected,
  isHighlighted,
  onClick,
}: {
  stage: TreatmentStage;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-none w-36 rounded-xl border p-3 text-left transition-all ${
        isSelected
          ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-400/30 dark:bg-indigo-950/40"
          : isHighlighted
          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40"
          : "border-border bg-card hover:border-indigo-200 hover:bg-indigo-50/30"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xl font-bold text-foreground">{stage.stage_number}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STAGE_TYPE_COLOR[stage.stage_type]}`}>
          {stage.stage_type}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-secondary">{stage.active_tooth_count} active teeth</p>
        <p className="text-[11px] font-semibold text-foreground">
          {stage.max_movement_mm.toFixed(2)} mm max
        </p>
        <div className="flex items-center gap-2 mt-1">
          {stage.has_attachments && (
            <span className="text-[10px] rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-indigo-600 font-semibold">ATT</span>
          )}
          {stage.has_ipr && (
            <span className="text-[10px] rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-orange-600 font-semibold">IPR</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Stage Detail ─────────────────────────────────────────────────────────────

function StageDetail({
  stage,
  token,
  onNotesUpdated,
}: {
  stage: TreatmentStage;
  token: string;
  onNotesUpdated: (stageId: string, notes: string) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(stage.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setNotesError(null);
    try {
      const res = await fetch(`/api/treatment-stages/${stage.id}/notes`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onNotesUpdated(stage.id, notesDraft);
      setEditingNotes(false);
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-foreground">Stage {stage.stage_number} Detail</h3>
          <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${STAGE_TYPE_COLOR[stage.stage_type]}`}>
            {stage.stage_type}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-secondary">
          <span>{stage.active_tooth_count} active · {stage.max_movement_mm.toFixed(2)} mm max</span>
        </div>
      </div>

      {/* Tooth Movements table */}
      {stage.tooth_movements.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Tooth Movements</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Tooth", "Movement", "Value"].map((h) => (
                    <th key={h} className="pb-2 pr-4 text-left font-semibold text-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stage.tooth_movements.map((tm, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 pr-4 font-medium">{tm.tooth_fdi}</td>
                    <td className="py-1.5 pr-4 text-secondary">{tm.movement_type}</td>
                    <td className={`py-1.5 font-semibold ${movementColor(tm.value)}`}>
                      {tm.value > 0 ? `+${tm.value.toFixed(2)}` : tm.value.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attachments */}
      {stage.attachments.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Attachments</p>
          <div className="flex flex-wrap gap-2">
            {stage.attachments.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">
                <span className="font-bold">{a.tooth_fdi}</span> — {a.type}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* IPR */}
      {stage.ipr_points.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">IPR Points</p>
          <div className="space-y-1">
            {stage.ipr_points.map((ipr, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{ipr.contact}</span>
                <span className="font-semibold text-orange-600">{ipr.amount_mm.toFixed(2)} mm</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Notes</p>
          {!editingNotes && (
            <button
              onClick={() => { setNotesDraft(stage.notes ?? ""); setEditingNotes(true); }}
              className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Edit
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="Clinical notes for this stage…"
            />
            {notesError && (
              <p className="text-[10px] text-rose-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{notesError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingNotes && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
              </button>
              <button
                onClick={() => setEditingNotes(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-secondary">{stage.notes ?? "No notes for this stage."}</p>
        )}
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TreatmentStagesPanel({ setupId, token }: { setupId?: string; token: string }) {
  const [stages, setStages] = useState<TreatmentStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [previewRunning, setPreviewRunning] = useState(false);
  const [previewStage, setPreviewStage] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previewTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchStages = useCallback(async () => {
    if (!setupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/treatment-stages?setupId=${setupId}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as TreatmentStage[];
      setStages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stages");
    } finally {
      setLoading(false);
    }
  }, [setupId, token]);

  useEffect(() => { fetchStages(); }, [fetchStages]);

  // Cleanup preview on unmount
  useEffect(() => {
    return () => {
      if (previewTimer.current) clearInterval(previewTimer.current);
    };
  }, []);

  const handleGenerate = async () => {
    if (!setupId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/treatment-stages/generate/${setupId}`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as TreatmentStage[];
      setStages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate stages");
    } finally {
      setGenerating(false);
    }
  };

  const handleNotesUpdated = (stageId: string, notes: string) => {
    setStages((prev) => prev.map((s) => s.id === stageId ? { ...s, notes } : s));
  };

  const startPreview = () => {
    if (stages.length === 0) return;
    setPreviewRunning(true);
    setPreviewStage(stages[0].stage_number);
    let idx = 0;
    previewTimer.current = setInterval(() => {
      idx++;
      if (idx >= stages.length) {
        clearInterval(previewTimer.current!);
        setPreviewRunning(false);
        setPreviewStage(null);
        return;
      }
      const s = stages[idx];
      setPreviewStage(s.stage_number);
      // Scroll to the card
      if (scrollRef.current) {
        const cards = scrollRef.current.querySelectorAll("[data-stage-card]");
        cards[idx]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }, 500);
  };

  const stopPreview = () => {
    if (previewTimer.current) clearInterval(previewTimer.current);
    setPreviewRunning(false);
    setPreviewStage(null);
  };

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null;
  const counts = stageCounts(stages);
  const totalDurationWeeks = Math.round(stages.length * 2); // 2 weeks per stage estimate

  if (!setupId) {
    return (
      <EmptyState
        icon={Layers}
        title="No setup selected"
        body="Select a digital setup from the CAD Workspace to view treatment stages."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {generating ? "Generating…" : "Generate Stages"}
        </button>
        <button
          onClick={fetchStages}
          disabled={loading}
          className="rounded-lg border border-border p-2.5 text-secondary hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>

        {stages.length > 0 && (
          <button
            onClick={previewRunning ? stopPreview : startPreview}
            className={`ml-auto inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
              previewRunning
                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            {previewRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {previewRunning ? "Stop Preview" : "▶ Preview"}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && stages.length === 0 && (
        <div className="flex items-center justify-center py-16"><Spinner size={32} /></div>
      )}

      {!loading && stages.length === 0 && (
        <EmptyState
          icon={Layers}
          title="No stages generated"
          body="Click Generate Stages to create a treatment staging plan for this setup."
        />
      )}

      {stages.length > 0 && (
        <>
          {/* Stage overview */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-3xl font-bold text-foreground">{counts.total}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-secondary">Total Stages</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40 p-4 text-center">
              <p className="text-3xl font-bold text-indigo-600">{counts.active}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-500">Active</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 p-4 text-center">
              <p className="text-3xl font-bold text-slate-600">{counts.passive}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-secondary">Passive</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 p-4 text-center">
              <p className="text-3xl font-bold text-emerald-600">{counts.retention}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">Retention</p>
            </div>
          </div>

          {/* Duration estimate */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
            <CheckCircle2 className="h-4 w-4 text-indigo-500" />
            <span className="text-secondary">Estimated total duration:</span>
            <span className="font-semibold text-foreground">
              {totalDurationWeeks} weeks (~{Math.round(totalDurationWeeks / 4)} months)
            </span>
          </div>

          {/* Preview indicator */}
          {previewRunning && previewStage != null && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Previewing Stage {previewStage} of {stages.length}
            </div>
          )}

          {/* Horizontal scrollable timeline */}
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-secondary">Stage Timeline</p>
            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto pb-2"
              style={{ scrollbarWidth: "thin" }}
            >
              {stages.map((stage) => (
                <div key={stage.id} data-stage-card>
                  <StageCard
                    stage={stage}
                    isSelected={selectedStageId === stage.id}
                    isHighlighted={previewStage === stage.stage_number}
                    onClick={() => setSelectedStageId(selectedStageId === stage.id ? null : stage.id)}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Expanded stage detail */}
          {selectedStage && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={() => setSelectedStageId(null)}
                  className="flex items-center gap-1 text-xs text-secondary hover:text-foreground"
                >
                  <ChevronDown className="h-3.5 w-3.5 rotate-90" />
                  Close detail
                </button>
                <ChevronRight className="h-3.5 w-3.5 text-secondary" />
                <span className="text-xs font-semibold text-foreground">Stage {selectedStage.stage_number}</span>
              </div>
              <StageDetail
                stage={selectedStage}
                token={token}
                onNotesUpdated={handleNotesUpdated}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
