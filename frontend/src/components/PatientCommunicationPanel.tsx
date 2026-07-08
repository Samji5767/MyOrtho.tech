"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Heart,
  Clock,
  Users,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  MessageCircle,
  Info,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { listPlans, type TreatmentPlanSummary } from "@/lib/api/treatmentPlans";
import { listAttachments } from "@/lib/api/attachments";
import { listIprItems } from "@/lib/api/ipr";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PatientCommunicationPanelProps {
  caseId: string;
  patientName: string;
}

// ─── Minimal TreatmentGoals type (subset of the API response) ─────────────────

interface TreatmentGoals {
  id: string;
  case_id: string;
  predicted_aligners: number;
  duration_weeks: number;
  confidence_pct: number;
  ai_rationale: string;
  retention_strategy: string;
  approved: boolean;
}

// ─── Static clinical content ──────────────────────────────────────────────────

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Will aligners hurt?",
    answer:
      "Some pressure is normal, especially when starting a new aligner. This usually passes within a day or two.",
  },
  {
    question: "Can I eat with aligners in?",
    answer:
      "No — always remove aligners before eating or drinking anything other than water.",
  },
  {
    question: "What if I lose an aligner?",
    answer: "Contact our clinic immediately. Do not skip to the next aligner.",
  },
  {
    question: "Do I need retainers after?",
    answer:
      "Yes — retainers are essential to maintain your result and must be worn as instructed.",
  },
  {
    question: "How often do I visit?",
    answer: "Typically every 6–8 weeks during active treatment.",
  },
];

