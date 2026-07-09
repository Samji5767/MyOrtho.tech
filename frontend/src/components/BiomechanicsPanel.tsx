"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, EmptyState, ProgressBar, Spinner } from "@/components/DesignSystem";
import { api, ApiError } from "@/lib/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollisionPair {
  tooth_a: number;
  tooth_b: number;
  position: string;
  severity: "minor" | "moderate" | "severe";
}

interface ExcessiveMovement {
  tooth_fdi: number;
  movement_type: string;
  value: number;
  limit: number;
  exceeds: boolean;
}

interface IprRequirement {
  contact: string;
  amount_needed_mm: number;
  priority: "low" | "medium" | "high";
}

interface AttachmentRequirement {
  tooth_fdi: number;
  type: string;
  reason: string;
}

interface StagingStep {
  stage: number;
  max_movement_mm: number;
  tooth_count: number;
}

interface PdlStress {
  tooth_fdi: number;
  stress_pct: number;
  overloaded: boolean;
}

interface BiomechanicsResult {
  id: string;
  setup_id: string;
  biomechanical_score: number;
  movement_feasible: boolean;
  has_collisions: boolean;
  staging_feasible: boolean;
  max_pdl_stress_pct: number;
  pdl_stresses: PdlStress[];
  collision_pairs: CollisionPair[];
  excessive_movements: ExcessiveMovement[];
  anchorage_demand_score: number;
  anchorage_demand_description: string;
  ipr_requirements: IprRequirement[];
  attachment_requirements: AttachmentRequirement[];
  recommended_staging: StagingStep[];
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-600";
}

function scoreBg(score: number): string {
  if (score >= 80) return "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40";
  if (score >= 60) return "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40";
  return "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40";
}

function toothLabel(fdi: number): string {
  const names: Record<number, string> = { 1: "Cent.", 2: "Lat.", 3: "Can.", 4: "1PM", 5: "2PM", 6: "1M", 7: "2M", 8: "3M" };
  return `${fdi} (${names[fdi % 10] ?? ""})`;
}

