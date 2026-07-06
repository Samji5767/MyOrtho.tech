"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Home,
  Moon,
  RefreshCw,
  SmilePlus,
  Sun,
  Timer,
} from "lucide-react";
import { getWearSchedule, type WearPhase } from "@/lib/api/retention";

// ─── Wear timer ───────────────────────────────────────────────────────────────

function WearTimer({ targetHours }: { targetHours: number }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const targetSeconds = targetHours * 3600;
  const pct = Math.min(100, (seconds / targetSeconds) * 100);
  const reached = seconds >= targetSeconds;

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Timer size={16} className="text-[color:var(--primary)]" />
        <p className="text-sm font-bold text-[color:var(--foreground)]">Today's Wear Timer</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className={`text-5xl font-black tabular-nums tracking-tight ${reached ? "text-emerald-500" : "text-[color:var(--foreground)]"}`}>
          {pad(hh)}:{pad(mm)}:{pad(ss)}
        </p>
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Goal: {targetHours} hours/day
        </p>

        <div className="w-full h-2 rounded-full overflow-hidden bg-[color:var(--border)]">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${reached ? "bg-emerald-500" : "bg-[color:var(--primary)]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {reached && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <CheckCircle2 size={13} />
            Daily goal reached!
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-transform active:scale-95 ${
              running
                ? "border border-[color:var(--border)] text-[color:var(--foreground)]"
                : "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
            }`}
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            type="button"
            onClick={() => { setSeconds(0); setRunning(false); }}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[color:var(--border)] px-4 text-sm font-semibold text-[color:var(--muted-foreground)] transition-transform active:scale-95"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wear phase card ──────────────────────────────────────────────────────────

function PhaseCard({ phase, current }: { phase: WearPhase; current: boolean }) {
  const isNightOnly = phase.wearHoursPerDay <= 12;
  return (
    <div className={`rounded-xl border p-3 space-y-1 ${current ? "border-[color:var(--primary)] bg-[color:var(--primary)]/5" : "border-[color:var(--border)] bg-[color:var(--card)]"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">
          Phase {phase.phaseNum}
          {current && <span className="ml-1.5 text-[color:var(--primary)]">● Current</span>}
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

// ─── Compliance checklist ─────────────────────────────────────────────────────

const COMPLIANCE_TIPS = [
  "Wear aligners 20–22 hours per day",
  "Remove only to eat, drink (except water), and brush",
  "Rinse aligners with cool water when removed",
  "Store aligners in their case when not in use",
  "Change to the next aligner on your scheduled date",
  "Attend all scheduled check-up appointments",
  "Contact your clinic if aligners feel loose or cause pain",
];

// ─── Main page ────────────────────────────────────────────────────────────────

function PatientPortalContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams?.get("caseId") ?? null;
  const planId = searchParams?.get("planId") ?? null;

  const [wearSchedule, setWearSchedule] = useState<WearPhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caseId || !planId) return;
    setLoading(true);
    setError(null);
    try {
      const schedule = await getWearSchedule(caseId, planId);
      setWearSchedule(schedule);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  useEffect(() => { void load(); }, [load]);

  // Estimate current phase based on today being roughly start-of-treatment
  const currentPhaseIdx = 0;

  const activeWearHours = wearSchedule[currentPhaseIdx]?.wearHoursPerDay ?? 22;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            Patient Portal
          </p>
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">My Treatment</h1>
        </div>
        <Link
          href="/"
          className="grid h-9 w-9 place-items-center rounded-xl border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
        >
          <Home size={15} />
        </Link>
      </div>

      {/* No case loaded */}
      {!caseId || !planId ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-8 text-center space-y-3">
          <SmilePlus size={28} className="mx-auto text-[color:var(--muted-foreground)]" />
          <p className="text-sm font-semibold text-[color:var(--foreground)]">No treatment loaded</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            Ask your clinician to share your treatment portal link.
          </p>
        </div>
      ) : (
        <>
          {/* Wear timer */}
          <WearTimer targetHours={activeWearHours} />

          {/* Schedule section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[color:var(--primary)]" />
                <p className="text-sm font-bold text-[color:var(--foreground)]">Wear Schedule</p>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="flex items-center gap-1 text-xs font-semibold text-[color:var(--primary)] disabled:opacity-50"
              >
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-300/50 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/10 dark:text-rose-400">
                <AlertTriangle size={12} className="shrink-0" />
                {error}
              </div>
            )}

            {wearSchedule.length > 0 ? (
              <div className="space-y-2">
                {wearSchedule.map((phase, i) => (
                  <PhaseCard key={phase.id} phase={phase} current={i === currentPhaseIdx} />
                ))}
              </div>
            ) : !loading && !error ? (
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-center text-xs text-[color:var(--muted-foreground)]">
                No wear schedule available yet. Check back after your clinician approves your protocol.
              </div>
            ) : null}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
                Loading schedule…
              </div>
            )}
          </div>

          {/* Compliance checklist */}
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-[color:var(--primary)]" />
              <p className="text-sm font-bold text-[color:var(--foreground)]">Daily Reminders</p>
            </div>
            <div className="space-y-2">
              {COMPLIANCE_TIPS.map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-2 border-[color:var(--border)]" />
                  <p className="text-xs text-[color:var(--foreground)]">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <strong>Note:</strong> This portal is for patient information only. Always follow your clinician&apos;s specific instructions. Contact your clinic with any concerns about your treatment.
          </div>
        </>
      )}
    </div>
  );
}

export default function PatientPortalPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[color:var(--muted-foreground)]">
        Loading patient portal…
      </div>
    }>
      <PatientPortalContent />
    </Suspense>
  );
}
