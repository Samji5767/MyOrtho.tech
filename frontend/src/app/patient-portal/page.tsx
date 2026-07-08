"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  HelpCircle,
  Home,
  MapPin,
  Moon,
  PhoneCall,
  RefreshCw,
  SmilePlus,
  Star,
  Sun,
  Timer,
  TrendingUp,
} from "lucide-react";
import {
  getWearSchedule,
  getRetentionProtocol,
  type WearPhase,
} from "@/lib/api/retention";
import { listPlans, type TreatmentPlanSummary } from "@/lib/api/treatmentPlans";
import { listStages, type AlignerStage } from "@/lib/api/stages";
import { useAsync } from "@/hooks/useAsync";

// ─── Wear timer ────────────────────────────────────────────────────────────────

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
        <p className="text-sm font-bold text-[color:var(--foreground)]">Today&apos;s Wear Timer</p>
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

// ─── Compliance tips ──────────────────────────────────────────────────────────

const COMPLIANCE_TIPS = [
  "Wear aligners 20–22 hours per day",
  "Remove only to eat, drink (except water), and brush",
  "Rinse aligners with cool water when removed",
  "Store aligners in their case when not in use",
  "Change to the next aligner on your scheduled date",
  "Attend all scheduled check-up appointments",
  "Contact your clinic if aligners feel loose or cause pain",
];

// ─── Section 1: Treatment Progress Card ───────────────────────────────────────

