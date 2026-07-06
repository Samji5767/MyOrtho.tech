"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Printer,
  Moon,
  Sun,
  ListChecks,
} from "lucide-react";
import { getWearSchedule, type WearPhase } from "@/lib/api/retention";

// ─── Treatment summary type (from reports API) ─────────────────────────────────

interface TreatmentSummaryContent {
  patientFriendlySummary?: string;
  treatmentGoals?: string[];
  estimatedDuration?: string;
  numberOfAligners?: number;
  keyMilestones?: { stage: number; description: string }[];
  complianceInstructions?: string[];
}

interface TreatmentSummary {
  id: string;
  reportType: string;
  status: string;
  content: TreatmentSummaryContent;
  generatedAt: string;
}

async function fetchTreatmentSummary(caseId: string, planId: string): Promise<TreatmentSummary> {
  const res = await fetch(`/api/cases/${caseId}/reports/treatment-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<TreatmentSummary>;
}

// ─── Wear phase card ───────────────────────────────────────────────────────────

function WearPhaseCard({ phase }: { phase: WearPhase }) {
  const isNightOnly = phase.wearHoursPerDay <= 12;
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">
          Phase {phase.phaseNum}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-[color:var(--foreground)]">
          {isNightOnly ? <Moon size={10} /> : <Sun size={10} />}
          {phase.wearLabel}
        </span>
      </div>
      <p className="text-sm font-bold text-[color:var(--foreground)]">
        Month {phase.startMonth}–{phase.endMonth}
      </p>
      <div className="flex items-center gap-1.5">
        <Clock size={11} className="shrink-0 text-[color:var(--muted-foreground)]" />
        <p className="text-xs text-[color:var(--muted-foreground)]">{phase.wearHoursPerDay} hours/day</p>
      </div>
      {phase.clinicalInstruction && (
        <p className="text-[11px] italic text-[color:var(--muted-foreground)]">{phase.clinicalInstruction}</p>
      )}
    </div>
  );
}

// ─── Default compliance checklist (shown when API has no custom instructions) ──

const DEFAULT_COMPLIANCE: string[] = [
  "Wear aligners 20–22 hours per day",
  "Remove only to eat, drink (except water), and clean teeth",
  "Brush and floss before reinserting aligners",
  "Rinse aligners with cool water when removed — never hot",
  "Store aligners in the provided case when not in use",
  "Change to the next aligner on your scheduled date",
  "Attend all scheduled check-up appointments",
  "Contact the clinic if aligners crack, lose fit, or cause pain",
  "Do not use toothpaste to clean aligners — it scratches the surface",
  "Keep the previous set of aligners in case of loss",
];

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

export function PatientReportPanel({ caseId, planId }: Props) {
  const [summary, setSummary] = useState<TreatmentSummary | null>(null);
  const [wearSchedule, setWearSchedule] = useState<WearPhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, scheduleRes] = await Promise.allSettled([
        fetchTreatmentSummary(caseId, planId),
        getWearSchedule(caseId, planId),
      ]);
      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
      if (scheduleRes.status === "fulfilled") setWearSchedule(scheduleRes.value);
      if (summaryRes.status === "rejected" && scheduleRes.status === "rejected") {
        const msg = summaryRes.reason instanceof Error ? summaryRes.reason.message : "Failed to load report";
        setError(msg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  useEffect(() => { void load(); }, [load]);

  const complianceItems =
    summary?.content?.complianceInstructions?.length
      ? summary.content.complianceInstructions
      : DEFAULT_COMPLIANCE;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; }
        }
      `}</style>

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">
              Patient Communication
            </p>
            <h3 className="text-base font-semibold text-[color:var(--foreground)]">Patient Report</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
            >
              <Printer size={12} />
              Print
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--primary)] disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-300/50 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/10 dark:text-rose-400 no-print">
            <AlertTriangle size={12} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Treatment overview */}
        {summary?.content && (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-[color:var(--primary)]" />
              <p className="text-sm font-bold text-[color:var(--foreground)]">Treatment Overview</p>
            </div>

            {summary.content.patientFriendlySummary && (
              <p className="text-sm leading-relaxed text-[color:var(--foreground)]">
                {summary.content.patientFriendlySummary}
              </p>
            )}

            <div className="flex flex-wrap gap-4">
              {summary.content.estimatedDuration && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Calendar size={12} className="text-[color:var(--muted-foreground)]" />
                  <span className="text-[color:var(--muted-foreground)]">Duration:</span>
                  <span className="font-semibold text-[color:var(--foreground)]">{summary.content.estimatedDuration}</span>
                </div>
              )}
              {summary.content.numberOfAligners != null && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[color:var(--muted-foreground)]">Aligners:</span>
                  <span className="font-semibold text-[color:var(--foreground)]">{summary.content.numberOfAligners} trays</span>
                </div>
              )}
            </div>

            {summary.content.treatmentGoals && summary.content.treatmentGoals.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1.5">
                  Treatment Goals
                </p>
                <ul className="space-y-1">
                  {summary.content.treatmentGoals.map((goal, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-emerald-500" />
                      <span className="text-[color:var(--foreground)]">{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.content.keyMilestones && summary.content.keyMilestones.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)] mb-1.5">
                  Key Milestones
                </p>
                <div className="space-y-1.5">
                  {summary.content.keyMilestones.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="shrink-0 rounded-full border border-[color:var(--primary)] px-1.5 py-0.5 text-[9px] font-bold text-[color:var(--primary)]">
                        Stage {m.stage}
                      </span>
                      <span className="text-[color:var(--foreground)]">{m.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Wear schedule */}
        {wearSchedule.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">
              Wear Schedule
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {wearSchedule.map((phase) => (
                <WearPhaseCard key={phase.id} phase={phase} />
              ))}
            </div>
          </div>
        )}

        {/* Patient compliance checklist */}
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks size={14} className="text-[color:var(--primary)]" />
            <p className="text-sm font-bold text-[color:var(--foreground)]">Patient Compliance Checklist</p>
          </div>
          <div className="space-y-2">
            {complianceItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-2 border-[color:var(--border)]" />
                <p className="text-xs text-[color:var(--foreground)]">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <strong>Clinical Disclaimer:</strong> This report is for patient communication and planning reference only. All clinical decisions must be made by a licensed orthodontist. Contact your clinician with any questions or concerns about your treatment.
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)] no-print">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
            Loading report data…
          </div>
        )}
      </div>
    </>
  );
}