const WEAR_STEPS = [
  "Wear aligners 20–22 hours per day",
  "Change aligners every 1–2 weeks as directed by your orthodontist",
  "Attend check-up appointments every 6–8 weeks",
  "Finish with retainers to maintain your result",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="p-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/10 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      {badge && <div className="ml-auto shrink-0">{badge}</div>}
    </div>
  );
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/30">
      <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
      <p className="text-sm text-secondary leading-relaxed">{children}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-2xl p-6 space-y-3 animate-pulse"
        >
          <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4" />
          <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-lg w-2/3" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/2" />
        </div>
      ))}
      <div className="flex items-center justify-center py-4 gap-2 text-secondary text-sm">
        <Loader2 size={16} className="animate-spin text-primary" />
        <span>Loading treatment summary…</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PatientCommunicationPanel({
  caseId,
  patientName,
}: PatientCommunicationPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<TreatmentPlanSummary | null>(null);
  const [goals, setGoals] = useState<TreatmentGoals | null>(null);
  const [attachmentCount, setAttachmentCount] = useState<number | null>(null);
  const [totalIprMm, setTotalIprMm] = useState<number | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch treatment plans and treatment goals in parallel
      const [plansResult, goalsResult] = await Promise.allSettled([
        listPlans(caseId),
        fetch(`/api/treatment-goals?caseId=${caseId}`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }).then(async (res) => {
          if (!res.ok) return null;
          const data = (await res.json()) as TreatmentGoals | null;
          return data;
        }),
      ]);

      let activePlan: TreatmentPlanSummary | null = null;

      if (plansResult.status === "fulfilled" && plansResult.value.length > 0) {
        activePlan = plansResult.value[0];
        setPlan(activePlan);
      }

      if (goalsResult.status === "fulfilled" && goalsResult.value != null) {
        setGoals(goalsResult.value);
      }

      // Fetch attachments and IPR once we have a plan ID
      if (activePlan) {
        const [attsResult, iprResult] = await Promise.allSettled([
          listAttachments(caseId, activePlan.id),
          listIprItems(caseId, activePlan.id),
        ]);
        if (attsResult.status === "fulfilled") {
          setAttachmentCount(attsResult.value.length);
        }
        if (iprResult.status === "fulfilled") {
          const total = iprResult.value.reduce(
            (sum, item) => sum + item.amountMm,
            0,
          );
          setTotalIprMm(total);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load treatment summary",
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Derived display values ──────────────────────────────────────────────────
  const alignerCount =
    goals?.predicted_aligners ?? plan?.estimatedStages ?? null;

  const durationMonths =
    goals?.duration_weeks != null
      ? Math.round(goals.duration_weeks / 4.33)
      : null;

  const confidence = goals?.confidence_pct ?? null;

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingSkeleton />;
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-300/50 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/10 dark:text-rose-400">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── 1. Treatment Overview ──────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <SectionHeader
          icon={<Heart size={16} className="text-primary" />}
          title="Treatment Overview"
          subtitle={`Personalised summary for ${patientName}`}
          badge={
            confidence != null ? (
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  confidence >= 80
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : confidence >= 60
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                    : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
                }`}
              >
                {confidence}% AI confidence
              </span>
            ) : undefined
          }
        />
        <div className="p-6">
          {alignerCount != null || durationMonths != null ? (
            <p className="text-base leading-relaxed text-foreground">
              Your treatment consists of{" "}
              <span className="font-bold text-primary">
                {alignerCount ?? "—"} aligners
              </span>{" "}
              worn over approximately{" "}
              <span className="font-bold text-primary">
                {durationMonths != null ? `${durationMonths} months` : "—"}
              </span>
              .
            </p>
          ) : (
            <InfoBlock>
              Treatment overview data is not yet available. Please check back
              once your plan has been generated by your orthodontist.
            </InfoBlock>
          )}
          {goals?.ai_rationale && (
            <p className="mt-3 text-sm text-secondary leading-relaxed">
              {goals.ai_rationale}
            </p>
          )}
        </div>
      </div>

      {/* ── 2. What to Expect ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <SectionHeader
          icon={<Clock size={16} className="text-blue-500" />}
          title="What to Expect"
          subtitle="General treatment guidance"
        />
        <div className="p-6">
          <ol className="space-y-3">
            {WEAR_STEPS.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
                  {idx + 1}
                </span>
                <span className="text-sm text-foreground leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── 3. Treatment Goals ────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <SectionHeader
          icon={<CheckCircle2 size={16} className="text-emerald-500" />}
          title="Your Treatment Goals"
          subtitle="Objectives defined by your orthodontist"
        />
        <div className="p-6">
          {goals != null ? (
            <div className="space-y-3">
              {goals.ai_rationale && (
                <div className="rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/30 p-4">
                  <p className="text-[10px] font-semibold text-secondary mb-2 uppercase tracking-widest">
                    Clinical Rationale
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {goals.ai_rationale}
                  </p>
                </div>
              )}
              {goals.retention_strategy && (
                <div className="rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/30 p-4">
                  <p className="text-[10px] font-semibold text-secondary mb-2 uppercase tracking-widest">
                    Retention Strategy
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {goals.retention_strategy}
                  </p>
                </div>
              )}
              {!goals.ai_rationale && !goals.retention_strategy && (
                <InfoBlock>
                  Goal details are defined but no descriptions are available at
                  this time.
                </InfoBlock>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2
                size={32}
                className="text-slate-300 dark:text-slate-700"
              />
              <p className="text-sm text-secondary font-medium">
                No treatment goals defined yet
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                Goals will appear here once your orthodontist generates a
                treatment plan.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Attachments & IPR ──────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <SectionHeader
          icon={<Users size={16} className="text-purple-500" />}
          title="Attachments &amp; IPR"
          subtitle="Auxiliary tooth movement aids"
        />
        <div className="p-6 space-y-3">

          {/* Attachments */}
          {attachmentCount != null ? (
            attachmentCount > 0 ? (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200/60 bg-blue-50/40 dark:border-blue-700/30 dark:bg-blue-950/20">
                <CheckCircle2
                  size={14}
                  className="text-blue-500 mt-0.5 shrink-0"
                />
                <p className="text-sm text-foreground leading-relaxed">
                  Small tooth-coloured buttons (attachments) will be placed on{" "}
                  <span className="font-semibold">
                    {attachmentCount}{" "}
                    {attachmentCount === 1 ? "tooth" : "teeth"}
                  </span>{" "}
                  to help with certain movements.
                </p>
              </div>
            ) : (
              <InfoBlock>
                No attachments are required for your treatment.
              </InfoBlock>
            )
          ) : (
            <InfoBlock>Attachment data is not yet available.</InfoBlock>
          )}

          {/* IPR */}
          {totalIprMm != null ? (
            totalIprMm > 0 ? (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200/60 bg-amber-50/40 dark:border-amber-700/30 dark:bg-amber-950/20">
                <AlertTriangle
                  size={14}
                  className="text-amber-600 mt-0.5 shrink-0"
                />
                <p className="text-sm text-foreground leading-relaxed">
                  Small amounts of enamel (IPR) will be carefully removed
                  between some teeth to create space. Total planned IPR:{" "}
                  <span className="font-semibold">
                    {totalIprMm.toFixed(1)} mm
                  </span>
                  .
                </p>
              </div>
            ) : (
              <InfoBlock>
                No interproximal reduction (IPR) is required for your
                treatment.
              </InfoBlock>
            )
          ) : (
            <InfoBlock>IPR data is not yet available.</InfoBlock>
          )}
        </div>
      </div>

      {/* ── 5. FAQ Accordion ──────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <SectionHeader
          icon={<MessageCircle size={16} className="text-indigo-500" />}
          title="Frequently Asked Questions"
          subtitle="Common questions about your treatment"
        />
        <div className="divide-y divide-border">
          {FAQ_ITEMS.map((item, idx) => (
            <div key={idx}>
              <button
                onClick={() =>
                  setOpenFaqIndex(openFaqIndex === idx ? null : idx)
                }
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors focus-ring"
                aria-expanded={openFaqIndex === idx}
              >
                <span className="text-sm font-semibold text-foreground pr-4">
                  {item.question}
                </span>
                {openFaqIndex === idx ? (
                  <ChevronUp
                    size={15}
                    className="shrink-0 text-secondary"
                  />
                ) : (
                  <ChevronDown
                    size={15}
                    className="shrink-0 text-secondary"
                  />
                )}
              </button>
              {openFaqIndex === idx && (
                <div className="px-5 pb-4 text-sm text-secondary leading-relaxed border-t border-border/50">
                  <p className="pt-3">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 6. AI Disclaimer ──────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-900/10">
        <AlertTriangle
          size={14}
          className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
        />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <span className="font-semibold">AI-assisted recommendation only.</span>{" "}
          Final treatment decisions remain the responsibility of the licensed
          orthodontist.
        </p>
      </div>
    </div>
  );
}