function TreatmentProgressCard({
  plan,
  currentStageNum,
  loading,
}: {
  plan: TreatmentPlanSummary | null;
  currentStageNum: number;
  loading: boolean;
}) {
  const totalStages = plan?.estimatedStages ?? 0;
  const pct =
    totalStages > 0
      ? Math.min(100, Math.round((currentStageNum / totalStages) * 100))
      : 0;

  const estCompletion = (() => {
    if (!plan?.createdAt || !totalStages) return null;
    const start = new Date(plan.createdAt);
    const end = new Date(start.getTime() + totalStages * 14 * 24 * 60 * 60 * 1000);
    return end.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  })();

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-[color:var(--border)]" />
        <div className="h-8 w-32 rounded bg-[color:var(--border)]" />
        <div className="h-2.5 w-full rounded-full bg-[color:var(--border)]" />
        <div className="h-3 w-40 rounded bg-[color:var(--border)]" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-[color:var(--primary)]" />
        <p className="text-sm font-bold text-[color:var(--foreground)]">Treatment Progress</p>
      </div>

      <p className="text-[10px] text-[color:var(--muted-foreground)]">
        AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist.
      </p>

      {totalStages > 0 ? (
        <>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-[color:var(--foreground)]">
              Stage {currentStageNum}
              <span className="ml-1 text-sm font-normal text-[color:var(--muted-foreground)]">
                / {totalStages}
              </span>
            </p>
            <span className="text-lg font-bold text-[color:var(--primary)]">{pct}%</span>
          </div>

          <div className="w-full h-2.5 rounded-full overflow-hidden bg-[color:var(--border)]">
            <div
              className="h-full rounded-full bg-[color:var(--primary)] transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>

          {estCompletion && (
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Est. Completion:{" "}
              <span className="font-semibold text-[color:var(--foreground)]">
                {estCompletion}
              </span>
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Treatment progress will appear once your plan is finalized by your clinician.
        </p>
      )}
    </div>
  );
}

// ─── Section 2: Today's Tasks ──────────────────────────────────────────────────

function TodaysTasks({
  currentPhaseName,
  loading,
}: {
  currentPhaseName: string | null;
  loading: boolean;
}) {
  const [checked, setChecked] = useState<boolean[]>([false, false, false]);

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const items = [
    {
      label: "Wear your aligners today",
      sub: "20–22 hours is recommended for best results",
    },
    {
      label: currentPhaseName
        ? `Current phase: ${currentPhaseName}`
        : "Check your wear schedule",
      sub: currentPhaseName
        ? "Follow your phase instructions below"
        : "See wear schedule section below",
    },
    {
      label: "Next appointment",
      sub: "Check with your clinic for scheduling",
    },
  ];

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3 animate-pulse">
        <div className="h-4 w-28 rounded bg-[color:var(--border)]" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 w-full rounded-xl bg-[color:var(--border)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={14} className="text-[color:var(--primary)]" />
        <p className="text-sm font-bold text-[color:var(--foreground)]">Today&apos;s Tasks</p>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className="w-full flex items-start gap-3 rounded-xl border border-[color:var(--border)] p-3 text-left transition-colors hover:border-[color:var(--primary)]/50 active:scale-[0.98]"
          >
            <div
              className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                checked[i]
                  ? "border-emerald-500 bg-emerald-500"
                  : "border-[color:var(--border)]"
              }`}
            >
              {checked[i] && <Check size={9} className="text-white" />}
            </div>
            <div className="min-w-0">
              <p
                className={`text-xs font-semibold leading-snug ${
                  checked[i]
                    ? "line-through text-[color:var(--muted-foreground)]"
                    : "text-[color:var(--foreground)]"
                }`}
              >
                {item.label}
              </p>
              <p className="text-[11px] text-[color:var(--muted-foreground)] mt-0.5">
                {item.sub}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Section 3: Milestone Timeline ────────────────────────────────────────────

type MilestoneStatus = "past" | "active" | "future";
type MilestoneIconKey = "flag" | "mappin" | "star" | "check" | "smile";

interface MilestoneItem {
  label: string;
  dateLabel: string;
  status: MilestoneStatus;
  iconKey: MilestoneIconKey;
}

function MilestoneIcon({
  iconKey,
  status,
}: {
  iconKey: MilestoneIconKey;
  status: MilestoneStatus;
}) {
  const cls = `shrink-0 ${
    status === "active"
      ? "text-[color:var(--primary-foreground)]"
      : status === "past"
      ? "text-white"
      : "text-[color:var(--muted-foreground)]"
  }`;
  if (iconKey === "flag") return <Flag size={11} className={cls} />;
  if (iconKey === "mappin") return <MapPin size={11} className={cls} />;
  if (iconKey === "star") return <Star size={11} className={cls} />;
  if (iconKey === "check") return <CheckCircle2 size={11} className={cls} />;
  return <SmilePlus size={11} className={cls} />;
}

function MilestoneTimeline({
  totalStages,
  treatmentStartDate,
  currentStageNum,
  loading,
}: {
  totalStages: number;
  treatmentStartDate: Date | null;
  currentStageNum: number;
  loading: boolean;
}) {
  const milestones: MilestoneItem[] = (() => {
    const startDate = treatmentStartDate ?? new Date();
    const addDays = (d: Date, days: number) =>
      new Date(d.getTime() + days * 86400000);
    const fmtDate = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const safeTotal = Math.max(1, totalStages);
    const midStage = Math.max(1, Math.ceil(safeTotal / 2));
    const endStage = safeTotal;
    const midDate = addDays(startDate, midStage * 14);
    const endDate = addDays(startDate, endStage * 14);
    const retentionDate = addDays(endDate, 14);

    return [
      {
        label: "Treatment Start",
        dateLabel: treatmentStartDate ? fmtDate(startDate) : "Your start date",
        status: "past" as MilestoneStatus,
        iconKey: "flag" as MilestoneIconKey,
      },
      {
        label: totalStages
          ? `Stage ${Math.min(currentStageNum, endStage)} — Current`
          : "Current Stage",
        dateLabel: "Now",
        status: "active" as MilestoneStatus,
        iconKey: "mappin" as MilestoneIconKey,
      },
      {
        label: totalStages ? `Midpoint — Stage ${midStage}` : "Midpoint",
        dateLabel: totalStages
          ? `${currentStageNum >= midStage ? "" : "~"}${fmtDate(midDate)}`
          : "Estimated",
        status: (currentStageNum >= midStage ? "past" : "future") as MilestoneStatus,
        iconKey: "star" as MilestoneIconKey,
      },
      {
        label: totalStages ? `Final Stage ${endStage}` : "Final Stage",
        dateLabel: totalStages
          ? `${currentStageNum >= endStage ? "" : "~"}${fmtDate(endDate)}`
          : "Estimated",
        status: (currentStageNum >= endStage ? "past" : "future") as MilestoneStatus,
        iconKey: "check" as MilestoneIconKey,
      },
      {
        label: "Retention Phase",
        dateLabel: totalStages ? `~${fmtDate(retentionDate)}` : "After final stage",
        status: "future" as MilestoneStatus,
        iconKey: "smile" as MilestoneIconKey,
      },
    ];
  })();

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-4 animate-pulse">
        <div className="h-4 w-44 rounded bg-[color:var(--border)]" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-6 w-6 shrink-0 rounded-full bg-[color:var(--border)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 rounded bg-[color:var(--border)]" />
              <div className="h-2.5 w-1/2 rounded bg-[color:var(--border)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={14} className="text-[color:var(--primary)]" />
        <p className="text-sm font-bold text-[color:var(--foreground)]">Treatment Milestones</p>
      </div>
      <p className="text-[10px] text-[color:var(--muted-foreground)]">
        AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist.
      </p>
      <div className="relative">
        {/* Vertical connecting line through dot centers */}
        <div className="absolute left-3 top-3 bottom-3 w-px bg-[color:var(--border)]" />
        <div className="space-y-5">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className={`relative z-10 h-6 w-6 shrink-0 rounded-full flex items-center justify-center border-2 ${
                  m.status === "active"
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]"
                    : m.status === "past"
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-[color:var(--border)] bg-[color:var(--card)]"
                }`}
              >
                <MilestoneIcon iconKey={m.iconKey} status={m.status} />
              </div>
              <div className="pt-0.5 min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    m.status === "active"
                      ? "text-[color:var(--primary)]"
                      : m.status === "past"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[color:var(--muted-foreground)]"
                  }`}
                >
                  {m.label}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">
                    {m.dateLabel}
                  </p>
                  {m.status === "future" &&
                    m.dateLabel !== "After final stage" &&
                    m.dateLabel !== "Estimated" && (
                      <span className="text-[9px] font-semibold rounded px-1 py-0.5 bg-amber-100/80 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                        Estimated
                      </span>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section 4: FAQ ───────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "How long should I wear my aligners each day?",
    a: "20–22 hours per day is required for effective treatment. Only remove aligners to eat, drink (except water), and clean your teeth. Consistent wear time is the single biggest factor in treatment success.",
  },
  {
    q: "What if my aligner feels too tight?",
    a: "Some tightness is normal — it means your teeth are moving as planned. Use chewies to seat the aligner fully. If severe pain or significant tightness persists beyond 48 hours, contact your clinic.",
  },
  {
    q: "Can I drink while wearing my aligners?",
    a: "Water only. Beverages like coffee, tea, juice, or soft drinks can stain aligners and promote bacteria growth. Hot drinks can distort the plastic. Always remove aligners before drinking anything other than plain water.",
  },
  {
    q: "What do I do if I lose an aligner?",
    a: "Contact your clinic immediately. Depending on where you are in your treatment, your orthodontist may advise you to go back to the previous aligner, move forward to the next one, or order a replacement. Do not wait.",
  },
  {
    q: "When will I see results?",
    a: "Most patients notice early changes within the first few months of treatment. Visible alignment improvements depend on your case complexity. Follow your wear schedule consistently for best results.",
  },
] as const;

