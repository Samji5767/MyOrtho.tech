"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Card, EmptyState, Spinner } from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

type SeverityLevel = "critical" | "warning" | "info";

interface SupportingDatum {
  label: string;
  value: string | number;
  unit?: string;
}

interface AISuggestion {
  id: string;
  setup_id: string;
  severity: SeverityLevel;
  message: string;
  tooth_fdi?: number;
  confidence: number;
  supporting_data: SupportingDatum[];
  applicable: boolean;
  applied: boolean;
  applied_at?: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_EMOJI: Record<SeverityLevel, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
};

const SEVERITY_ORDER: Record<SeverityLevel, number> = { critical: 0, warning: 1, info: 2 };

function severityBorder(s: SeverityLevel): string {
  if (s === "critical") return "border-rose-200 dark:border-rose-800";
  if (s === "warning") return "border-amber-200 dark:border-amber-800";
  return "border-blue-200 dark:border-blue-800";
}

function severityBg(s: SeverityLevel): string {
  if (s === "critical") return "bg-rose-50/50 dark:bg-rose-950/20";
  if (s === "warning") return "bg-amber-50/50 dark:bg-amber-950/20";
  return "bg-blue-50/50 dark:bg-blue-950/20";
}

function countBySeverity(suggestions: AISuggestion[], severity: SeverityLevel): number {
  return suggestions.filter((s) => s.severity === severity).length;
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onUpdated,
}: {
  suggestion: AISuggestion;
  onUpdated: (updated: AISuggestion) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [applying, setApplying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/ai-suggestions/${suggestion.id}/acknowledge`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json() as AISuggestion;
      onUpdated(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to acknowledge");
    } finally {
      setAcknowledging(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/ai-suggestions/${suggestion.id}/apply`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json() as AISuggestion;
      onUpdated(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${severityBorder(suggestion.severity)} ${severityBg(suggestion.severity)}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-base leading-none shrink-0">{SEVERITY_EMOJI[suggestion.severity]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-snug">{suggestion.message}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {suggestion.tooth_fdi != null && (
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                  FDI {suggestion.tooth_fdi}
                </span>
              )}
              <span className="text-[10px] text-secondary font-medium">
                {Math.round(suggestion.confidence * 100)}% conf.
              </span>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {suggestion.applied && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-2.5 w-2.5" /> Applied ✓
              </span>
            )}
            {suggestion.acknowledged && !suggestion.applied && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-secondary dark:border-slate-700 dark:bg-slate-900">
                Reviewed
                {suggestion.acknowledged_at && (
                  <span className="font-normal opacity-70">
                    {" · "}{new Date(suggestion.acknowledged_at).toLocaleDateString()}
                  </span>
                )}
              </span>
            )}
          </div>

          {suggestion.supporting_data.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center gap-1 text-[10px] font-semibold text-secondary hover:text-foreground"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? "Hide" : "Show"} supporting data ({suggestion.supporting_data.length})
              </button>
              {expanded && (
                <div className="mt-2 rounded-lg border border-border bg-card p-2 space-y-1">
                  {suggestion.supporting_data.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-secondary">{d.label}</span>
                      <span className="font-semibold text-foreground">
                        {d.value}{d.unit != null ? ` ${d.unit}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {actionError && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-rose-600">
              <AlertCircle className="h-3 w-3 shrink-0" />{actionError}
            </div>
          )}

          {!suggestion.applied && (
            <div className="mt-3 flex items-center gap-2">
              {!suggestion.acknowledged && (
                <button
                  onClick={handleAcknowledge}
                  disabled={acknowledging}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-secondary hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
                >
                  {acknowledging && <Loader2 className="h-3 w-3 animate-spin" />}
                  Acknowledge
                </button>
              )}
              {suggestion.applicable && (
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {applying && <Loader2 className="h-3 w-3 animate-spin" />}
                  Apply
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIClinicalAssistantPanel({ setupId }: { setupId?: string }) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    if (!setupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-suggestions?setupId=${setupId}&onlyActive=${showActiveOnly}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as AISuggestion[];
      setSuggestions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }, [setupId, showActiveOnly]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const handleGenerate = async () => {
    if (!setupId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-suggestions/generate/${setupId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as AISuggestion[];
      setSuggestions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate suggestions");
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdated = (updated: AISuggestion) => {
    setSuggestions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const criticalCount = countBySeverity(suggestions, "critical");
  const warningCount = countBySeverity(suggestions, "warning");
  const infoCount = countBySeverity(suggestions, "info");
  const allReviewed = suggestions.length > 0 && suggestions.every((s) => s.acknowledged || s.applied);

  const sorted = [...suggestions].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  if (!setupId) {
    return (
      <EmptyState
        icon={Bot}
        title="No setup selected"
        body="Select a digital setup to view AI clinical suggestions."
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
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          {generating ? "Generating…" : "Refresh Suggestions"}
        </button>
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="rounded-lg border border-border p-2.5 text-secondary hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>

        <div className="ml-auto flex items-center rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setShowActiveOnly(true)}
            className={`px-3 py-2 text-xs font-semibold transition ${showActiveOnly ? "bg-indigo-600 text-white" : "text-secondary hover:bg-slate-100 dark:hover:bg-slate-900"}`}
          >
            Show Active Only
          </button>
          <button
            onClick={() => setShowActiveOnly(false)}
            className={`px-3 py-2 text-xs font-semibold transition ${!showActiveOnly ? "bg-indigo-600 text-white" : "text-secondary hover:bg-slate-100 dark:hover:bg-slate-900"}`}
          >
            Show All
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary bar */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
              🔴 {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
              🟡 {warningCount} warning
            </span>
          )}
          {infoCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
              🔵 {infoCount} info
            </span>
          )}
          {allReviewed && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All reviewed
            </span>
          )}
        </div>
      )}

      {loading && suggestions.length === 0 && (
        <div className="flex items-center justify-center py-16"><Spinner size={32} /></div>
      )}

      {!loading && suggestions.length === 0 && (
        <EmptyState
          icon={Bot}
          title="No suggestions"
          body="Click Refresh Suggestions to generate AI clinical recommendations for this setup."
        />
      )}

      {sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