function priorityColor(p: string): string {
  if (p === "high") return "text-rose-600 bg-rose-50 border-rose-200";
  if (p === "medium") return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

function severityColor(s: string): string {
  if (s === "severe") return "text-rose-600 bg-rose-50 border-rose-200";
  if (s === "moderate") return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-blue-600 bg-blue-50 border-blue-200";
}

// ─── PDL Gauge ────────────────────────────────────────────────────────────────

function PdlGauge({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const radius = 40;
  const circumference = Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = pct >= 80 ? "var(--clinical-danger)" : pct >= 60 ? "var(--clinical-warn)" : "var(--clinical-safe)";

  return (
    <div className="flex flex-col items-center">
      <svg width={100} height={60} viewBox="0 0 100 55">
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" style={{ stroke: "var(--clinical-track)" }} strokeWidth={10} strokeLinecap="round" />
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          style={{ stroke: color }}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <text x={50} y={52} textAnchor="middle" fontSize={14} fontWeight="700" style={{ fill: color }}>{clamped}%</text>
      </svg>
      <p className="text-[10px] text-secondary">Max PDL Stress</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BiomechanicsPanel({ setupId }: { setupId?: string }) {
  const [result, setResult] = useState<BiomechanicsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResult = useCallback(async () => {
    if (!setupId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<BiomechanicsResult>(`/api/biomechanics/${setupId}`);
      setResult(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) { setResult(null); return; }
      setError(e instanceof Error ? e.message : "Failed to load analysis");
    } finally {
      setLoading(false);
    }
  }, [setupId]);

  useEffect(() => { fetchResult(); }, [fetchResult]);

  const handleRun = async () => {
    if (!setupId) return;
    setRunning(true);
    setError(null);
    try {
      const data = await api.post<BiomechanicsResult>(`/api/biomechanics/${setupId}`, {});
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run analysis");
    } finally {
      setRunning(false);
    }
  };

  if (!setupId) {
    return (
      <EmptyState
        icon={Activity}
        title="No setup selected"
        body="Select a digital setup from the CAD Workspace to run biomechanical analysis."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={running || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {running ? "Analyzing…" : "Run Biomechanical Analysis"}
          </button>
          {result && (
            <span className="text-xs text-secondary">
              Last run: {new Date(result.created_at).toLocaleString()}
            </span>
          )}
        </div>
        <button
          onClick={fetchResult}
          disabled={loading}
          className="rounded-lg border border-border p-2 text-secondary hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !result && (
        <div className="flex items-center justify-center py-16"><Spinner size={32} /></div>
      )}

      {!result && !loading && (
        <EmptyState
          icon={Activity}
          title="No analysis yet"
          body="Click Run Biomechanical Analysis to evaluate the current setup."
        />
      )}

      {result && (
        <>
          {/* Score cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={`rounded-xl border p-4 text-center ${scoreBg(result.biomechanical_score)}`}>
              <p className={`text-4xl font-bold ${scoreColor(result.biomechanical_score)}`}>{result.biomechanical_score}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-secondary">Biomech Score</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${result.movement_feasible ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"}`}>
              <div className="flex justify-center">
                {result.movement_feasible
                  ? <ShieldCheck className="h-9 w-9 text-emerald-500" />
                  : <ShieldAlert className="h-9 w-9 text-rose-500" />}
              </div>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-secondary">Movement Feasible</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${!result.has_collisions ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"}`}>
              <div className="flex justify-center">
                {!result.has_collisions
                  ? <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                  : <XCircle className="h-9 w-9 text-rose-500" />}
              </div>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                {result.has_collisions ? "Collisions" : "No Collisions"}
              </p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${result.staging_feasible ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"}`}>
              <div className="flex justify-center">
                {result.staging_feasible
                  ? <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                  : <AlertTriangle className="h-9 w-9 text-amber-500" />}
              </div>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-secondary">Staging Feasible</p>
            </div>
          </div>

          {/* PDL Stress */}
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              PDL Stress Analysis
            </h3>
            <div className="flex flex-wrap items-start gap-6">
              <PdlGauge pct={result.max_pdl_stress_pct} />
              <div className="flex-1 min-w-[200px]">
                {result.pdl_stresses.filter((s) => s.overloaded).length === 0 ? (
                  <p className="text-sm text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> No overloaded teeth
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-secondary mb-2">Overloaded Teeth</p>
                    {result.pdl_stresses.filter((s) => s.overloaded).map((s) => (
                      <div key={s.tooth_fdi} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{toothLabel(s.tooth_fdi)}</span>
                        <div className="flex items-center gap-2 w-32">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                            <div className="h-1.5 rounded-full bg-rose-500" style={{ width: `${Math.min(100, s.stress_pct)}%` }} />
                          </div>
                          <span className="w-10 text-right font-semibold text-rose-600">{s.stress_pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Collision Detection */}
          {result.collision_pairs.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-rose-500" />
                Collision Detection ({result.collision_pairs.length})
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {result.collision_pairs.map((pair, i) => (
                  <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${severityColor(pair.severity)}`}>
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">Tooth {pair.tooth_a} ↔ Tooth {pair.tooth_b}</p>
                      <p className="text-[11px] mt-0.5 opacity-80">{pair.position}</p>
                      <span className={`inline-block mt-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${severityColor(pair.severity)}`}>
                        {pair.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Excessive Movements */}
          {result.excessive_movements.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Excessive Movements</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {["Tooth", "Movement", "Value", "Limit", "Status"].map((h) => (
                        <th key={h} className="pb-2 pr-4 text-left font-semibold text-secondary">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.excessive_movements.map((m, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium">{toothLabel(m.tooth_fdi)}</td>
                        <td className="py-2 pr-4 text-secondary">{m.movement_type}</td>
                        <td className={`py-2 pr-4 font-semibold ${m.exceeds ? "text-rose-600" : "text-foreground"}`}>{m.value.toFixed(2)}</td>
                        <td className="py-2 pr-4 text-secondary">{m.limit.toFixed(2)}</td>
                        <td className="py-2">
                          <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-semibold ${m.exceeds ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                            {m.exceeds ? "Exceeds" : "OK"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Anchorage Demand */}
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Anchorage Demand</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-secondary">Score</span>
                <span className={`font-bold text-sm ${scoreColor(100 - result.anchorage_demand_score)}`}>
                  {result.anchorage_demand_score}/100
                </span>
              </div>
              <ProgressBar
                value={result.anchorage_demand_score}
                tone={result.anchorage_demand_score >= 70 ? "danger" : result.anchorage_demand_score >= 40 ? "warning" : "success"}
              />
              <p className="text-xs text-secondary mt-1">{result.anchorage_demand_description}</p>
            </div>
          </Card>

          {/* IPR Requirements */}
          {result.ipr_requirements.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">IPR Requirements</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {["Contact", "Amount", "Priority"].map((h) => (
                        <th key={h} className="pb-2 pr-4 text-left font-semibold text-secondary">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.ipr_requirements.map((req, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium">{req.contact}</td>
                        <td className="py-2 pr-4">{req.amount_needed_mm.toFixed(2)} mm</td>
                        <td className="py-2">
                          <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-semibold ${priorityColor(req.priority)}`}>
                            {req.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Attachment Requirements */}
          {result.attachment_requirements.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Attachment Requirements</h3>
              <div className="flex flex-wrap gap-2">
                {result.attachment_requirements.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <span className="text-xs font-bold text-foreground mt-0.5">{a.tooth_fdi}</span>
                    <div>
                      <span className="block text-[10px] font-semibold text-indigo-600">{a.type}</span>
                      <span className="block text-[10px] text-secondary">{a.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* AI Recommended Staging */}
          {result.recommended_staging.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">AI Recommended Staging</h3>
              <p className="mb-3 text-xs text-secondary">{result.recommended_staging.length} estimated stages</p>
              <div className="space-y-2">
                {result.recommended_staging.map((step) => {
                  const pct = Math.min(100, (step.max_movement_mm / 0.5) * 100);
                  return (
                    <div key={step.stage} className="flex items-center gap-3 text-xs">
                      <span className="w-14 shrink-0 font-semibold text-secondary">Stage {step.stage}</span>
                      <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-foreground">
                          {step.tooth_count} teeth · {step.max_movement_mm.toFixed(2)} mm max
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