function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <HelpCircle size={14} className="text-[color:var(--primary)]" />
        <p className="text-sm font-bold text-[color:var(--foreground)]">
          Frequently Asked Questions
        </p>
      </div>
      {FAQ_ITEMS.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-[color:var(--border)] overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setOpenIdx((prev) => (prev === i ? null : i))}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
          >
            <p className="text-xs font-semibold text-[color:var(--foreground)]">
              {item.q}
            </p>
            {openIdx === i ? (
              <ChevronUp
                size={14}
                className="shrink-0 text-[color:var(--muted-foreground)]"
              />
            ) : (
              <ChevronDown
                size={14}
                className="shrink-0 text-[color:var(--muted-foreground)]"
              />
            )}
          </button>
          {openIdx === i && (
            <div className="px-3 pb-3 border-t border-[color:var(--border)]">
              <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed pt-2">
                {item.a}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Section 5: Emergency Guidance Banner ─────────────────────────────────────

function EmergencyBanner() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <PhoneCall
            size={14}
            className="shrink-0 text-amber-700 dark:text-amber-300"
          />
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            When to contact your clinic
          </p>
        </div>
        {open ? (
          <ChevronUp
            size={14}
            className="shrink-0 text-amber-700 dark:text-amber-300"
          />
        ) : (
          <ChevronDown
            size={14}
            className="shrink-0 text-amber-700 dark:text-amber-300"
          />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-amber-200/60 dark:border-amber-500/20 pt-3">
          <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            Contact your clinic immediately if:
          </p>
          <ul className="space-y-2">
            {[
              "You experience severe or persistent pain",
              "You have lost or broken an aligner",
              "An attachment has fallen off",
              "Your aligner no longer fits or seats properly",
              "You notice unexpected tooth movement or new gaps",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle
                  size={11}
                  className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400"
                />
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  {item}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 pt-1">
            Do not wait for your next scheduled appointment — early intervention prevents delays in your treatment.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function PatientPortalContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams?.get("caseId") ?? null;
  const planId = searchParams?.get("planId") ?? null;

  const [wearSchedule, setWearSchedule] = useState<WearPhase[]>([]);
  const [treatmentStartDate, setTreatmentStartDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caseId || !planId) return;
    setLoading(true);
    setError(null);
    try {
      const [schedule, protocol] = await Promise.all([
        getWearSchedule(caseId, planId),
        getRetentionProtocol(caseId, planId).catch(() => null),
      ]);
      setWearSchedule(schedule);
      if (protocol?.createdAt) {
        setTreatmentStartDate(new Date(protocol.createdAt));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  useEffect(() => { void load(); }, [load]);

  // Fetch treatment plan + aligner stages for progress + milestones
  const { data: progressData, loading: progressLoading } = useAsync(
    (): Promise<[TreatmentPlanSummary[], AlignerStage[]] | null> => {
      if (!caseId || !planId) return Promise.resolve(null);
      return Promise.all([listPlans(caseId), listStages(caseId, planId)]);
    },
    [caseId, planId],
  );

  const plan: TreatmentPlanSummary | null = progressData
    ? (progressData[0].find((p) => p.id === planId) ?? null)
    : null;

  const alignerStages: AlignerStage[] = progressData ? progressData[1] : [];

  // Compute current phase index from elapsed months since treatment started
  const currentPhaseIdx = (() => {
    if (!treatmentStartDate || !wearSchedule.length) return 0;
    const msPerMonth = 1000 * 60 * 60 * 24 * 30.44;
    const elapsedMonths = Math.floor(
      (Date.now() - treatmentStartDate.getTime()) / msPerMonth,
    );
    const idx = wearSchedule.findIndex(
      (p) => elapsedMonths >= p.startMonth - 1 && elapsedMonths <= p.endMonth,
    );
    return idx >= 0 ? idx : wearSchedule.length - 1;
  })();

  // Compute current stage number (2 weeks per stage)
  const currentStageNum = (() => {
    const totalStages = plan?.estimatedStages ?? alignerStages.length;
    if (!treatmentStartDate) return 1;
    const elapsedDays = Math.floor(
      (Date.now() - treatmentStartDate.getTime()) / 86400000,
    );
    const computed = Math.max(1, Math.floor(elapsedDays / 14) + 1);
    return totalStages > 0 ? Math.min(computed, totalStages) : computed;
  })();

  const activeWearHours = wearSchedule[currentPhaseIdx]?.wearHoursPerDay ?? 22;
  const currentPhaseName = wearSchedule[currentPhaseIdx]?.wearLabel ?? null;

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
          {/* Section 1: Treatment Progress */}
          <TreatmentProgressCard
            plan={plan}
            currentStageNum={currentStageNum}
            loading={progressLoading}
          />

          {/* Wear timer */}
          <WearTimer targetHours={activeWearHours} />

          {/* Section 2: Today's Tasks */}
          <TodaysTasks currentPhaseName={currentPhaseName} loading={loading} />

          {/* Wear Schedule section */}
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

          {/* Section 3: Milestone Timeline */}
          <MilestoneTimeline
            totalStages={plan?.estimatedStages ?? alignerStages.length}
            treatmentStartDate={treatmentStartDate}
            currentStageNum={currentStageNum}
            loading={progressLoading}
          />

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

          {/* Section 4: FAQ */}
          <FAQSection />

          {/* Section 5: Emergency Guidance Banner */}
          <EmergencyBanner />

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
